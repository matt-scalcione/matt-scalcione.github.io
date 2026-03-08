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
const DOTA_TOWER_TOTAL = 11;
const DOTA_BARRACKS_TOTAL = 6;
const MIN_GOLD_SWING_FOR_TICKER = 1500;

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

function bitCount(value) {
  let count = 0;
  let remaining = Math.max(0, toCount(value));
  while (remaining > 0) {
    count += remaining & 1;
    remaining >>= 1;
  }
  return count;
}

function destroyedFromStatus(statusValue, total) {
  const parsed = toOptionalNumber(statusValue);
  if (parsed === null) {
    return null;
  }

  const alive = bitCount(parsed);
  return Math.max(0, total - alive);
}

function toIsoFromSeconds(seconds, fallback = Date.now()) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return new Date(fallback).toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}

function parseTimestamp(value, fallback = 0) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
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

function signed(value) {
  const count = toCount(value);
  if (count > 0) return `+${count.toLocaleString()}`;
  if (count < 0) return `-${Math.abs(count).toLocaleString()}`;
  return "0";
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
  const hasCompletedSignals =
    typeof node?.didRadiantWin === "boolean" ||
    typeof node?.didDireWin === "boolean" ||
    toOptionalNumber(node?.endDateTime) !== null ||
    (toOptionalNumber(node?.durationSeconds) !== null &&
      (toOptionalNumber(node?.radiantKills) !== null ||
        toOptionalNumber(node?.direKills) !== null ||
        (Array.isArray(node?.players) && node.players.length > 0)));

  if (state.includes("complete") || state.includes("ended") || state.includes("finished")) {
    return "completed";
  }

  if (hasCompletedSignals) {
    return "completed";
  }

  if (state.includes("live") || state.includes("progress") || state.includes("ongoing")) {
    return "live";
  }

  if (state.includes("draft") || state.includes("pick") || state.includes("ban")) {
    return "live";
  }

  if (
    Boolean(node?.isUpdating) ||
    Boolean(node?.isParsing) ||
    toCount(firstPresent(node?.gameTime, node?.gameMinute, node?.clockTime, node?.duration)) > 0
  ) {
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
  const latestGold = latestPlayerGoldEvent(player);
  const latestPosition = latestPlayerPosition(player);
  const inventoryItems = latestPlayerInventory(player);
  const kills = toCount(firstPresent(player?.kills, player?.stats?.kills, player?.playerStats?.kills));
  const deaths = toCount(firstPresent(player?.deaths, player?.stats?.deaths, player?.playerStats?.deaths));
  const assists = toCount(firstPresent(player?.assists, player?.stats?.assists, player?.playerStats?.assists));
  const cs = toCount(
    firstPresent(
      player?.lastHits,
      player?.numLastHits,
      player?.last_hits,
      player?.lh,
      player?.stats?.lastHits
    )
  );
  const denies = toCount(firstPresent(player?.denies, player?.numDenies, player?.stats?.denies));
  const goldEarned = toCount(
    firstPresent(
      latestGold?.networth,
      player?.networth,
      player?.netWorth,
      player?.gold,
      player?.goldEarned,
      player?.stats?.networth,
      player?.playerStats?.networth
    )
  );
  const gpm = toCount(
    firstPresent(
      latestGold?.goldPerMinute,
      player?.goldPerMinute,
      player?.gpm,
      player?.stats?.gpm,
      player?.playerStats?.gpm
    )
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
  const respawnSeconds = toOptionalNumber(
    firstPresent(
      player?.secondsToRespawn,
      player?.respawnSeconds,
      player?.respawnTimer,
      player?.stats?.respawnSeconds
    )
  );
  const explicitDead = typeof player?.isDead === "boolean" ? player.isDead : typeof player?.dead === "boolean" ? player.dead : null;
  const isDead = Boolean(
    explicitDead ??
      (player?.alive === false ? true : null) ??
      (respawnSeconds !== null ? respawnSeconds > 0 : null) ??
      (health !== null && health <= 0 ? true : null)
  );
  const items = inventoryItems.length
    ? inventoryItems
    : []
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
    x: latestPosition?.x ?? null,
    y: latestPosition?.y ?? null,
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

function extractRawPlayers(node) {
  return []
    .concat(Array.isArray(node?.radiantPlayers) ? node.radiantPlayers : [])
    .concat(Array.isArray(node?.direPlayers) ? node.direPlayers : [])
    .concat(Array.isArray(node?.players) ? node.players : [])
    .concat(Array.isArray(node?.matchPlayers) ? node.matchPlayers : [])
    .concat(Array.isArray(node?.stats?.players) ? node.stats.players : [])
    .concat(Array.isArray(node?.participantStats) ? node.participantStats : [])
    .filter(Boolean);
}

function latestEvent(events = []) {
  return events
    .filter(Boolean)
    .slice()
    .sort((left, right) => toCount(left?.time) - toCount(right?.time))
    .pop() || null;
}

function inventoryItemIdsFromEvent(row) {
  return [
    row?.itemId0,
    row?.itemId1,
    row?.itemId2,
    row?.itemId3,
    row?.itemId4,
    row?.itemId5,
    row?.backpackId0,
    row?.backpackId1,
    row?.backpackId2,
    row?.item0Id,
    row?.item1Id,
    row?.item2Id,
    row?.item3Id,
    row?.item4Id,
    row?.item5Id,
    row?.backpack0Id,
    row?.backpack1Id,
    row?.backpack2Id
  ]
    .map((value) => toOptionalNumber(value))
    .filter((value) => value !== null && value > 0);
}

function latestPlayerPosition(player) {
  const playbackPoint = latestEvent(player?.playbackData?.positionEvents);
  if (playbackPoint) {
    return {
      x: toOptionalNumber(playbackPoint?.x),
      y: toOptionalNumber(playbackPoint?.y),
      time: toOptionalNumber(playbackPoint?.time)
    };
  }

  return null;
}

function latestPlayerGoldEvent(player) {
  return latestEvent(player?.playbackData?.goldEvents);
}

function latestPlayerInventory(player) {
  const playbackInventory = latestEvent(player?.playbackData?.inventoryEvents);
  if (playbackInventory) {
    return inventoryItemIdsFromEvent(playbackInventory);
  }

  return inventoryItemIdsFromEvent(player);
}

function objectiveImportance(type) {
  if (type === "baron") return "high";
  if (type === "inhibitor") return "high";
  if (type === "tower") return "medium";
  if (type === "teamfight") return "medium";
  return "low";
}

function normalizeStratzObjectiveType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "other";
  }
  if (normalized.includes("tower")) return "tower";
  if (normalized.includes("barrack")) return "inhibitor";
  if (normalized.includes("roshan")) return "baron";
  return "other";
}

function labelObjectiveEvent(type, teamName) {
  if (type === "tower") return `${teamName} destroyed a tower`;
  if (type === "inhibitor") return `${teamName} destroyed barracks`;
  if (type === "baron") return `${teamName} secured Roshan`;
  return `${teamName} found an objective`;
}

function buildObjectiveTimelineFromStratz(root, teams, startAtIso) {
  const rows = [];
  const startMs = parseTimestamp(startAtIso, Date.now());
  const buildingEvents = Array.isArray(root?.playbackData?.buildingEvents) ? root.playbackData.buildingEvents : [];
  const roshanEvents = Array.isArray(root?.playbackData?.roshanEvents) ? root.playbackData.roshanEvents : [];

  buildingEvents.forEach((event, index) => {
    if (event?.isAlive !== false) {
      return;
    }

    const type = normalizeStratzObjectiveType(event?.type ?? event?.npcId);
    if (type === "other") {
      return;
    }

    const objectiveTeam = event?.isRadiant === true ? "right" : event?.isRadiant === false ? "left" : null;
    const teamName =
      objectiveTeam === "left"
        ? teams?.left?.name || "Radiant"
        : objectiveTeam === "right"
          ? teams?.right?.name || "Dire"
          : "Unknown";
    const gameTimeSeconds = toCount(event?.time);

    rows.push({
      id: `stratz_obj_building_${index + 1}`,
      at: new Date(startMs + gameTimeSeconds * 1000).toISOString(),
      type,
      team: objectiveTeam,
      importance: objectiveImportance(type),
      label: labelObjectiveEvent(type, teamName),
      rawType: String(event?.type || event?.npcId || ""),
      gameTimeSeconds
    });
  });

  roshanEvents.forEach((event, index) => {
    if (event?.isAlive !== false) {
      return;
    }

    const gameTimeSeconds = toCount(event?.time);
    rows.push({
      id: `stratz_obj_roshan_${index + 1}`,
      at: new Date(startMs + gameTimeSeconds * 1000).toISOString(),
      type: "baron",
      team: null,
      importance: "high",
      label: "Roshan slain",
      rawType: "roshan",
      gameTimeSeconds
    });
  });

  return rows.sort((left, right) => parseTimestamp(left.at) - parseTimestamp(right.at));
}

function buildObjectiveBreakdown(objectiveTimeline = []) {
  const init = () => ({
    total: 0,
    dragon: 0,
    baron: 0,
    tower: 0,
    inhibitor: 0,
    other: 0
  });

  const left = init();
  const right = init();

  for (const event of objectiveTimeline) {
    if (event?.team !== "left" && event?.team !== "right") {
      continue;
    }

    const target = event.team === "left" ? left : right;
    target.total += 1;
    if (event.type === "tower") target.tower += 1;
    else if (event.type === "inhibitor") target.inhibitor += 1;
    else if (event.type === "baron") target.baron += 1;
    else target.other += 1;
  }

  return { left, right };
}

function buildObjectiveControlFromBreakdown(root, objectiveBreakdown) {
  const leftTowersFromStatus = destroyedFromStatus(root?.towerStatusDire, DOTA_TOWER_TOTAL);
  const rightTowersFromStatus = destroyedFromStatus(root?.towerStatusRadiant, DOTA_TOWER_TOTAL);
  const leftTowers = Math.max(leftTowersFromStatus ?? toCount(objectiveBreakdown?.left?.tower), 0);
  const rightTowers = Math.max(rightTowersFromStatus ?? toCount(objectiveBreakdown?.right?.tower), 0);
  const leftBarons = Math.max(toCount(objectiveBreakdown?.left?.baron), 0);
  const rightBarons = Math.max(toCount(objectiveBreakdown?.right?.baron), 0);
  const leftInhibitorsFromStatus = destroyedFromStatus(root?.barracksStatusDire, DOTA_BARRACKS_TOTAL);
  const rightInhibitorsFromStatus = destroyedFromStatus(root?.barracksStatusRadiant, DOTA_BARRACKS_TOTAL);
  const leftInhibitors = Math.max(
    leftInhibitorsFromStatus ?? toCount(objectiveBreakdown?.left?.inhibitor),
    0
  );
  const rightInhibitors = Math.max(
    rightInhibitorsFromStatus ?? toCount(objectiveBreakdown?.right?.inhibitor),
    0
  );
  const leftScore = leftTowers * 1.4 + leftBarons * 3.1 + leftInhibitors * 2.2;
  const rightScore = rightTowers * 1.4 + rightBarons * 3.1 + rightInhibitors * 2.2;
  const total = leftScore + rightScore;

  return {
    left: {
      towers: leftTowers,
      dragons: 0,
      barons: leftBarons,
      inhibitors: leftInhibitors,
      score: Number(leftScore.toFixed(2)),
      controlPct: total > 0 ? Number(((leftScore / total) * 100).toFixed(1)) : 50
    },
    right: {
      towers: rightTowers,
      dragons: 0,
      barons: rightBarons,
      inhibitors: rightInhibitors,
      score: Number(rightScore.toFixed(2)),
      controlPct: total > 0 ? Number(((rightScore / total) * 100).toFixed(1)) : 50
    }
  };
}

function buildScoreTimeline(root, startAtIso) {
  const leftRows = Array.isArray(root?.playbackData?.radiantScore) ? root.playbackData.radiantScore : [];
  const rightRows = Array.isArray(root?.playbackData?.direScore) ? root.playbackData.direScore : [];
  const byTime = new Map();
  const startMs = parseTimestamp(startAtIso, Date.now());

  leftRows.forEach((row) => {
    const time = toCount(row?.time);
    const bucket = byTime.get(time) || { time, left: null, right: null };
    bucket.left = toCount(row?.score);
    byTime.set(time, bucket);
  });
  rightRows.forEach((row) => {
    const time = toCount(row?.time);
    const bucket = byTime.get(time) || { time, left: null, right: null };
    bucket.right = toCount(row?.score);
    byTime.set(time, bucket);
  });

  const times = Array.from(byTime.keys()).sort((left, right) => left - right);
  let previousLeft = 0;
  let previousRight = 0;

  return times.map((time) => {
    const bucket = byTime.get(time);
    if (bucket.left === null) bucket.left = previousLeft;
    if (bucket.right === null) bucket.right = previousRight;
    previousLeft = bucket.left;
    previousRight = bucket.right;
    return {
      time,
      left: bucket.left,
      right: bucket.right,
      at: new Date(startMs + time * 1000).toISOString()
    };
  });
}

function buildGoldLeadSeriesFromPlayers(players, teams, startAtIso, fallbackLeads = []) {
  const startMs = parseTimestamp(startAtIso, Date.now());
  const byTime = new Map();

  players.forEach((player, index) => {
    const side = inferPlayerSide(player, {
      leftTeamId: teams?.left?.id,
      rightTeamId: teams?.right?.id,
      index
    });
    const playerKey = `${side}:${String(firstPresent(player?.steamAccountId, player?.steamAccount?.id, player?.playerSlot, index) || index)}`;
    const goldEvents = Array.isArray(player?.playbackData?.goldEvents) ? player.playbackData.goldEvents : [];
    goldEvents.forEach((event) => {
      const time = toCount(event?.time);
      const bucket = byTime.get(time) || {
        time,
        diffs: [],
        leftByPlayer: new Map(),
        rightByPlayer: new Map()
      };
      const diff = toOptionalNumber(event?.networthDifference);
      if (diff !== null) {
        bucket.diffs.push(diff);
      }
      const networth = toOptionalNumber(event?.networth);
      if (networth !== null) {
        const target = side === "left" ? bucket.leftByPlayer : bucket.rightByPlayer;
        target.set(playerKey, networth);
      }
      byTime.set(time, bucket);
    });
  });

  const rows = Array.from(byTime.values())
    .sort((left, right) => left.time - right.time)
    .map((bucket) => {
      const lead =
        bucket.diffs.length > 0
          ? Number(
              (
                bucket.diffs.reduce((sum, value) => sum + Number(value || 0), 0) / bucket.diffs.length
              ).toFixed(0)
            )
          : Array.from(bucket.leftByPlayer.values()).reduce((sum, value) => sum + Number(value || 0), 0) -
            Array.from(bucket.rightByPlayer.values()).reduce((sum, value) => sum + Number(value || 0), 0);
      return {
        at: new Date(startMs + bucket.time * 1000).toISOString(),
        lead: toCount(lead),
        gameTimeSeconds: bucket.time
      };
    })
    .filter((row) => Number.isFinite(row.lead));

  if (rows.length > 0) {
    return rows;
  }

  return (Array.isArray(fallbackLeads) ? fallbackLeads : [])
    .map((leadValue, index) => ({
      at: new Date(startMs + index * 60 * 1000).toISOString(),
      lead: toCount(leadValue),
      gameTimeSeconds: index * 60
    }))
    .filter((row, index, list) => Number.isFinite(row.lead) && (index === 0 || row.lead !== list[index - 1].lead));
}

function buildLeadTrend(goldLeadSeries = []) {
  if (!Array.isArray(goldLeadSeries) || goldLeadSeries.length === 0) {
    return null;
  }

  const leads = goldLeadSeries.map((row) => toCount(row.lead));
  const finalLead = leads[leads.length - 1];
  let largestSwing = 0;
  for (let index = 1; index < leads.length; index += 1) {
    largestSwing = Math.max(largestSwing, Math.abs(leads[index] - leads[index - 1]));
  }

  return {
    finalLead,
    maxLead: Math.max(...leads),
    minLead: Math.min(...leads),
    largestSwing,
    direction: finalLead > 0 ? "left" : finalLead < 0 ? "right" : "even"
  };
}

function buildGoldMilestones(goldLeadSeries, teams) {
  const thresholds = [2000, 4000, 8000, 12000];
  const seen = new Set();
  const rows = [];

  for (const row of goldLeadSeries) {
    const lead = toCount(row?.lead);
    const threshold = thresholds.find((candidate) => Math.abs(lead) >= candidate && !seen.has(`${Math.sign(lead)}:${candidate}`));
    if (!threshold || lead === 0) {
      continue;
    }

    const side = lead > 0 ? "left" : "right";
    const teamName = side === "left" ? teams?.left?.name || "Radiant" : teams?.right?.name || "Dire";
    const key = `${Math.sign(lead)}:${threshold}`;
    seen.add(key);
    rows.push({
      id: `stratz_gold_${key}`,
      occurredAt: row.at,
      team: side,
      amount: threshold,
      title: `${teamName} reached a ${threshold / 1000}k lead`,
      summary: `Net worth edge moved to ${signed(lead)}.`,
      importance: threshold >= 8000 ? "high" : "medium"
    });
  }

  return rows;
}

function buildCombatBursts(scoreTimeline, teams) {
  const rows = [];
  for (let index = 1; index < scoreTimeline.length; index += 1) {
    const previous = scoreTimeline[index - 1];
    const current = scoreTimeline[index];
    const leftDelta = toCount(current?.left) - toCount(previous?.left);
    const rightDelta = toCount(current?.right) - toCount(previous?.right);
    const totalDelta = leftDelta + rightDelta;
    if (totalDelta <= 0) {
      continue;
    }

    const team =
      leftDelta > 0 && rightDelta > 0
        ? "both"
        : leftDelta > 0
          ? "left"
          : rightDelta > 0
            ? "right"
            : null;
    const teamName =
      team === "left"
        ? teams?.left?.name || "Radiant"
        : team === "right"
          ? teams?.right?.name || "Dire"
          : "Both teams";
    const burstKills = Math.max(leftDelta, rightDelta, totalDelta);

    rows.push({
      id: `stratz_burst_${index}`,
      occurredAt: current.at,
      team,
      title:
        team === "both"
          ? `Trade found ${totalDelta} kills`
          : `${teamName} found ${burstKills} kill${burstKills === 1 ? "" : "s"}`,
      summary:
        team === "both"
          ? `Score moved to ${current.left}-${current.right}.`
          : `${teamName} pushed the score to ${current.left}-${current.right}.`,
      importance: totalDelta >= 3 ? "high" : "medium",
      kills: totalDelta
    });
  }

  return rows;
}

function buildLiveTicker({ objectiveTimeline, goldLeadSeries, combatBursts, teams, selectedGameNumber, status, startAtIso }) {
  const rows = [];

  for (const row of objectiveTimeline.slice(-14)) {
    const teamName =
      row.team === "left"
        ? teams?.left?.name || "Radiant"
        : row.team === "right"
          ? teams?.right?.name || "Dire"
          : "Map state";
    rows.push({
      id: `ticker_obj_${row.id}`,
      type: row.type,
      team: row.team,
      title: row.label,
      summary: row.team ? `${teamName} extended objective control.` : row.label,
      importance: row.importance || "medium",
      occurredAt: row.at
    });
  }

  for (let index = 1; index < goldLeadSeries.length; index += 1) {
    const previous = toCount(goldLeadSeries[index - 1]?.lead);
    const current = toCount(goldLeadSeries[index]?.lead);
    const delta = current - previous;
    if (Math.abs(delta) < MIN_GOLD_SWING_FOR_TICKER) {
      continue;
    }

    const leader = current > 0 ? "left" : current < 0 ? "right" : null;
    const leaderName =
      leader === "left"
        ? teams?.left?.name || "Radiant"
        : leader === "right"
          ? teams?.right?.name || "Dire"
          : "Map state";

    rows.push({
      id: `ticker_gold_${index}`,
      type: "economy",
      team: leader,
      title: `${leaderName} swung ${signed(delta)} gold`,
      summary: `Lead now ${signed(current)} net worth.`,
      importance: Math.abs(delta) >= 3000 ? "high" : "medium",
      occurredAt: goldLeadSeries[index]?.at || new Date().toISOString()
    });
  }

  for (const burst of combatBursts.slice(-12)) {
    rows.push({
      id: `ticker_burst_${burst.id}`,
      type: "teamfight",
      team: burst.team === "both" ? null : burst.team,
      title: burst.title,
      summary: burst.summary,
      importance: burst.importance || "medium",
      occurredAt: burst.occurredAt
    });
  }

  if (status === "live" && startAtIso && !rows.some((row) => row.type === "state")) {
    rows.push({
      id: `ticker_state_${selectedGameNumber || 1}`,
      type: "state",
      team: null,
      title: `Game ${selectedGameNumber || 1} in progress`,
      summary: `${teams?.left?.name || "Radiant"} vs ${teams?.right?.name || "Dire"}`,
      importance: "high",
      occurredAt: startAtIso
    });
  }

  return rows
    .sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt))
    .slice(0, 40);
}

function buildKeyMoments({ objectiveTimeline, goldLeadSeries, teams }) {
  const rows = [];

  for (const row of objectiveTimeline.filter((event) => event.importance === "high").slice(-6)) {
    const teamName =
      row.team === "left"
        ? teams?.left?.name || "Radiant"
        : row.team === "right"
          ? teams?.right?.name || "Dire"
          : "Map state";
    rows.push({
      id: `moment_obj_${row.id}`,
      occurredAt: row.at,
      importance: row.importance || "high",
      title: row.label,
      summary: row.team ? `${teamName} gained major objective control.` : row.label
    });
  }

  for (let index = 1; index < goldLeadSeries.length; index += 1) {
    const previous = toCount(goldLeadSeries[index - 1]?.lead);
    const current = toCount(goldLeadSeries[index]?.lead);
    const delta = current - previous;
    if (Math.abs(delta) < 2500) {
      continue;
    }
    const leaderName =
      current > 0
        ? teams?.left?.name || "Radiant"
        : current < 0
          ? teams?.right?.name || "Dire"
          : "Neither side";
    rows.push({
      id: `moment_gold_${index}`,
      occurredAt: goldLeadSeries[index]?.at || new Date().toISOString(),
      importance: Math.abs(delta) >= 4500 ? "critical" : "high",
      title: `${leaderName} converted a ${Math.abs(delta).toLocaleString()} swing`,
      summary: `Lead moved from ${signed(previous)} to ${signed(current)}.`
    });
  }

  return rows
    .sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt))
    .slice(0, 10);
}

function heroNameById(players = []) {
  const map = new Map();
  players.forEach((player) => {
    const heroId = toOptionalNumber(firstPresent(player?.heroId, player?.hero?.id));
    const heroName = playerHeroName(player);
    if (heroId !== null && heroName) {
      map.set(heroId, heroName);
    }
  });
  return map;
}

function buildTeamDraft(root, players = []) {
  const pickBans =
    []
      .concat(Array.isArray(root?.playbackData?.pickBans) ? root.playbackData.pickBans : [])
      .concat(Array.isArray(root?.pickBans) ? root.pickBans : [])
      .filter(Boolean)
      .sort((left, right) => toCount(left?.order) - toCount(right?.order));
  if (!pickBans.length) {
    return null;
  }

  const heroNames = heroNameById(players);
  const draft = { left: [], right: [] };
  for (const row of pickBans) {
    if (!row?.isPick) {
      continue;
    }

    const side = row?.isRadiant === true ? "left" : row?.isRadiant === false ? "right" : null;
    if (!side) {
      continue;
    }

    const heroId = toOptionalNumber(row?.heroId);
    const heroName = heroId !== null ? heroNames.get(heroId) || `Hero ${heroId}` : "Unknown";
    draft[side].push({
      role: normalizeRole(firstPresent(row?.position, `pos${draft[side].length + 1}`)),
      champion: heroName,
      name: row?.letter ? `Pick ${row.letter}` : `Pick ${draft[side].length + 1}`,
      heroId
    });
  }

  return draft.left.length || draft.right.length ? draft : null;
}

function buildLiveAlerts(momentum, objectiveTimeline, telemetryStatus, teams) {
  const alerts = [];

  if (Math.abs(toCount(momentum?.goldLead)) >= 6000) {
    const side = momentum.goldLead > 0 ? "left" : momentum.goldLead < 0 ? "right" : null;
    const teamName =
      side === "left"
        ? teams?.left?.name || "Radiant"
        : side === "right"
          ? teams?.right?.name || "Dire"
          : "Neither side";
    alerts.push({
      id: "alert_gold_surge",
      severity: Math.abs(toCount(momentum?.goldLead)) >= 10000 ? "critical" : "high",
      title: `${teamName} hold a large net worth lead`,
      summary: `Current lead ${signed(momentum?.goldLead)}.`,
      team: side
    });
  }

  if (objectiveTimeline.some((row) => row.type === "inhibitor")) {
    alerts.push({
      id: "alert_rax_pressure",
      severity: "high",
      title: "Barracks pressure online",
      summary: "At least one lane of barracks has been removed.",
      team: null
    });
  }

  if (telemetryStatus === "rich") {
    alerts.push({
      id: "alert_rich_live",
      severity: "medium",
      title: "Live telemetry active",
      summary: "STRATZ playback data is driving this map.",
      team: null
    });
  }

  return alerts.slice(0, 4);
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

function extractSnapshot(node, playerEconomy, teamEconomyTotals, { objectiveControl, scoreTimeline } = {}) {
  const lastScore = Array.isArray(scoreTimeline) && scoreTimeline.length ? scoreTimeline[scoreTimeline.length - 1] : null;
  const leftKills = toCount(
    firstPresent(
      lastScore?.left,
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
      lastScore?.right,
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
      objectiveControl?.left?.towers,
      node?.radiantTowerKills,
      node?.teams?.left?.towers,
      node?.teamRadiant?.towerKills,
      node?.score?.leftTowers
    )
  );
  const rightTowers = toCount(
    firstPresent(
      objectiveControl?.right?.towers,
      node?.direTowerKills,
      node?.teams?.right?.towers,
      node?.teamDire?.towerKills,
      node?.score?.rightTowers
    )
  );
  const leftRoshan = toCount(
    firstPresent(
      objectiveControl?.left?.barons,
      node?.radiantRoshanKills,
      node?.teams?.left?.roshans,
      node?.score?.leftRoshan
    )
  );
  const rightRoshan = toCount(
    firstPresent(
      objectiveControl?.right?.barons,
      node?.direRoshanKills,
      node?.teams?.right?.roshans,
      node?.score?.rightRoshan
    )
  );
  const leftBarracks = toCount(
    firstPresent(
      objectiveControl?.left?.inhibitors,
      node?.radiantBarracksKills,
      node?.teams?.left?.barracks,
      node?.score?.leftBarracks
    )
  );
  const rightBarracks = toCount(
    firstPresent(
      objectiveControl?.right?.inhibitors,
      node?.direBarracksKills,
      node?.teams?.right?.barracks,
      node?.score?.rightBarracks
    )
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

  const winnerTeamId =
    typeof root?.didRadiantWin === "boolean"
      ? root.didRadiantWin
        ? liveSummary.teams.left.id
        : liveSummary.teams.right.id
      : typeof root?.didDireWin === "boolean"
        ? root.didDireWin
          ? liveSummary.teams.right.id
          : liveSummary.teams.left.id
        : null;

  const watchOptions = extractWatchOptions(root);
  const watchUrl = watchOptions[0]?.url || null;
  const teams = liveSummary.teams;
  const rawPlayers = extractRawPlayers(root);
  const playerGroups = extractPlayerGroups(root, teams);
  const playerEconomy = {
    elapsedSeconds: toCount(
      firstPresent(root?.durationSeconds, root?.duration, root?.gameTimeSeconds, root?.clockTime, root?.gameTime)
    ),
    updatedAt: liveSummary.updatedAt || new Date().toISOString(),
    left: sortPlayers(playerGroups.left),
    right: sortPlayers(playerGroups.right)
  };
  const teamEconomyTotals = buildTeamEconomyTotals(playerEconomy);
  const goldLeadSeries = buildGoldLeadSeriesFromPlayers(
    rawPlayers,
    teams,
    liveSummary.startAt,
    root?.radiantNetworthLeads
  );
  const leadTrend = buildLeadTrend(goldLeadSeries);
  const objectiveTimeline = buildObjectiveTimelineFromStratz(root, teams, liveSummary.startAt);
  const objectiveBreakdown = buildObjectiveBreakdown(objectiveTimeline);
  const objectiveControl = buildObjectiveControlFromBreakdown(root, objectiveBreakdown);
  const scoreTimeline = buildScoreTimeline(root, liveSummary.startAt);
  const snapshot = extractSnapshot(root, playerEconomy, teamEconomyTotals, {
    objectiveControl,
    scoreTimeline
  });
  const { seriesGames, selectedGameNumber } = buildSeriesGames(liveSummary, {
    gameNumber,
    watchUrl,
    watchOptions
  });
  const selectedGame = seriesGames.find((game) => game.selected) || seriesGames[0] || {
    number: 1,
    state: liveSummary.status === "live" ? "inProgress" : liveSummary.status === "completed" ? "completed" : "unstarted"
  };
  const combatBursts = buildCombatBursts(scoreTimeline, teams);
  const goldMilestones = buildGoldMilestones(goldLeadSeries, teams);
  const liveTicker = buildLiveTicker({
    objectiveTimeline,
    goldLeadSeries,
    combatBursts,
    teams,
    selectedGameNumber,
    status: liveSummary.status,
    startAtIso: liveSummary.startAt
  });
  const keyMoments = buildKeyMoments({
    objectiveTimeline,
    goldLeadSeries,
    teams
  });
  const teamDraft = buildTeamDraft(root, rawPlayers);
  const liveWinRateSeries = Array.isArray(root?.liveWinRateValues) ? root.liveWinRateValues : [];
  const telemetryAvailable =
    playerEconomy.left.length > 0 ||
    playerEconomy.right.length > 0 ||
    goldLeadSeries.length > 0 ||
    objectiveTimeline.length > 0 ||
    snapshot.left.kills > 0 ||
    snapshot.right.kills > 0 ||
    snapshot.left.gold > 0 ||
    snapshot.right.gold > 0;
  const telemetryRich =
    playerEconomy.left.length > 0 &&
    playerEconomy.right.length > 0 &&
    goldLeadSeries.length > 1 &&
    (objectiveTimeline.length > 0 || combatBursts.length > 0);
  const telemetryStatus = telemetryAvailable
    ? telemetryRich
      ? "rich"
      : "basic"
    : liveSummary.status === "live"
      ? "pending"
      : "none";
  const seriesProgress = buildSeriesProgress(liveSummary, seriesGames);
  const preMatchInsights = buildPreMatchInsights(liveSummary, seriesGames, watchUrl);
  const topPerformers = buildTopPerformers(playerEconomy);
  const momentum = {
    leaderTeamId:
      snapshot.left.gold > snapshot.right.gold
        ? teams.left.id
        : snapshot.right.gold > snapshot.left.gold
          ? teams.right.id
          : null,
    goldLead: snapshot.left.gold - snapshot.right.gold,
    goldLeadDeltaWindow: toCount(leadTrend?.largestSwing),
    killDiff: snapshot.left.kills - snapshot.right.kills,
    towerDiff: snapshot.left.towers - snapshot.right.towers,
    dragonDiff: 0,
    baronDiff: snapshot.left.barons - snapshot.right.barons,
    inhibitorDiff: snapshot.left.inhibitors - snapshot.right.inhibitors
  };
  const liveAlerts = buildLiveAlerts(momentum, objectiveTimeline, telemetryStatus, teams);

  return {
    ...liveSummary,
    id: String(matchId || liveSummary.id),
    winnerTeamId,
    selectedState: selectedGame.state,
    sourceMatchId: String(firstPresent(root?.matchId, liveSummary.sourceMatchId, matchId) || ""),
    patch: normalizeText(firstPresent(root?.patch, root?.gameVersion), "unknown"),
    freshness: {
      source: "stratz",
      status: telemetryRich ? "healthy" : telemetryAvailable ? "partial" : liveSummary.status === "live" ? "partial" : "schedule_only",
      updatedAt: liveSummary.updatedAt || new Date().toISOString()
    },
    keyMoments,
    timeline: [],
    objectiveTimeline,
    objectiveControl,
    objectiveBreakdown,
    objectiveRuns: [],
    goldLeadSeries,
    leadTrend,
    playerEconomy,
    teamEconomyTotals,
    topPerformers,
    momentum,
    dataConfidence: {
      grade: telemetryRich ? "high" : telemetryAvailable ? "medium" : "low",
      score: telemetryRich ? 86 : telemetryAvailable ? 72 : 50,
      telemetry:
        telemetryStatus === "rich"
          ? "provider_rich"
          : telemetryAvailable
            ? "provider_basic"
            : liveSummary.status === "live"
              ? "live_status_only"
              : "schedule_only",
      notes: telemetryAvailable
        ? [
            telemetryRich
              ? "Live STRATZ playback data normalized into the Pulseboard Dota contract."
              : "Live STRATZ player and scoreboard data normalized into the Pulseboard Dota contract."
          ]
        : ["STRATZ match resolved, but only limited state is currently available from the returned payload."]
    },
    pulseCard: {
      tone: telemetryRich ? "good" : telemetryAvailable ? "info" : liveSummary.status === "live" ? "warn" : "neutral",
      title: telemetryAvailable ? "STRATZ live detail active" : "STRATZ status confirmed",
      summary: telemetryAvailable
        ? telemetryRich
          ? "Rich live Dota telemetry is available from STRATZ."
          : "Basic live Dota telemetry is now available from STRATZ."
        : "Series resolved through STRATZ, but the returned payload does not include rich live telemetry yet."
    },
    edgeMeter: {
      left: {
        team: teams.left.name,
        score: Math.max(0, Math.min(100, Math.round(50 + momentum.goldLead / 220 + momentum.killDiff * 1.6))),
        drivers: [
          `Gold ${signed(momentum.goldLead)}`,
          `Kills ${signed(momentum.killDiff)}`,
          `Control ${Number(objectiveControl?.left?.controlPct || 50).toFixed(1)}%`
        ]
      },
      right: {
        team: teams.right.name,
        score: Math.max(0, Math.min(100, Math.round(50 - momentum.goldLead / 220 - momentum.killDiff * 1.6))),
        drivers: [
          `Gold ${signed(-momentum.goldLead)}`,
          `Kills ${signed(-momentum.killDiff)}`,
          `Control ${Number(objectiveControl?.right?.controlPct || 50).toFixed(1)}%`
        ]
      },
      verdict:
        telemetryRich
          ? "Rich live telemetry available."
          : telemetryAvailable
            ? "Basic live telemetry available."
            : "Waiting for richer live STRATZ telemetry."
    },
    tempoSnapshot: {
      completedGames: seriesProgress.completedGames,
      averageDurationMinutes: null,
      shortestDurationMinutes: null,
      longestDurationMinutes: null,
      currentGameMinutes: playerEconomy.elapsedSeconds > 0 ? Number((playerEconomy.elapsedSeconds / 60).toFixed(1)) : null,
      objectivePer10Minutes:
        playerEconomy.elapsedSeconds > 0
          ? Number((objectiveTimeline.length / Math.max(1, playerEconomy.elapsedSeconds / 600)).toFixed(2))
          : null,
      objectiveEvents: objectiveTimeline.length
    },
    tacticalChecklist: telemetryAvailable
      ? [
          {
            tone: telemetryRich ? "good" : "info",
            title: telemetryRich ? "Rich telemetry active" : "Basic telemetry active",
            detail:
              telemetryRich
                ? "Player rows, gold trend, objectives, and live feed are coming from STRATZ."
                : "Player rows and scoreboard are coming from STRATZ."
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
    teamDraft,
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
    combatBursts,
    goldMilestones,
    liveAlerts,
    matchupReadiness: telemetryRich ? "high" : telemetryAvailable ? "medium" : "low",
    matchupKeyFactors: telemetryRich
      ? ["STRATZ playback feed", "Gold trend available", "Objective timeline available"]
      : telemetryAvailable
        ? ["STRATZ live detail", "Player board available"]
        : ["STRATZ status only"],
    matchupAlertLevel: telemetryRich ? "high" : telemetryAvailable ? "medium" : "low",
    matchupMeta: null,
    seriesGames,
    selectedGame: {
      number: selectedGameNumber,
      state: selectedGame.state,
      label: selectedGame.label,
      title: `Game ${selectedGameNumber}`,
      telemetryStatus,
      telemetryCounts: {
        tickerEvents: liveTicker.length,
        objectiveEvents: objectiveTimeline.length,
        combatBursts: combatBursts.length,
        goldMilestones: goldMilestones.length
      },
      snapshot,
      tips: [],
      sideSummary: [`${teams.left.name} Radiant`, `${teams.right.name} Dire`],
      watchUrl,
      watchOptions,
      startedAt: selectedGame.startedAt || liveSummary.startAt || null,
      durationMinutes:
        playerEconomy.elapsedSeconds > 0 ? Number((playerEconomy.elapsedSeconds / 60).toFixed(1)) : null,
      requestedMissing: false,
      sourceMatchId: String(firstPresent(root?.matchId, liveSummary.sourceMatchId, matchId) || ""),
      winnerTeamId
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
    liveTicker,
    liveWinRateSeries,
    source: {
      provider: "stratz"
    }
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
