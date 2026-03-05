import { fetchJson } from "../shared/http.js";

const OPENDOTA_BASE_URL = process.env.OPENDOTA_BASE_URL || "https://api.opendota.com/api";
const LEAGUE_CACHE_MS = Number.parseInt(process.env.OPENDOTA_LEAGUE_CACHE_MS || "21600000", 10);

function toIsoFromSeconds(seconds, fallback = Date.now()) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return new Date(fallback).toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

function normalizeSeriesType(seriesType) {
  if (seriesType === 1) return 1;
  if (seriesType === 2) return 3;
  if (seriesType === 3) return 5;
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

function isProLiveLeagueMatch(row) {
  return (
    Number(row?.league_id || 0) > 0 &&
    Number(row?.team_id_radiant || 0) > 0 &&
    Number(row?.team_id_dire || 0) > 0
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

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSeriesScore({ leftWins, rightWins, radiantWin }) {
  const left = toOptionalNumber(leftWins);
  const right = toOptionalNumber(rightWins);

  if (left !== null || right !== null) {
    return {
      left: left ?? 0,
      right: right ?? 0
    };
  }

  if (typeof radiantWin === "boolean") {
    return {
      left: radiantWin ? 1 : 0,
      right: radiantWin ? 0 : 1
    };
  }

  return {
    left: 0,
    right: 0
  };
}

function normalizeLiveMatch(row, leagueTierMap) {
  const matchId = row?.match_id;
  if (!matchId || !isProLiveLeagueMatch(row)) {
    return null;
  }

  const leagueId = Number(row?.league_id || 0);
  const competitiveTier = leagueTierMap.get(leagueId) ?? null;
  const tournament = row?.league_name || `League ${leagueId}`;

  return {
    id: `dota_od_live_${matchId}`,
    providerMatchId: String(matchId),
    leagueId,
    competitiveTier,
    game: "dota2",
    region: "global",
    tournament,
    status: "live",
    startAt: toIsoFromSeconds(row?.start_time || row?.activate_time),
    updatedAt: toIsoFromSeconds(row?.last_update_time),
    bestOf: normalizeSeriesType(row?.series_type),
    seriesScore: normalizeSeriesScore({
      leftWins: row?.radiant_series_wins,
      rightWins: row?.dire_series_wins
    }),
    teams: {
      left: {
        id: String(row?.team_id_radiant),
        name: row?.team_name_radiant || "Radiant"
      },
      right: {
        id: String(row?.team_id_dire),
        name: row?.team_name_dire || "Dire"
      }
    },
    keySignal: "provider_pro_live"
  };
}

function normalizeResultMatch(row, leagueTierMap) {
  const matchId = row?.match_id;
  if (!matchId) {
    return null;
  }

  const leagueId = Number(row?.leagueid || row?.league_id || 0);
  if (leagueId <= 0) {
    return null;
  }

  const competitiveTier = leagueTierMap.get(leagueId) ?? null;
  const startSeconds = typeof row?.start_time === "number" ? row.start_time : null;
  const durationSeconds = typeof row?.duration === "number" ? row.duration : 0;
  const endSeconds = startSeconds ? startSeconds + durationSeconds : null;

  const leftId = String(row?.radiant_team_id || `od_radiant_${matchId}`);
  const rightId = String(row?.dire_team_id || `od_dire_${matchId}`);

  return {
    id: `dota_od_result_${matchId}`,
    providerMatchId: String(matchId),
    leagueId,
    competitiveTier,
    game: "dota2",
    region: "global",
    tournament: row?.league_name || `League ${leagueId}`,
    status: "completed",
    startAt: toIsoFromSeconds(startSeconds),
    endAt: toIsoFromSeconds(endSeconds, Date.now()),
    bestOf: normalizeSeriesType(row?.series_type),
    seriesScore: {
      left: row?.radiant_win ? 1 : 0,
      right: row?.radiant_win ? 0 : 1
    },
    teams: {
      left: {
        id: leftId,
        name: row?.radiant_name || "Radiant"
      },
      right: {
        id: rightId,
        name: row?.dire_name || "Dire"
      }
    },
    winnerTeamId: row?.radiant_win ? leftId : rightId
  };
}

function parseProviderMatchId(matchId) {
  if (!matchId) return null;

  const parts = String(matchId).split("_");
  const tail = parts[parts.length - 1];
  return /^\d+$/.test(tail) ? tail : null;
}

function normalizeMatchDetail(payload, fallbackId, leagueTierMap) {
  const providerMatchId = payload?.match_id || parseProviderMatchId(fallbackId);
  if (!providerMatchId) {
    return null;
  }

  const leagueId = Number(payload?.leagueid || payload?.league_id || payload?.league?.leagueid || 0);
  const competitiveTier = leagueTierMap.get(leagueId) ?? null;
  const radiantName = payload?.radiant_team?.name || payload?.radiant_name || "Radiant";
  const direName = payload?.dire_team?.name || payload?.dire_name || "Dire";
  const leftTeamId = String(
    payload?.radiant_team?.team_id || payload?.radiant_team_id || `od_radiant_${providerMatchId}`
  );
  const rightTeamId = String(
    payload?.dire_team?.team_id || payload?.dire_team_id || `od_dire_${providerMatchId}`
  );

  const hasWinner = typeof payload?.radiant_win === "boolean";
  const status = hasWinner ? "completed" : "live";

  const detail = {
    id: fallbackId || `dota_od_live_${providerMatchId}`,
    game: "dota2",
    region: "global",
    tournament: payload?.league?.name || payload?.league_name || "Dota 2 Pro",
    leagueId,
    competitiveTier,
    patch: payload?.patch ? String(payload.patch) : "unknown",
    status,
    freshness: {
      source: "opendota",
      status: "healthy",
      updatedAt: new Date().toISOString()
    },
    seriesScore: normalizeSeriesScore({
      leftWins: payload?.radiant_series_wins,
      rightWins: payload?.dire_series_wins,
      radiantWin: payload?.radiant_win
    }),
    teams: {
      left: {
        id: leftTeamId,
        name: radiantName,
        kills: typeof payload?.radiant_score === "number" ? payload.radiant_score : undefined
      },
      right: {
        id: rightTeamId,
        name: direName,
        kills: typeof payload?.dire_score === "number" ? payload.dire_score : undefined
      }
    },
    keyMoments: [],
    timeline: []
  };

  if (hasWinner) {
    detail.winnerTeamId = payload.radiant_win ? leftTeamId : rightTeamId;
  }

  return detail;
}

export class OpenDotaProvider {
  constructor({ timeoutMs = 4500 } = {}) {
    this.timeoutMs = timeoutMs;
    this.leagueTierCache = {
      fetchedAt: 0,
      map: new Map()
    };
  }

  async getLeagueTierMap() {
    const ageMs = Date.now() - this.leagueTierCache.fetchedAt;
    if (ageMs <= LEAGUE_CACHE_MS && this.leagueTierCache.map.size > 0) {
      return this.leagueTierCache.map;
    }

    try {
      const leagues = await fetchJson(`${OPENDOTA_BASE_URL}/leagues`, {
        timeoutMs: this.timeoutMs
      });

      const map = new Map();
      if (Array.isArray(leagues)) {
        for (const league of leagues) {
          const leagueId = Number(league?.leagueid || league?.id || 0);
          if (leagueId <= 0) {
            continue;
          }

          const tier = parseLeagueTier(league?.tier);
          if (tier) {
            map.set(leagueId, tier);
          }
        }
      }

      this.leagueTierCache = {
        fetchedAt: Date.now(),
        map
      };
    } catch {
      // Keep stale cache if available, otherwise return empty map.
    }

    return this.leagueTierCache.map;
  }

  async fetchLiveMatches({ allowedTiers = [1, 2, 3, 4] } = {}) {
    const [rows, leagueTierMap] = await Promise.all([
      fetchJson(`${OPENDOTA_BASE_URL}/live`, {
        timeoutMs: this.timeoutMs
      }),
      this.getLeagueTierMap()
    ]);

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((row) => normalizeLiveMatch(row, leagueTierMap))
      .filter(Boolean)
      .filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
  }

  async fetchRecentResults({ maxRows = 30, allowedTiers = [1, 2, 3, 4] } = {}) {
    const [rows, leagueTierMap] = await Promise.all([
      fetchJson(`${OPENDOTA_BASE_URL}/proMatches`, {
        timeoutMs: this.timeoutMs
      }),
      this.getLeagueTierMap()
    ]);

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .slice(0, maxRows)
      .map((row) => normalizeResultMatch(row, leagueTierMap))
      .filter(Boolean)
      .filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
  }

  async fetchMatchDetail(matchId) {
    const providerMatchId = parseProviderMatchId(matchId);
    if (!providerMatchId) {
      return null;
    }

    const [payload, leagueTierMap] = await Promise.all([
      fetchJson(`${OPENDOTA_BASE_URL}/matches/${providerMatchId}`, {
        timeoutMs: this.timeoutMs
      }),
      this.getLeagueTierMap()
    ]);

    return normalizeMatchDetail(payload, matchId, leagueTierMap);
  }
}
