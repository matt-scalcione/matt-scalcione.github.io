import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { optimizeTeamLogoManifest } from "./optimize-team-logos.mjs"
import { backfillTeamLogoManifest } from "./backfill-team-logos.mjs"
import { fillTeamLogoFallbacks } from "./fallback-team-logos.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const GENERATED_DIR = path.join(ROOT_DIR, "assets", "team-logos", "generated")
const LOL_DIR = path.join(GENERATED_DIR, "lol")
const DOTA_DIR = path.join(GENERATED_DIR, "dota2")
const MANIFEST_JSON_PATH = path.join(ROOT_DIR, "assets", "team-logos", "manifest.json")
const MANIFEST_JS_PATH = path.join(ROOT_DIR, "team-logos.generated.js")

const LOL_API_BASE_URL =
  process.env.LOL_ESPORTS_API_BASE_URL || "https://esports-api.lolesports.com/persisted/gw"
const LOL_API_KEY =
  process.env.LOL_ESPORTS_API_KEY || "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"
const OPENDOTA_BASE_URL = process.env.OPENDOTA_BASE_URL || "https://api.opendota.com/api"
const CONCURRENCY = clampInt(Number.parseInt(process.env.TEAM_LOGO_SYNC_CONCURRENCY || "12", 10), 2, 24, 12)

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

function normalizeImageUrl(value) {
  const raw = String(value || "").trim()
  if (!raw) {
    return null
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw
  }
  return null
}

function extensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase()
  if (normalized.includes("image/png")) return ".png"
  if (normalized.includes("image/jpeg")) return ".jpg"
  if (normalized.includes("image/webp")) return ".webp"
  if (normalized.includes("image/svg+xml")) return ".svg"
  if (normalized.includes("image/gif")) return ".gif"
  return null
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname
  const ext = path.extname(pathname).toLowerCase()
  return ext && ext.length <= 5 ? ext : null
}

function extensionFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    return null
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return ".png"
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg"
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return ".gif"
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return ".webp"
  }
  if (buffer.subarray(0, 256).toString("utf8").includes("<svg")) {
    return ".svg"
  }
  return null
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`)
  }
  return response.json()
}

async function fetchLolTeams() {
  const url = `${LOL_API_BASE_URL}/getTeams?hl=en-US`
  const payload = await fetchJson(url, {
    headers: {
      "x-api-key": LOL_API_KEY
    }
  })

  const rows = Array.isArray(payload?.data?.teams) ? payload.data.teams : []
  return rows
    .map((row) => ({
      game: "lol",
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      code: String(row?.code || "").trim() || null,
      imageUrl: normalizeImageUrl(row?.image || row?.alternativeImage)
    }))
    .filter((row) => row.id && row.name && row.imageUrl)
}

async function fetchDotaTeams() {
  const payload = await fetchJson(`${OPENDOTA_BASE_URL}/teams`)
  const rows = Array.isArray(payload) ? payload : []
  return rows
    .map((row) => ({
      game: "dota2",
      id: String(row?.team_id || "").trim(),
      name: String(row?.name || "").trim(),
      code: String(row?.tag || "").trim() || null,
      imageUrl: normalizeImageUrl(row?.logo_url)
    }))
    .filter((row) => row.id && row.name && row.imageUrl)
}

async function ensureDirectories() {
  await fs.rm(GENERATED_DIR, { recursive: true, force: true })
  await fs.mkdir(LOL_DIR, { recursive: true })
  await fs.mkdir(DOTA_DIR, { recursive: true })
}

async function asyncPool(items, limit, worker) {
  const queue = items.slice()
  const runners = Array.from({ length: Math.min(limit, queue.length || 1) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      await worker(item)
    }
  })
  await Promise.all(runners)
}

async function downloadLogos(rows) {
  const manifest = {
    updatedAt: new Date().toISOString(),
    counts: {
      lol: 0,
      dota2: 0
    },
    byGameAndId: {},
    byGameAndName: {},
    byGameAndAlias: {}
  }

  const urlToPath = new Map()
  const failures = []

  await asyncPool(rows, CONCURRENCY, async (row) => {
    try {
      let relativePath = urlToPath.get(row.imageUrl) || null

      if (!relativePath) {
        const response = await fetch(row.imageUrl)
        if (!response.ok) {
          throw new Error(`Image request failed ${response.status}`)
        }

        const contentType = response.headers.get("content-type")
        const buffer = Buffer.from(await response.arrayBuffer())
        const extension =
          extensionFromContentType(contentType) || extensionFromUrl(row.imageUrl) || extensionFromBuffer(buffer) || ".png"
        const filename = `${slugify(row.name)}-${row.id}${extension}`
        const relativeFile = path.join("assets", "team-logos", "generated", row.game, filename)
        const absoluteFile = path.join(ROOT_DIR, relativeFile)
        await fs.writeFile(absoluteFile, buffer)
        relativePath = `./${relativeFile.split(path.sep).join("/")}`
        urlToPath.set(row.imageUrl, relativePath)
      }

      const record = {
        id: row.id,
        name: row.name,
        code: row.code,
        path: relativePath
      }
      manifest.byGameAndId[`${row.game}:${row.id}`] = record
      manifest.byGameAndName[`${row.game}:${normalizeTeamLogoKey(row.name)}`] = record
      const aliasKey = normalizeAliasKey(row.name)
      if (aliasKey) {
        manifest.byGameAndAlias[`${row.game}:${aliasKey}`] = record
      }
      manifest.counts[row.game] = Number(manifest.counts[row.game] || 0) + 1
    } catch (error) {
      failures.push({
        game: row.game,
        id: row.id,
        name: row.name,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  })

  return {
    manifest,
    failures
  }
}

async function writeManifest(manifest) {
  await fs.writeFile(MANIFEST_JSON_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(
    MANIFEST_JS_PATH,
    `export const TEAM_LOGO_MANIFEST = ${JSON.stringify(manifest, null, 2)}\n\nexport default TEAM_LOGO_MANIFEST\n`
  )
}

async function main() {
  await ensureDirectories()
  const [lolRows, dotaRows] = await Promise.all([fetchLolTeams(), fetchDotaTeams()])
  const { manifest, failures } = await downloadLogos([...lolRows, ...dotaRows])
  await writeManifest(manifest)
  const optimization = await optimizeTeamLogoManifest()
  const backfill = await backfillTeamLogoManifest()
  const fallback = await fillTeamLogoFallbacks()

  process.stdout.write(
    `Synced team logos. LoL ${fallback.manifest.counts.lol} · Dota ${fallback.manifest.counts.dota2} · Failures ${failures.length} · Backfilled ${backfill.applied} · Fallbacks ${fallback.created} · ${(
      optimization.bytesBefore /
      1024 /
      1024
    ).toFixed(2)} MB -> ${(optimization.bytesAfter / 1024 / 1024).toFixed(2)} MB\n`
  )

  if (failures.length) {
    const sample = failures.slice(0, 10)
    process.stdout.write(`${JSON.stringify(sample, null, 2)}\n`)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exitCode = 1
})
