import fs from "node:fs/promises"
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
const MAX_DIMENSION = clampInt(Number.parseInt(process.env.TEAM_LOGO_MAX_DIMENSION || "256", 10), 64, 512, 256)
const WEBP_QUALITY = clampInt(Number.parseInt(process.env.TEAM_LOGO_WEBP_QUALITY || "90", 10), 50, 100, 90)

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

async function readManifest() {
  return JSON.parse(await fs.readFile(MANIFEST_JSON_PATH, "utf8"))
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
    return { width: MAX_DIMENSION, height: MAX_DIMENSION }
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

function isRasterExtension(ext) {
  const normalized = String(ext || "").toLowerCase()
  return normalized === ".png" || normalized === ".jpg" || normalized === ".jpeg" || normalized === ".gif" || normalized === ".webp"
}

async function optimizeFilePath(relativePath) {
  const normalizedPath = String(relativePath || "").trim()
  if (!normalizedPath) {
    return null
  }

  const webpSiblingPath = normalizedPath.replace(/\.[^.]+$/i, ".webp")
  const webpSiblingAbsolute = path.join(ROOT_DIR, webpSiblingPath.replace(/^\.\//, ""))
  const absolutePath = path.join(ROOT_DIR, normalizedPath.replace(/^\.\//, ""))

  let inputPath = normalizedPath
  let inputAbsolutePath = absolutePath

  try {
    await fs.access(inputAbsolutePath)
  } catch {
    try {
      await fs.access(webpSiblingAbsolute)
      inputPath = webpSiblingPath
      inputAbsolutePath = webpSiblingAbsolute
    } catch {
      throw new Error(`Missing source asset ${normalizedPath}`)
    }
  }

  const ext = path.extname(inputPath).toLowerCase()
  const sourceStats = await fs.stat(inputAbsolutePath)

  if (!isRasterExtension(ext)) {
    return {
      nextPath: inputPath,
      bytesBefore: sourceStats.size,
      bytesAfter: sourceStats.size
    }
  }

  if (ext === ".webp") {
    return {
      nextPath: inputPath,
      bytesBefore: sourceStats.size,
      bytesAfter: sourceStats.size
    }
  }

  const dims = await imageDimensions(inputAbsolutePath)
  const nextDims = targetDimensions(dims.width, dims.height)
  const nextRelativePath = inputPath.replace(/\.[^.]+$/i, ".webp")
  const nextAbsolutePath = path.join(ROOT_DIR, nextRelativePath.replace(/^\.\//, ""))

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
      inputAbsolutePath,
      "-o",
      nextAbsolutePath
    ],
    { maxBuffer: 1024 * 1024 }
  )

  if (nextAbsolutePath !== inputAbsolutePath) {
    await fs.rm(inputAbsolutePath, { force: true })
  }

  const nextStats = await fs.stat(nextAbsolutePath)
  return {
    nextPath: nextRelativePath,
    bytesBefore: sourceStats.size,
    bytesAfter: nextStats.size
  }
}

async function optimizeRecordPath(record, nextPath, bytesBefore, bytesAfter) {
  const relativePath = String(record?.path || "").trim()
  if (!relativePath) {
    return record
  }
  return {
    ...record,
    path: nextPath || relativePath,
    bytesBefore,
    bytesAfter
  }
}

function rebuildManifest(records) {
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

  for (const entry of records) {
    const game = String(entry?.game || "").trim()
    const id = String(entry?.id || "").trim()
    const name = String(entry?.name || "").trim()
    if (!game || !id || !name || !entry?.path) {
      continue
    }

    const record = {
      id,
      name,
      code: entry?.code || null,
      path: entry.path
    }
    manifest.byGameAndId[`${game}:${id}`] = record
    manifest.byGameAndName[`${game}:${normalizeTeamLogoKey(name)}`] = record
    const aliasKey = normalizeAliasKey(name)
    if (aliasKey) {
      manifest.byGameAndAlias[`${game}:${aliasKey}`] = record
    }
    manifest.counts[game] = Number(manifest.counts[game] || 0) + 1
  }

  return manifest
}

async function writeManifest(manifest) {
  await fs.writeFile(MANIFEST_JSON_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(
    MANIFEST_JS_PATH,
    `export const TEAM_LOGO_MANIFEST = ${JSON.stringify(manifest, null, 2)}\n\nexport default TEAM_LOGO_MANIFEST\n`
  )
}

export async function optimizeTeamLogoManifest() {
  const current = await readManifest()
  const uniqueRecords = Object.entries(current?.byGameAndId || {}).map(([key, value]) => {
    const [game, id] = key.split(":")
    return {
      game,
      id,
      name: value?.name || "",
      code: value?.code || null,
      path: value?.path || null
    }
  })

  const optimized = []
  let bytesBefore = 0
  let bytesAfter = 0
  const pathMap = new Map()

  for (const record of uniqueRecords) {
    const key = String(record?.path || "").trim()
    if (!key || pathMap.has(key)) {
      continue
    }
    const fileResult = await optimizeFilePath(key)
    pathMap.set(key, fileResult)
    bytesBefore += Number(fileResult?.bytesBefore || 0)
    bytesAfter += Number(fileResult?.bytesAfter || 0)
  }

  for (const record of uniqueRecords) {
    const fileResult = pathMap.get(String(record?.path || "").trim())
    const next = await optimizeRecordPath(
      record,
      fileResult?.nextPath || record?.path || null,
      fileResult?.bytesBefore || 0,
      fileResult?.bytesAfter || 0
    )
    optimized.push(next)
  }

  const manifest = rebuildManifest(optimized)
  await writeManifest(manifest)
  return {
    manifest,
    bytesBefore,
    bytesAfter
  }
}

async function main() {
  const { manifest, bytesBefore, bytesAfter } = await optimizeTeamLogoManifest()
  const savedPct = bytesBefore > 0 ? ((bytesBefore - bytesAfter) / bytesBefore) * 100 : 0
  process.stdout.write(
    `Optimized team logos. LoL ${manifest.counts.lol} · Dota ${manifest.counts.dota2} · ${(
      bytesBefore /
      1024 /
      1024
    ).toFixed(2)} MB -> ${(bytesAfter / 1024 / 1024).toFixed(2)} MB (${savedPct.toFixed(1)}% saved)\n`
  )
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
