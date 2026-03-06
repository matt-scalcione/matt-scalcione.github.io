import { randomUUID } from "node:crypto";
import { OpenDotaProvider } from "../providers/dota/openDotaProvider.js";
import { LolEsportsProvider } from "../providers/lol/lolEsportsProvider.js";

const now = Date.now();
const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;

const dataMode = String(process.env.ESPORTS_DATA_MODE || "hybrid").toLowerCase();
const providerCacheMs = Number.parseInt(process.env.PROVIDER_CACHE_MS || "30000", 10);
const defaultDotaTiers = parseTierList(process.env.DOTA_TIERS || "1,2,3,4");

const openDotaProvider = new OpenDotaProvider({
  timeoutMs: Number.parseInt(process.env.PROVIDER_TIMEOUT_MS || "4500", 10)
});
const lolEsportsProvider = new LolEsportsProvider({
  timeoutMs: Number.parseInt(process.env.PROVIDER_TIMEOUT_MS || "4500", 10)
});

const providerState = {
  lolLive: {
    fetchedAt: 0,
    status: "stale",
    rows: []
  },
  lolSchedule: {
    fetchedAt: 0,
    status: "stale",
    rows: []
  },
  lolResults: {
    fetchedAt: 0,
    status: "stale",
    rows: []
  },
  live: {
    fetchedAt: 0,
    status: "stale",
    rows: []
  },
  results: {
    fetchedAt: 0,
    status: "stale",
    rows: []
  },
  detailById: new Map(),
  lolDetailById: new Map()
};

function parseTierList(value) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((tier) => Number.isInteger(tier) && tier >= 1 && tier <= 4);

  return parsed.length ? Array.from(new Set(parsed)) : [1, 2, 3, 4];
}

const liveMatches = [
  {
    id: "lol_lta_2026_w2_fly_tl",
    game: "lol",
    region: "na",
    tournament: "LTA North 2026 Spring",
    status: "live",
    startAt: new Date(now - 23 * oneMinute).toISOString(),
    updatedAt: new Date(now - 3 * 1000).toISOString(),
    bestOf: 3,
    seriesScore: { left: 1, right: 0 },
    teams: {
      left: { id: "team_fly", name: "FlyQuest" },
      right: { id: "team_tl", name: "Team Liquid" }
    },
    keySignal: "major_swing"
  },
  {
    id: "dota_dl_s26_liq_gaim",
    game: "dota2",
    region: "eu",
    tournament: "DreamLeague Season 26",
    status: "live",
    startAt: new Date(now - 37 * oneMinute).toISOString(),
    updatedAt: new Date(now - 5 * 1000).toISOString(),
    bestOf: 2,
    seriesScore: { left: 0, right: 1 },
    teams: {
      left: { id: "team_liq", name: "Team Liquid" },
      right: { id: "team_gaim", name: "Gaimin Gladiators" }
    },
    keySignal: "game_point"
  },
  {
    id: "lol_lck_2026_w2_t1_gen",
    game: "lol",
    region: "kr",
    tournament: "LCK 2026 Spring",
    status: "upcoming",
    startAt: new Date(now + 30 * oneMinute).toISOString(),
    updatedAt: new Date(now - 15 * 1000).toISOString(),
    bestOf: 3,
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_t1", name: "T1" },
      right: { id: "team_gen", name: "Gen.G" }
    },
    keySignal: "match_starting"
  }
];

const scheduleOnlyMatches = [
  {
    id: "dota_esl_bhm_spirit_falc",
    game: "dota2",
    region: "mena",
    tournament: "ESL One Birmingham 2026",
    status: "upcoming",
    startAt: new Date(now + 2 * oneHour).toISOString(),
    updatedAt: new Date(now - 20 * 1000).toISOString(),
    bestOf: 3,
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_spirit", name: "Team Spirit" },
      right: { id: "team_falc", name: "Team Falcons" }
    },
    keySignal: "high_expectation"
  },
  {
    id: "lol_lpl_2026_w3_blg_jdg",
    game: "lol",
    region: "cn",
    tournament: "LPL 2026 Spring",
    status: "upcoming",
    startAt: new Date(now + 4 * oneHour).toISOString(),
    updatedAt: new Date(now - 25 * 1000).toISOString(),
    bestOf: 3,
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_blg", name: "Bilibili Gaming" },
      right: { id: "team_jdg", name: "JDG" }
    },
    keySignal: "rivalry"
  }
];

const completedMatches = [
  {
    id: "lol_lta_2026_w2_c9_100",
    game: "lol",
    region: "na",
    tournament: "LTA North 2026 Spring",
    status: "completed",
    startAt: new Date(now - 6 * oneHour).toISOString(),
    endAt: new Date(now - 4.7 * oneHour).toISOString(),
    bestOf: 3,
    seriesScore: { left: 2, right: 1 },
    teams: {
      left: { id: "team_c9", name: "Cloud9" },
      right: { id: "team_100", name: "100 Thieves" }
    },
    winnerTeamId: "team_c9"
  },
  {
    id: "dota_dl_s26_xtreme_tundra",
    game: "dota2",
    region: "eu",
    tournament: "DreamLeague Season 26",
    status: "completed",
    startAt: new Date(now - 8 * oneHour).toISOString(),
    endAt: new Date(now - 6.5 * oneHour).toISOString(),
    bestOf: 2,
    seriesScore: { left: 0, right: 2 },
    teams: {
      left: { id: "team_xtreme", name: "Xtreme Gaming" },
      right: { id: "team_tundra", name: "Tundra Esports" }
    },
    winnerTeamId: "team_tundra"
  },
  {
    id: "lol_lck_2026_w2_hle_dkx",
    game: "lol",
    region: "kr",
    tournament: "LCK 2026 Spring",
    status: "completed",
    startAt: new Date(now - 28 * oneHour).toISOString(),
    endAt: new Date(now - 26.8 * oneHour).toISOString(),
    bestOf: 3,
    seriesScore: { left: 2, right: 0 },
    teams: {
      left: { id: "team_hle", name: "Hanwha Life Esports" },
      right: { id: "team_dkx", name: "Dplus KIA" }
    },
    winnerTeamId: "team_hle"
  }
];

const scheduleMatches = [...liveMatches, ...scheduleOnlyMatches];

const matchDetails = {
  lol_lta_2026_w2_fly_tl: {
    id: "lol_lta_2026_w2_fly_tl",
    game: "lol",
    tournament: "LTA North 2026 Spring",
    patch: "16.4",
    status: "live",
    freshness: {
      source: "mock_primary",
      status: "healthy",
      updatedAt: new Date(now - 3 * 1000).toISOString()
    },
    seriesScore: { left: 1, right: 0 },
    teams: {
      left: { id: "team_fly", name: "FlyQuest", gold: 47200, kills: 14, towers: 6, dragons: 2 },
      right: { id: "team_tl", name: "Team Liquid", gold: 46100, kills: 9, towers: 4, dragons: 1 }
    },
    keyMoments: [
      {
        id: "km_1",
        occurredAt: new Date(now - 12 * oneMinute).toISOString(),
        importance: "high",
        title: "FlyQuest secured Baron",
        summary: "Objective control flipped map pressure and enabled a 2k gold swing."
      },
      {
        id: "km_2",
        occurredAt: new Date(now - 4 * oneMinute).toISOString(),
        importance: "medium",
        title: "Team Liquid won side skirmish",
        summary: "Picked two targets and slowed FlyQuest's push timing."
      }
    ],
    timeline: [
      { at: "08:40", type: "objective", label: "Dragon - FlyQuest" },
      { at: "15:12", type: "teamfight", label: "2 for 1 trade - Team Liquid" },
      { at: "23:02", type: "objective", label: "Baron - FlyQuest" }
    ]
  },
  dota_dl_s26_liq_gaim: {
    id: "dota_dl_s26_liq_gaim",
    game: "dota2",
    tournament: "DreamLeague Season 26",
    patch: "7.39",
    status: "live",
    freshness: {
      source: "mock_primary",
      status: "healthy",
      updatedAt: new Date(now - 5 * 1000).toISOString()
    },
    seriesScore: { left: 0, right: 1 },
    teams: {
      left: { id: "team_liq", name: "Team Liquid", netWorth: 51600, kills: 19, towers: 3 },
      right: { id: "team_gaim", name: "Gaimin Gladiators", netWorth: 53200, kills: 24, towers: 6 }
    },
    keyMoments: [
      {
        id: "km_3",
        occurredAt: new Date(now - 10 * oneMinute).toISOString(),
        importance: "critical",
        title: "Gaimin secured Roshan",
        summary: "Aegis timing enabled high-ground pressure and forced buybacks."
      }
    ],
    timeline: [
      { at: "12:50", type: "teamfight", label: "3 for 2 trade - Team Liquid" },
      { at: "25:28", type: "objective", label: "Roshan - Gaimin Gladiators" },
      { at: "31:02", type: "push", label: "Top barracks destroyed - Gaimin Gladiators" }
    ]
  },
  lol_lck_2026_w2_t1_gen: {
    id: "lol_lck_2026_w2_t1_gen",
    game: "lol",
    tournament: "LCK 2026 Spring",
    patch: "16.4",
    status: "upcoming",
    freshness: {
      source: "mock_primary",
      status: "healthy",
      updatedAt: new Date(now - 15 * 1000).toISOString()
    },
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_t1", name: "T1" },
      right: { id: "team_gen", name: "Gen.G" }
    },
    keyMoments: [],
    timeline: []
  },
  dota_esl_bhm_spirit_falc: {
    id: "dota_esl_bhm_spirit_falc",
    game: "dota2",
    tournament: "ESL One Birmingham 2026",
    patch: "7.39",
    status: "upcoming",
    freshness: {
      source: "mock_primary",
      status: "healthy",
      updatedAt: new Date(now - 20 * 1000).toISOString()
    },
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_spirit", name: "Team Spirit" },
      right: { id: "team_falc", name: "Team Falcons" }
    },
    keyMoments: [],
    timeline: []
  },
  lol_lpl_2026_w3_blg_jdg: {
    id: "lol_lpl_2026_w3_blg_jdg",
    game: "lol",
    tournament: "LPL 2026 Spring",
    patch: "16.4",
    status: "upcoming",
    freshness: {
      source: "mock_primary",
      status: "healthy",
      updatedAt: new Date(now - 25 * 1000).toISOString()
    },
    seriesScore: { left: 0, right: 0 },
    teams: {
      left: { id: "team_blg", name: "Bilibili Gaming" },
      right: { id: "team_jdg", name: "JDG" }
    },
    keyMoments: [],
    timeline: []
  },
  lol_lta_2026_w2_c9_100: {
    id: "lol_lta_2026_w2_c9_100",
    game: "lol",
    tournament: "LTA North 2026 Spring",
    patch: "16.4",
    status: "completed",
    freshness: {
      source: "mock_archive",
      status: "healthy",
      updatedAt: new Date(now - 4.7 * oneHour).toISOString()
    },
    seriesScore: { left: 2, right: 1 },
    teams: {
      left: { id: "team_c9", name: "Cloud9", kills: 38, towers: 19, dragons: 6 },
      right: { id: "team_100", name: "100 Thieves", kills: 30, towers: 13, dragons: 3 }
    },
    keyMoments: [
      {
        id: "km_4",
        occurredAt: new Date(now - 5.2 * oneHour).toISOString(),
        importance: "high",
        title: "Cloud9 won soul fight",
        summary: "Four-for-one fight secured infernal soul and map control."
      }
    ],
    timeline: [{ at: "32:21", type: "teamfight", label: "4 for 1 trade - Cloud9" }]
  },
  dota_dl_s26_xtreme_tundra: {
    id: "dota_dl_s26_xtreme_tundra",
    game: "dota2",
    tournament: "DreamLeague Season 26",
    patch: "7.39",
    status: "completed",
    freshness: {
      source: "mock_archive",
      status: "healthy",
      updatedAt: new Date(now - 6.5 * oneHour).toISOString()
    },
    seriesScore: { left: 0, right: 2 },
    teams: {
      left: { id: "team_xtreme", name: "Xtreme Gaming", kills: 21, towers: 4 },
      right: { id: "team_tundra", name: "Tundra Esports", kills: 39, towers: 14 }
    },
    keyMoments: [
      {
        id: "km_5",
        occurredAt: new Date(now - 7.1 * oneHour).toISOString(),
        importance: "critical",
        title: "Tundra secured second Roshan",
        summary: "Double Roshan sequence closed both games with clean high-ground pushes."
      }
    ],
    timeline: [{ at: "41:12", type: "objective", label: "Roshan - Tundra Esports" }]
  },
  lol_lck_2026_w2_hle_dkx: {
    id: "lol_lck_2026_w2_hle_dkx",
    game: "lol",
    tournament: "LCK 2026 Spring",
    patch: "16.4",
    status: "completed",
    freshness: {
      source: "mock_archive",
      status: "healthy",
      updatedAt: new Date(now - 26.8 * oneHour).toISOString()
    },
    seriesScore: { left: 2, right: 0 },
    teams: {
      left: { id: "team_hle", name: "Hanwha Life Esports", kills: 27, towers: 14, dragons: 4 },
      right: { id: "team_dkx", name: "Dplus KIA", kills: 18, towers: 7, dragons: 1 }
    },
    keyMoments: [
      {
        id: "km_6",
        occurredAt: new Date(now - 27.2 * oneHour).toISOString(),
        importance: "high",
        title: "HLE broke base at 22 minutes",
        summary: "Fast tempo from double herald setup forced DKX into defensive drafts."
      }
    ],
    timeline: [{ at: "22:03", type: "push", label: "Mid inhibitor destroyed - HLE" }]
  }
};

const follows = [
  {
    id: "follow_1",
    userId: "demo-user",
    entityType: "team",
    entityId: "team_t1",
    createdAt: new Date(now - 3 * 24 * 60 * oneMinute).toISOString()
  },
  {
    id: "follow_2",
    userId: "demo-user",
    entityType: "team",
    entityId: "team_liq",
    createdAt: new Date(now - 2 * 24 * 60 * oneMinute).toISOString()
  }
];

const notificationPreferencesByUser = new Map([
  [
    "demo-user",
    {
      userId: "demo-user",
      webPush: true,
      emailDigest: true,
      swingAlerts: false,
      matchStart: true,
      matchFinal: true,
      updatedAt: new Date(now - 12 * oneHour).toISOString()
    }
  ]
]);

function filterByGameRegion(rows, { game, region }) {
  let filtered = rows.slice();

  if (game) {
    filtered = filtered.filter((match) => match.game === game);
  }

  if (region) {
    filtered = filtered.filter((match) => match.region === region);
  }

  return filtered;
}

function filterByDateRange(rows, { dateFrom, dateTo, getDateField }) {
  return rows.filter((row) => {
    const raw = getDateField(row);
    const value = Date.parse(raw);
    if (Number.isNaN(value)) {
      return false;
    }

    if (typeof dateFrom === "number" && value < dateFrom) {
      return false;
    }

    if (typeof dateTo === "number" && value > dateTo) {
      return false;
    }

    return true;
  });
}

function sortByDateAscending(rows, key) {
  return rows.slice().sort((a, b) => Date.parse(a[key]) - Date.parse(b[key]));
}

function sortByDateDescending(rows, key) {
  return rows.slice().sort((a, b) => Date.parse(b[key]) - Date.parse(a[key]));
}

function belongsToFollowedTeam(match, followedTeamIds) {
  return followedTeamIds.has(match.teams.left.id) || followedTeamIds.has(match.teams.right.id);
}

function isProviderModeEnabled() {
  return dataMode === "hybrid" || dataMode === "live";
}

function shouldHideFallbackDotaRows() {
  return isProviderModeEnabled();
}

function normalizeDotaTierInput(dotaTiers) {
  if (!Array.isArray(dotaTiers) || dotaTiers.length === 0) {
    return defaultDotaTiers;
  }

  const valid = dotaTiers
    .map((tier) => Number.parseInt(String(tier), 10))
    .filter((tier) => Number.isInteger(tier) && tier >= 1 && tier <= 4);

  return valid.length ? Array.from(new Set(valid)) : defaultDotaTiers;
}

function stripFallbackDotaRows(rows) {
  return rows.filter((row) => row.game !== "dota2");
}

function filterByDotaTiers(rows, dotaTiers) {
  const normalizedTiers = normalizeDotaTierInput(dotaTiers);

  return rows.filter((row) => {
    if (row.game !== "dota2") {
      return true;
    }

    if (typeof row.competitiveTier === "number") {
      return normalizedTiers.includes(row.competitiveTier);
    }

    return !shouldHideFallbackDotaRows();
  });
}

async function loadProviderLiveMatches() {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const ageMs = Date.now() - providerState.live.fetchedAt;
  if (ageMs <= providerCacheMs && providerState.live.status !== "stale") {
    return {
      status: providerState.live.status,
      rows: providerState.live.rows
    };
  }

  try {
    const rows = await openDotaProvider.fetchLiveMatches({
      allowedTiers: defaultDotaTiers
    });
    providerState.live = {
      fetchedAt: Date.now(),
      status: "success",
      rows
    };
  } catch {
    providerState.live = {
      fetchedAt: Date.now(),
      status: "error",
      rows: []
    };
  }

  return {
    status: providerState.live.status,
    rows: providerState.live.rows
  };
}

async function loadProviderResults() {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const ageMs = Date.now() - providerState.results.fetchedAt;
  if (ageMs <= providerCacheMs && providerState.results.status !== "stale") {
    return {
      status: providerState.results.status,
      rows: providerState.results.rows
    };
  }

  try {
    const rows = await openDotaProvider.fetchRecentResults({
      allowedTiers: defaultDotaTiers
    });
    providerState.results = {
      fetchedAt: Date.now(),
      status: "success",
      rows
    };
  } catch {
    providerState.results = {
      fetchedAt: Date.now(),
      status: "error",
      rows: []
    };
  }

  return {
    status: providerState.results.status,
    rows: providerState.results.rows
  };
}

async function loadProviderLolLiveMatches() {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const ageMs = Date.now() - providerState.lolLive.fetchedAt;
  if (ageMs <= providerCacheMs && providerState.lolLive.status !== "stale") {
    return {
      status: providerState.lolLive.status,
      rows: providerState.lolLive.rows
    };
  }

  try {
    const rows = await lolEsportsProvider.fetchLiveMatches();
    providerState.lolLive = {
      fetchedAt: Date.now(),
      status: "success",
      rows
    };
  } catch {
    providerState.lolLive = {
      fetchedAt: Date.now(),
      status: "error",
      rows: []
    };
  }

  return {
    status: providerState.lolLive.status,
    rows: providerState.lolLive.rows
  };
}

async function loadProviderLolScheduleMatches() {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const ageMs = Date.now() - providerState.lolSchedule.fetchedAt;
  if (ageMs <= providerCacheMs && providerState.lolSchedule.status !== "stale") {
    return {
      status: providerState.lolSchedule.status,
      rows: providerState.lolSchedule.rows
    };
  }

  try {
    const rows = await lolEsportsProvider
      .fetchScheduleMatches()
      .then((scheduleRows) => scheduleRows.filter((row) => row.status !== "completed"));
    providerState.lolSchedule = {
      fetchedAt: Date.now(),
      status: "success",
      rows
    };
  } catch {
    providerState.lolSchedule = {
      fetchedAt: Date.now(),
      status: "error",
      rows: []
    };
  }

  return {
    status: providerState.lolSchedule.status,
    rows: providerState.lolSchedule.rows
  };
}

async function loadProviderLolResults() {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const ageMs = Date.now() - providerState.lolResults.fetchedAt;
  if (ageMs <= providerCacheMs && providerState.lolResults.status !== "stale") {
    return {
      status: providerState.lolResults.status,
      rows: providerState.lolResults.rows
    };
  }

  try {
    const rows = await lolEsportsProvider.fetchRecentResults();
    providerState.lolResults = {
      fetchedAt: Date.now(),
      status: "success",
      rows
    };
  } catch {
    providerState.lolResults = {
      fetchedAt: Date.now(),
      status: "error",
      rows: []
    };
  }

  return {
    status: providerState.lolResults.status,
    rows: providerState.lolResults.rows
  };
}

function replaceFallbackRowsForGame(fallbackRows, game, providerRowsState, { strictNoFallback = false } = {}) {
  if (providerRowsState.status === "success") {
    const withoutGame = fallbackRows.filter((row) => row.game !== game);
    return withoutGame.concat(providerRowsState.rows);
  }

  if (strictNoFallback) {
    return fallbackRows.filter((row) => row.game !== game);
  }

  return fallbackRows.slice();
}

function matchDetailCacheKey(matchId, { gameNumber } = {}) {
  if (!Number.isInteger(gameNumber) || gameNumber < 1) {
    return `${matchId}::auto`;
  }

  return `${matchId}::g${gameNumber}`;
}

function clampHistoryLimit(value, fallback = 5) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(20, parsed));
}

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function teamSideInMatch(match, { teamId, teamName } = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  if (normalizedTeamId && String(match?.teams?.left?.id || "") === normalizedTeamId) {
    return "left";
  }

  if (normalizedTeamId && String(match?.teams?.right?.id || "") === normalizedTeamId) {
    return "right";
  }

  const normalizedTeamName = normalizeTeamName(teamName);
  if (!normalizedTeamName) {
    return null;
  }

  if (normalizeTeamName(match?.teams?.left?.name) === normalizedTeamName) {
    return "left";
  }

  if (normalizeTeamName(match?.teams?.right?.name) === normalizedTeamName) {
    return "right";
  }

  return null;
}

function perspectiveForTeam(match, { teamId, teamName } = {}) {
  const side = teamSideInMatch(match, { teamId, teamName });
  if (!side) {
    return null;
  }

  const opponentSide = side === "left" ? "right" : "left";
  const ownScore = Number(match?.seriesScore?.[side] || 0);
  const oppScore = Number(match?.seriesScore?.[opponentSide] || 0);
  const ownTeamId = match?.teams?.[side]?.id || null;
  const ownTeamName = match?.teams?.[side]?.name || null;
  const winnerTeamId = match?.winnerTeamId || null;
  const winnerSide =
    winnerTeamId && winnerTeamId === String(match?.teams?.left?.id || "")
      ? "left"
      : winnerTeamId && winnerTeamId === String(match?.teams?.right?.id || "")
        ? "right"
        : null;
  let result;
  if (winnerSide) {
    result = winnerSide === side ? "win" : "loss";
  } else if (winnerTeamId && teamId && String(winnerTeamId) === String(teamId)) {
    result = "win";
  } else if (winnerTeamId && teamId) {
    result = "loss";
  } else {
    result = ownScore > oppScore ? "win" : oppScore > ownScore ? "loss" : "draw";
  }

  return {
    matchId: match.id,
    game: match.game,
    status: match.status,
    tournament: match.tournament,
    region: match.region,
    startAt: match.startAt,
    endAt: match.endAt || null,
    bestOf: Number(match.bestOf || 1),
    side,
    result,
    ownTeamId,
    ownTeamName,
    ownScore,
    oppScore,
    scoreLabel: `${ownScore}-${oppScore}`,
    opponentId: match?.teams?.[opponentSide]?.id || null,
    opponentName: match?.teams?.[opponentSide]?.name || "Unknown"
  };
}

function mergeUniqueMatches(existingRows = [], additionalRows = []) {
  const rowsById = new Map();
  for (const row of existingRows) {
    if (row?.id) {
      rowsById.set(String(row.id), row);
    }
  }

  for (const row of additionalRows) {
    if (row?.id) {
      rowsById.set(String(row.id), row);
    }
  }

  return Array.from(rowsById.values());
}

function computeStreakLabel(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "n/a";
  }

  let streak = 0;
  let mode = null;
  for (const row of rows) {
    const result = row?.result;
    if (result !== "win" && result !== "loss") {
      break;
    }

    if (!mode) {
      mode = result;
    }

    if (result !== mode) {
      break;
    }

    streak += 1;
  }

  if (!mode || streak === 0) {
    return "n/a";
  }

  return `${mode === "win" ? "W" : "L"}${streak}`;
}

function summarizeForm(rows = []) {
  const wins = rows.filter((row) => row.result === "win").length;
  const losses = rows.filter((row) => row.result === "loss").length;
  const draws = rows.filter((row) => row.result === "draw").length;
  const mapWins = rows.reduce((sum, row) => sum + Number(row.ownScore || 0), 0);
  const mapLosses = rows.reduce((sum, row) => sum + Number(row.oppScore || 0), 0);
  const sampleSeries = Math.max(1, rows.length);
  const sampleMaps = Math.max(1, mapWins + mapLosses);

  return {
    matchesAnalyzed: rows.length,
    wins,
    losses,
    draws,
    seriesWinRatePct: (wins / sampleSeries) * 100,
    mapWins,
    mapLosses,
    mapWinRatePct: (mapWins / sampleMaps) * 100,
    streakLabel: computeStreakLabel(rows),
    formLast5: rows
      .slice(0, 5)
      .map((row) => (row.result === "win" ? "W" : row.result === "loss" ? "L" : "D"))
      .join("")
  };
}

function buildOpponentBreakdown(rows = [], maxRows = 6) {
  const table = new Map();
  for (const row of rows) {
    const key = String(row?.opponentId || row?.opponentName || "unknown");
    if (!table.has(key)) {
      table.set(key, {
        opponentId: row?.opponentId || null,
        opponentName: row?.opponentName || "Unknown",
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0
      });
    }

    const target = table.get(key);
    target.matches += 1;
    if (row.result === "win") target.wins += 1;
    else if (row.result === "loss") target.losses += 1;
    else target.draws += 1;
  }

  return Array.from(table.values())
    .map((row) => ({
      ...row,
      winRatePct: row.matches > 0 ? (row.wins / row.matches) * 100 : 0
    }))
    .sort((left, right) => {
      if (right.matches !== left.matches) return right.matches - left.matches;
      if (right.wins !== left.wins) return right.wins - left.wins;
      return left.losses - right.losses;
    })
    .slice(0, maxRows);
}

function parseRequestedFallbackGameNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    return null;
  }

  return parsed;
}

function fallbackSeriesProgress(seriesScore, bestOf, seriesGames) {
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const leftWins = Number(seriesScore?.left || 0);
  const rightWins = Number(seriesScore?.right || 0);
  const completedGames = seriesGames.filter((game) => game.state === "completed").length;
  const inProgressGames = seriesGames.filter((game) => game.state === "inProgress").length;
  const skippedGames = seriesGames.filter((game) => game.state === "unneeded").length;

  return {
    bestOf,
    winsNeeded,
    leftWins,
    rightWins,
    leftToWin: Math.max(0, winsNeeded - leftWins),
    rightToWin: Math.max(0, winsNeeded - rightWins),
    completedGames,
    inProgressGames,
    skippedGames,
    totalScheduledGames: bestOf,
    decided: leftWins >= winsNeeded || rightWins >= winsNeeded
  };
}

function buildFallbackDotaDetailFromSummary(match, options = {}) {
  if (!match || match.game !== "dota2") {
    return null;
  }

  const status = String(match?.status || "upcoming");
  const bestOf = Math.max(1, Number(match?.bestOf || 1));
  const seriesScore = {
    left: Number(match?.seriesScore?.left || 0),
    right: Number(match?.seriesScore?.right || 0)
  };
  const completedWins = seriesScore.left + seriesScore.right;
  const currentGameNumber =
    status === "live"
      ? Math.max(1, completedWins + 1)
      : status === "completed"
        ? Math.max(1, completedWins || 1)
        : 1;
  const totalSlots = Math.max(bestOf, currentGameNumber);
  const requestedGameNumber = parseRequestedFallbackGameNumber(options?.gameNumber);

  const seriesGames = [];
  const startMs = Date.parse(String(match?.startAt || ""));
  for (let number = 1; number <= totalSlots; number += 1) {
    let state = "unstarted";
    if (number < currentGameNumber) {
      state = "completed";
    } else if (number === currentGameNumber) {
      state = status === "live" ? "inProgress" : status === "completed" ? "completed" : "unstarted";
    }

    if (number > currentGameNumber && completedWins >= Math.floor(bestOf / 2) + 1) {
      state = "unneeded";
    }

    const startedAt =
      Number.isFinite(startMs)
        ? new Date(startMs + (number - 1) * 45 * 60 * 1000).toISOString()
        : null;

    seriesGames.push({
      id: `fallback_dota_game_${number}`,
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
      winnerTeamId: state === "completed" && number === currentGameNumber ? match?.winnerTeamId || null : null,
      sideInfo: {
        leftSide: "radiant",
        rightSide: "dire"
      },
      durationMinutes: state === "completed" ? 40 : null,
      startedAt,
      watchUrl: `https://www.opendota.com/matches/${String(match?.providerMatchId || "").trim()}`,
      watchProvider: "opendota",
      watchOptions: []
    });
  }

  let selectedGame = null;
  if (requestedGameNumber !== null) {
    selectedGame = seriesGames.find((game) => game.number === requestedGameNumber) || null;
  }
  if (!selectedGame) {
    selectedGame = seriesGames.find((game) => game.state === "inProgress") || null;
  }
  if (!selectedGame) {
    selectedGame = seriesGames.filter((game) => game.state === "completed").pop() || null;
  }
  if (!selectedGame) {
    selectedGame = seriesGames[0] || null;
  }

  if (selectedGame) {
    selectedGame.selected = true;
  }

  const selectedGameNumber = Number(selectedGame?.number || 1);
  const selectedState = String(selectedGame?.state || "unstarted");
  const leftKills = Number(match?.teams?.left?.kills || 0);
  const rightKills = Number(match?.teams?.right?.kills || 0);

  const selectedSnapshot = {
    left: {
      kills: leftKills,
      towers: Number(match?.teams?.left?.towers || 0),
      dragons: 0,
      barons: 0,
      inhibitors: 0,
      gold: null
    },
    right: {
      kills: rightKills,
      towers: Number(match?.teams?.right?.towers || 0),
      dragons: 0,
      barons: 0,
      inhibitors: 0,
      gold: null
    }
  };

  const selectedReason =
    requestedGameNumber !== null && selectedGame?.number !== requestedGameNumber
      ? "fallback_nearest"
      : requestedGameNumber !== null
        ? "requested"
        : selectedState === "inProgress"
          ? "in_progress"
          : selectedState === "completed"
            ? "latest_completed"
            : "first_scheduled";

  const selectedIndex = seriesGames.findIndex((game) => game.number === selectedGameNumber);
  const previousGameNumber = selectedIndex > 0 ? seriesGames[selectedIndex - 1].number : null;
  const nextGameNumber =
    selectedIndex >= 0 && selectedIndex < seriesGames.length - 1
      ? seriesGames[selectedIndex + 1].number
      : null;
  const liveGame = seriesGames.find((game) => game.state === "inProgress") || null;

  const seriesProgress = fallbackSeriesProgress(seriesScore, bestOf, seriesGames);
  const liveTicker =
    status === "live"
      ? [
          {
            id: `fallback_start_${selectedGameNumber}`,
            type: "state",
            team: null,
            title: `Game ${selectedGameNumber} in progress`,
            summary: `${match?.teams?.left?.name || "Radiant"} vs ${match?.teams?.right?.name || "Dire"}`,
            importance: "high",
            occurredAt: match?.startAt || new Date().toISOString()
          }
        ]
      : [];

  return {
    ...match,
    patch: match?.patch || "unknown",
    freshness: {
      source: "provider_fallback",
      status: "degraded",
      updatedAt: new Date().toISOString()
    },
    keyMoments: [],
    timeline: [],
    objectiveTimeline: [],
    objectiveControl: {
      left: { towers: 0, dragons: 0, barons: 0, inhibitors: 0, score: 0, controlPct: 50 },
      right: { towers: 0, dragons: 0, barons: 0, inhibitors: 0, score: 0, controlPct: 50 }
    },
    objectiveBreakdown: {
      left: { total: 0, dragon: 0, baron: 0, tower: 0, inhibitor: 0, other: 0 },
      right: { total: 0, dragon: 0, baron: 0, tower: 0, inhibitor: 0, other: 0 }
    },
    objectiveRuns: [],
    goldLeadSeries: [],
    leadTrend: null,
    playerEconomy: {
      elapsedSeconds: 0,
      updatedAt: new Date().toISOString(),
      left: [],
      right: []
    },
    teamEconomyTotals: {
      left: { totalGold: 0, totalGpm: 0, avgGpm: 0 },
      right: { totalGold: 0, totalGpm: 0, avgGpm: 0 }
    },
    topPerformers: [],
    momentum: {
      leaderTeamId: null,
      goldLead: 0,
      goldLeadDeltaWindow: 0,
      killDiff: leftKills - rightKills,
      towerDiff: 0,
      dragonDiff: 0,
      baronDiff: 0,
      inhibitorDiff: 0
    },
    dataConfidence: {
      grade: "low",
      score: 45,
      telemetry: "fallback",
      notes: ["OpenDota match detail unavailable; fallback summary applied."]
    },
    pulseCard: {
      tone: "neutral",
      title: "Fallback Summary",
      summary: "Detailed telemetry is temporarily unavailable for this map."
    },
    edgeMeter: {
      left: { team: match?.teams?.left?.name || "Radiant", score: 50, drivers: ["Detailed signal unavailable"] },
      right: { team: match?.teams?.right?.name || "Dire", score: 50, drivers: ["Detailed signal unavailable"] },
      verdict: "No edge signal without full map telemetry."
    },
    tempoSnapshot: {
      completedGames: seriesProgress.completedGames,
      averageDurationMinutes: null,
      shortestDurationMinutes: null,
      longestDurationMinutes: null,
      currentGameMinutes: null,
      objectivePer10Minutes: null,
      objectiveEvents: 0
    },
    tacticalChecklist: [
      {
        tone: "neutral",
        title: "Telemetry degraded",
        detail: "Provider detail is currently unavailable for this map."
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
      venue: match?.tournament || "Tournament stage",
      streamUrl: selectedGame?.watchUrl || null,
      streamLabel: selectedGame?.watchUrl ? "OpenDota Match Page" : "Official stream pending",
      language: "Global",
      status
    },
    teamForm: null,
    headToHead: null,
    prediction: {
      modelVersion: "fallback-v1",
      leftWinPct: 50,
      rightWinPct: 50,
      favoriteTeamName: "Even",
      confidence: "low",
      drivers: ["Insufficient telemetry for predictive signal."]
    },
    combatBursts: [],
    goldMilestones: [],
    liveAlerts: [],
    matchupReadiness: null,
    matchupKeyFactors: [],
    matchupAlertLevel: null,
    matchupMeta: null,
    seriesGames,
    selectedGame: {
      number: selectedGameNumber,
      state: selectedState,
      label:
        selectedState === "completed"
          ? "Completed game."
          : selectedState === "inProgress"
            ? "Currently live."
            : "Scheduled next.",
      telemetryStatus: "none",
      telemetryCounts: {
        tickerEvents: liveTicker.length,
        objectiveEvents: 0,
        combatBursts: 0,
        goldMilestones: 0
      },
      snapshot: selectedSnapshot,
      tips: [],
      sideSummary: [
        `${match?.teams?.left?.name || "Radiant"} Radiant`,
        `${match?.teams?.right?.name || "Dire"} Dire`
      ],
      watchUrl: selectedGame?.watchUrl || null,
      watchOptions: [],
      startedAt: selectedGame?.startedAt || match?.startAt || null,
      durationMinutes: selectedGame?.durationMinutes || null,
      requestedMissing: requestedGameNumber !== null && selectedGameNumber !== requestedGameNumber
    },
    gameNavigation: {
      availableGames: seriesGames,
      selectedGameNumber,
      previousGameNumber,
      nextGameNumber,
      currentLiveGameNumber: liveGame?.number || null,
      requestedGameNumber,
      requestedMissing: requestedGameNumber !== null && selectedGameNumber !== requestedGameNumber,
      selectedReason
    },
    seriesHeader: {
      headline: `${match?.teams?.left?.name || "Radiant"} ${seriesScore.left} - ${seriesScore.right} ${match?.teams?.right?.name || "Dire"}`,
      subhead:
        status === "completed"
          ? "Series complete"
          : status === "live"
            ? "Live series"
            : "Upcoming series"
    },
    seriesProgress,
    seriesProjection: {
      matchStartAt: match?.startAt || null,
      countdownSeconds: Number.isFinite(startMs) ? Math.max(0, Math.round((startMs - Date.now()) / 1000)) : null,
      estimatedEndAt: null,
      games: seriesGames.map((game) => ({
        number: game.number,
        estimatedStartAt: game.startedAt || null
      }))
    },
    liveTicker
  };
}

async function fallbackProviderDotaDetail(matchId, options = {}) {
  const [liveState, resultsState] = await Promise.all([
    loadProviderLiveMatches(),
    loadProviderResults()
  ]);

  const liveRows = Array.isArray(liveState?.rows) ? liveState.rows : [];
  const resultRows = Array.isArray(resultsState?.rows) ? resultsState.rows : [];
  const match = [...liveRows, ...resultRows].find((row) => String(row?.id || "") === String(matchId));
  if (!match) {
    return null;
  }

  return buildFallbackDotaDetailFromSummary(match, options);
}

async function loadProviderMatchDetail(matchId, options = {}) {
  const cacheKey = matchDetailCacheKey(matchId, options);

  if (!isProviderModeEnabled()) {
    return null;
  }

  if (String(matchId).startsWith("dota_od_")) {
    const cached = providerState.detailById.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt <= providerCacheMs) {
      return cached.detail;
    }

    try {
      const detail = await openDotaProvider.fetchMatchDetail(matchId, options);
      const resolvedDetail = detail || (await fallbackProviderDotaDetail(matchId, options));
      if (!resolvedDetail) {
        return null;
      }

      providerState.detailById.set(cacheKey, {
        fetchedAt: Date.now(),
        detail: resolvedDetail
      });

      return resolvedDetail;
    } catch {
      const fallback = await fallbackProviderDotaDetail(matchId, options);
      if (!fallback) {
        return null;
      }

      providerState.detailById.set(cacheKey, {
        fetchedAt: Date.now(),
        detail: fallback
      });

      return fallback;
    }
  }

  if (String(matchId).startsWith("lol_riot_")) {
    const cached = providerState.lolDetailById.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt <= providerCacheMs) {
      return cached.detail;
    }

    try {
      const detail = await lolEsportsProvider.fetchMatchDetail(matchId, options);
      if (!detail) {
        return null;
      }

      providerState.lolDetailById.set(cacheKey, {
        fetchedAt: Date.now(),
        detail
      });

      return detail;
    } catch {
      return null;
    }
  }

  return null;
}

export async function listLiveMatches({
  game,
  region,
  followedOnly = false,
  userId = null,
  dotaTiers
}) {
  const [providerDotaLiveState, providerLolLiveState] = await Promise.all([
    loadProviderLiveMatches(),
    loadProviderLolLiveMatches()
  ]);

  let rows = liveMatches.slice();
  rows = replaceFallbackRowsForGame(rows, "lol", providerLolLiveState);
  rows = replaceFallbackRowsForGame(rows, "dota2", providerDotaLiveState, {
    strictNoFallback: shouldHideFallbackDotaRows()
  });

  rows = filterByDotaTiers(rows, dotaTiers);
  rows = filterByGameRegion(rows, { game, region });
  rows = sortByDateAscending(rows, "startAt");

  if (followedOnly) {
    const userFollows = follows.filter(
      (follow) => follow.userId === userId && follow.entityType === "team"
    );
    const followedTeamIds = new Set(userFollows.map((follow) => follow.entityId));
    rows = rows.filter((match) => belongsToFollowedTeam(match, followedTeamIds));
  }

  return rows;
}

export async function listSchedule({ game, region, dateFrom, dateTo, dotaTiers }) {
  const [providerDotaLiveState, providerLolScheduleState] = await Promise.all([
    loadProviderLiveMatches(),
    loadProviderLolScheduleMatches()
  ]);

  let rows = scheduleMatches.slice();
  rows = replaceFallbackRowsForGame(rows, "lol", providerLolScheduleState);
  rows = replaceFallbackRowsForGame(rows, "dota2", providerDotaLiveState, {
    strictNoFallback: shouldHideFallbackDotaRows()
  });

  rows = filterByDotaTiers(rows, dotaTiers);
  rows = filterByGameRegion(rows, { game, region });
  rows = filterByDateRange(rows, {
    dateFrom,
    dateTo,
    getDateField: (row) => row.startAt
  });

  return sortByDateAscending(rows, "startAt");
}

export async function listResults({ game, region, dateFrom, dateTo, dotaTiers }) {
  const [providerDotaResultsState, providerLolResultsState] = await Promise.all([
    loadProviderResults(),
    loadProviderLolResults()
  ]);

  let rows = completedMatches.slice();
  rows = replaceFallbackRowsForGame(rows, "lol", providerLolResultsState);
  rows = replaceFallbackRowsForGame(rows, "dota2", providerDotaResultsState, {
    strictNoFallback: shouldHideFallbackDotaRows()
  });

  rows = filterByDotaTiers(rows, dotaTiers);
  rows = filterByGameRegion(rows, { game, region });
  rows = filterByDateRange(rows, {
    dateFrom,
    dateTo,
    getDateField: (row) => row.endAt || row.startAt
  });

  return sortByDateDescending(rows, "endAt");
}

export async function getMatchDetail(matchId, options = {}) {
  if (matchDetails[matchId]) {
    return matchDetails[matchId];
  }

  if (!String(matchId).startsWith("dota_od_") && !String(matchId).startsWith("lol_riot_")) {
    return null;
  }

  return loadProviderMatchDetail(matchId, options);
}

export async function getTeamProfile(teamId, {
  game,
  opponentId,
  limit = 5,
  seedMatchId,
  teamNameHint
} = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  if (!normalizedTeamId) {
    return null;
  }

  const safeLimit = clampHistoryLimit(limit, 5);
  const requestedOpponentId = String(opponentId || "").trim() || null;
  let requestedOpponentName = null;
  const shouldFetchExtendedLolHistory = !game || game === "lol";
  const shouldFetchExtendedDotaHistory = !game || game === "dota2";

  const [baseResultsRows, scheduleRows, liveRows] = await Promise.all([
    listResults({
      game,
      region: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      dotaTiers: undefined
    }),
    listSchedule({
      game,
      region: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      dotaTiers: undefined
    }),
    listLiveMatches({
      game,
      region: undefined,
      followedOnly: false,
      userId: null,
      dotaTiers: undefined
    })
  ]);

  let resultsRows = baseResultsRows.slice();
  if (isProviderModeEnabled() && shouldFetchExtendedLolHistory) {
    try {
      const extendedLolResults = await lolEsportsProvider.getCachedRecentResults({
        maxRows: 220,
        maxPages: 8
      });
      resultsRows = mergeUniqueMatches(resultsRows, extendedLolResults);
    } catch {
      // Keep base rows when extended provider history fails.
    }
  }

  if (isProviderModeEnabled() && shouldFetchExtendedDotaHistory) {
    try {
      const extendedDotaResults = await openDotaProvider.fetchRecentResults({
        maxRows: 220,
        allowedTiers: defaultDotaTiers
      });
      resultsRows = mergeUniqueMatches(resultsRows, extendedDotaResults);
    } catch {
      // Keep base rows when extended provider history fails.
    }
  }

  const scheduleUnion = [...scheduleRows, ...liveRows];
  const mapTeamResults = ({ teamName } = {}) =>
    resultsRows
      .map((row) =>
        perspectiveForTeam(row, {
          teamId: normalizedTeamId,
          teamName
        })
      )
      .filter(Boolean)
      .sort((left, right) => Date.parse(right.endAt || right.startAt) - Date.parse(left.endAt || left.startAt));
  const mapUpcoming = ({ teamName } = {}) =>
    scheduleUnion
      .filter((row) => row.status === "upcoming" || row.status === "live")
      .map((row) =>
        perspectiveForTeam(row, {
          teamId: normalizedTeamId,
          teamName
        })
      )
      .filter(Boolean)
      .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
      .slice(0, 8);

  let teamResults = mapTeamResults({
    teamName: teamNameHint
  });
  let upcoming = mapUpcoming({
    teamName: teamNameHint
  });

  let teamName = String(teamNameHint || "").trim() || teamResults[0]?.ownTeamName || upcoming[0]?.ownTeamName || null;

  if (!teamName && seedMatchId) {
    try {
      const seed = await getMatchDetail(seedMatchId);
      const seedPerspective = perspectiveForTeam(seed, {
        teamId: normalizedTeamId,
        teamName: teamNameHint
      });
      if (seedPerspective?.ownTeamName) {
        teamName = seedPerspective.ownTeamName;
      }
    } catch {
      // Ignore seed lookup errors and continue.
    }
  }

  if (teamName && teamResults.length === 0) {
    teamResults = mapTeamResults({ teamName });
  }

  if (teamName && upcoming.length === 0) {
    upcoming = mapUpcoming({ teamName });
  }

  if (teamNameHint && !teamName) {
    teamName = String(teamNameHint).trim();
  }

  if (!teamName && teamResults.length > 0) {
    teamName = teamResults[0].ownTeamName || null;
  }

  if (!teamName && upcoming.length > 0) {
    teamName = upcoming[0].ownTeamName || null;
  }

  if (seedMatchId) {
    try {
      const seed = await getMatchDetail(seedMatchId);
      if (seed) {
        const seedPerspective = perspectiveForTeam(seed, {
          teamId: normalizedTeamId,
          teamName: teamName || teamNameHint
        });
        if (seedPerspective) {
          if (!teamName) {
            teamName = seedPerspective.ownTeamName || null;
          }
          if (!requestedOpponentName) {
            requestedOpponentName = seedPerspective.opponentName || null;
          }

          if (seedPerspective.status === "completed") {
            if (!teamResults.some((row) => row.matchId === seedPerspective.matchId)) {
              teamResults = [seedPerspective, ...teamResults];
            }
          } else if (!upcoming.some((row) => row.matchId === seedPerspective.matchId)) {
            upcoming = [seedPerspective, ...upcoming].slice(0, 8);
          }
        }
      }
    } catch {
      // Ignore seed lookup errors and return best-effort profile.
    }
  }

  const dominantGame = game || teamResults[0]?.game || upcoming[0]?.game || "lol";

  if (!teamName && teamResults.length === 0 && upcoming.length === 0) {
    return null;
  }

  const summaryRows = teamResults.slice(0, 12);
  const summary = summarizeForm(summaryRows);
  const recentMatches = teamResults.slice(0, safeLimit);
  const opponentBreakdown = buildOpponentBreakdown(summaryRows);
  const normalizedOpponentName = normalizeTeamName(requestedOpponentName);
  const filteredResults = requestedOpponentId
    ? teamResults.filter((row) => {
        if (String(row.opponentId || "") === requestedOpponentId) {
          return true;
        }

        if (normalizedOpponentName && normalizeTeamName(row.opponentName) === normalizedOpponentName) {
          return true;
        }

        return false;
      })
    : [];

  const headToHead = requestedOpponentId
    ? {
        opponentId: requestedOpponentId,
        opponentName: filteredResults[0]?.opponentName || requestedOpponentName || "Unknown",
        matches: filteredResults.length,
        wins: filteredResults.filter((row) => row.result === "win").length,
        losses: filteredResults.filter((row) => row.result === "loss").length,
        draws: filteredResults.filter((row) => row.result === "draw").length,
        recentMatches: filteredResults.slice(0, safeLimit)
      }
    : null;

  return {
    id: normalizedTeamId,
    game: dominantGame,
    name: teamName || `Team ${normalizedTeamId}`,
    generatedAt: new Date().toISOString(),
    summary,
    recentMatches,
    upcomingMatches: upcoming.slice(0, 5),
    opponentBreakdown,
    headToHead
  };
}

export function listFollows(userId) {
  return follows.filter((follow) => follow.userId === userId);
}

export function addFollow({ userId, entityType, entityId }) {
  const existing = follows.find(
    (follow) =>
      follow.userId === userId &&
      follow.entityType === entityType &&
      follow.entityId === entityId
  );

  if (existing) {
    return existing;
  }

  const follow = {
    id: `follow_${randomUUID()}`,
    userId,
    entityType,
    entityId,
    createdAt: new Date().toISOString()
  };

  follows.push(follow);
  return follow;
}

export function deleteFollowById(followId, userId) {
  const index = follows.findIndex((follow) => follow.id === followId && follow.userId === userId);

  if (index < 0) {
    return false;
  }

  follows.splice(index, 1);
  return true;
}

export function getNotificationPreferences(userId) {
  return (
    notificationPreferencesByUser.get(userId) || {
      userId,
      webPush: false,
      emailDigest: false,
      swingAlerts: false,
      matchStart: true,
      matchFinal: true,
      updatedAt: new Date().toISOString()
    }
  );
}

export function upsertNotificationPreferences({
  userId,
  webPush,
  emailDigest,
  swingAlerts,
  matchStart,
  matchFinal
}) {
  const next = {
    userId,
    webPush: Boolean(webPush),
    emailDigest: Boolean(emailDigest),
    swingAlerts: Boolean(swingAlerts),
    matchStart: Boolean(matchStart),
    matchFinal: Boolean(matchFinal),
    updatedAt: new Date().toISOString()
  };

  notificationPreferencesByUser.set(userId, next);
  return next;
}
