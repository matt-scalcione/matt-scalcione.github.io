import { fetchGraphql } from "../shared/http.js";

const STRATZ_GRAPHQL_URL = process.env.STRATZ_GRAPHQL_URL || "https://api.stratz.com/graphql";
const STRATZ_API_TOKEN = String(process.env.STRATZ_API_TOKEN || "").trim();
const STRATZ_USER_AGENT =
  process.env.STRATZ_USER_AGENT || "Pulseboard/1.0 (https://matt-scalcione.github.io)";
const STRATZ_LIVE_QUERY = String(process.env.STRATZ_DOTA_LIVE_QUERY || "").trim();
const STRATZ_MATCH_DETAIL_QUERY = String(process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY || "").trim();
const STRATZ_LIVE_CACHE_MS = Math.max(
  10000,
  Number.parseInt(process.env.STRATZ_DOTA_LIVE_CACHE_MS || "15000", 10)
);

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoFromSeconds(seconds, fallback = Date.now()) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return new Date(fallback).toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

function normalizeText(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseBestOf(value) {
  const parsed = toOptionalNumber(value);
  if (parsed === 1) return 3;
  if (parsed === 2) return 5;
  if (parsed === 3) return 7;
  if (parsed !== null && parsed > 0) return Math.max(1, Math.round(parsed));
  return 3;
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

function hasTierAllowed(competitiveTier, allowedTiers) {
  if (!Array.isArray(allowedTiers) || allowedTiers.length === 0) {
    return true;
  }

  if (typeof competitiveTier !== "number") {
    return false;
  }

  return allowedTiers.includes(competitiveTier);
}

function extractTeams(node) {
  const direct = [
    {
      id: node?.radiantTeam?.id ?? node?.teamRadiant?.id ?? node?.teams?.left?.id ?? null,
      name:
        node?.radiantTeam?.displayName ??
        node?.radiantTeam?.name ??
        node?.teamRadiant?.name ??
        node?.teams?.left?.name ??
        null
    },
    {
      id: node?.direTeam?.id ?? node?.teamDire?.id ?? node?.teams?.right?.id ?? null,
      name:
        node?.direTeam?.displayName ??
        node?.direTeam?.name ??
        node?.teamDire?.name ??
        node?.teams?.right?.name ??
        null
    }
  ].filter((team) => team.name || team.id);

  if (direct.length >= 2) {
    return direct.slice(0, 2).map((team, index) => ({
      id: team.id !== null && team.id !== undefined ? String(team.id) : `stratz_team_${index + 1}`,
      name: normalizeText(team.name, index === 0 ? "Radiant" : "Dire")
    }));
  }

  const competitors = Array.isArray(node?.competitors) ? node.competitors : [];
  if (competitors.length >= 2) {
    return competitors.slice(0, 2).map((team, index) => ({
      id:
        team?.id !== null && team?.id !== undefined
          ? String(team.id)
          : `stratz_team_${index + 1}`,
      name: normalizeText(
        team?.displayName ?? team?.name ?? team?.team?.displayName ?? team?.team?.name,
        index === 0 ? "Radiant" : "Dire"
      )
    }));
  }

  return null;
}

function extractTournamentName(node) {
  return normalizeText(
    node?.league?.displayName ??
      node?.league?.name ??
      node?.tournament?.displayName ??
      node?.tournament?.name ??
      node?.event?.displayName ??
      node?.event?.name,
    "Dota 2"
  );
}

function extractSeriesScore(node) {
  const left =
    toOptionalNumber(node?.radiantSeriesWins) ??
    toOptionalNumber(node?.leftWins) ??
    toOptionalNumber(node?.score?.left) ??
    toOptionalNumber(node?.seriesScore?.left) ??
    0;
  const right =
    toOptionalNumber(node?.direSeriesWins) ??
    toOptionalNumber(node?.rightWins) ??
    toOptionalNumber(node?.score?.right) ??
    toOptionalNumber(node?.seriesScore?.right) ??
    0;

  return {
    left: Math.max(0, Math.round(left)),
    right: Math.max(0, Math.round(right))
  };
}

function extractStatus(node) {
  const state = String(
    node?.status ?? node?.matchStatus ?? node?.liveStatus ?? node?.gameState ?? ""
  )
    .trim()
    .toLowerCase();

  if (state.includes("complete") || state.includes("ended") || state.includes("finished")) {
    return "completed";
  }

  if (state.includes("live") || state.includes("progress") || state.includes("ongoing")) {
    return "live";
  }

  if (state.includes("draft") || state.includes("pick") || state.includes("ban")) {
    return "live";
  }

  return "upcoming";
}

function extractMatchishArrays(root) {
  const arrays = [];
  const seen = new Set();
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (Array.isArray(current)) {
      if (!seen.has(current)) {
        seen.add(current);
        arrays.push(current);
      }
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    for (const value of Object.values(current)) {
      queue.push(value);
    }
  }

  return arrays;
}

function looksLikeMatchNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  const teams = extractTeams(node);
  const tournament = extractTournamentName(node);
  return Boolean(teams && teams.length >= 2 && tournament);
}

function normalizeLiveRow(node) {
  const teams = extractTeams(node);
  if (!teams || teams.length < 2) {
    return null;
  }

  const providerMatchId =
    String(
      node?.seriesId ??
        node?.matchId ??
        node?.id ??
        node?.match?.id ??
        node?.series?.id ??
        ""
    ).trim() || null;
  if (!providerMatchId) {
    return null;
  }

  const tournament = extractTournamentName(node);
  const startSeconds =
    toOptionalNumber(node?.startDateTime) ??
    toOptionalNumber(node?.scheduledTime) ??
    toOptionalNumber(node?.startTime) ??
    toOptionalNumber(node?.startTimestamp);
  const updatedSeconds =
    toOptionalNumber(node?.lastUpdateDateTime) ??
    toOptionalNumber(node?.lastUpdatedTime) ??
    toOptionalNumber(node?.updatedAt) ??
    startSeconds;
  const seriesScore = extractSeriesScore(node);
  const competitiveTier =
    toOptionalNumber(node?.league?.tier) ??
    toOptionalNumber(node?.tournament?.tier) ??
    inferCompetitiveTier(tournament);

  return {
    id: `dota_stratz_${providerMatchId}`,
    providerMatchId,
    sourceMatchId: String(node?.matchId ?? node?.id ?? providerMatchId),
    game: "dota2",
    region: "global",
    tournament,
    status: extractStatus(node),
    startAt: toIsoFromSeconds(startSeconds, Date.now()),
    updatedAt: toIsoFromSeconds(updatedSeconds ?? startSeconds, Date.now()),
    bestOf: parseBestOf(node?.bestOf ?? node?.seriesType ?? node?.format?.bestOf),
    competitiveTier:
      typeof competitiveTier === "number" && Number.isFinite(competitiveTier)
        ? Math.max(1, Math.min(4, Math.round(competitiveTier)))
        : inferCompetitiveTier(tournament),
    seriesScore,
    teams: {
      left: teams[0],
      right: teams[1]
    },
    keySignal: "provider_stratz_live",
    source: {
      provider: "stratz"
    }
  };
}

function isPulseboardMatchDetail(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.game === "dota2" &&
      value.teams &&
      value.selectedGame &&
      value.seriesScore
  );
}

export class StratzProvider {
  constructor({ timeoutMs = 15000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.liveCache = {
      fetchedAt: 0,
      rows: []
    };
  }

  getCapabilities() {
    return {
      provider: "stratz",
      graphqlUrl: STRATZ_GRAPHQL_URL,
      tokenConfigured: Boolean(STRATZ_API_TOKEN),
      liveQueryConfigured: Boolean(STRATZ_LIVE_QUERY),
      detailQueryConfigured: Boolean(STRATZ_MATCH_DETAIL_QUERY),
      liveEnabled: Boolean(STRATZ_API_TOKEN && STRATZ_LIVE_QUERY),
      detailEnabled: Boolean(STRATZ_API_TOKEN && STRATZ_MATCH_DETAIL_QUERY),
      detailContractMode: "pulseboard_contract_only"
    };
  }

  buildHeaders() {
    const headers = {
      "user-agent": STRATZ_USER_AGENT
    };

    if (STRATZ_API_TOKEN) {
      headers.Authorization = `Bearer ${STRATZ_API_TOKEN}`;
    }

    return headers;
  }

  extractLiveNodes(data) {
    const arrays = extractMatchishArrays(data);
    for (const candidate of arrays) {
      const matchish = candidate.filter((node) => looksLikeMatchNode(node));
      if (matchish.length > 0) {
        return matchish;
      }
    }

    return [];
  }

  async fetchLiveMatches({ allowedTiers = [1, 2, 3, 4] } = {}) {
    const capabilities = this.getCapabilities();
    if (!capabilities.liveEnabled) {
      return [];
    }

    const ageMs = Date.now() - this.liveCache.fetchedAt;
    if (ageMs <= STRATZ_LIVE_CACHE_MS && this.liveCache.rows.length > 0) {
      return this.liveCache.rows.filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
    }

    const data = await fetchGraphql(STRATZ_GRAPHQL_URL, {
      query: STRATZ_LIVE_QUERY,
      variables: {},
      headers: this.buildHeaders(),
      timeoutMs: this.timeoutMs
    });
    const rows = this.extractLiveNodes(data)
      .map((node) => normalizeLiveRow(node))
      .filter(Boolean)
      .filter((row) => row.status === "live")
      .filter((row, index, all) => {
        const teamKey = [normalizeTeamName(row?.teams?.left?.name), normalizeTeamName(row?.teams?.right?.name)]
          .sort()
          .join("::");
        return all.findIndex((candidate) => {
          const candidateKey = [
            normalizeTeamName(candidate?.teams?.left?.name),
            normalizeTeamName(candidate?.teams?.right?.name)
          ]
            .sort()
            .join("::");
          return candidate.providerMatchId === row.providerMatchId || candidateKey === teamKey;
        }) === index;
      });

    this.liveCache = {
      fetchedAt: Date.now(),
      rows
    };

    return rows.filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers));
  }

  async fetchMatchDetail(matchId, { gameNumber } = {}) {
    const capabilities = this.getCapabilities();
    if (!capabilities.detailEnabled) {
      return null;
    }

    const providerMatchId = String(matchId || "")
      .replace(/^dota_stratz_/, "")
      .trim();
    if (!providerMatchId) {
      return null;
    }

    const data = await fetchGraphql(STRATZ_GRAPHQL_URL, {
      query: STRATZ_MATCH_DETAIL_QUERY,
      variables: {
        id: providerMatchId,
        matchId: providerMatchId,
        seriesId: providerMatchId,
        gameNumber: Number.isInteger(gameNumber) ? gameNumber : null
      },
      headers: this.buildHeaders(),
      timeoutMs: this.timeoutMs
    });

    return isPulseboardMatchDetail(data) ? data : null;
  }
}
