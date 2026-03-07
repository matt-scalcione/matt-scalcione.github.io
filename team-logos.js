import { TEAM_LOGO_MANIFEST } from "./team-logos.generated.js"

const STATIC_TEAM_LOGO_OVERRIDES = {
  "lol:cloud9": {
    code: "C9",
    path: "./assets/team-logos/cloud9.png"
  },
  "lol:red canids": {
    code: "RED",
    path: "./assets/team-logos/red-canids.png"
  },
  "lol:red canids kalunga": {
    code: "RED",
    path: "./assets/team-logos/red-canids.png"
  }
}

function normalizeGameKey(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "dota" || raw === "dota2") {
    return "dota2"
  }
  if (raw === "lol" || raw === "league" || raw === "leagueoflegends") {
    return "lol"
  }
  return raw || null
}

export function normalizeTeamLogoKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normalizeAliasTeamLogoKey(value) {
  return normalizeTeamLogoKey(value)
    .replace(/\b(esports?|e-sports?|gaming|club|kia|honda|kalunga)\b/gi, " ")
    .replace(/\bteam\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function lookupLogoRecord({ game, id, name } = {}) {
  const normalizedGame = normalizeGameKey(game)
  const byId = TEAM_LOGO_MANIFEST?.byGameAndId || {}
  const byName = TEAM_LOGO_MANIFEST?.byGameAndName || {}
  const byAlias = TEAM_LOGO_MANIFEST?.byGameAndAlias || {}

  if (normalizedGame && id !== undefined && id !== null && String(id).trim()) {
    const record = byId[`${normalizedGame}:${String(id).trim()}`]
    if (record) {
      return record
    }
  }

  const normalizedName = normalizeTeamLogoKey(name)
  if (normalizedGame && normalizedName) {
    const record = byName[`${normalizedGame}:${normalizedName}`]
    if (record) {
      return record
    }

    const aliasRecord = byAlias[`${normalizedGame}:${normalizeAliasTeamLogoKey(name)}`]
    if (aliasRecord) {
      return aliasRecord
    }

    const staticRecord =
      STATIC_TEAM_LOGO_OVERRIDES[`${normalizedGame}:${normalizedName}`] ||
      STATIC_TEAM_LOGO_OVERRIDES[`${normalizedGame}:${normalizeAliasTeamLogoKey(name)}`]
    if (staticRecord) {
      return {
        id: null,
        name,
        code: staticRecord.code,
        path: staticRecord.path
      }
    }
  }

  return null
}

export function resolveLocalTeamLogo({ game, id, name } = {}) {
  return lookupLogoRecord({ game, id, name })?.path || null
}

export function resolveLocalTeamCode({ game, id, name, code } = {}) {
  const rawCode = String(code || "").trim()
  if (rawCode) {
    return rawCode
  }
  return lookupLogoRecord({ game, id, name })?.code || null
}

export function resolveLocalTeamMeta({ game, id, name, code } = {}) {
  const record = lookupLogoRecord({ game, id, name })
  return {
    code: String(code || "").trim() || record?.code || null,
    logoUrl: record?.path || null
  }
}
