import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const MANIFEST_JSON_PATH = path.join(ROOT_DIR, "assets", "team-logos", "manifest.json")
const MANIFEST_JS_PATH = path.join(ROOT_DIR, "team-logos.generated.js")
const FALLBACK_DIR = path.join(ROOT_DIR, "assets", "team-logos", "fallback")
const DEFAULT_API_CANDIDATES = [
  process.env.PULSEBOARD_API_BASE || "",
  "https://pulseboard-api.onrender.com",
  "https://pulseboard-api-drq0.onrender.com"
].filter(Boolean)

const PALETTE = [
  ["#0f172a", "#1d4ed8", "#bfdbfe"],
  ["#1f2937", "#7c3aed", "#e9d5ff"],
  ["#111827", "#dc2626", "#fecaca"],
  ["#172554", "#0891b2", "#bae6fd"],
  ["#3f0d12", "#e11d48", "#fecdd3"],
  ["#052e16", "#16a34a", "#bbf7d0"],
  ["#431407", "#ea580c", "#fed7aa"],
  ["#27272a", "#d97706", "#fde68a"]
]

function normalizeGameKey(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "dota" || raw === "dota2") return "dota2"
  if (raw === "lol" || raw === "league" || raw === "leagueoflegends") return "lol"
  return raw || null
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

function hashString(value) {
  let hash = 0
  for (const char of String(value || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash >>> 0
}

function deriveBadgeText({ name, code }) {
  const rawCode = String(code || "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
  if (rawCode && rawCode.length <= 4) {
    return rawCode
  }

  const words = String(name || "")
    .replace(/["'.]/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!words.length) {
    return "PB"
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase()
  }

  return words
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function gameLabel(game) {
  return normalizeGameKey(game) === "lol" ? "LOL" : "D2"
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildFallbackSvg(entry) {
  const hash = hashString(`${entry.game}:${entry.id}:${entry.name}`)
  const [bg, accent, textTone] = PALETTE[hash % PALETTE.length]
  const badge = escapeXml(deriveBadgeText(entry))
  const label = escapeXml(gameLabel(entry.game))
  const title = escapeXml(entry.name)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${title} fallback team badge</desc>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
  </defs>
  <rect x="12" y="12" width="232" height="232" rx="52" fill="url(#bg)" />
  <rect x="26" y="26" width="204" height="204" rx="40" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" />
  <text x="128" y="128" text-anchor="middle" dominant-baseline="central" fill="${textTone}" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="700" letter-spacing="2">${badge}</text>
  <text x="128" y="198" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4">${label}</text>
</svg>
`
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`)
  }
  return response.json()
}

async function resolvePulseboardApiBase() {
  for (const candidate of DEFAULT_API_CANDIDATES) {
    try {
      const payload = await fetchJson(`${candidate}/health`)
      if (payload) {
        return candidate.replace(/\/$/, "")
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

async function fetchOpenDotaCandidates() {
  const rows = await fetchJson("https://api.opendota.com/api/teams")
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      game: "dota2",
      id: String(row?.team_id || "").trim(),
      name: String(row?.name || "").trim(),
      code: String(row?.tag || "").trim() || null
    }))
    .filter((row) => row.id && row.name)
}

function normalizeCollectionRows(payload) {
  if (Array.isArray(payload)) {
    return payload
  }
  if (Array.isArray(payload?.data)) {
    return payload.data
  }
  return []
}

async function fetchPulseboardCandidates(apiBase) {
  if (!apiBase) {
    return []
  }

  const urls = [
    `${apiBase}/v1/live-matches?game=dota2`,
    `${apiBase}/v1/schedule?game=dota2&days_forward=7&days_back=0&dota_tiers=1,2,3,4`,
    `${apiBase}/v1/results?game=dota2&days_forward=1&days_back=7&dota_tiers=1,2,3,4`
  ]

  const entries = []
  for (const url of urls) {
    const payload = await fetchJson(url)
    const rows = normalizeCollectionRows(payload)
    for (const row of rows) {
      for (const side of ["left", "right"]) {
        const team = row?.teams?.[side]
        if (!team?.name) {
          continue
        }
        entries.push({
          game: "dota2",
          id: String(team.id || "").trim(),
          name: String(team.name || "").trim(),
          code: String(team.code || "").trim() || null
        })
      }
    }
  }

  return entries.filter((row) => row.name)
}

function hasManifestRecord(manifest, entry) {
  const game = normalizeGameKey(entry.game)
  const id = String(entry.id || "").trim()
  const name = normalizeTeamLogoKey(entry.name)
  if (!game || !name) {
    return true
  }

  if (id && manifest?.byGameAndId?.[`${game}:${id}`]) {
    return true
  }
  if (manifest?.byGameAndName?.[`${game}:${name}`]) {
    return true
  }

  const alias = normalizeAliasKey(entry.name)
  if (alias && manifest?.byGameAndAlias?.[`${game}:${alias}`]) {
    return true
  }

  return false
}

async function writeFallbackFile(entry) {
  const relativeFile = path.join("assets", "team-logos", "fallback", entry.game, `${slugify(entry.name)}-${entry.id || "name"}.svg`)
  const absoluteFile = path.join(ROOT_DIR, relativeFile)
  await fs.mkdir(path.dirname(absoluteFile), { recursive: true })
  await fs.writeFile(absoluteFile, buildFallbackSvg(entry), "utf8")
  return `./${relativeFile.split(path.sep).join("/")}`
}

function upsertManifestRecord(manifest, entry, relativePath) {
  const game = normalizeGameKey(entry.game)
  const id = String(entry.id || "").trim()
  const name = String(entry.name || "").trim()
  if (!game || !name) {
    return
  }

  const record = {
    id,
    name,
    code: entry.code || null,
    path: relativePath
  }
  if (id) {
    manifest.byGameAndId[`${game}:${id}`] = record
  }
  manifest.byGameAndName[`${game}:${normalizeTeamLogoKey(name)}`] = record

  const aliasKey = normalizeAliasKey(name)
  if (aliasKey) {
    manifest.byGameAndAlias[`${game}:${aliasKey}`] = record
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

function uniqueEntries(entries) {
  const map = new Map()
  for (const entry of entries) {
    const key = `${normalizeGameKey(entry.game) || entry.game}:${String(entry.id || "").trim()}:${normalizeTeamLogoKey(entry.name)}`
    if (!map.has(key)) {
      map.set(key, entry)
    }
  }
  return [...map.values()]
}

export async function fillTeamLogoFallbacks() {
  const manifest = await readManifest()
  const apiBase = await resolvePulseboardApiBase()
  const [openDotaEntries, pulseboardEntries] = await Promise.all([
    fetchOpenDotaCandidates(),
    fetchPulseboardCandidates(apiBase)
  ])

  let created = 0
  for (const entry of uniqueEntries([...openDotaEntries, ...pulseboardEntries])) {
    if (hasManifestRecord(manifest, entry)) {
      continue
    }
    const relativePath = await writeFallbackFile(entry)
    upsertManifestRecord(manifest, entry, relativePath)
    created += 1
  }

  manifest.updatedAt = new Date().toISOString()
  rebuildCounts(manifest)
  await writeManifest(manifest)

  return {
    manifest,
    created,
    apiBase
  }
}

async function main() {
  const result = await fillTeamLogoFallbacks()
  process.stdout.write(
    `Filled team logo fallbacks. LoL ${result.manifest.counts.lol} · Dota ${result.manifest.counts.dota2} · Created ${result.created}${result.apiBase ? ` · API ${result.apiBase}` : ""}\n`
  )
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
