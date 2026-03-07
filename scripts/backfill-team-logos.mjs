import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const MANIFEST_JSON_PATH = path.join(ROOT_DIR, "assets", "team-logos", "manifest.json")
const MANIFEST_JS_PATH = path.join(ROOT_DIR, "team-logos.generated.js")
const MANUAL_DIR = path.join(ROOT_DIR, "assets", "team-logos", "manual")
const MAX_DIMENSION = clampInt(Number.parseInt(process.env.TEAM_LOGO_MAX_DIMENSION || "256", 10), 64, 512, 256)
const WEBP_QUALITY = clampInt(Number.parseInt(process.env.TEAM_LOGO_WEBP_QUALITY || "90", 10), 50, 100, 90)
const REQUEST_HEADERS = {
  "user-agent": "PulseboardBot/1.0 (contact: admin@example.com)"
}

const MANUAL_BACKFILLS = [
  {
    game: "dota2",
    id: "9131584",
    name: "BB Team",
    code: "BB",
    reuseFrom: {
      game: "dota2",
      id: "8255888"
    }
  },
  {
    game: "dota2",
    id: "6209166",
    name: "Team Aster",
    code: "Aster",
    sourceUrl: "https://liquipedia.net/commons/images/e/e7/Team_Aster_allmode.png"
  },
  {
    game: "dota2",
    id: "7424172",
    name: "T1",
    code: "T1",
    sourceUrl: "https://liquipedia.net/commons/images/e/e4/T1_2019_allmode.png"
  },
  {
    game: "dota2",
    id: "9594647",
    name: "PuckChamp",
    code: "PC",
    sourceUrl: "https://liquipedia.net/commons/images/c/ce/PuckChamp_202111_allmode.png"
  },
  {
    game: "dota2",
    id: "9080405",
    name: "Team Zero",
    code: "Tz",
    sourceUrl: "https://liquipedia.net/commons/images/1/10/Team_Zero_full_lightmode.png"
  }
]

function clampInt(value, min, max, fallback) {
  if (!Number.isInteger(value)) {
    return fallback
  }
  return Math.min(Math.max(value, min), max)
}

function normalizeTeamLogoKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normalizeAliasKey(value) {
  return normalizeTeamLogoKey(value)
    .replace(/\b(esports?|e-sports?|gaming|club|kia|honda|kalunga)\b/gi, " ")
    .replace(/\bteam\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function slugify(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "team"
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase()
  if (normalized.includes("image/png")) return ".png"
  if (normalized.includes("image/jpeg")) return ".jpg"
  if (normalized.includes("image/webp")) return ".webp"
  if (normalized.includes("image/svg+xml")) return ".svg"
  if (normalized.includes("image/gif")) return ".gif"
  return ".img"
}

function extensionFromUrl(value) {
  try {
    const ext = path.extname(new URL(value).pathname).toLowerCase()
    return ext && ext.length <= 5 ? ext : null
  } catch {
    return null
  }
}

async function readManifest() {
  return JSON.parse(await fs.readFile(MANIFEST_JSON_PATH, "utf8"))
}

async function writeManifest(manifest) {
  await fs.writeFile(MANIFEST_JSON_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(
    MANIFEST_JS_PATH,
    `export const TEAM_LOGO_MANIFEST = ${JSON.stringify(manifest, null, 2)}\n\nexport default TEAM_LOGO_MANIFEST\n`
  )
}

async function imageDimensions(absoluteFile) {
  const { stdout } = await execFileAsync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", absoluteFile], {
    maxBuffer: 1024 * 1024
  })
  const widthMatch = stdout.match(/pixelWidth:\s*(\d+)/)
  const heightMatch = stdout.match(/pixelHeight:\s*(\d+)/)
  return {
    width: widthMatch ? Number.parseInt(widthMatch[1], 10) : 0,
    height: heightMatch ? Number.parseInt(heightMatch[1], 10) : 0
  }
}

function targetDimensions(width, height) {
  const safeWidth = Number(width || 0)
  const safeHeight = Number(height || 0)
  if (safeWidth <= 0 || safeHeight <= 0) {
    return {
      width: MAX_DIMENSION,
      height: MAX_DIMENSION
    }
  }

  const largest = Math.max(safeWidth, safeHeight)
  if (largest <= MAX_DIMENSION) {
    return {
      width: safeWidth,
      height: safeHeight
    }
  }

  if (safeWidth >= safeHeight) {
    return {
      width: MAX_DIMENSION,
      height: Math.max(1, Math.round((safeHeight * MAX_DIMENSION) / safeWidth))
    }
  }

  return {
    width: Math.max(1, Math.round((safeWidth * MAX_DIMENSION) / safeHeight)),
    height: MAX_DIMENSION
  }
}

async function ensureDirectory(absoluteDir) {
  await fs.mkdir(absoluteDir, { recursive: true })
}

async function downloadToTempFile(sourceUrl) {
  const ext = extensionFromUrl(sourceUrl) || extensionFromContentType(null)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pulseboard-team-logo-"))
  const tempFile = path.join(tempDir, `source${ext}`)
  await execFileAsync(
    "curl",
    [
      "--compressed",
      "-L",
      "-sS",
      "-A",
      REQUEST_HEADERS["user-agent"],
      "-o",
      tempFile,
      sourceUrl
    ],
    {
      maxBuffer: 1024 * 1024
    }
  )
  return {
    tempDir,
    tempFile
  }
}

async function optimizeRemoteLogoToLocalWebp(entry) {
  const relativeFile = path.join("assets", "team-logos", "manual", entry.game, `${slugify(entry.name)}-${entry.id}.webp`)
  const absoluteFile = path.join(ROOT_DIR, relativeFile)
  await ensureDirectory(path.dirname(absoluteFile))

  const { tempDir, tempFile } = await downloadToTempFile(entry.sourceUrl)
  try {
    const dims = await imageDimensions(tempFile)
    const nextDims = targetDimensions(dims.width, dims.height)
    await execFileAsync(
      "cwebp",
      [
        "-quiet",
        "-q",
        String(WEBP_QUALITY),
        "-alpha_q",
        "100",
        "-m",
        "6",
        "-resize",
        String(nextDims.width),
        String(nextDims.height),
        tempFile,
        "-o",
        absoluteFile
      ],
      {
        maxBuffer: 1024 * 1024
      }
    )
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }

  return `./${relativeFile.split(path.sep).join("/")}`
}

function resolveReusePath(manifest, entry) {
  const byId = manifest?.byGameAndId || {}
  if (entry?.reuseFrom?.game && entry?.reuseFrom?.id) {
    const record = byId[`${entry.reuseFrom.game}:${entry.reuseFrom.id}`]
    if (record?.path) {
      return record.path
    }
  }
  throw new Error(`Could not resolve reuse path for ${entry.name}`)
}

function upsertManifestRecord(manifest, entry, relativePath) {
  const record = {
    id: String(entry.id).trim(),
    name: String(entry.name).trim(),
    code: entry.code || null,
    path: relativePath
  }

  manifest.byGameAndId[`${entry.game}:${record.id}`] = record
  manifest.byGameAndName[`${entry.game}:${normalizeTeamLogoKey(record.name)}`] = record

  const aliasKey = normalizeAliasKey(record.name)
  if (aliasKey) {
    manifest.byGameAndAlias[`${entry.game}:${aliasKey}`] = record
  }
}

function rebuildCounts(manifest) {
  const counts = {
    lol: 0,
    dota2: 0
  }

  for (const key of Object.keys(manifest?.byGameAndId || {})) {
    const [game] = key.split(":")
    counts[game] = Number(counts[game] || 0) + 1
  }

  manifest.counts = counts
}

export async function backfillTeamLogoManifest() {
  const manifest = await readManifest()
  let applied = 0

  for (const entry of MANUAL_BACKFILLS) {
    const relativePath = entry.sourceUrl
      ? await optimizeRemoteLogoToLocalWebp(entry)
      : resolveReusePath(manifest, entry)
    upsertManifestRecord(manifest, entry, relativePath)
    applied += 1
  }

  manifest.updatedAt = new Date().toISOString()
  rebuildCounts(manifest)
  await writeManifest(manifest)

  return {
    manifest,
    applied
  }
}

async function main() {
  const result = await backfillTeamLogoManifest()
  process.stdout.write(
    `Backfilled team logos. LoL ${result.manifest.counts.lol} · Dota ${result.manifest.counts.dota2} · Applied ${result.applied}\n`
  )
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
