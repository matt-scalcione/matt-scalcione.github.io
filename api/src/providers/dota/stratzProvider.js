import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchGraphql } from "../shared/http.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_STRATZ_LIVE_QUERY_FILE = join(MODULE_DIR, "queries", "stratzLive.graphql");
const DEFAULT_STRATZ_MATCH_DETAIL_QUERY_FILE = join(
  MODULE_DIR,
  "queries",
  "stratzMatchDetail.graphql"
);
const STRATZ_GRAPHQL_URL = process.env.STRATZ_GRAPHQL_URL || "https://api.stratz.com/graphql";
const STRATZ_API_TOKEN = String(process.env.STRATZ_API_TOKEN || "").trim();
const STRATZ_USER_AGENT =
  process.env.STRATZ_USER_AGENT || "Pulseboard/1.0 (https://matt-scalcione.github.io)";
const STRATZ_LIVE_QUERY_FILE = String(process.env.STRATZ_DOTA_LIVE_QUERY_FILE || "").trim();
const STRATZ_MATCH_DETAIL_QUERY_FILE = String(
  process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY_FILE || ""
).trim();
const STRATZ_LIVE_CACHE_MS = Math.max(
  10000,
  Number.parseInt(process.env.STRATZ_DOTA_LIVE_CACHE_MS || "15000", 10)
);

function loadQueryText(inlineValue, filePath) {
  const inline = String(inlineValue || "").trim();
  if (inline) {
    return inline;
  }

  const targetFile = String(filePath || "").trim();
  if (!targetFile) {
    return "";
  }

  try {
    return String(readFileSync(targetFile, "utf8") || "").trim();
  } catch {
    return "";
  }
}

const STRATZ_LIVE_QUERY = loadQueryText(
  process.env.STRATZ_DOTA_LIVE_QUERY,
  STRATZ_LIVE_QUERY_FILE || DEFAULT_STRATZ_LIVE_QUERY_FILE
);
const STRATZ_MATCH_DETAIL_QUERY = loadQueryText(
  process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY,
  STRATZ_MATCH_DETAIL_QUERY_FILE || DEFAULT_STRATZ_MATCH_DETAIL_QUERY_FILE
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

function findFirstObject(root, predicate) {
  const seen = new Set();
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (!Array.isArray(current) && predicate(current)) {
      return current;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    for (const value of Object.values(current)) {
      queue.push(value);
    }
  }

  return null;
}

function extractDetailRoot(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const preferred = [
    data?.liveMatch?.match,
    data?.live?.match,
    Array.isArray(data?.live?.matches) ? data.live.matches[0] : null,
    data?.completedMatch,
    data?.match,
    data?.liveMatch,
    data?.series,
    data?.liveSeries,
    data?.data?.liveMatch?.match,
    data?.data?.live?.match,
    Array.isArray(data?.data?.live?.matches) ? data.data.live.matches[0] : null,
    data?.data?.completedMatch,
    data?.data?.match,
    data?.data?.liveMatch,
    data?.data?.series
  ].filter(Boolean);

  for (const candidate of preferred) {
    if (looksLikeMatchNode(candidate) || hasPlayerData(candidate)) {
      return candidate;
    }
  }

  return findFirstObject(data, (candidate) => looksLikeMatchNode(candidate) || hasPlayerData(candidate));
}

function hasPlayerData(node) {
  return Boolean(
    (Array.isArray(node?.radiantPlayers) && node.radiantPlayers.length) ||
      (Array.isArray(node?.direPlayers) && node.direPlayers.length) ||
      (Array.isArray(node?.players) && node.players.length) ||
      (Array.isArray(node?.matchPlayers) && node.matchPlayers.length) ||
      (Array.isArray(node?.stats?.players) && node.stats.players.length) ||
      (Array.isArray(node?.participantStats) && node.participantStats.length)
  );
}

function extractWatchOptions(node) {
  const rawOptions = []
    .concat(Array.isArray(node?.streams) ? node.streams : [])
    .concat(Array.isArray(node?.watchOptions) ? node.watchOptions : [])
    .concat(Array.isArray(node?.broadcasts) ? node.broadcasts : []);

  return rawOptions
    .map((row) => {
      const url = firstPresent(row?.url, row?.link, row?.streamUrl, row?.href);
      if (!url) {
        return null;
      }

      return {
        label: normalizeText(firstPresent(row?.label, row?.provider, row?.name), "Watch stream"),
        provider: normalizeText(firstPresent(row?.provider, row?.name), "stream").toLowerCase(),
        url: String(url)
      };
    })
    .filter(Boolean);
}

function normalizeRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "flex";
  }

  if (normalized.includes("carry") || normalized === "pos1" || normalized === "position1") return "pos1";
  if (normalized.includes("mid") || normalized === "pos2" || normalized === "position2") return "pos2";
  if (normalized.includes("off") || normalized === "pos3" || normalized === "position3") return "pos3";
  if (normalized.includes("soft") || normalized === "pos4" || normalized === "position4") return "pos4";
  if (normalized.includes("hard") || normalized === "pos5" || normalized === "position5") return "pos5";
  return normalized;
}

function playerName(player, fallback) {
  return normalizeText(
    firstPresent(
      player?.name,
      player?.displayName,
      player?.steamAccount?.name,
      player?.steamAccount?.proSteamAccount?.name,
      player?.proSteamAccount?.name,
      player?.player?.name,
      player?.account?.name
    ),
    fallback
  );
}

function playerHeroName(player) {
  return normalizeText(
    firstPresent(
      player?.hero?.displayName,
      player?.hero?.shortName,
      player?.hero?.name,
      player?.heroName,
      player?.character?.name,
      player?.heroDisplayName
    ),
    "Unknown"
  );
}

function normalizePlayerRow(player, side, teamRef, fallbackIndex) {
  const kills = toCount(firstPresent(player?.kills, player?.stats?.kills, player?.playerStats?.kills));
  const deaths = toCount(firstPresent(player?.deaths, player?.stats?.deaths, player?.playerStats?.deaths));
  const assists = toCount(firstPresent(player?.assists, player?.stats?.assists, player?.playerStats?.assists));
  const cs = toCount(
    firstPresent(player?.lastHits, player?.last_hits, player?.lh, player?.stats?.lastHits)
  );
  const denies = toCount(firstPresent(player?.denies, player?.stats?.denies));
  const goldEarned = toCount(
    firstPresent(
      player?.networth,
      player?.netWorth,
      player?.gold,
      player?.goldEarned,
      player?.stats?.networth,
      player?.playerStats?.networth
    )
  );
  const gpm = toCount(
    firstPresent(player?.goldPerMinute, player?.gpm, player?.stats?.gpm, player?.playerStats?.gpm)
  );
  const xpm = toCount(
    firstPresent(
      player?.experiencePerMinute,
      player?.xpm,
      player?.stats?.xpm,
      player?.playerStats?.xpm
    )
  );
  const level = toCount(firstPresent(player?.level, player?.stats?.level));
  const health = toOptionalNumber(
    firstPresent(player?.health, player?.hp, player?.currentHealth, player?.stats?.health)
  );
  const maxHealth = toOptionalNumber(
    firstPresent(player?.maxHealth, player?.maxHp, player?.stats?.maxHealth)
  );
  const isDead = Boolean(
    firstPresent(player?.isDead, player?.dead, player?.alive === false, health !== null && health <= 0)
  );
  const respawnSeconds = toOptionalNumber(
    firstPresent(
      player?.secondsToRespawn,
      player?.respawnSeconds,
      player?.respawnTimer,
      player?.stats?.respawnSeconds
    )
  );
  const items = []
    .concat(Array.isArray(player?.items) ? player.items : [])
    .concat(Array.isArray(player?.inventory) ? player.inventory : [])
    .filter(Boolean);

  return {
    team: side,
    teamId: teamRef?.id || null,
    teamName: teamRef?.name || (side === "left" ? "Radiant" : "Dire"),
    name: playerName(player, `${teamRef?.name || "Player"} ${fallbackIndex + 1}`),
    heroName: playerHeroName(player),
    heroId: toOptionalNumber(firstPresent(player?.heroId, player?.hero?.id, player?.character?.id)),
    role: normalizeRole(firstPresent(player?.position, player?.role, player?.laneRole)),
    kills,
    deaths,
    assists,
    kda: `${kills}/${deaths}/${assists}`,
    cs,
    denies,
    goldEarned,
    gpm,
    xpm,
    level,
    health,
    maxHealth,
    isDead,
    respawnSeconds,
    itemCount: items.length
  };
}

function inferPlayerSide(player, { leftTeamId, rightTeamId, index = 0 } = {}) {
  if (typeof player?.isRadiant === "boolean") {
    return player.isRadiant ? "left" : "right";
  }

  const side = String(firstPresent(player?.side, player?.teamSide, player?.team, player?.faction) || "")
    .trim()
    .toLowerCase();
  if (side === "radiant" || side === "left") return "left";
  if (side === "dire" || side === "right") return "right";

  const teamId = firstPresent(player?.teamId, player?.team?.id);
  if (leftTeamId && String(teamId) === String(leftTeamId)) return "left";
  if (rightTeamId && String(teamId) === String(rightTeamId)) return "right";

  const teamSlot = toOptionalNumber(firstPresent(player?.teamSlot, player?.playerSlot, player?.slot));
  if (teamSlot !== null) {
    return teamSlot < 128 ? "left" : "right";
  }

  return index < 5 ? "left" : "right";
}

function extractPlayerGroups(node, teams) {
  const directLeft = []
    .concat(Array.isArray(node?.radiantPlayers) ? node.radiantPlayers : [])
    .concat(Array.isArray(node?.teams?.left?.players) ? node.teams.left.players : [])
    .concat(Array.isArray(node?.teamRadiant?.players) ? node.teamRadiant.players : []);
  const directRight = []
    .concat(Array.isArray(node?.direPlayers) ? node.direPlayers : [])
    .concat(Array.isArray(node?.teams?.right?.players) ? node.teams.right.players : [])
    .concat(Array.isArray(node?.teamDire?.players) ? node.teamDire.players : []);

  if (directLeft.length || directRight.length) {
    return {
      left: directLeft.map((player, index) => normalizePlayerRow(player, "left", teams.left, index)),
      right: directRight.map((player, index) => normalizePlayerRow(player, "right", teams.right, index))
    };
  }

  const combined =
    firstPresent(
      Array.isArray(node?.players) ? node.players : null,
      Array.isArray(node?.matchPlayers) ? node.matchPlayers : null,
      Array.isArray(node?.stats?.players) ? node.stats.players : null,
      Array.isArray(node?.participantStats) ? node.participantStats : null
    ) || [];

  const grouped = {
    left: [],
    right: []
  };
  for (let index = 0; index < combined.length; index += 1) {
    const player = combined[index];
    const side = inferPlayerSide(player, {
      leftTeamId: teams.left?.id,
      rightTeamId: teams.right?.id,
      index
    });
    grouped[side].push(
      normalizePlayerRow(player, side, side === "left" ? teams.left : teams.right, grouped[side].length)
    );
  }

  return grouped;
}

function sortPlayers(rows = []) {
  const roleOrder = new Map([
    ["pos1", 1],
    ["pos2", 2],
    ["pos3", 3],
    ["pos4", 4],
    ["pos5", 5]
  ]);
  return rows
    .slice()
    .sort((left, right) => {
      const leftRole = roleOrder.get(String(left?.role || "").toLowerCase()) ?? 99;
      const rightRole = roleOrder.get(String(right?.role || "").toLowerCase()) ?? 99;
      if (leftRole !== rightRole) {
        return leftRole - rightRole;
      }

      return Number(right?.goldEarned || 0) - Number(left?.goldEarned || 0);
    });
}

function buildTeamEconomyTotals(playerEconomy) {
  const summarize = (rows = []) => {
    const totalGold = rows.reduce((sum, row) => sum + toCount(row?.goldEarned), 0);
    const totalGpm = rows.reduce((sum, row) => sum + toCount(row?.gpm), 0);
    return {
      totalGold,
      totalGpm,
      avgGpm: rows.length ? Number((totalGpm / rows.length).toFixed(1)) : 0
    };
  };

  return {
    left: summarize(playerEconomy.left),
    right: summarize(playerEconomy.right)
  };
}

function sumMetric(rows = [], key) {
  return rows.reduce((sum, row) => sum + toCount(row?.[key]), 0);
}

function extractSnapshot(node, playerEconomy, teamEconomyTotals) {
  const leftKills = toCount(
    firstPresent(
      node?.radiantKills,
      node?.radiantScore,
      node?.score?.left,
      node?.teams?.left?.kills,
      node?.teamRadiant?.kills,
      sumMetric(playerEconomy.left, "kills")
    )
  );
  const rightKills = toCount(
    firstPresent(
      node?.direKills,
      node?.direScore,
      node?.score?.right,
      node?.teams?.right?.kills,
      node?.teamDire?.kills,
      sumMetric(playerEconomy.right, "kills")
    )
  );
  const leftTowers = toCount(
    firstPresent(
      node?.radiantTowerKills,
      node?.teams?.left?.towers,
      node?.teamRadiant?.towerKills,
      node?.score?.leftTowers
    )
  );
  const rightTowers = toCount(
    firstPresent(
      node?.direTowerKills,
      node?.teams?.right?.towers,
      node?.teamDire?.towerKills,
      node?.score?.rightTowers
    )
  );
  const leftRoshan = toCount(
    firstPresent(node?.radiantRoshanKills, node?.teams?.left?.roshans, node?.score?.leftRoshan)
  );
  const rightRoshan = toCount(
    firstPresent(node?.direRoshanKills, node?.teams?.right?.roshans, node?.score?.rightRoshan)
  );
  const leftBarracks = toCount(
    firstPresent(node?.radiantBarracksKills, node?.teams?.left?.barracks, node?.score?.leftBarracks)
  );
  const rightBarracks = toCount(
    firstPresent(node?.direBarracksKills, node?.teams?.right?.barracks, node?.score?.rightBarracks)
  );

  return {
    left: {
      kills: leftKills,
      towers: leftTowers,
      dragons: 0,
      barons: leftRoshan,
      inhibitors: leftBarracks,
      gold: toCount(teamEconomyTotals.left.totalGold)
    },
    right: {
      kills: rightKills,
      towers: rightTowers,
      dragons: 0,
      barons: rightRoshan,
      inhibitors: rightBarracks,
      gold: toCount(teamEconomyTotals.right.totalGold)
    }
  };
}

function currentGameNumberFromSeries({ seriesScore, status }) {
  const completedMaps = toCount(seriesScore?.left) + toCount(seriesScore?.right);
  if (status === "live") {
    return Math.max(1, completedMaps + 1);
  }
  if (status === "completed") {
    return Math.max(1, completedMaps || 1);
  }
  return 1;
}

function buildSeriesGames(summary, { gameNumber, watchUrl, watchOptions }) {
  const bestOf = Math.max(1, toCount(summary?.bestOf) || 1);
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const completedWins = toCount(summary?.seriesScore?.left) + toCount(summary?.seriesScore?.right);
  const currentGameNumber = currentGameNumberFromSeries(summary);
  const totalSlots = Math.max(bestOf, currentGameNumber);
  const requestedGameNumber = Number.isInteger(gameNumber) ? gameNumber : null;
  const startMs = Date.parse(String(summary?.startAt || ""));

  const seriesGames = [];
  for (let number = 1; number <= totalSlots; number += 1) {
    let state = "unstarted";
    if (number < currentGameNumber) {
      state = "completed";
    } else if (number === currentGameNumber) {
      if (summary?.status === "live") {
        state = "inProgress";
      } else if (summary?.status === "completed") {
        state = "completed";
      }
    }
    if (number > currentGameNumber && completedWins >= winsNeeded) {
      state = "unneeded";
    }

    seriesGames.push({
      id: `${summary?.id || "dota_stratz"}_game_${number}`,
      number,
      state,
      selected: false,
      label:
        state === "completed"
          ? "Completed game."
          : state === "inProgress"
            ? "Currently live."
            : state === "unneeded"
              ? "Not played (series already decided)."
              : "Scheduled next.",
      sideInfo: {
        leftSide: "radiant",
        rightSide: "dire"
      },
      winnerTeamId: null,
      durationMinutes: state === "completed" ? 40 : null,
      startedAt:
        Number.isFinite(startMs) && startMs > 0
          ? new Date(startMs + (number - 1) * 45 * 60 * 1000).toISOString()
          : null,
      watchUrl,
      watchProvider: watchUrl ? "stream" : null,
      watchOptions
    });
  }

  let selected = null;
  if (requestedGameNumber !== null) {
    selected = seriesGames.find((row) => row.number === requestedGameNumber) || null;
  }
  if (!selected) {
    selected = seriesGames.find((row) => row.state === "inProgress") || null;
  }
  if (!selected) {
    selected = seriesGames.filter((row) => row.state === "completed").pop() || null;
  }
  if (!selected) {
    selected = seriesGames[0] || null;
  }
  if (selected) {
    selected.selected = true;
  }

  return {
    seriesGames,
    selectedGameNumber: Number(selected?.number || 1),
    currentGameNumber
  };
}

function buildSeriesProgress(summary, seriesGames) {
  const bestOf = Math.max(1, toCount(summary?.bestOf) || 1);
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const completedGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game?.state === "completed").length
    : 0;
  const inProgressGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game?.state === "inProgress").length
    : 0;
  const skippedGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game?.state === "unneeded").length
    : 0;
  const leftWins = toCount(summary?.seriesScore?.left);
  const rightWins = toCount(summary?.seriesScore?.right);

  return {
    bestOf,
    winsNeeded,
    leftWins,
    rightWins,
    completedGames,
    inProgressGames,
    skippedGames,
    leftToWin: Math.max(0, winsNeeded - leftWins),
    rightToWin: Math.max(0, winsNeeded - rightWins)
  };
}

function buildGameNavigation(seriesGames, selectedGameNumber) {
  const index = seriesGames.findIndex((game) => Number(game?.number) === Number(selectedGameNumber));
  return {
    availableGames: seriesGames,
    selectedGameNumber,
    previousGameNumber: index > 0 ? seriesGames[index - 1].number : null,
    nextGameNumber: index >= 0 && index < seriesGames.length - 1 ? seriesGames[index + 1].number : null,
    currentLiveGameNumber: (seriesGames.find((game) => game?.state === "inProgress") || {}).number || null,
    requestedGameNumber: Number.isInteger(selectedGameNumber) ? selectedGameNumber : null,
    requestedMissing: false,
    selectedReason: "best_effort"
  };
}

function buildTopPerformers(playerEconomy) {
  return [...playerEconomy.left, ...playerEconomy.right]
    .filter((row) => row && row.name)
    .sort((left, right) => {
      const goldDelta = toCount(right?.goldEarned) - toCount(left?.goldEarned);
      if (goldDelta !== 0) {
        return goldDelta;
      }
      return toCount(right?.gpm) - toCount(left?.gpm);
    })
    .slice(0, 3);
}

function buildPreMatchInsights(summary, seriesGames, watchUrl) {
  const bestOf = Math.max(1, toCount(summary?.bestOf) || 1);
  const startMs = Date.parse(String(summary?.startAt || ""));
  return {
    seriesGames,
    seriesProjection: {
      matchStartAt: summary?.startAt || null,
      countdownSeconds: Number.isFinite(startMs) ? Math.max(0, Math.round((startMs - Date.now()) / 1000)) : null,
      estimatedEndAt: null,
      games: seriesGames.map((game) => ({
        number: game.number,
        estimatedStartAt: game.startedAt || null
      }))
    },
    teamForm: null,
    headToHead: null,
    prediction: null,
    matchupReadiness: summary?.status === "live" ? "medium" : "low",
    keyFactors: [
      `Best of ${bestOf}`,
      summary?.status === "live" ? "Live series" : "Schedule only"
    ],
    watchOptions: watchUrl
      ? [
          {
            label: "Open stream",
            provider: "stream",
            url: watchUrl
          }
        ]
      : []
  };
}

function normalizeStratzDetail(data, { matchId, gameNumber } = {}) {
  if (isPulseboardMatchDetail(data)) {
    return data;
  }

  const root = extractDetailRoot(data);
  if (!root) {
    return null;
  }

  const liveSummary = normalizeLiveRow(root);
  if (!liveSummary) {
    return null;
  }

  const watchOptions = extractWatchOptions(root);
  const watchUrl = watchOptions[0]?.url || null;
  const teams = liveSummary.teams;
  const playerGroups = extractPlayerGroups(root, teams);
  const playerEconomy = {
    elapsedSeconds: toCount(
      firstPresent(root?.durationSeconds, root?.duration, root?.gameTimeSeconds, root?.clockTime)
    ),
    updatedAt: liveSummary.updatedAt || new Date().toISOString(),
    left: sortPlayers(playerGroups.left),
    right: sortPlayers(playerGroups.right)
  };
  const teamEconomyTotals = buildTeamEconomyTotals(playerEconomy);
  const snapshot = extractSnapshot(root, playerEconomy, teamEconomyTotals);
  const { seriesGames, selectedGameNumber } = buildSeriesGames(liveSummary, {
    gameNumber,
    watchUrl,
    watchOptions
  });
  const selectedGame = seriesGames.find((game) => game.selected) || seriesGames[0] || {
    number: 1,
    state: liveSummary.status === "live" ? "inProgress" : liveSummary.status === "completed" ? "completed" : "unstarted"
  };
  const telemetryAvailable =
    playerEconomy.left.length > 0 ||
    playerEconomy.right.length > 0 ||
    snapshot.left.kills > 0 ||
    snapshot.right.kills > 0 ||
    snapshot.left.gold > 0 ||
    snapshot.right.gold > 0;
  const telemetryStatus = telemetryAvailable
    ? "basic"
    : liveSummary.status === "live"
      ? "pending"
      : "none";
  const seriesProgress = buildSeriesProgress(liveSummary, seriesGames);
  const preMatchInsights = buildPreMatchInsights(liveSummary, seriesGames, watchUrl);
  const topPerformers = buildTopPerformers(playerEconomy);

  return {
    ...liveSummary,
    id: String(matchId || liveSummary.id),
    patch: normalizeText(firstPresent(root?.patch, root?.gameVersion), "unknown"),
    freshness: {
      source: "stratz",
      status: telemetryAvailable ? "healthy" : liveSummary.status === "live" ? "partial" : "schedule_only",
      updatedAt: liveSummary.updatedAt || new Date().toISOString()
    },
    keyMoments: [],
    timeline: [],
    objectiveTimeline: [],
    objectiveControl: {
      left: {
        towers: snapshot.left.towers,
        dragons: 0,
        barons: snapshot.left.barons,
        inhibitors: snapshot.left.inhibitors,
        score: 0,
        controlPct: 50
      },
      right: {
        towers: snapshot.right.towers,
        dragons: 0,
        barons: snapshot.right.barons,
        inhibitors: snapshot.right.inhibitors,
        score: 0,
        controlPct: 50
      }
    },
    objectiveBreakdown: {
      left: { total: 0, dragon: 0, baron: 0, tower: snapshot.left.towers, inhibitor: snapshot.left.inhibitors, other: 0 },
      right: { total: 0, dragon: 0, baron: 0, tower: snapshot.right.towers, inhibitor: snapshot.right.inhibitors, other: 0 }
    },
    objectiveRuns: [],
    goldLeadSeries: [],
    leadTrend: null,
    playerEconomy,
    teamEconomyTotals,
    topPerformers,
    momentum: {
      leaderTeamId:
        snapshot.left.gold > snapshot.right.gold
          ? teams.left.id
          : snapshot.right.gold > snapshot.left.gold
            ? teams.right.id
            : null,
      goldLead: snapshot.left.gold - snapshot.right.gold,
      goldLeadDeltaWindow: 0,
      killDiff: snapshot.left.kills - snapshot.right.kills,
      towerDiff: snapshot.left.towers - snapshot.right.towers,
      dragonDiff: 0,
      baronDiff: snapshot.left.barons - snapshot.right.barons,
      inhibitorDiff: snapshot.left.inhibitors - snapshot.right.inhibitors
    },
    dataConfidence: {
      grade: telemetryAvailable ? "medium" : "low",
      score: telemetryAvailable ? 72 : 50,
      telemetry: telemetryAvailable ? "provider_basic" : liveSummary.status === "live" ? "live_status_only" : "schedule_only",
      notes: telemetryAvailable
        ? ["Live STRATZ data normalized into the Pulseboard Dota contract."]
        : ["STRATZ match resolved, but only limited state is currently available from the returned payload."]
    },
    pulseCard: {
      tone: telemetryAvailable ? "info" : liveSummary.status === "live" ? "warn" : "neutral",
      title: telemetryAvailable ? "STRATZ live detail active" : "STRATZ status confirmed",
      summary: telemetryAvailable
        ? "Basic live Dota telemetry is now available from STRATZ."
        : "Series resolved through STRATZ, but the returned payload does not include rich live telemetry yet."
    },
    edgeMeter: {
      left: { team: teams.left.name, score: 50, drivers: [] },
      right: { team: teams.right.name, score: 50, drivers: [] },
      verdict: telemetryAvailable ? "Basic live telemetry available." : "Waiting for richer live STRATZ telemetry."
    },
    tempoSnapshot: {
      completedGames: seriesProgress.completedGames,
      averageDurationMinutes: null,
      shortestDurationMinutes: null,
      longestDurationMinutes: null,
      currentGameMinutes: playerEconomy.elapsedSeconds > 0 ? Number((playerEconomy.elapsedSeconds / 60).toFixed(1)) : null,
      objectivePer10Minutes: null,
      objectiveEvents: 0
    },
    tacticalChecklist: telemetryAvailable
      ? [
          {
            tone: "info",
            title: "Basic telemetry active",
            detail: "Player rows and scoreboard are coming from STRATZ."
          }
        ]
      : [
          {
            tone: "warn",
            title: "Limited live payload",
            detail: "STRATZ resolved the series, but this payload still lacks richer map telemetry."
          }
        ],
    storylines: [],
    teamDraft: null,
    laneMatchups: [],
    roleMatchupDeltas: [],
    seriesPlayerTrends: [],
    draftDelta: null,
    objectiveForecast: [],
    deltaWindow: {
      selectedGameNumber,
      referenceGameNumber: null,
      windowMinutes: 5,
      updatedAt: new Date().toISOString()
    },
    playerDelta: [],
    watchGuide: {
      venue: liveSummary.tournament || "Tournament stage",
      streamUrl: watchUrl,
      streamLabel: watchUrl ? "Open stream" : "Stream pending",
      language: "Global",
      status: liveSummary.status
    },
    teamForm: null,
    headToHead: null,
    prediction: null,
    preMatchInsights,
    combatBursts: [],
    goldMilestones: [],
    liveAlerts: [],
    matchupReadiness: telemetryAvailable ? "medium" : "low",
    matchupKeyFactors: telemetryAvailable ? ["STRATZ live detail", "Player board available"] : ["STRATZ status only"],
    matchupAlertLevel: telemetryAvailable ? "medium" : "low",
    matchupMeta: null,
    seriesGames,
    selectedGame: {
      number: selectedGameNumber,
      state: selectedGame.state,
      label: selectedGame.label,
      telemetryStatus,
      telemetryCounts: {
        tickerEvents: 0,
        objectiveEvents: 0,
        combatBursts: 0,
        goldMilestones: 0
      },
      snapshot,
      tips: [],
      sideSummary: [`${teams.left.name} Radiant`, `${teams.right.name} Dire`],
      watchUrl,
      watchOptions,
      startedAt: selectedGame.startedAt || liveSummary.startAt || null,
      durationMinutes:
        playerEconomy.elapsedSeconds > 0 ? Number((playerEconomy.elapsedSeconds / 60).toFixed(1)) : null,
      requestedMissing: false
    },
    gameNavigation: buildGameNavigation(seriesGames, selectedGameNumber),
    seriesHeader: {
      headline: `${teams.left.name} ${liveSummary.seriesScore.left} - ${liveSummary.seriesScore.right} ${teams.right.name}`,
      subhead:
        liveSummary.status === "completed"
          ? "Series complete"
          : liveSummary.status === "live"
            ? "Live series"
            : "Upcoming series"
    },
    seriesProgress,
    seriesProjection: preMatchInsights.seriesProjection,
    liveTicker: []
  };
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
      liveQuerySource: STRATZ_LIVE_QUERY
        ? String(process.env.STRATZ_DOTA_LIVE_QUERY || "").trim()
          ? "env"
          : STRATZ_LIVE_QUERY_FILE
            ? "file"
            : "bundled_default"
        : "missing",
      detailQuerySource: STRATZ_MATCH_DETAIL_QUERY
        ? String(process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY || "").trim()
          ? "env"
          : STRATZ_MATCH_DETAIL_QUERY_FILE
            ? "file"
            : "bundled_default"
        : "missing",
      liveEnabled: Boolean(STRATZ_API_TOKEN && STRATZ_LIVE_QUERY),
      detailEnabled: Boolean(STRATZ_API_TOKEN && STRATZ_MATCH_DETAIL_QUERY),
      detailContractMode: "normalized_raw_or_contract"
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
        return (
          all.findIndex((candidate) => {
            const candidateKey = [
              normalizeTeamName(candidate?.teams?.left?.name),
              normalizeTeamName(candidate?.teams?.right?.name)
            ]
              .sort()
              .join("::");
            return candidate.providerMatchId === row.providerMatchId || candidateKey === teamKey;
          }) === index
        );
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
    const normalizedMatchId = /^\d+$/.test(providerMatchId)
      ? Number.parseInt(providerMatchId, 10)
      : providerMatchId;

    const data = await fetchGraphql(STRATZ_GRAPHQL_URL, {
      query: STRATZ_MATCH_DETAIL_QUERY,
      variables: {
        id: normalizedMatchId,
        matchId: normalizedMatchId,
        seriesId: normalizedMatchId,
        gameNumber: Number.isInteger(gameNumber) ? gameNumber : null
      },
      headers: this.buildHeaders(),
      timeoutMs: this.timeoutMs
    });

    return normalizeStratzDetail(data, {
      matchId,
      gameNumber
    });
  }
}
