import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resolveLocalTeamMeta } from "../team-logos.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const REPORT_PATH = path.join(ROOT_DIR, "reports", "team-logo-coverage.json")
const DEFAULT_API_CANDIDATES = [
  process.env.PULSEBOARD_API_BASE || "",
  "https://pulseboard-api.onrender.com",
  "https://pulseboard-api-drq0.onrender.com"
].filter(Boolean)
const LOL_API_URL = "https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-US"
const LOL_API_KEY = process.env.LOL_ESPORTS_API_KEY || "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"
const OPENDOTA_API_URL = "https://api.opendota.com/api/teams"

function normalizeTeamLogoKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function uniqueTeams(entries) {
  const map = new Map()
  for (const entry of entries) {
    const key = `${entry.game}:${String(entry.id || "").trim()}:${normalizeTeamLogoKey(entry.name)}`
    if (!map.has(key)) {
      map.set(key, entry)
    }
  }
  return [...map.values()]
}

function assetBucket(meta) {
  const pathValue = String(meta?.logoUrl || "")
  if (!pathValue) return "missing"
  if (pathValue.includes("/manual/")) return "manual"
  if (pathValue.includes("/fallback/")) return "fallback"
  if (pathValue.includes("/generated/")) return "generated"
  return "static"
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

async function fetchLolSourceTeams() {
  const payload = await fetchJson(LOL_API_URL, {
    headers: {
      "x-api-key": LOL_API_KEY
    }
  })
  return uniqueTeams(
    (Array.isArray(payload?.data?.teams) ? payload.data.teams : []).map((row) => ({
      source: "riotTeams",
      game: "lol",
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      code: String(row?.code || "").trim() || null
    }))
  )
}

async function fetchDotaSourceTeams() {
  const payload = await fetchJson(OPENDOTA_API_URL)
  return uniqueTeams(
    (Array.isArray(payload) ? payload : [])
      .map((row) => ({
        source: "openDotaTeams",
        game: "dota2",
        id: String(row?.team_id || "").trim(),
        name: String(row?.name || "").trim(),
        code: String(row?.tag || "").trim() || null
      }))
      .filter((row) => row.id && row.name)
  )
}

function normalizeCollectionRows(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

async function fetchPulseboardCollections(apiBase) {
  if (!apiBase) {
    return []
  }
  const configs = [
    { source: "pulseboardLiveLol", game: "lol", url: `${apiBase}/v1/live-matches?game=lol` },
    { source: "pulseboardScheduleLol", game: "lol", url: `${apiBase}/v1/schedule?game=lol&days_forward=7&days_back=0` },
    { source: "pulseboardResultsLol", game: "lol", url: `${apiBase}/v1/results?game=lol&days_forward=1&days_back=7` },
    { source: "pulseboardLiveDota", game: "dota2", url: `${apiBase}/v1/live-matches?game=dota2` },
    { source: "pulseboardScheduleDota", game: "dota2", url: `${apiBase}/v1/schedule?game=dota2&days_forward=7&days_back=0&dota_tiers=1,2,3,4` },
    { source: "pulseboardResultsDota", game: "dota2", url: `${apiBase}/v1/results?game=dota2&days_forward=1&days_back=7&dota_tiers=1,2,3,4` }
  ]

  const collections = []
  for (const config of configs) {
    const payload = await fetchJson(config.url)
    const rows = normalizeCollectionRows(payload)
    const entries = []
    for (const row of rows) {
      for (const side of ["left", "right"]) {
        const team = row?.teams?.[side]
        if (!team?.name) {
          continue
        }
        entries.push({
          source: config.source,
          game: config.game,
          id: String(team.id || "").trim(),
          name: String(team.name || "").trim(),
          code: String(team.code || "").trim() || null
        })
      }
    }
    collections.push({
      source: config.source,
      game: config.game,
      entries: uniqueTeams(entries)
    })
  }
  return collections
}

function analyzeEntries(entries) {
  const unresolved = []
  const buckets = {
    generated: 0,
    manual: 0,
    fallback: 0,
    static: 0,
    missing: 0
  }

  for (const entry of entries) {
    const meta = resolveLocalTeamMeta(entry)
    const bucket = assetBucket(meta)
    buckets[bucket] = Number(buckets[bucket] || 0) + 1
    if (bucket === "missing") {
      unresolved.push({
        id: entry.id || null,
        name: entry.name,
        code: entry.code || null
      })
    }
  }

  return {
    total: entries.length,
    resolved: entries.length - unresolved.length,
    unresolved: unresolved.length,
    bucketCounts: buckets,
    unresolvedTeams: unresolved.slice(0, 100)
  }
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
}

async function main() {
  const apiBase = await resolvePulseboardApiBase()
  const [lolSource, dotaSource, pulseboardCollections] = await Promise.all([
    fetchLolSourceTeams(),
    fetchDotaSourceTeams(),
    fetchPulseboardCollections(apiBase)
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    apiBase,
    sources: {
      riotTeams: analyzeEntries(lolSource),
      openDotaTeams: analyzeEntries(dotaSource)
    },
    collections: {}
  }

  for (const collection of pulseboardCollections) {
    report.collections[collection.source] = analyzeEntries(collection.entries)
  }

  await writeReport(report)

  process.stdout.write(
    [
      `Team logo coverage report written to ${path.relative(ROOT_DIR, REPORT_PATH)}`,
      `Riot teams: ${report.sources.riotTeams.resolved}/${report.sources.riotTeams.total} resolved`,
      `OpenDota teams: ${report.sources.openDotaTeams.resolved}/${report.sources.openDotaTeams.total} resolved`,
      ...Object.entries(report.collections).map(
        ([key, value]) => `${key}: ${value.resolved}/${value.total} resolved`
      )
    ].join("\n") + "\n"
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exitCode = 1
})
