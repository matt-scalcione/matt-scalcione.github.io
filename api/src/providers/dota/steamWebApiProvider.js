import { fetchJson } from "../shared/http.js";

const STEAM_WEB_API_BASE_URL = process.env.STEAM_WEB_API_BASE_URL || "https://api.steampowered.com";
const STEAM_WEB_API_KEY = String(
  process.env.STEAM_WEB_API_KEY || process.env.STEAM_API_KEY || ""
).trim();
const STEAM_WEB_API_APP_ID = String(process.env.STEAM_WEB_API_APP_ID || "570").trim();
const STEAM_WEB_API_USER_AGENT =
  process.env.STEAM_WEB_API_USER_AGENT || "Pulseboard/1.0 (https://matt-scalcione.github.io)";
const STEAM_LIVE_CACHE_MS = Math.max(
  10000,
  Number.parseInt(process.env.STEAM_DOTA_LIVE_CACHE_MS || "15000", 10)
);
const STEAM_LEAGUE_CACHE_MS = Math.max(
  60000,
  Number.parseInt(process.env.STEAM_DOTA_LEAGUE_CACHE_MS || String(6 * 60 * 60 * 1000), 10)
);

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value) {
  const parsed = toOptionalNumber(value);
  return parsed === null ? 0 : Math.round(parsed);
}

function toIsoFromSeconds(seconds, fallback = Date.now()) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return new Date(fallback).toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

function normalizeSeriesType(seriesType) {
  if (seriesType === 1) return 3;
  if (seriesType === 2) return 5;
  if (seriesType === 3) return 7;
  return 1;
}

function parseLeagueTier(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const tierMap = {
    premium: 1,
    premier: 1,
    tier1: 1,
    professional: 2,
    pro: 2,
    tier2: 2,
    semipro: 3,
    "semi-pro": 3,
    tier3: 3,
    amateur: 4,
    tier4: 4
  };

  if (tierMap[normalized]) {
    return tierMap[normalized];
  }

  if (/^[1-4]$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return null;
}

function inferCompetitiveTier(tournamentName) {
  const normalized = String(tournamentName || "").toLowerCase();
  const tier1Patterns = [
    /dreamleague/,
    /pgl wallachia/,
    /esl one/,
    /blast slam/,
    /the international/,
    /riyadh masters/,
    /fissure universe/,
    /betboom dacha/
  ];
  const tier2Patterns = [/cct /, /\bcct\b/, /epl/, /ultras dota pro league/, /res regional/];
  const tier3Patterns = [/destiny league/, /space league/, /national/, /showmatch/];

  if (tier1Patterns.some((pattern) => pattern.test(normalized))) return 1;
  if (tier2Patterns.some((pattern) => pattern.test(normalized))) return 2;
  if (tier3Patterns.some((pattern) => pattern.test(normalized))) return 3;
  return 2;
}

function isGenericLeagueName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return true;
  }

  return /^league\s+\d+$/i.test(normalized) || /^league$/i.test(normalized);
}

function isGenericTeamName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return true;
  }

  const safe = normalized.toLowerCase();
  return (
    safe === "radiant" ||
    safe === "dire" ||
    safe === "team 1" ||
    safe === "team 2" ||
    safe === "unknown" ||
    /^[.]+$/.test(normalized)
  );
}

function hasTierAllowed(competitiveTier, allowedTiers) {
  if (!Array.isArray(allowedTiers) || allowedTiers.length === 0) {
    return true;
  }

  if (typeof competitiveTier !== "number") {
    return false;
  }

  return allowedTiers.includes(competitiveTier);
}

function firstPresent(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }
    return value;
  }

  return null;
}

function normalizeTeam(team, fallbackName) {
  const teamId = firstPresent(team?.team_id, team?.teamId, team?.id);
  const tag = String(firstPresent(team?.team_tag, team?.tag, team?.abbreviation) || "").trim();
  const name = String(firstPresent(team?.team_name, team?.teamName, team?.name, fallbackName) || fallbackName).trim();

  return {
    id: teamId !== null && teamId !== undefined ? String(teamId) : `steam_${fallbackName.toLowerCase().replace(/\s+/g, "_")}`,
    name: name || fallbackName,
    shortName: tag || null
  };
}

function leagueNameFromMap(leagueId, leagueMap, fallback = null) {
  const normalizedLeagueId = Number.parseInt(String(leagueId || 0), 10);
  if (Number.isInteger(normalizedLeagueId) && leagueMap.has(normalizedLeagueId)) {
    return leagueMap.get(normalizedLeagueId)?.name || fallback;
  }
  return fallback;
}

function leagueTierFromMap(leagueId, leagueMap, fallbackName = null) {
  const normalizedLeagueId = Number.parseInt(String(leagueId || 0), 10);
  if (Number.isInteger(normalizedLeagueId) && leagueMap.has(normalizedLeagueId)) {
    const tier = leagueMap.get(normalizedLeagueId)?.tier;
    if (typeof tier === "number") {
      return tier;
    }
  }

  if (isGenericLeagueName(fallbackName)) {
    return null;
  }

  return inferCompetitiveTier(fallbackName);
}

function normalizeLiveMatch(row, leagueMap) {
  const matchId = toOptionalNumber(firstPresent(row?.match_id, row?.matchId, row?.id));
  if (matchId === null) {
    return null;
  }

  const seriesId = toOptionalNumber(firstPresent(row?.series_id, row?.seriesId));
  const leagueId = toOptionalNumber(firstPresent(row?.league_id, row?.leagueId));
  const tournamentFallback = String(
    firstPresent(row?.league_name, row?.leagueName, row?.league?.name) || ""
  ).trim();
  const tournament =
    leagueNameFromMap(leagueId, leagueMap, tournamentFallback) ||
    tournamentFallback ||
    (leagueId !== null ? `League ${leagueId}` : "Dota 2");
  if (isGenericLeagueName(tournament)) {
    return null;
  }
  const competitiveTier = leagueTierFromMap(leagueId, leagueMap, tournament);
  const updatedAt = toIsoFromSeconds(
    toOptionalNumber(firstPresent(row?.last_update_time, row?.lastUpdateDateTime)),
    Date.now()
  );
  const startAt = toIsoFromSeconds(
    toOptionalNumber(
      firstPresent(row?.start_time, row?.startTime, row?.activate_time, row?.activateTime)
    ),
    Date.now()
  );
  const radiantTeam = normalizeTeam(
    firstPresent(row?.radiant_team, row?.radiantTeam, row?.radiant_team_info) || {},
    "Radiant"
  );
  const direTeam = normalizeTeam(
    firstPresent(row?.dire_team, row?.direTeam, row?.dire_team_info) || {},
    "Dire"
  );
  if (isGenericTeamName(radiantTeam.name) || isGenericTeamName(direTeam.name)) {
    return null;
  }
  const providerMatchId = String(seriesId || matchId);

  return {
    id: `dota_steam_${providerMatchId}`,
    providerMatchId,
    sourceMatchId: String(matchId),
    game: "dota2",
    region: "global",
    tournament,
    status: "live",
    startAt,
    updatedAt,
    bestOf: normalizeSeriesType(toCount(firstPresent(row?.series_type, row?.seriesType))),
    competitiveTier,
    seriesScore: {
      left: toCount(firstPresent(row?.radiant_series_wins, row?.radiantSeriesWins)),
      right: toCount(firstPresent(row?.dire_series_wins, row?.direSeriesWins))
    },
    teams: {
      left: radiantTeam,
      right: direTeam
    },
    keySignal: "provider_steam_live",
    freshness: {
      source: "steam_web_api",
      status: "healthy",
      updatedAt
    },
    source: {
      provider: "steam",
      leagueId: leagueId !== null ? String(leagueId) : null
    }
  };
}

export class SteamWebApiDotaProvider {
  constructor({ timeoutMs = 4500 } = {}) {
    this.timeoutMs = timeoutMs;
    this.liveCache = {
      fetchedAt: 0,
      rows: []
    };
    this.leagueCache = {
      fetchedAt: 0,
      leagues: new Map()
    };
  }

  getCapabilities() {
    return {
      provider: "steam",
      baseUrl: STEAM_WEB_API_BASE_URL,
      appId: STEAM_WEB_API_APP_ID,
      keyConfigured: Boolean(STEAM_WEB_API_KEY),
      liveEnabled: Boolean(STEAM_WEB_API_KEY),
      detailEnabled: false
    };
  }

  buildHeaders() {
    return {
      "user-agent": STEAM_WEB_API_USER_AGENT
    };
  }

  buildMethodUrl(methodName, params = {}) {
    const target = new URL(
      `${String(STEAM_WEB_API_BASE_URL || "").replace(/\/+$/g, "")}/${methodName}/v1`
    );
    target.searchParams.set("key", STEAM_WEB_API_KEY);

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      target.searchParams.set(key, String(value));
    }

    return target.toString();
  }

  async fetchMethod(methodName, params = {}) {
    return fetchJson(this.buildMethodUrl(methodName, params), {
      timeoutMs: this.timeoutMs,
      headers: this.buildHeaders()
    });
  }

  async getLeagueMap() {
    const capabilities = this.getCapabilities();
    if (!capabilities.keyConfigured) {
      return new Map();
    }

    const ageMs = Date.now() - this.leagueCache.fetchedAt;
    if (ageMs <= STEAM_LEAGUE_CACHE_MS && this.leagueCache.leagues.size > 0) {
      return this.leagueCache.leagues;
    }

    try {
      const payload = await this.fetchMethod(`IDOTA2Match_${STEAM_WEB_API_APP_ID}/GetLeagueListing`);
      const rows = Array.isArray(payload?.result?.leagues)
        ? payload.result.leagues
        : Array.isArray(payload?.result?.leagueList)
          ? payload.result.leagueList
          : [];
      const leagues = new Map(
        rows
          .map((row) => {
            const leagueId = Number.parseInt(
              String(firstPresent(row?.leagueid, row?.league_id, row?.leagueId) || ""),
              10
            );
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
              return null;
            }

            const name = String(firstPresent(row?.name, row?.league_name, row?.leagueName) || "").trim();
            return [
              leagueId,
              {
                name: name || `League ${leagueId}`,
                tier: parseLeagueTier(firstPresent(row?.tier, row?.league_tier, row?.leagueTier))
              }
            ];
          })
          .filter(Boolean)
      );
      this.leagueCache = {
        fetchedAt: Date.now(),
        leagues
      };
      return leagues;
    } catch {
      return this.leagueCache.leagues.size > 0 ? this.leagueCache.leagues : new Map();
    }
  }

  async fetchLiveMatches({ allowedTiers = [1, 2, 3, 4] } = {}) {
    const capabilities = this.getCapabilities();
    if (!capabilities.liveEnabled) {
      return [];
    }

    const ageMs = Date.now() - this.liveCache.fetchedAt;
    if (ageMs <= STEAM_LIVE_CACHE_MS && this.liveCache.rows.length > 0) {
      return this.liveCache.rows.filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
    }

    const [payload, leagueMap] = await Promise.all([
      this.fetchMethod(`IDOTA2Match_${STEAM_WEB_API_APP_ID}/GetLiveLeagueGames`),
      this.getLeagueMap()
    ]);
    const games = Array.isArray(payload?.result?.games)
      ? payload.result.games
      : Array.isArray(payload?.result?.matches)
        ? payload.result.matches
        : [];
    const rows = games
      .map((row) => normalizeLiveMatch(row, leagueMap))
      .filter(Boolean);

    this.liveCache = {
      fetchedAt: Date.now(),
      rows
    };

    return rows.filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
  }
}
