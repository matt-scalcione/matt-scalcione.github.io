import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenDotaProvider } from "../providers/dota/openDotaProvider.js";
import {
  canonicalDotaTournamentKey,
  LiquipediaDotaScheduleProvider
} from "../providers/dota/liquipediaScheduleProvider.js";
import { SteamWebApiDotaProvider } from "../providers/dota/steamWebApiProvider.js";
import { StratzProvider } from "../providers/dota/stratzProvider.js";
import { LolEsportsProvider } from "../providers/lol/lolEsportsProvider.js";
import { fetchJson } from "../providers/shared/http.js";

const now = Date.now();
const oneMinute = 60 * 1000;
const oneHour = 60 * oneMinute;
const dotaSyntheticLiveThresholdMs = Number.parseInt(
  process.env.DOTA_SCHEDULE_PROMOTE_AFTER_MS || String(20 * oneMinute),
  10
);
const dotaSyntheticLiveBaseWindowMs = Number.parseInt(
  process.env.DOTA_SCHEDULE_PROMOTE_BASE_WINDOW_MS || String(30 * oneMinute),
  10
);
const dotaSyntheticLivePerGameWindowMs = Number.parseInt(
  process.env.DOTA_SCHEDULE_PROMOTE_PER_GAME_MS || String(90 * oneMinute),
  10
);

const dataMode = String(process.env.ESPORTS_DATA_MODE || "hybrid").toLowerCase();
const providerCacheMs = Number.parseInt(process.env.PROVIDER_CACHE_MS || "30000", 10);
const defaultDotaTiers = parseTierList(process.env.DOTA_TIERS || "1,2,3,4");
const providerTimeoutMs = Number.parseInt(process.env.PROVIDER_TIMEOUT_MS || "3000", 10);
const providerSlowMs = Number.parseInt(process.env.PROVIDER_SLOW_MS || "1200", 10);
const diagnosticsHistoryLimit = Number.parseInt(process.env.PROVIDER_HISTORY_LIMIT || "60", 10);
const providerDetailCacheLimit = Number.parseInt(process.env.PROVIDER_DETAIL_CACHE_LIMIT || "80", 10);
const providerTeamProfileCacheLimit = Number.parseInt(
  process.env.PROVIDER_TEAM_PROFILE_CACHE_LIMIT || "120",
  10
);
const providerRateLimitCooldownMs = Math.max(
  providerCacheMs,
  Number.parseInt(process.env.PROVIDER_RATE_LIMIT_COOLDOWN_MS || String(5 * oneMinute), 10)
);
const providerRateLimitMaxCooldownMs = Math.max(
  providerRateLimitCooldownMs,
  Number.parseInt(process.env.PROVIDER_RATE_LIMIT_MAX_COOLDOWN_MS || String(30 * oneMinute), 10)
);
const pulseboardPublicBase = String(process.env.PULSEBOARD_PUBLIC_BASE || "https://matt-scalcione.github.io")
  .trim()
  .replace(/\/+$/g, "");
const pulseboardDotaResultsSnapshotUrl =
  process.env.PULSEBOARD_DOTA_RESULTS_SNAPSHOT_URL ||
  (pulseboardPublicBase ? `${pulseboardPublicBase}/assets/provider-snapshots/dota-results.json` : "");
const pulseboardDotaResultsSnapshotMaxAgeMs = Math.max(
  providerCacheMs,
  Number.parseInt(process.env.PULSEBOARD_DOTA_RESULTS_SNAPSHOT_MAX_AGE_MS || String(90 * oneMinute), 10)
);
const pulseboardLolLiveSnapshotUrl =
  process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_URL ||
  (pulseboardPublicBase ? `${pulseboardPublicBase}/assets/provider-snapshots/lol-live.json` : "");
const pulseboardLolLiveSnapshotMaxAgeMs = Math.max(
  providerCacheMs,
  Number.parseInt(process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_MAX_AGE_MS || String(35 * oneMinute), 10)
);
const pulseboardLolScheduleSnapshotUrl =
  process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL ||
  (pulseboardPublicBase ? `${pulseboardPublicBase}/assets/provider-snapshots/lol-schedule.json` : "");
const pulseboardLolScheduleSnapshotMaxAgeMs = Math.max(
  providerCacheMs,
  Number.parseInt(process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_MAX_AGE_MS || String(6 * oneHour), 10)
);
const pulseboardLolResultsSnapshotUrl =
  process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL ||
  (pulseboardPublicBase ? `${pulseboardPublicBase}/assets/provider-snapshots/lol-results.json` : "");
const pulseboardLolResultsSnapshotMaxAgeMs = Math.max(
  providerCacheMs,
  Number.parseInt(process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_MAX_AGE_MS || String(6 * oneHour), 10)
);
const rowQualityOverdueGraceMs = Number.parseInt(
  process.env.ROW_QUALITY_OVERDUE_GRACE_MS || String(15 * oneMinute),
  10
);
const logAllProviderTiming = String(process.env.API_LOG_PROVIDER_TIMING || "").trim() === "1";
const providerCachePersistenceEnabled = dataMode !== "mock" && !import.meta.url.includes("?");
const PROVIDER_CACHE_FILE_URL = new URL("../../../.runtime/provider-cache.json", import.meta.url);
const PROVIDER_CACHE_FILE_PATH = fileURLToPath(PROVIDER_CACHE_FILE_URL);
const PROVIDER_CACHE_DIR_PATH = dirname(PROVIDER_CACHE_FILE_PATH);
const providerSnapshotKeys = [
  "lolLive",
  "lolSchedule",
  "lolResults",
  "live",
  "stratzLive",
  "steamLive",
  "results",
  "dotaSchedule"
];

const openDotaProvider = new OpenDotaProvider({
  timeoutMs: providerTimeoutMs
});
const stratzProvider = new StratzProvider({
  timeoutMs: providerTimeoutMs
});
const steamWebApiDotaProvider = new SteamWebApiDotaProvider({
  timeoutMs: providerTimeoutMs
});
const liquipediaDotaScheduleProvider = new LiquipediaDotaScheduleProvider({
  timeoutMs: providerTimeoutMs
});
const lolEsportsProvider = new LolEsportsProvider({
  timeoutMs: providerTimeoutMs
});

function createProviderSlot() {
  return {
    fetchedAt: 0,
    status: "stale",
    rows: [],
    refreshPromise: null,
    lastDurationMs: null,
    lastOutcome: "stale",
    lastError: null,
    rateLimitedUntil: 0,
    consecutiveRateLimitCount: 0
  };
}

const providerState = {
  lolLive: createProviderSlot(),
  lolSchedule: createProviderSlot(),
  lolResults: createProviderSlot(),
  live: createProviderSlot(),
  stratzLive: createProviderSlot(),
  steamLive: createProviderSlot(),
  results: createProviderSlot(),
  dotaSchedule: createProviderSlot(),
  detailById: new Map(),
  lolDetailById: new Map(),
  teamProfileByKey: new Map()
};
const providerRefreshHistory = [];
const providerWarmHistory = [];
const providerSnapshotMeta = {
  path: PROVIDER_CACHE_FILE_PATH,
  loadedAt: null,
  persistedAt: null,
  lastLoadError: null,
  lastPersistError: null
};

function pushBounded(list, entry, limit = diagnosticsHistoryLimit) {
  list.push(entry);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function cloneRows(rows) {
  return JSON.parse(JSON.stringify(Array.isArray(rows) ? rows : []));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSnapshotPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      generatedAt: null,
      rows: payload
    };
  }

  return {
    generatedAt: payload?.generatedAt || payload?.meta?.generatedAt || payload?.data?.generatedAt || null,
    rows: Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : Array.isArray(payload?.data)
          ? payload.data
          : []
  };
}

function countRowsWithSnapshot(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => Boolean(row?.source?.snapshotGeneratedAt)).length;
}

function countRetainedRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => Boolean(row?.retainedFromScheduleCache)).length;
}

function pushQualityIssue(issues, {
  code,
  message,
  penalty = 0,
  severity = "warn"
}) {
  issues.push({
    code,
    message,
    severity
  });
  return penalty;
}

function summarizeQualityIssues(issues) {
  const degraded = issues.find((issue) => issue.severity === "degraded");
  return degraded?.message || issues[0]?.message || "";
}

function annotateEntityQuality(entity, { nowMs = Date.now() } = {}) {
  if (!entity || typeof entity !== "object") {
    return entity;
  }

  const status = String(entity?.status || "").toLowerCase();
  const issues = [];
  let score = 100;
  const startMs = Date.parse(String(entity?.startAt || ""));
  const leftTeamName = String(entity?.teams?.left?.name || "").trim();
  const rightTeamName = String(entity?.teams?.right?.name || "").trim();
  const leftTeamId = String(entity?.teams?.left?.id || "").trim();
  const rightTeamId = String(entity?.teams?.right?.id || "").trim();
  const leftScore = Number(entity?.seriesScore?.left);
  const rightScore = Number(entity?.seriesScore?.right);
  const hasSeriesScore =
    Number.isFinite(leftScore) &&
    Number.isFinite(rightScore) &&
    (leftScore > 0 || rightScore > 0 || Boolean(entity?.winnerTeamId));
  const freshnessStatus = String(entity?.freshness?.status || "").toLowerCase();

  if (entity?.source?.snapshotGeneratedAt) {
    score -= pushQualityIssue(issues, {
      code: "snapshot_fallback",
      message: "Snapshot fallback active",
      penalty: 16,
      severity: "warn"
    });
  }

  if (entity?.retainedFromScheduleCache) {
    score -= pushQualityIssue(issues, {
      code: "retained_cache",
      message: "Serving recently retained provider cache",
      penalty: 18,
      severity: "warn"
    });
  }

  if (entity?.game === "dota2" && status === "live" && String(entity?.keySignal || "").includes("schedule_started")) {
    score -= pushQualityIssue(issues, {
      code: "synthetic_live",
      message: "Live status inferred from schedule timing",
      penalty: 12,
      severity: "warn"
    });
  }

  if (status === "upcoming" && Number.isFinite(startMs) && nowMs > startMs + rowQualityOverdueGraceMs) {
    score -= pushQualityIssue(issues, {
      code: "overdue_start",
      message: "Start time passed; awaiting provider confirmation",
      penalty: 30,
      severity: "degraded"
    });
  }

  if (status === "completed" && !entity?.winnerTeamId && !hasSeriesScore) {
    score -= pushQualityIssue(issues, {
      code: "missing_result",
      message: "Result is incomplete from the current source",
      penalty: 26,
      severity: "degraded"
    });
  }

  if (!leftTeamName || !rightTeamName) {
    score -= pushQualityIssue(issues, {
      code: "missing_team_name",
      message: "Team identity is incomplete",
      penalty: 24,
      severity: "degraded"
    });
  } else if (!leftTeamId || !rightTeamId) {
    score -= pushQualityIssue(issues, {
      code: "missing_team_id",
      message: "Resolved team IDs are incomplete",
      penalty: 10,
      severity: "warn"
    });
  }

  if (freshnessStatus === "stale_cache" || freshnessStatus === "degraded") {
    score -= pushQualityIssue(issues, {
      code: "stale_detail",
      message: "Showing cached detail while providers refresh",
      penalty: freshnessStatus === "stale_cache" ? 18 : 10,
      severity: "warn"
    });
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  const level = normalizedScore <= 60 ? "degraded" : normalizedScore <= 85 ? "warn" : "good";

  return {
    ...entity,
    quality: {
      score: normalizedScore,
      level,
      summary: summarizeQualityIssues(issues),
      issues,
      updatedAt: new Date(nowMs).toISOString()
    }
  };
}

function annotateRowsWithQuality(rows, options = {}) {
  return (Array.isArray(rows) ? rows : []).map((row) => annotateEntityQuality(row, options));
}

function readProviderCacheFromDisk() {
  if (!providerCachePersistenceEnabled) {
    return null;
  }

  if (!existsSync(PROVIDER_CACHE_FILE_PATH)) {
    return null;
  }

  return JSON.parse(readFileSync(PROVIDER_CACHE_FILE_PATH, "utf8"));
}

function persistProviderCacheToDisk() {
  if (!providerCachePersistenceEnabled) {
    return;
  }

  mkdirSync(PROVIDER_CACHE_DIR_PATH, {
    recursive: true
  });

  const snapshot = {
    savedAt: new Date().toISOString(),
    providers: Object.fromEntries(
      providerSnapshotKeys.map((stateKey) => {
        const current = providerState[stateKey];
        return [
          stateKey,
          {
            fetchedAt: current.fetchedAt,
            rows: cloneRows(current.rows),
            lastDurationMs: current.lastDurationMs,
            lastOutcome: current.lastOutcome,
            lastError: current.lastError,
            rateLimitedUntil: current.rateLimitedUntil,
            consecutiveRateLimitCount: current.consecutiveRateLimitCount
          }
        ];
      })
    ),
    detailById: Array.from(providerState.detailById.entries())
      .sort((left, right) => Number(right?.[1]?.fetchedAt || 0) - Number(left?.[1]?.fetchedAt || 0))
      .slice(0, providerDetailCacheLimit)
      .map(([key, entry]) => ({
        key,
        fetchedAt: entry.fetchedAt,
        detail: cloneValue(entry.detail)
      })),
    lolDetailById: Array.from(providerState.lolDetailById.entries())
      .sort((left, right) => Number(right?.[1]?.fetchedAt || 0) - Number(left?.[1]?.fetchedAt || 0))
      .slice(0, providerDetailCacheLimit)
      .map(([key, entry]) => ({
        key,
        fetchedAt: entry.fetchedAt,
        detail: cloneValue(entry.detail)
      })),
    teamProfileByKey: Array.from(providerState.teamProfileByKey.entries())
      .sort((left, right) => Number(right?.[1]?.fetchedAt || 0) - Number(left?.[1]?.fetchedAt || 0))
      .slice(0, providerTeamProfileCacheLimit)
      .map(([key, entry]) => ({
        key,
        fetchedAt: entry.fetchedAt,
        detail: cloneValue(entry.detail)
      }))
  };

  const tempPath = join(PROVIDER_CACHE_DIR_PATH, "provider-cache.json.tmp");
  writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  renameSync(tempPath, PROVIDER_CACHE_FILE_PATH);

  providerSnapshotMeta.persistedAt = snapshot.savedAt;
  providerSnapshotMeta.lastPersistError = null;
}

function hydrateDetailCacheMap(targetMap, entries = []) {
  targetMap.clear();
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry.key === "string" && entry.detail)
        .sort((left, right) => Number(right?.fetchedAt || 0) - Number(left?.fetchedAt || 0))
        .slice(0, providerDetailCacheLimit)
    : [];

  for (const entry of normalizedEntries) {
    targetMap.set(entry.key, {
      fetchedAt: Number.parseInt(String(entry.fetchedAt || 0), 10) || 0,
      detail: cloneValue(entry.detail)
    });
  }
}

function hydrateProfileCacheMap(targetMap, entries = []) {
  targetMap.clear();
  const normalizedEntries = Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry.key === "string" && entry.detail)
        .sort((left, right) => Number(right?.fetchedAt || 0) - Number(left?.fetchedAt || 0))
        .slice(0, providerTeamProfileCacheLimit)
    : [];

  for (const entry of normalizedEntries) {
    targetMap.set(entry.key, {
      fetchedAt: Number.parseInt(String(entry.fetchedAt || 0), 10) || 0,
      detail: cloneValue(entry.detail)
    });
  }
}

function tryPersistProviderCacheSnapshot() {
  try {
    persistProviderCacheToDisk();
  } catch (error) {
    providerSnapshotMeta.lastPersistError = error?.message || String(error);
    // eslint-disable-next-line no-console
    console.warn(`[provider-cache] persist failed ${providerSnapshotMeta.lastPersistError}`);
  }
}

function hydrateProviderStateFromDisk() {
  if (!providerCachePersistenceEnabled) {
    return;
  }

  try {
    const parsed = readProviderCacheFromDisk();
    if (!parsed?.providers) {
      return;
    }

    for (const stateKey of providerSnapshotKeys) {
      const snapshot = parsed.providers[stateKey];
      if (!snapshot || !Array.isArray(snapshot.rows)) {
        continue;
      }

      providerState[stateKey] = {
        ...providerState[stateKey],
        fetchedAt: Number.parseInt(String(snapshot.fetchedAt || 0), 10) || 0,
        status: snapshot.rows.length ? "success" : "stale",
        rows: cloneRows(snapshot.rows),
        refreshPromise: null,
        lastDurationMs: Number.isFinite(snapshot.lastDurationMs) ? snapshot.lastDurationMs : null,
        lastOutcome: snapshot.rows.length ? "snapshot" : "stale",
        lastError: typeof snapshot.lastError === "string" ? snapshot.lastError : null,
        rateLimitedUntil: Number.parseInt(String(snapshot.rateLimitedUntil || 0), 10) || 0,
        consecutiveRateLimitCount: Number.parseInt(String(snapshot.consecutiveRateLimitCount || 0), 10) || 0
      };
    }

    providerSnapshotMeta.loadedAt = new Date().toISOString();
    providerSnapshotMeta.persistedAt =
      typeof parsed.savedAt === "string" && parsed.savedAt.trim() ? parsed.savedAt : null;
    hydrateDetailCacheMap(providerState.detailById, parsed.detailById);
    hydrateDetailCacheMap(providerState.lolDetailById, parsed.lolDetailById);
    hydrateProfileCacheMap(providerState.teamProfileByKey, parsed.teamProfileByKey);
    providerSnapshotMeta.lastLoadError = null;
  } catch (error) {
    providerSnapshotMeta.lastLoadError = error?.message || String(error);
    // eslint-disable-next-line no-console
    console.warn(`[provider-cache] load failed ${providerSnapshotMeta.lastLoadError}`);
  }
}

function parseTierList(value) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((tier) => Number.isInteger(tier) && tier >= 1 && tier <= 4);

  return parsed.length ? Array.from(new Set(parsed)) : [1, 2, 3, 4];
}

hydrateProviderStateFromDisk();

function trimDetailCacheMap(targetMap) {
  if (targetMap.size <= providerDetailCacheLimit) {
    return;
  }

  const overflowEntries = Array.from(targetMap.entries())
    .sort((left, right) => Number(right?.[1]?.fetchedAt || 0) - Number(left?.[1]?.fetchedAt || 0))
    .slice(providerDetailCacheLimit);
  for (const [key] of overflowEntries) {
    targetMap.delete(key);
  }
}

function setDetailCacheEntry(targetMap, cacheKey, detail) {
  targetMap.set(cacheKey, {
    fetchedAt: Date.now(),
    detail
  });
  trimDetailCacheMap(targetMap);
  tryPersistProviderCacheSnapshot();
}

function trimProfileCacheMap(targetMap) {
  if (targetMap.size <= providerTeamProfileCacheLimit) {
    return;
  }

  const overflowEntries = Array.from(targetMap.entries())
    .sort((left, right) => Number(right?.[1]?.fetchedAt || 0) - Number(left?.[1]?.fetchedAt || 0))
    .slice(providerTeamProfileCacheLimit);
  for (const [key] of overflowEntries) {
    targetMap.delete(key);
  }
}

function setTeamProfileCacheEntry(cacheKey, detail) {
  providerState.teamProfileByKey.set(cacheKey, {
    fetchedAt: Date.now(),
    detail
  });
  trimProfileCacheMap(providerState.teamProfileByKey);
  tryPersistProviderCacheSnapshot();
}

const detailRefreshState = {
  dota: new Map(),
  lol: new Map()
};
const teamProfileRefreshState = new Map();

function refreshProviderMatchDetail({ channel, cacheKey, fetchDetail, cacheMap }) {
  const refreshMap = detailRefreshState[channel];
  if (refreshMap.has(cacheKey)) {
    return refreshMap.get(cacheKey);
  }

  const refreshPromise = (async () => {
    try {
      const detail = await fetchDetail();
      if (detail) {
        setDetailCacheEntry(cacheMap, cacheKey, detail);
      }
      return detail;
    } catch {
      return null;
    } finally {
      refreshMap.delete(cacheKey);
    }
  })();

  refreshMap.set(cacheKey, refreshPromise);
  return refreshPromise;
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
const alertOutboxByUser = new Map();

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
  return dataMode === "provider" || dataMode === "hybrid" || dataMode === "live";
}

function providerRowsSnapshot(stateKey) {
  const current = providerState[stateKey];
  return {
    status: current.status,
    rows: current.rows
  };
}

function providerLogLabel(stateKey) {
  if (stateKey === "live") return "dota live";
  if (stateKey === "stratzLive") return "dota stratz live";
  if (stateKey === "steamLive") return "dota steam live";
  if (stateKey === "results") return "dota results";
  if (stateKey === "dotaSchedule") return "dota schedule";
  if (stateKey === "lolLive") return "lol live";
  if (stateKey === "lolSchedule") return "lol schedule";
  if (stateKey === "lolResults") return "lol results";
  return stateKey;
}

function isRateLimitedError(error) {
  const message = String(error?.message || error || "");
  return /\bHTTP 429\b/i.test(message) || /rate[\s-]?limit/i.test(message);
}

function providerCooldownMs(nextRateLimitCount) {
  const safeCount = Math.max(1, Number(nextRateLimitCount || 1));
  return Math.min(providerRateLimitCooldownMs * 2 ** (safeCount - 1), providerRateLimitMaxCooldownMs);
}

function logProviderTiming(stateKey, durationMs, outcome, detail = "") {
  if (!logAllProviderTiming && durationMs < providerSlowMs && outcome === "success") {
    return;
  }

  const suffix = detail ? ` ${detail}` : "";
  // eslint-disable-next-line no-console
  console.warn(`[provider] ${providerLogLabel(stateKey)} ${outcome} in ${durationMs.toFixed(1)}ms${suffix}`);
}

function recordProviderRefresh(stateKey, durationMs, outcome, { rowCount = 0, error = null } = {}) {
  pushBounded(providerRefreshHistory, {
    timestamp: new Date().toISOString(),
    key: stateKey,
    label: providerLogLabel(stateKey),
    outcome,
    durationMs,
    rowCount,
    error
  });
}

async function refreshProviderRows(stateKey, fetchRows) {
  const current = providerState[stateKey];
  if (current.refreshPromise) {
    return current.refreshPromise;
  }

  current.refreshPromise = (async () => {
    const startedAt = performance.now();
    try {
      const rows = await fetchRows();
      const durationMs = performance.now() - startedAt;
      providerState[stateKey] = {
        ...providerState[stateKey],
        fetchedAt: Date.now(),
        status: "success",
        rows,
        refreshPromise: null,
        lastDurationMs: durationMs,
        lastOutcome: "success",
        lastError: null,
        rateLimitedUntil: 0,
        consecutiveRateLimitCount: 0
      };
      recordProviderRefresh(stateKey, durationMs, "success", {
        rowCount: Array.isArray(rows) ? rows.length : 0
      });
      logProviderTiming(stateKey, durationMs, "success", `rows=${Array.isArray(rows) ? rows.length : 0}`);
      tryPersistProviderCacheSnapshot();
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      const existingRows = Array.isArray(providerState[stateKey].rows) ? providerState[stateKey].rows : [];
      const rateLimited = isRateLimitedError(error);
      const nextRateLimitCount = rateLimited
        ? Number(providerState[stateKey].consecutiveRateLimitCount || 0) + 1
        : 0;
      const outcome = rateLimited
        ? existingRows.length
          ? "rate-limited-cache"
          : "rate-limited"
        : existingRows.length
          ? "fallback-cache"
          : "error";
      providerState[stateKey] = {
        ...providerState[stateKey],
        fetchedAt: Date.now(),
        status: existingRows.length ? "success" : "error",
        rows: existingRows,
        refreshPromise: null,
        lastDurationMs: durationMs,
        lastOutcome: outcome,
        lastError: error?.message || null,
        rateLimitedUntil: rateLimited ? Date.now() + providerCooldownMs(nextRateLimitCount) : 0,
        consecutiveRateLimitCount: nextRateLimitCount
      };
      recordProviderRefresh(stateKey, durationMs, outcome, {
        rowCount: existingRows.length,
        error: error?.message || null
      });
      logProviderTiming(
        stateKey,
        durationMs,
        outcome,
        `rows=${existingRows.length}${error?.message ? ` message=${error.message}` : ""}`
      );
      if (existingRows.length) {
        tryPersistProviderCacheSnapshot();
      }
    }

    return providerRowsSnapshot(stateKey);
  })();

  return current.refreshPromise;
}

async function loadProviderRows(stateKey, fetchRows) {
  if (!isProviderModeEnabled()) {
    return { status: "disabled", rows: [] };
  }

  const current = providerState[stateKey];
  if (current.rateLimitedUntil && current.rateLimitedUntil > Date.now()) {
    return {
      status: current.status === "stale" ? "success" : current.status,
      rows: current.rows
    };
  }

  const ageMs = Date.now() - current.fetchedAt;
  if (ageMs <= providerCacheMs && current.status !== "stale") {
    return providerRowsSnapshot(stateKey);
  }

  const hasRows = Array.isArray(current.rows) && current.rows.length > 0;
  if (hasRows) {
    void refreshProviderRows(stateKey, fetchRows);
    return {
      status: current.status === "stale" ? "success" : current.status,
      rows: current.rows
    };
  }

  providerState[stateKey] = {
    ...providerState[stateKey],
    status: "warming"
  };
  return refreshProviderRows(stateKey, fetchRows);
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
  return loadProviderRows("live", () =>
    openDotaProvider.fetchLiveMatches({
      allowedTiers: defaultDotaTiers
    })
  );
}

async function loadProviderStratzLiveMatches() {
  if (!stratzProvider.getCapabilities().liveEnabled) {
    return { status: "disabled", rows: [] };
  }

  return loadProviderRows("stratzLive", () =>
    stratzProvider.fetchLiveMatches({
      allowedTiers: defaultDotaTiers
    })
  );
}

async function loadProviderSteamLiveMatches() {
  if (!steamWebApiDotaProvider.getCapabilities().liveEnabled) {
    return { status: "disabled", rows: [] };
  }

  return loadProviderRows("steamLive", () =>
    steamWebApiDotaProvider.fetchLiveMatches({
      allowedTiers: defaultDotaTiers
    })
  );
}

async function loadProviderResults() {
  return loadProviderRows("results", () => fetchProviderDotaResults());
}

async function loadProviderDotaScheduleMatches({ knownRows = [] } = {}) {
  return loadProviderRows("dotaSchedule", async () => {
    const rows = await liquipediaDotaScheduleProvider.fetchScheduleMatches({
      knownRows,
      allowedTiers: defaultDotaTiers
    });
    const retainedRows = mergeRetainedDotaScheduleRows(rows, providerState.dotaSchedule.rows, {
      knownRows
    });
    return hydrateDotaScheduleRowsWithResolvedTeams(retainedRows);
  });
}

async function loadProviderLolLiveMatches() {
  return loadProviderRows("lolLive", () => fetchProviderLolLiveMatches());
}

async function loadProviderLolScheduleMatches() {
  return loadProviderRows("lolSchedule", () => fetchProviderLolScheduleMatches());
}

async function loadProviderLolResults() {
  return loadProviderRows("lolResults", () => fetchProviderLolResults());
}

function providerDiagnosticsRow(stateKey) {
  const current = providerState[stateKey];
  return {
    key: stateKey,
    label: providerLogLabel(stateKey),
    status: current.status,
    lastOutcome: current.lastOutcome,
    lastError: current.lastError,
    lastDurationMs: current.lastDurationMs,
    fetchedAt: current.fetchedAt ? new Date(current.fetchedAt).toISOString() : null,
    ageMs: current.fetchedAt ? Date.now() - current.fetchedAt : null,
    rowCount: Array.isArray(current.rows) ? current.rows.length : 0,
    refreshing: Boolean(current.refreshPromise),
    rateLimitedUntil: current.rateLimitedUntil ? new Date(current.rateLimitedUntil).toISOString() : null,
    cooldownRemainingMs:
      current.rateLimitedUntil && current.rateLimitedUntil > Date.now()
        ? current.rateLimitedUntil - Date.now()
        : 0
  };
}

function providerRefreshTasks() {
  return {
    live: () =>
      refreshProviderRows("live", () =>
        openDotaProvider.fetchLiveMatches({
          allowedTiers: defaultDotaTiers
        })
      ),
    stratzLive: () =>
      stratzProvider.getCapabilities().liveEnabled
        ? refreshProviderRows("stratzLive", () =>
            stratzProvider.fetchLiveMatches({
              allowedTiers: defaultDotaTiers
            })
          )
        : Promise.resolve({ status: "disabled", rows: [] }),
    steamLive: () =>
      steamWebApiDotaProvider.getCapabilities().liveEnabled
        ? refreshProviderRows("steamLive", () =>
            steamWebApiDotaProvider.fetchLiveMatches({
              allowedTiers: defaultDotaTiers
            })
          )
        : Promise.resolve({ status: "disabled", rows: [] }),
    results: () =>
      refreshProviderRows("results", () => fetchProviderDotaResults()),
    dotaSchedule: () =>
      refreshProviderRows("dotaSchedule", async () => {
        const knownRows = dedupeRowsById([
          ...(Array.isArray(providerState.stratzLive.rows) ? providerState.stratzLive.rows : []),
          ...(Array.isArray(providerState.live.rows) ? providerState.live.rows : []),
          ...(Array.isArray(providerState.steamLive.rows) ? providerState.steamLive.rows : []),
          ...(Array.isArray(providerState.results.rows) ? providerState.results.rows : [])
        ]);
        const rows = await liquipediaDotaScheduleProvider.fetchScheduleMatches({
          knownRows,
          allowedTiers: defaultDotaTiers
        });
        const retainedRows = mergeRetainedDotaScheduleRows(rows, providerState.dotaSchedule.rows, {
          knownRows
        });
        return hydrateDotaScheduleRowsWithResolvedTeams(retainedRows);
      }),
    lolLive: () => refreshProviderRows("lolLive", () => fetchProviderLolLiveMatches()),
    lolSchedule: () => refreshProviderRows("lolSchedule", () => fetchProviderLolScheduleMatches()),
    lolResults: () => refreshProviderRows("lolResults", () => fetchProviderLolResults())
  };
}

async function fetchPulseboardSnapshotRows({
  snapshotUrl,
  snapshotMaxAgeMs,
  label,
  rowFilter = null
}) {
  if (!snapshotUrl) {
    throw new Error(`${label} snapshot fallback is disabled.`);
  }

  const payload = await fetchJson(snapshotUrl, {
    timeoutMs: providerTimeoutMs,
    headers: {
      accept: "application/json"
    }
  });
  const { generatedAt, rows } = normalizeSnapshotPayload(payload);
  const generatedAtMs = generatedAt ? Date.parse(String(generatedAt)) : Number.NaN;
  if (generatedAt && Number.isNaN(generatedAtMs)) {
    throw new Error(`${label} snapshot has an invalid generatedAt timestamp.`);
  }

  if (Number.isFinite(generatedAtMs) && Date.now() - generatedAtMs > snapshotMaxAgeMs) {
    throw new Error(`${label} snapshot is stale from ${generatedAt}`);
  }

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => (typeof rowFilter === "function" ? rowFilter(row) : true))
    .map((row) => ({
      ...row,
      source: {
        ...(row?.source || {}),
        snapshotUrl,
        snapshotGeneratedAt: generatedAt || null
      }
    }));
}

async function fetchPulseboardDotaResultsSnapshot() {
  return fetchPulseboardSnapshotRows({
    snapshotUrl: pulseboardDotaResultsSnapshotUrl,
    snapshotMaxAgeMs: pulseboardDotaResultsSnapshotMaxAgeMs,
    label: "Pulseboard Dota results",
    rowFilter: (row) =>
      row?.game === "dota2" &&
      row?.status === "completed" &&
      (typeof row?.competitiveTier === "number"
        ? defaultDotaTiers.includes(row.competitiveTier)
        : true)
  });
}

async function fetchPulseboardLolLiveSnapshot() {
  return fetchPulseboardSnapshotRows({
    snapshotUrl: pulseboardLolLiveSnapshotUrl,
    snapshotMaxAgeMs: pulseboardLolLiveSnapshotMaxAgeMs,
    label: "Pulseboard LoL live",
    rowFilter: (row) => row?.game === "lol" && row?.status === "live"
  });
}

async function fetchPulseboardLolScheduleSnapshot() {
  return fetchPulseboardSnapshotRows({
    snapshotUrl: pulseboardLolScheduleSnapshotUrl,
    snapshotMaxAgeMs: pulseboardLolScheduleSnapshotMaxAgeMs,
    label: "Pulseboard LoL schedule",
    rowFilter: (row) => row?.game === "lol" && row?.status !== "completed"
  });
}

async function fetchPulseboardLolResultsSnapshot() {
  return fetchPulseboardSnapshotRows({
    snapshotUrl: pulseboardLolResultsSnapshotUrl,
    snapshotMaxAgeMs: pulseboardLolResultsSnapshotMaxAgeMs,
    label: "Pulseboard LoL results",
    rowFilter: (row) => row?.game === "lol" && row?.status === "completed"
  });
}

async function fetchProviderDotaResults() {
  try {
    return await openDotaProvider.fetchRecentResults({
      allowedTiers: defaultDotaTiers
    });
  } catch (error) {
    try {
      return await fetchPulseboardDotaResultsSnapshot();
    } catch (snapshotError) {
      throw new Error(
        `${error?.message || String(error)} | ${snapshotError?.message || String(snapshotError)}`
      );
    }
  }
}

async function fetchProviderLolLiveMatches() {
  try {
    return await lolEsportsProvider.fetchLiveMatches();
  } catch (error) {
    try {
      return await fetchPulseboardLolLiveSnapshot();
    } catch (snapshotError) {
      throw new Error(
        `${error?.message || String(error)} | ${snapshotError?.message || String(snapshotError)}`
      );
    }
  }
}

async function fetchProviderLolScheduleMatches() {
  try {
    const scheduleRows = await lolEsportsProvider.fetchScheduleMatches();
    return scheduleRows.filter((row) => row.status !== "completed");
  } catch (error) {
    try {
      return await fetchPulseboardLolScheduleSnapshot();
    } catch (snapshotError) {
      throw new Error(
        `${error?.message || String(error)} | ${snapshotError?.message || String(snapshotError)}`
      );
    }
  }
}

async function fetchProviderLolResults() {
  try {
    return await lolEsportsProvider.fetchRecentResults();
  } catch (error) {
    try {
      return await fetchPulseboardLolResultsSnapshot();
    } catch (snapshotError) {
      throw new Error(
        `${error?.message || String(error)} | ${snapshotError?.message || String(snapshotError)}`
      );
    }
  }
}

function normalizeProviderKeys(providerKeys) {
  const allowedKeys = new Set(providerSnapshotKeys);
  if (!Array.isArray(providerKeys) || providerKeys.length === 0) {
    return Array.from(allowedKeys);
  }

  return Array.from(
    new Set(
      providerKeys
        .map((value) => String(value || "").trim())
        .filter((value) => allowedKeys.has(value))
    )
  );
}

async function forceRefreshProviderCaches({ providerKeys, reason = "manual" } = {}) {
  if (!isProviderModeEnabled()) {
    return {
      skipped: true,
      providers: []
    };
  }

  const refreshers = providerRefreshTasks();
  const targetKeys = normalizeProviderKeys(providerKeys);
  const startedAt = performance.now();
  const refreshes = await Promise.allSettled(targetKeys.map((key) => refreshers[key]()));
  const durationMs = performance.now() - startedAt;
  const providers = targetKeys.map((stateKey, index) => {
    const settled = refreshes[index];
    return {
      key: stateKey,
      label: providerLogLabel(stateKey),
      ok: settled.status === "fulfilled",
      status: providerState[stateKey].status,
      lastOutcome: providerState[stateKey].lastOutcome,
      rowCount: Array.isArray(providerState[stateKey].rows) ? providerState[stateKey].rows.length : 0
    };
  });

  pushBounded(providerWarmHistory, {
    timestamp: new Date().toISOString(),
    reason,
    durationMs,
    providers,
    skipped: false
  });

  return {
    skipped: false,
    reason,
    durationMs,
    providers
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

function teamProfileCacheKey(teamId, {
  game,
  opponentId,
  limit = 5,
  seedMatchId,
  teamNameHint
} = {}) {
  return JSON.stringify({
    teamId: String(teamId || "").trim(),
    game: String(game || "").trim(),
    opponentId: String(opponentId || "").trim(),
    limit: Number.parseInt(String(limit || 5), 10) || 5,
    seedMatchId: String(seedMatchId || "").trim(),
    teamNameHint: normalizeTeamName(teamNameHint || "")
  });
}

function refreshTeamProfile(cacheKey, buildProfile) {
  if (teamProfileRefreshState.has(cacheKey)) {
    return teamProfileRefreshState.get(cacheKey);
  }

  const refreshPromise = (async () => {
    try {
      const profile = await buildProfile();
      if (profile) {
        setTeamProfileCacheEntry(cacheKey, profile);
      }
      return profile;
    } finally {
      teamProfileRefreshState.delete(cacheKey);
    }
  })();

  teamProfileRefreshState.set(cacheKey, refreshPromise);
  return refreshPromise;
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

function dedupeRowsById(rows = []) {
  const rowsById = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.id) {
      rowsById.set(String(row.id), row);
    }
  }

  return Array.from(rowsById.values());
}

function sameDotaSeries(left, right) {
  if (!left || !right || left.game !== "dota2" || right.game !== "dota2") {
    return false;
  }

  const leftTeams = [normalizeTeamName(left?.teams?.left?.name), normalizeTeamName(left?.teams?.right?.name)].sort();
  const rightTeams = [normalizeTeamName(right?.teams?.left?.name), normalizeTeamName(right?.teams?.right?.name)].sort();
  if (leftTeams[0] !== rightTeams[0] || leftTeams[1] !== rightTeams[1]) {
    return false;
  }

  const leftTournament = canonicalDotaTournamentKey(left?.tournament);
  const rightTournament = canonicalDotaTournamentKey(right?.tournament);
  if (leftTournament && rightTournament && leftTournament !== rightTournament) {
    return false;
  }

  const leftStart = Date.parse(String(left?.startAt || ""));
  const rightStart = Date.parse(String(right?.startAt || ""));
  if (Number.isNaN(leftStart) || Number.isNaN(rightStart)) {
    return true;
  }

  return Math.abs(leftStart - rightStart) <= 6 * oneHour;
}

function materializeStaleDetail(detail, {
  reason = "stale_cache",
  aliasMatchId = null
} = {}) {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const next = {
    ...detail,
    freshness: {
      ...(detail?.freshness || {}),
      source: detail?.freshness?.source || "provider_cache",
      status: reason,
      updatedAt: detail?.freshness?.updatedAt || new Date().toISOString()
    }
  };

  if (aliasMatchId && String(aliasMatchId) !== String(detail?.id || "")) {
    next.resolvedFromMatchId = String(detail?.id || "");
    next.id = String(aliasMatchId);
  }

  return next;
}

async function resolveDotaAliasMatchId(matchId, cachedDetail = null) {
  if (!cachedDetail || cachedDetail?.game !== "dota2") {
    return null;
  }

  const [stratzLiveState, liveState, steamLiveState, resultsState] = await Promise.all([
    loadProviderStratzLiveMatches(),
    loadProviderLiveMatches(),
    loadProviderSteamLiveMatches(),
    loadProviderResults()
  ]);
  const mergedProviderDotaLiveRows = mergeEffectiveDotaLiveRows(
    stratzLiveState.rows,
    liveState.rows,
    steamLiveState.rows
  );
  const scheduleState = await loadProviderDotaScheduleMatches({
    knownRows: dedupeRowsById([
      ...mergedProviderDotaLiveRows,
      ...(Array.isArray(resultsState?.rows) ? resultsState.rows : [])
    ])
  });
  const scheduleRows = canonicalizeDotaScheduleRows(scheduleState?.rows, {
    liveRows: mergedProviderDotaLiveRows,
    resultRows: Array.isArray(resultsState?.rows) ? resultsState.rows : []
  });
  const candidate = [...mergedProviderDotaLiveRows, ...scheduleRows, ...(Array.isArray(resultsState?.rows) ? resultsState.rows : [])]
    .find((row) => sameDotaSeries(row, cachedDetail));

  if (!candidate?.id || String(candidate.id) === String(matchId)) {
    return null;
  }

  return String(candidate.id);
}

function mergeDotaScheduleRows(liveRows = [], upcomingRows = []) {
  const normalizedLiveRows = Array.isArray(liveRows) ? liveRows : [];
  const merged = [...normalizedLiveRows];

  for (const row of Array.isArray(upcomingRows) ? upcomingRows : []) {
    if (!row?.id) {
      continue;
    }

    if (normalizedLiveRows.some((liveRow) => sameDotaSeries(liveRow, row))) {
      continue;
    }

    merged.push(row);
  }

  return dedupeRowsById(merged);
}

function mergeDotaLiveRows(primaryRows = [], secondaryRows = []) {
  const normalizedPrimaryRows = Array.isArray(primaryRows) ? primaryRows : [];
  const merged = [...normalizedPrimaryRows];

  for (const row of Array.isArray(secondaryRows) ? secondaryRows : []) {
    if (!row?.id) {
      continue;
    }

    if (normalizedPrimaryRows.some((primaryRow) => sameDotaSeries(primaryRow, row))) {
      continue;
    }

    merged.push(row);
  }

  return dedupeRowsById(merged);
}

function mergeEffectiveDotaLiveRows(stratzRows = [], openDotaRows = [], steamRows = []) {
  return mergeDotaLiveRows(mergeDotaLiveRows(stratzRows, openDotaRows), steamRows);
}

function dotaSyntheticLiveWindowMs(row) {
  const bestOf = Math.max(1, Number(row?.bestOf || 1));
  return dotaSyntheticLiveBaseWindowMs + bestOf * dotaSyntheticLivePerGameWindowMs;
}

function canonicalizeDotaScheduleRows(scheduleRows = [], { liveRows = [], resultRows = [], nowMs = Date.now() } = {}) {
  const normalizedLiveRows = Array.isArray(liveRows) ? liveRows : [];
  const normalizedResultRows = Array.isArray(resultRows) ? resultRows : [];

  return (Array.isArray(scheduleRows) ? scheduleRows : [])
    .filter((row) => row?.game === "dota2")
    .filter((row) => !normalizedResultRows.some((resultRow) => sameDotaSeries(resultRow, row)))
    .map((row) => {
      const startMs = Date.parse(String(row?.startAt || ""));
      if (Number.isNaN(startMs)) {
        return row;
      }

      const overlapsLive = normalizedLiveRows.some((liveRow) => sameDotaSeries(liveRow, row));
      if (overlapsLive) {
        return row;
      }

      const lateByMs = nowMs - startMs;
      const withinSyntheticWindow = lateByMs >= dotaSyntheticLiveThresholdMs && lateByMs <= dotaSyntheticLiveWindowMs(row);
      if (!withinSyntheticWindow) {
        return row;
      }

      return {
        ...row,
        status: "live",
        keySignal: "provider_schedule_started",
        updatedAt: new Date(nowMs).toISOString()
      };
    });
}

function shouldRetainDotaScheduleRow(row, nowMs = Date.now()) {
  if (!row || row.game !== "dota2") {
    return false;
  }

  const startMs = Date.parse(String(row?.startAt || ""));
  if (Number.isNaN(startMs)) {
    return false;
  }

  const retainFutureWindowMs = 24 * oneHour;
  const ageMs = nowMs - startMs;
  return ageMs <= dotaSyntheticLiveWindowMs(row) && startMs <= nowMs + retainFutureWindowMs;
}

function mergeRetainedDotaScheduleRows(freshRows = [], previousRows = [], { knownRows = [], nowMs = Date.now() } = {}) {
  const normalizedFreshRows = Array.isArray(freshRows) ? freshRows : [];
  const normalizedPreviousRows = Array.isArray(previousRows) ? previousRows : [];
  const normalizedKnownRows = Array.isArray(knownRows) ? knownRows : [];
  const mergedRows = normalizedFreshRows.slice();

  for (const row of normalizedPreviousRows) {
    if (!shouldRetainDotaScheduleRow(row, nowMs)) {
      continue;
    }

    if (normalizedFreshRows.some((freshRow) => sameDotaSeries(freshRow, row))) {
      continue;
    }

    if (normalizedKnownRows.some((knownRow) => sameDotaSeries(knownRow, row))) {
      continue;
    }

    mergedRows.push({
      ...row,
      retainedFromScheduleCache: true,
      updatedAt: row?.updatedAt || new Date(nowMs).toISOString()
    });
  }

  return dedupeRowsById(mergedRows);
}

async function hydrateDotaScheduleRowsWithResolvedTeams(rows = []) {
  const resolutionCache = new Map();
  const resolveTeam = async (team) => {
    const teamName = String(team?.name || "").trim();
    const teamId = String(team?.id || "").trim();
    if (!teamName || /^\d+$/.test(teamId)) {
      return team;
    }

    const cacheKey = normalizeTeamName(teamName);
    if (resolutionCache.has(cacheKey)) {
      const resolved = resolutionCache.get(cacheKey);
      return resolved ? { ...team, id: String(resolved.id) } : team;
    }

    try {
      const resolved = await openDotaProvider.resolveTeamIdentityByName(teamName);
      resolutionCache.set(cacheKey, resolved || null);
      return resolved ? { ...team, id: String(resolved.id) } : team;
    } catch {
      resolutionCache.set(cacheKey, null);
      return team;
    }
  };

  return Promise.all(
    (Array.isArray(rows) ? rows : []).map(async (row) => {
      if (row?.game !== "dota2" || !row?.teams?.left || !row?.teams?.right) {
        return row;
      }

      const [left, right] = await Promise.all([
        resolveTeam(row.teams.left),
        resolveTeam(row.teams.right)
      ]);

      return {
        ...row,
        teams: {
          ...row.teams,
          left,
          right
        }
      };
    })
  );
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
    updatedAt: match.updatedAt || null,
    bestOf: Number(match.bestOf || 1),
    side,
    result,
    ownTeamId,
    ownTeamName,
    ownScore,
    oppScore,
    scoreLabel: `${ownScore}-${oppScore}`,
    opponentId: match?.teams?.[opponentSide]?.id || null,
    opponentName: match?.teams?.[opponentSide]?.name || "Unknown",
    keySignal: match?.keySignal || null,
    source: match?.source ? cloneValue(match.source) : null,
    freshness: match?.freshness ? cloneValue(match.freshness) : null,
    quality: match?.quality ? cloneValue(match.quality) : null
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

function perspectiveSignature(row) {
  const bucket = (() => {
    const startMs = Date.parse(String(row?.startAt || ""));
    return Number.isNaN(startMs) ? "na" : String(Math.floor(startMs / (6 * oneHour)));
  })();

  return [
    row?.game || "game",
    normalizeTeamName(row?.tournament),
    normalizeTeamName(row?.opponentName),
    bucket,
    String(row?.ownScore ?? ""),
    String(row?.oppScore ?? "")
  ].join("::");
}

function mergeUniquePerspectives(existingRows = [], additionalRows = []) {
  const bySignature = new Map();
  for (const row of existingRows) {
    bySignature.set(perspectiveSignature(row), row);
  }

  for (const row of additionalRows) {
    const signature = perspectiveSignature(row);
    if (!bySignature.has(signature)) {
      bySignature.set(signature, row);
    }
  }

  return Array.from(bySignature.values()).sort(
    (left, right) => Date.parse(right.endAt || right.startAt) - Date.parse(left.endAt || left.startAt)
  );
}

export function buildDotaSeriesPerspectivesFromTeamMatches(rows = [], { teamId, teamName } = {}) {
  const sortedRows = Array.isArray(rows)
    ? rows
        .filter((row) => Number.isFinite(Number(row?.start_time)))
        .sort((left, right) => Number(right?.start_time || 0) - Number(left?.start_time || 0))
    : [];

  const groups = [];
  for (const row of sortedRows) {
    const startMs = Number(row?.start_time || 0) * 1000;
    const opponentKey = String(row?.opposing_team_id || normalizeTeamName(row?.opposing_team_name) || "unknown");
    const leagueKey = String(row?.leagueid || normalizeTeamName(row?.league_name) || "league");
    const lastGroup = groups[groups.length - 1];
    const shouldMerge =
      lastGroup &&
      lastGroup.opponentKey === opponentKey &&
      lastGroup.leagueKey === leagueKey &&
      Math.abs(lastGroup.latestStartMs - startMs) <= 8 * oneHour &&
      lastGroup.rows.length < 5;

    if (shouldMerge) {
      lastGroup.rows.push(row);
      lastGroup.latestStartMs = Math.max(lastGroup.latestStartMs, startMs);
      lastGroup.earliestStartMs = Math.min(lastGroup.earliestStartMs, startMs);
      continue;
    }

    groups.push({
      opponentKey,
      leagueKey,
      latestStartMs: startMs,
      earliestStartMs: startMs,
      rows: [row]
    });
  }

  return groups.map((group) => {
    const maps = group.rows;
    const wins = maps.reduce((total, row) => {
      const radiantWin = Boolean(row?.radiant_win);
      const isRadiant = Boolean(row?.radiant);
      return total + (isRadiant ? radiantWin : !radiantWin ? 1 : 0);
    }, 0);
    const losses = Math.max(0, maps.length - wins);
    const latestEndMs = maps.reduce((maxMs, row) => {
      const startMs = Number(row?.start_time || 0) * 1000;
      const durationMs = Math.max(0, Number(row?.duration || 0)) * 1000;
      return Math.max(maxMs, startMs + durationMs);
    }, group.latestStartMs);
    const leadRow = maps[0] || {};
    const totalMaps = maps.length;
    const bestOf = totalMaps >= 3 ? (totalMaps >= 5 ? 5 : 3) : wins === losses ? 2 : 3;
    const opponentId = leadRow?.opposing_team_id ? String(leadRow.opposing_team_id) : null;
    const opponentName = leadRow?.opposing_team_name || "Unknown";
    const latestProviderMatchId = Number.isFinite(Number(leadRow?.match_id)) && Number(leadRow.match_id) > 0
      ? Number(leadRow.match_id)
      : null;
    const latestSeriesId = maps
      .map((row) => (Number.isFinite(Number(row?.series_id)) && Number(row.series_id) > 0 ? Number(row.series_id) : null))
      .find((value) => Number.isInteger(value) && value > 0) || null;
    const detailMatchId =
      latestSeriesId
        ? `dota_od_series_${latestSeriesId}`
        : latestProviderMatchId
          ? `dota_od_result_${latestProviderMatchId}`
          : null;

    return {
      matchId: `dota_team_series_${String(teamId || "team")}_${String(opponentId || normalizeTeamName(opponentName))}_${String(leadRow?.leagueid || normalizeTeamName(leadRow?.league_name))}_${String(group.earliestStartMs)}`,
      detailMatchId,
      sourceMatchId: latestProviderMatchId ? String(latestProviderMatchId) : null,
      game: "dota2",
      status: "completed",
      tournament: leadRow?.league_name || "Dota 2",
      region: "global",
      startAt: new Date(group.earliestStartMs).toISOString(),
      endAt: new Date(latestEndMs).toISOString(),
      bestOf,
      side: "left",
      result: wins > losses ? "win" : losses > wins ? "loss" : "draw",
      ownTeamId: String(teamId || ""),
      ownTeamName: teamName || "Unknown",
      ownScore: wins,
      oppScore: losses,
      scoreLabel: `${wins}-${losses}`,
      opponentId: opponentId || `dota_opponent_${normalizeTeamName(opponentName)}`,
      opponentName
    };
  });
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

function watchProviderFromUrl(url) {
  const normalized = String(url || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("opendota")) return "opendota";
  if (normalized.includes("twitch")) return "twitch";
  if (normalized.includes("youtube")) return "youtube";
  if (normalized.includes("kick")) return "kick";
  if (normalized.includes("liquipedia")) return "liquipedia";
  return "stream";
}

function buildFallbackTeamFormProfiles(match, { leftProfile = null, rightProfile = null } = {}) {
  const normalizeProfile = (profile, team) => {
    if (!profile) {
      return null;
    }

    const summary = profile.summary || {};
    return {
      teamId: team?.id || profile.id || null,
      teamName: team?.name || profile.name || null,
      wins: Number(summary.wins || 0),
      losses: Number(summary.losses || 0),
      draws: Number(summary.draws || 0),
      gameWins: Number(summary.mapWins || 0),
      gameLosses: Number(summary.mapLosses || 0),
      seriesWinRatePct: Number(summary.seriesWinRatePct || 0),
      gameWinRatePct: Number(summary.mapWinRatePct || 0),
      streakLabel: summary.streakLabel || "n/a",
      formLabel: summary.formLast5 || "n/a",
      recentMatches: Array.isArray(profile.recentMatches) ? profile.recentMatches.slice(0, 5) : []
    };
  };

  const teamForm = {
    left: normalizeProfile(leftProfile, match?.teams?.left),
    right: normalizeProfile(rightProfile, match?.teams?.right)
  };

  return teamForm.left || teamForm.right ? teamForm : null;
}

function buildFallbackHeadToHeadFromProfiles(match, { leftProfile = null, rightProfile = null } = {}) {
  const raw = leftProfile?.headToHead || rightProfile?.headToHead || null;
  if (!raw || !Array.isArray(raw.recentMatches) || raw.recentMatches.length === 0) {
    return null;
  }

  const lastMeetings = raw.recentMatches.slice(0, 5).map((row) => {
    const result = String(row?.result || "").toLowerCase();
    const winnerName =
      result === "win"
        ? match?.teams?.left?.name || "Left Team"
        : result === "loss"
          ? match?.teams?.right?.name || "Right Team"
          : "Draw";
    return {
      ...row,
      id: row?.matchId || row?.id || null,
      matchId: row?.matchId || row?.id || null,
      winnerName
    };
  });

  return {
    total: Number(raw.matches || lastMeetings.length || 0),
    leftWins: Number(raw.wins || 0),
    rightWins: Number(raw.losses || 0),
    lastMeetings
  };
}

function clampPct(value, fallback = 50) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(5, Math.min(95, value));
}

function buildFallbackPredictionFromProfiles(match, { leftProfile = null, rightProfile = null, headToHead = null } = {}) {
  const leftSummary = leftProfile?.summary || {};
  const rightSummary = rightProfile?.summary || {};
  const leftSeriesRate = Number(leftSummary.seriesWinRatePct || 0);
  const rightSeriesRate = Number(rightSummary.seriesWinRatePct || 0);
  const leftMapRate = Number(leftSummary.mapWinRatePct || 0);
  const rightMapRate = Number(rightSummary.mapWinRatePct || 0);
  const leftSample = Number(leftSummary.matchesAnalyzed || 0);
  const rightSample = Number(rightSummary.matchesAnalyzed || 0);
  let leftEdge = 0;
  const drivers = [];

  if (leftSeriesRate || rightSeriesRate) {
    const diff = leftSeriesRate - rightSeriesRate;
    leftEdge += diff * 0.35;
    if (Math.abs(diff) >= 8) {
      drivers.push(
        `${diff > 0 ? match?.teams?.left?.name : match?.teams?.right?.name} have the stronger recent series win rate.`
      );
    }
  }

  if (leftMapRate || rightMapRate) {
    const diff = leftMapRate - rightMapRate;
    leftEdge += diff * 0.2;
    if (Math.abs(diff) >= 8) {
      drivers.push(
        `${diff > 0 ? match?.teams?.left?.name : match?.teams?.right?.name} have been converting maps more cleanly lately.`
      );
    }
  }

  if (headToHead && Number(headToHead.total || 0) > 0) {
    const total = Math.max(1, Number(headToHead.total || 0));
    const diff = Number(headToHead.leftWins || 0) - Number(headToHead.rightWins || 0);
    leftEdge += (diff / total) * 14;
    if (Math.abs(diff) >= 1) {
      drivers.push(
        `${diff > 0 ? match?.teams?.left?.name : match?.teams?.right?.name} lead the recent head-to-head.`
      );
    }
  }

  const leftPct = clampPct(50 + leftEdge);
  const rightPct = clampPct(100 - leftPct);
  const favoriteTeamName =
    Math.abs(leftPct - rightPct) < 4
      ? "Even"
      : leftPct > rightPct
        ? match?.teams?.left?.name || "Left Team"
        : match?.teams?.right?.name || "Right Team";
  const confidenceSignals = [
    leftSample >= 3 && rightSample >= 3,
    (leftSeriesRate || rightSeriesRate) > 0,
    (leftMapRate || rightMapRate) > 0,
    Number(headToHead?.total || 0) >= 2
  ].filter(Boolean).length;
  const confidence = confidenceSignals >= 4 ? "high" : confidenceSignals >= 2 ? "medium" : "low";

  if (!drivers.length) {
    drivers.push("Limited recent Dota history available; model confidence is reduced.");
  }

  return {
    modelVersion: "fallback-dota-v2",
    leftWinPct: Number(leftPct.toFixed(1)),
    rightWinPct: Number(rightPct.toFixed(1)),
    favoriteTeamName,
    confidence,
    drivers: drivers.slice(0, 4)
  };
}

function dedupeFallbackWatchOptions(watchOptions = []) {
  const rows = [];
  const seen = new Set();
  for (const option of Array.isArray(watchOptions) ? watchOptions : []) {
    const url = String(option?.watchUrl || option?.url || "").trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    rows.push({
      label: option?.label || "Watch",
      url,
      note: option?.provider ? `Provider: ${option.provider}` : null
    });
  }
  return rows;
}

function buildFallbackPreMatchInsights(match, { seriesGames = [], teamForm = null, headToHead = null, prediction = null } = {}) {
  const watchOptions = dedupeFallbackWatchOptions(
    (Array.isArray(seriesGames) ? seriesGames : []).flatMap((game) =>
      Array.isArray(game?.watchOptions) ? game.watchOptions : []
    )
  );
  const startMs = Date.parse(String(match?.startAt || ""));

  return {
    essentials: {
      scheduledAt: match?.startAt || null,
      countdownSeconds: Number.isFinite(startMs) ? Math.max(0, Math.round((startMs - Date.now()) / 1000)) : null,
      estimatedEndAt: null,
      bestOf: Number(match?.bestOf || 1),
      tournament: match?.tournament || "Dota 2",
      region: match?.region || "global"
    },
    watchOptions,
    teamForm,
    headToHead,
    prediction
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
  const baseWatchOptions = Array.isArray(match?.watchOptions) ? match.watchOptions : [];
  const baseWatchUrl =
    match?.watchUrl ||
    (String(match?.source?.provider || "") === "opendota" && match?.sourceMatchId
      ? `https://www.opendota.com/matches/${String(match.sourceMatchId).trim()}`
      : null);
  const baseWatchProvider =
    baseWatchOptions[0]?.provider || match?.watchProvider || watchProviderFromUrl(baseWatchUrl);
  const enrichment = options?.enrichment || {};

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
      watchUrl: baseWatchUrl,
      watchProvider: baseWatchProvider,
      watchOptions: baseWatchOptions
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
  const teamForm = buildFallbackTeamFormProfiles(match, enrichment);
  const headToHead = buildFallbackHeadToHeadFromProfiles(match, enrichment);
  const prediction = buildFallbackPredictionFromProfiles(match, {
    leftProfile: enrichment.leftProfile,
    rightProfile: enrichment.rightProfile,
    headToHead
  });
  const preMatchInsights = buildFallbackPreMatchInsights(match, {
    seriesGames,
    teamForm,
    headToHead,
    prediction
  });
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
      telemetry: status === "live" ? "live_status_only" : "fallback",
      notes: [
        status === "live"
          ? "Live status confirmed, but map telemetry is not available from the current Dota source."
          : "OpenDota match detail unavailable; fallback summary applied."
      ]
    },
    pulseCard: {
      tone: status === "live" ? "warn" : "neutral",
      title: status === "live" ? "Live status confirmed" : "Fallback Summary",
      summary:
        status === "live"
          ? "Series is live, but full Dota map telemetry is not available from the current provider."
          : "Detailed telemetry is temporarily unavailable for this map."
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
      streamLabel:
        selectedGame?.watchProvider === "opendota"
          ? "OpenDota Match Page"
          : selectedGame?.watchUrl
            ? "Official stream"
            : "Official stream pending",
      language: "Global",
      status
    },
    teamForm,
    headToHead,
    prediction,
    preMatchInsights,
    combatBursts: [],
    goldMilestones: [],
    liveAlerts: [],
    matchupReadiness: prediction?.confidence || "low",
    matchupKeyFactors: Array.isArray(prediction?.drivers) ? prediction.drivers.slice(0, 3) : [],
    matchupAlertLevel: prediction?.confidence || null,
    matchupMeta: teamForm
      ? {
          leftSample: Number(teamForm?.left?.recentMatches?.length || 0),
          rightSample: Number(teamForm?.right?.recentMatches?.length || 0),
          headToHeadMatches: Number(headToHead?.total || 0)
        }
      : null,
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
      watchOptions: Array.isArray(selectedGame?.watchOptions) ? selectedGame.watchOptions : [],
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
  const [stratzLiveState, liveState, steamLiveState, resultsState] = await Promise.all([
    loadProviderStratzLiveMatches(),
    loadProviderLiveMatches(),
    loadProviderSteamLiveMatches(),
    loadProviderResults()
  ]);
  const mergedProviderDotaLiveRows = mergeEffectiveDotaLiveRows(
    stratzLiveState.rows,
    liveState.rows,
    steamLiveState.rows
  );
  const scheduleState = await loadProviderDotaScheduleMatches({
    knownRows: dedupeRowsById([
      ...mergedProviderDotaLiveRows,
      ...(Array.isArray(resultsState?.rows) ? resultsState.rows : [])
    ])
  });

  const liveRows = mergedProviderDotaLiveRows;
  const scheduleRows = canonicalizeDotaScheduleRows(scheduleState?.rows, {
    liveRows,
    resultRows: Array.isArray(resultsState?.rows) ? resultsState.rows : []
  });
  const resultRows = Array.isArray(resultsState?.rows) ? resultsState.rows : [];
  const match = [...liveRows, ...scheduleRows, ...resultRows].find(
    (row) => String(row?.id || "") === String(matchId)
  );
  if (!match) {
    return null;
  }

  let enrichment = {};
  try {
    const [leftProfile, rightProfile] = await Promise.all([
      match?.teams?.left?.id
        ? getTeamProfile(match.teams.left.id, {
            game: "dota2",
            opponentId: match?.teams?.right?.id || null,
            teamNameHint: match?.teams?.left?.name || null,
            limit: 5
          })
        : null,
      match?.teams?.right?.id
        ? getTeamProfile(match.teams.right.id, {
            game: "dota2",
            opponentId: match?.teams?.left?.id || null,
            teamNameHint: match?.teams?.right?.name || null,
            limit: 5
          })
        : null
    ]);
    enrichment = { leftProfile, rightProfile };
  } catch {
    enrichment = {};
  }

  return buildFallbackDotaDetailFromSummary(match, {
    ...options,
    enrichment
  });
}

function telemetryRank(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "rich") return 4;
  if (normalized === "basic") return 3;
  if (normalized === "pending") return 2;
  if (normalized === "none") return 1;
  return 0;
}

function resolveDotaTelemetryMatchId(detail) {
  const selectedState = String(detail?.selectedGame?.state || detail?.selectedState || detail?.status || "").toLowerCase();
  const selectedNumber = Number(detail?.selectedGame?.number || 0);
  const candidates = [
    detail?.selectedGame?.sourceMatchId,
    ...(Array.isArray(detail?.seriesGames)
      ? detail.seriesGames
          .filter((game) => Number(game?.number) === selectedNumber)
          .map((game) => game?.sourceMatchId)
      : [])
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const primaryMatchId = candidates.find((value) => /^\d+$/.test(value)) || null;
  if (primaryMatchId) {
    return primaryMatchId;
  }

  if (selectedState === "inprogress" || selectedState === "live" || selectedState === "unstarted") {
    return null;
  }

  const fallbackCandidates = [detail?.sourceMatchId]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return fallbackCandidates.find((value) => /^\d+$/.test(value)) || null;
}

function normalizeDotaTelemetryTeamKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function matchesDotaTelemetryTeam(baseTeam, telemetryTeam) {
  if (!baseTeam || !telemetryTeam) {
    return false;
  }

  const baseId = String(baseTeam?.id || "").trim();
  const telemetryId = String(telemetryTeam?.id || "").trim();
  if (baseId && telemetryId && baseId === telemetryId) {
    return true;
  }

  return (
    normalizeDotaTelemetryTeamKey(baseTeam?.name) === normalizeDotaTelemetryTeamKey(telemetryTeam?.name)
  );
}

function swapTelemetrySide(value) {
  if (value === "left") return "right";
  if (value === "right") return "left";
  return value;
}

function swapTelemetryPair(pair) {
  if (!pair || typeof pair !== "object") {
    return pair;
  }

  return {
    ...pair,
    left: pair?.right ?? pair?.left ?? null,
    right: pair?.left ?? pair?.right ?? null
  };
}

function rebuildLeadTrend(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const leads = rows.map((row) => Number(row?.lead || 0));
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

function flipWinRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  return numeric > 1 ? Number((100 - numeric).toFixed(2)) : Number((1 - numeric).toFixed(4));
}

function orientDotaTelemetryDetail(baseDetail, telemetryDetail) {
  if (!baseDetail || !telemetryDetail) {
    return telemetryDetail;
  }

  const leftSummary = String(baseDetail?.selectedGame?.sideSummary?.[0] || "").toLowerCase();
  const rightSummary = String(baseDetail?.selectedGame?.sideSummary?.[1] || "").toLowerCase();
  const sideSummarySwap =
    leftSummary.includes("dire") && rightSummary.includes("radiant")
      ? true
      : leftSummary.includes("radiant") && rightSummary.includes("dire")
        ? false
        : null;

  const swapFromTeams =
    matchesDotaTelemetryTeam(baseDetail?.teams?.left, telemetryDetail?.teams?.right) &&
    matchesDotaTelemetryTeam(baseDetail?.teams?.right, telemetryDetail?.teams?.left);
  const sameFromTeams =
    matchesDotaTelemetryTeam(baseDetail?.teams?.left, telemetryDetail?.teams?.left) &&
    matchesDotaTelemetryTeam(baseDetail?.teams?.right, telemetryDetail?.teams?.right);
  const shouldSwap = sideSummarySwap ?? (swapFromTeams && !sameFromTeams);

  if (!shouldSwap) {
    return telemetryDetail;
  }

  const swapRowTeam = (row) =>
    row && typeof row === "object" ? { ...row, team: swapTelemetrySide(row.team) } : row;
  const swapRows = (rows) => (Array.isArray(rows) ? rows.map((row) => swapRowTeam(row)) : rows);
  const swapSnapshot = (snapshot) =>
    snapshot
      ? {
          ...snapshot,
          left: snapshot?.right ?? snapshot?.left ?? null,
          right: snapshot?.left ?? snapshot?.right ?? null
        }
      : snapshot;
  const swappedGoldLeadSeries = Array.isArray(telemetryDetail?.goldLeadSeries)
    ? telemetryDetail.goldLeadSeries.map((row) => ({
        ...row,
        lead: Number.isFinite(Number(row?.lead)) ? Number(row.lead) * -1 : row?.lead,
        leftGold: row?.rightGold ?? row?.leftGold ?? null,
        rightGold: row?.leftGold ?? row?.rightGold ?? null
      }))
    : telemetryDetail?.goldLeadSeries;

  return {
    ...telemetryDetail,
    teams: swapTelemetryPair(telemetryDetail?.teams),
    objectiveTimeline: Array.isArray(telemetryDetail?.objectiveTimeline)
      ? telemetryDetail.objectiveTimeline.map((row) => ({ ...row, team: swapTelemetrySide(row?.team) }))
      : telemetryDetail?.objectiveTimeline,
    objectiveControl: swapTelemetryPair(telemetryDetail?.objectiveControl),
    objectiveBreakdown: swapTelemetryPair(telemetryDetail?.objectiveBreakdown),
    goldLeadSeries: swappedGoldLeadSeries,
    leadTrend: rebuildLeadTrend(swappedGoldLeadSeries),
    playerEconomy: telemetryDetail?.playerEconomy
      ? {
          ...telemetryDetail.playerEconomy,
          left: swapRows(telemetryDetail?.playerEconomy?.right),
          right: swapRows(telemetryDetail?.playerEconomy?.left)
        }
      : telemetryDetail?.playerEconomy,
    teamEconomyTotals: swapTelemetryPair(telemetryDetail?.teamEconomyTotals),
    topPerformers: swapRows(telemetryDetail?.topPerformers),
    momentum: telemetryDetail?.momentum
      ? {
          ...telemetryDetail.momentum,
          goldLead: Number(telemetryDetail.momentum.goldLead || 0) * -1,
          killDiff: Number(telemetryDetail.momentum.killDiff || 0) * -1,
          towerDiff: Number(telemetryDetail.momentum.towerDiff || 0) * -1,
          dragonDiff: Number(telemetryDetail.momentum.dragonDiff || 0) * -1,
          baronDiff: Number(telemetryDetail.momentum.baronDiff || 0) * -1,
          inhibitorDiff: Number(telemetryDetail.momentum.inhibitorDiff || 0) * -1
        }
      : telemetryDetail?.momentum,
    edgeMeter: swapTelemetryPair(telemetryDetail?.edgeMeter),
    teamDraft: swapTelemetryPair(telemetryDetail?.teamDraft),
    playerDelta: Array.isArray(telemetryDetail?.playerDelta)
      ? telemetryDetail.playerDelta.map((row) => ({
          ...row,
          team: swapTelemetrySide(row?.team),
          now: row?.now ? { ...row.now, team: swapTelemetrySide(row.now.team) } : row?.now
        }))
      : telemetryDetail?.playerDelta,
    combatBursts: Array.isArray(telemetryDetail?.combatBursts)
      ? telemetryDetail.combatBursts.map((row) => ({ ...row, team: swapTelemetrySide(row?.team) }))
      : telemetryDetail?.combatBursts,
    goldMilestones: Array.isArray(telemetryDetail?.goldMilestones)
      ? telemetryDetail.goldMilestones.map((row) => ({ ...row, team: swapTelemetrySide(row?.team) }))
      : telemetryDetail?.goldMilestones,
    liveAlerts: Array.isArray(telemetryDetail?.liveAlerts)
      ? telemetryDetail.liveAlerts.map((row) => ({ ...row, team: swapTelemetrySide(row?.team) }))
      : telemetryDetail?.liveAlerts,
    selectedGame: telemetryDetail?.selectedGame
      ? {
          ...telemetryDetail.selectedGame,
          snapshot: swapSnapshot(telemetryDetail.selectedGame.snapshot)
        }
      : telemetryDetail?.selectedGame,
    liveTicker: Array.isArray(telemetryDetail?.liveTicker)
      ? telemetryDetail.liveTicker.map((row) => ({ ...row, team: swapTelemetrySide(row?.team) }))
      : telemetryDetail?.liveTicker,
    liveWinRateSeries: Array.isArray(telemetryDetail?.liveWinRateSeries)
      ? telemetryDetail.liveWinRateSeries.map((row) => ({ ...row, winRate: flipWinRate(row?.winRate) }))
      : telemetryDetail?.liveWinRateSeries
  };
}

function mergeDotaTelemetryDetail(baseDetail, telemetryDetail) {
  if (!baseDetail) {
    return telemetryDetail;
  }
  if (!telemetryDetail) {
    return baseDetail;
  }

  const alignedTelemetryDetail = orientDotaTelemetryDetail(baseDetail, telemetryDetail);

  const baseRank = telemetryRank(baseDetail?.selectedGame?.telemetryStatus);
  const telemetryRankValue = telemetryRank(alignedTelemetryDetail?.selectedGame?.telemetryStatus);
  if (telemetryRankValue <= baseRank && baseRank > 0) {
    return baseDetail;
  }

  const mergedSelectedGame = {
    ...(baseDetail?.selectedGame || {}),
    ...(alignedTelemetryDetail?.selectedGame || {}),
    number: baseDetail?.selectedGame?.number || alignedTelemetryDetail?.selectedGame?.number || 1,
    state: baseDetail?.selectedGame?.state || alignedTelemetryDetail?.selectedGame?.state || "unstarted",
    label: baseDetail?.selectedGame?.label || alignedTelemetryDetail?.selectedGame?.label || null,
    watchUrl: baseDetail?.selectedGame?.watchUrl || alignedTelemetryDetail?.selectedGame?.watchUrl || null,
    watchOptions:
      Array.isArray(baseDetail?.selectedGame?.watchOptions) && baseDetail.selectedGame.watchOptions.length
        ? baseDetail.selectedGame.watchOptions
        : Array.isArray(alignedTelemetryDetail?.selectedGame?.watchOptions)
          ? alignedTelemetryDetail.selectedGame.watchOptions
          : [],
    sideSummary:
      Array.isArray(baseDetail?.selectedGame?.sideSummary) && baseDetail.selectedGame.sideSummary.length
        ? baseDetail.selectedGame.sideSummary
        : Array.isArray(alignedTelemetryDetail?.selectedGame?.sideSummary)
          ? alignedTelemetryDetail.selectedGame.sideSummary
          : [],
    startedAt: alignedTelemetryDetail?.selectedGame?.startedAt || baseDetail?.selectedGame?.startedAt || null,
    requestedMissing: Boolean(baseDetail?.selectedGame?.requestedMissing),
    sourceMatchId:
      alignedTelemetryDetail?.selectedGame?.sourceMatchId ||
      baseDetail?.selectedGame?.sourceMatchId ||
      alignedTelemetryDetail?.sourceMatchId ||
      baseDetail?.sourceMatchId ||
      null
  };

  const mergedSeriesGames = Array.isArray(baseDetail?.seriesGames)
    ? baseDetail.seriesGames.map((game) =>
        Number(game?.number) === Number(mergedSelectedGame.number)
          ? {
              ...game,
              startedAt: mergedSelectedGame.startedAt || game?.startedAt || null,
              durationMinutes: mergedSelectedGame.durationMinutes || game?.durationMinutes || null,
              watchUrl: mergedSelectedGame.watchUrl || game?.watchUrl || null,
              watchOptions:
                Array.isArray(mergedSelectedGame.watchOptions) && mergedSelectedGame.watchOptions.length
                  ? mergedSelectedGame.watchOptions
                  : Array.isArray(game?.watchOptions)
                    ? game.watchOptions
                    : [],
              sourceMatchId: mergedSelectedGame.sourceMatchId || game?.sourceMatchId || null
            }
          : game
      )
    : telemetryDetail?.seriesGames || [];

  return {
    ...baseDetail,
    patch:
      alignedTelemetryDetail?.patch && alignedTelemetryDetail.patch !== "unknown"
        ? alignedTelemetryDetail.patch
        : baseDetail?.patch || alignedTelemetryDetail?.patch || "unknown",
    freshness: {
      ...(baseDetail?.freshness || {}),
      ...(alignedTelemetryDetail?.freshness || {}),
      source: alignedTelemetryDetail?.freshness?.source || baseDetail?.freshness?.source || "stratz",
      status: alignedTelemetryDetail?.freshness?.status || baseDetail?.freshness?.status || "partial",
      updatedAt:
        alignedTelemetryDetail?.freshness?.updatedAt ||
        baseDetail?.freshness?.updatedAt ||
        new Date().toISOString()
    },
    sourceMatchId: alignedTelemetryDetail?.sourceMatchId || baseDetail?.sourceMatchId || null,
    keyMoments:
      Array.isArray(alignedTelemetryDetail?.keyMoments) && alignedTelemetryDetail.keyMoments.length
        ? alignedTelemetryDetail.keyMoments
        : baseDetail?.keyMoments || [],
    objectiveTimeline:
      Array.isArray(alignedTelemetryDetail?.objectiveTimeline) && alignedTelemetryDetail.objectiveTimeline.length
        ? alignedTelemetryDetail.objectiveTimeline
        : baseDetail?.objectiveTimeline || [],
    objectiveControl:
      telemetryRankValue > 0
        ? alignedTelemetryDetail?.objectiveControl || baseDetail?.objectiveControl
        : baseDetail?.objectiveControl,
    objectiveBreakdown:
      telemetryRankValue > 0
        ? alignedTelemetryDetail?.objectiveBreakdown || baseDetail?.objectiveBreakdown
        : baseDetail?.objectiveBreakdown,
    goldLeadSeries:
      Array.isArray(alignedTelemetryDetail?.goldLeadSeries) && alignedTelemetryDetail.goldLeadSeries.length
        ? alignedTelemetryDetail.goldLeadSeries
        : baseDetail?.goldLeadSeries || [],
    leadTrend: alignedTelemetryDetail?.leadTrend || baseDetail?.leadTrend || null,
    playerEconomy:
      telemetryRankValue > 0
        ? alignedTelemetryDetail?.playerEconomy || baseDetail?.playerEconomy
        : baseDetail?.playerEconomy,
    teamEconomyTotals:
      telemetryRankValue > 0
        ? alignedTelemetryDetail?.teamEconomyTotals || baseDetail?.teamEconomyTotals
        : baseDetail?.teamEconomyTotals,
    topPerformers:
      Array.isArray(alignedTelemetryDetail?.topPerformers) && alignedTelemetryDetail.topPerformers.length
        ? alignedTelemetryDetail.topPerformers
        : baseDetail?.topPerformers || [],
    momentum: alignedTelemetryDetail?.momentum || baseDetail?.momentum || null,
    dataConfidence: alignedTelemetryDetail?.dataConfidence || baseDetail?.dataConfidence || null,
    pulseCard: alignedTelemetryDetail?.pulseCard || baseDetail?.pulseCard || null,
    edgeMeter: alignedTelemetryDetail?.edgeMeter || baseDetail?.edgeMeter || null,
    tempoSnapshot: alignedTelemetryDetail?.tempoSnapshot || baseDetail?.tempoSnapshot || null,
    tacticalChecklist:
      Array.isArray(alignedTelemetryDetail?.tacticalChecklist) && alignedTelemetryDetail.tacticalChecklist.length
        ? alignedTelemetryDetail.tacticalChecklist
        : baseDetail?.tacticalChecklist || [],
    teamDraft: alignedTelemetryDetail?.teamDraft || baseDetail?.teamDraft || null,
    playerDelta:
      Array.isArray(alignedTelemetryDetail?.playerDelta) && alignedTelemetryDetail.playerDelta.length
        ? alignedTelemetryDetail.playerDelta
        : baseDetail?.playerDelta || [],
    combatBursts:
      Array.isArray(alignedTelemetryDetail?.combatBursts) && alignedTelemetryDetail.combatBursts.length
        ? alignedTelemetryDetail.combatBursts
        : baseDetail?.combatBursts || [],
    goldMilestones:
      Array.isArray(alignedTelemetryDetail?.goldMilestones) && alignedTelemetryDetail.goldMilestones.length
        ? alignedTelemetryDetail.goldMilestones
        : baseDetail?.goldMilestones || [],
    liveAlerts:
      Array.isArray(alignedTelemetryDetail?.liveAlerts) && alignedTelemetryDetail.liveAlerts.length
        ? alignedTelemetryDetail.liveAlerts
        : baseDetail?.liveAlerts || [],
    selectedGame: mergedSelectedGame,
    seriesGames: mergedSeriesGames,
    liveTicker:
      Array.isArray(alignedTelemetryDetail?.liveTicker) && alignedTelemetryDetail.liveTicker.length
        ? alignedTelemetryDetail.liveTicker
        : baseDetail?.liveTicker || [],
    source: {
      ...(baseDetail?.source || {}),
      telemetryProvider: "stratz"
    }
  };
}

async function enrichDotaDetailWithStratz(detail, options = {}) {
  const sourceMatchId = resolveDotaTelemetryMatchId(detail);
  if (!sourceMatchId) {
    return detail;
  }

  try {
    const telemetryDetail = await stratzProvider.fetchMatchDetail(sourceMatchId, {
      gameNumber: detail?.selectedGame?.number || options?.gameNumber
    });
    return mergeDotaTelemetryDetail(detail, telemetryDetail);
  } catch {
    return detail;
  }
}

async function loadProviderMatchDetail(matchId, options = {}) {
  const cacheKey = matchDetailCacheKey(matchId, options);

  if (!isProviderModeEnabled()) {
    return null;
  }

  if (String(matchId).startsWith("dota_")) {
    const cached = providerState.detailById.get(cacheKey);
    const staleCachedDetail = cached?.detail || null;
    if (cached && Date.now() - cached.fetchedAt <= providerCacheMs) {
      return cached.detail;
    }

    if (cached?.detail) {
      void refreshProviderMatchDetail({
        channel: "dota",
        cacheKey,
        cacheMap: providerState.detailById,
        fetchDetail: async () => {
          if (String(matchId).startsWith("dota_stratz_")) {
            try {
              const stratzDetail = await stratzProvider.fetchMatchDetail(matchId, options);
              if (stratzDetail) {
                return stratzDetail;
              }
            } catch {
              // Fall through to OpenDota and fallback detail.
            }
          }

          if (String(matchId).startsWith("dota_od_")) {
            try {
              const detail = await openDotaProvider.fetchMatchDetail(matchId, options);
              return enrichDotaDetailWithStratz(
                detail || (await fallbackProviderDotaDetail(matchId, options)),
                options
              );
            } catch {
              return enrichDotaDetailWithStratz(await fallbackProviderDotaDetail(matchId, options), options);
            }
          }

          const aliasMatchId = await resolveDotaAliasMatchId(matchId, staleCachedDetail);
          if (aliasMatchId) {
            return loadProviderMatchDetail(aliasMatchId, options);
          }

          return enrichDotaDetailWithStratz(await fallbackProviderDotaDetail(matchId, options), options);
        }
      });

      return materializeStaleDetail(staleCachedDetail);
    }

    if (String(matchId).startsWith("dota_stratz_")) {
      try {
        const stratzDetail = await stratzProvider.fetchMatchDetail(matchId, options);
        if (stratzDetail) {
          setDetailCacheEntry(providerState.detailById, cacheKey, stratzDetail);
          return stratzDetail;
        }
      } catch {
        // Fall through to the OpenDota / fallback detail path.
      }
    }

    if (String(matchId).startsWith("dota_od_")) {
      try {
        const detail = await openDotaProvider.fetchMatchDetail(matchId, options);
        const resolvedDetail = await enrichDotaDetailWithStratz(
          detail || (await fallbackProviderDotaDetail(matchId, options)),
          options
        );
        if (!resolvedDetail) {
          return materializeStaleDetail(staleCachedDetail);
        }

        setDetailCacheEntry(providerState.detailById, cacheKey, resolvedDetail);
        return resolvedDetail;
      } catch {
        const fallback = await enrichDotaDetailWithStratz(await fallbackProviderDotaDetail(matchId, options), options);
        if (!fallback) {
          return materializeStaleDetail(staleCachedDetail);
        }

        setDetailCacheEntry(providerState.detailById, cacheKey, fallback);
        return fallback;
      }
    }

    const aliasMatchId = await resolveDotaAliasMatchId(matchId, staleCachedDetail);
    if (aliasMatchId) {
      const aliasDetail = await loadProviderMatchDetail(aliasMatchId, options);
      if (aliasDetail) {
        const resolvedAliasDetail = {
          ...aliasDetail,
          resolvedFromMatchId: String(matchId),
          freshness: {
            ...(aliasDetail?.freshness || {}),
            status: aliasDetail?.freshness?.status || "resolved_alias",
            updatedAt: aliasDetail?.freshness?.updatedAt || new Date().toISOString()
          }
        };

        setDetailCacheEntry(providerState.detailById, cacheKey, resolvedAliasDetail);
        return resolvedAliasDetail;
      }
    }

    const fallback = await enrichDotaDetailWithStratz(await fallbackProviderDotaDetail(matchId, options), options);
    if (!fallback) {
      return materializeStaleDetail(staleCachedDetail);
    }

    setDetailCacheEntry(providerState.detailById, cacheKey, fallback);
    return fallback;
  }

  if (String(matchId).startsWith("lol_riot_")) {
    const cached = providerState.lolDetailById.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt <= providerCacheMs) {
      return cached.detail;
    }

    if (cached?.detail) {
      void refreshProviderMatchDetail({
        channel: "lol",
        cacheKey,
        cacheMap: providerState.lolDetailById,
        fetchDetail: () => lolEsportsProvider.fetchMatchDetail(matchId, options)
      });
      return cached.detail;
    }

    try {
      const detail = await lolEsportsProvider.fetchMatchDetail(matchId, options);
      if (!detail) {
        return null;
      }

      setDetailCacheEntry(providerState.lolDetailById, cacheKey, detail);
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
  const [providerStratzLiveState, providerDotaLiveState, providerSteamLiveState, providerLolLiveState] = await Promise.all([
    loadProviderStratzLiveMatches(),
    loadProviderLiveMatches(),
    loadProviderSteamLiveMatches(),
    loadProviderLolLiveMatches()
  ]);
  const [providerDotaResultsState, providerDotaScheduleState] = await Promise.all([
    loadProviderResults(),
    loadProviderDotaScheduleMatches({
      knownRows: dedupeRowsById([
        ...mergeEffectiveDotaLiveRows(
          providerStratzLiveState.rows,
          providerDotaLiveState.rows,
          providerSteamLiveState.rows
        )
      ])
    })
  ]);
  const mergedProviderDotaLiveRows = mergeEffectiveDotaLiveRows(
    providerStratzLiveState.rows,
    providerDotaLiveState.rows,
    providerSteamLiveState.rows
  );

  let rows = liveMatches.slice();
  rows = replaceFallbackRowsForGame(rows, "lol", providerLolLiveState);
  if (
    providerStratzLiveState.status === "success" ||
    providerDotaLiveState.status === "success" ||
    providerSteamLiveState.status === "success" ||
    providerDotaScheduleState.status === "success"
  ) {
    const syntheticLiveRows = canonicalizeDotaScheduleRows(providerDotaScheduleState.rows, {
      liveRows: mergedProviderDotaLiveRows,
      resultRows: providerDotaResultsState.rows
    }).filter((row) => row.status === "live");
    rows = rows
      .filter((row) => row.game !== "dota2")
      .concat(mergeDotaScheduleRows(mergedProviderDotaLiveRows, syntheticLiveRows));
  } else if (shouldHideFallbackDotaRows()) {
    rows = stripFallbackDotaRows(rows);
  }

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

  return annotateRowsWithQuality(rows);
}

export async function listSchedule({ game, region, dateFrom, dateTo, dotaTiers }) {
  const [
    providerStratzLiveState,
    providerDotaLiveState,
    providerSteamLiveState,
    providerDotaResultsState,
    providerLolScheduleState
  ] = await Promise.all([
    loadProviderStratzLiveMatches(),
    loadProviderLiveMatches(),
    loadProviderSteamLiveMatches(),
    loadProviderResults(),
    loadProviderLolScheduleMatches()
  ]);
  const mergedProviderDotaLiveRows = mergeEffectiveDotaLiveRows(
    providerStratzLiveState.rows,
    providerDotaLiveState.rows,
    providerSteamLiveState.rows
  );
  const providerDotaScheduleState = await loadProviderDotaScheduleMatches({
    knownRows: dedupeRowsById([
      ...mergedProviderDotaLiveRows,
      ...(Array.isArray(providerDotaResultsState?.rows) ? providerDotaResultsState.rows : [])
    ])
  });
  const canonicalDotaScheduleRows = canonicalizeDotaScheduleRows(providerDotaScheduleState.rows, {
    liveRows: mergedProviderDotaLiveRows,
    resultRows: providerDotaResultsState.rows
  });

  let rows = scheduleMatches.slice();
  rows = replaceFallbackRowsForGame(rows, "lol", providerLolScheduleState);
  if (
    providerStratzLiveState.status === "success" ||
    providerDotaLiveState.status === "success" ||
    providerSteamLiveState.status === "success" ||
    providerDotaScheduleState.status === "success"
  ) {
    rows = rows
      .filter((row) => row.game !== "dota2")
      .concat(mergeDotaScheduleRows(mergedProviderDotaLiveRows, canonicalDotaScheduleRows));
  } else if (shouldHideFallbackDotaRows()) {
    rows = stripFallbackDotaRows(rows);
  }

  rows = filterByDotaTiers(rows, dotaTiers);
  rows = filterByGameRegion(rows, { game, region });
  rows = filterByDateRange(rows, {
    dateFrom,
    dateTo,
    getDateField: (row) => row.startAt
  });

  return annotateRowsWithQuality(sortByDateAscending(rows, "startAt"));
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

  return annotateRowsWithQuality(sortByDateDescending(rows, "endAt"));
}

function findMatchSummary(matchId) {
  const normalizedId = String(matchId || "").trim();
  if (!normalizedId) {
    return null;
  }

  for (const collection of [liveMatches, scheduleMatches, completedMatches]) {
    const row = collection.find((candidate) => candidate?.id === normalizedId);
    if (row) {
      return annotateEntityQuality(row);
    }
  }

  return null;
}

function mergeMatchDetailWithSummary(detail, summary) {
  if (!summary) {
    return annotateEntityQuality(detail);
  }
  if (!detail) {
    return annotateEntityQuality(summary);
  }

  return annotateEntityQuality({
    ...summary,
    ...detail,
    freshness: {
      ...(summary?.freshness || {}),
      ...(detail?.freshness || {})
    },
    source: {
      ...(summary?.source || {}),
      ...(detail?.source || {})
    },
    seriesScore: {
      ...(summary?.seriesScore || {}),
      ...(detail?.seriesScore || {})
    },
    teams: {
      left: {
        ...(summary?.teams?.left || {}),
        ...(detail?.teams?.left || {})
      },
      right: {
        ...(summary?.teams?.right || {}),
        ...(detail?.teams?.right || {})
      }
    }
  });
}

export async function getMatchDetail(matchId, options = {}) {
  const summary = findMatchSummary(matchId);

  if (matchDetails[matchId]) {
    return mergeMatchDetailWithSummary(matchDetails[matchId], summary);
  }

  if (!String(matchId).startsWith("dota_") && !String(matchId).startsWith("lol_riot_")) {
    return null;
  }

  return mergeMatchDetailWithSummary(await loadProviderMatchDetail(matchId, options), summary);
}

async function buildTeamProfile(teamId, {
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

  if (shouldFetchExtendedDotaHistory && (teamResults.length < safeLimit || requestedOpponentId) && teamName) {
    try {
      const resolvedDotaTeam =
        /^\d+$/.test(normalizedTeamId)
          ? {
              id: normalizedTeamId,
              name: teamName
            }
          : await openDotaProvider.resolveTeamIdentityByName(teamName);

      if (resolvedDotaTeam?.id) {
        const providerTeamMatches = await openDotaProvider.fetchTeamMatchHistory(resolvedDotaTeam.id, {
          maxRows: 60
        });
        const providerPerspectives = buildDotaSeriesPerspectivesFromTeamMatches(providerTeamMatches, {
          teamId: resolvedDotaTeam.id,
          teamName: resolvedDotaTeam.name || teamName
        });
        teamResults = mergeUniquePerspectives(teamResults, providerPerspectives);
        if (!teamName && resolvedDotaTeam.name) {
          teamName = resolvedDotaTeam.name;
        }
      }
    } catch {
      // Keep best-effort results when provider-specific team history fails.
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

export async function getTeamProfile(teamId, options = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  if (!normalizedTeamId) {
    return null;
  }

  const cacheKey = teamProfileCacheKey(normalizedTeamId, options);
  const cached = providerState.teamProfileByKey.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt <= providerCacheMs) {
    return cached.detail;
  }

  if (cached?.detail) {
    void refreshTeamProfile(cacheKey, () => buildTeamProfile(normalizedTeamId, options));
    return cached.detail;
  }

  return refreshTeamProfile(cacheKey, () => buildTeamProfile(normalizedTeamId, options));
}

export async function getProviderCoverageReport() {
  const [
    stratzLiveState,
    openDotaLiveState,
    steamLiveState,
    openDotaResultsState,
    lolLiveState,
    lolScheduleState,
    lolResultsState
  ] =
    await Promise.all([
      loadProviderStratzLiveMatches(),
      loadProviderLiveMatches(),
      loadProviderSteamLiveMatches(),
      loadProviderResults(),
      loadProviderLolLiveMatches(),
      loadProviderLolScheduleMatches(),
      loadProviderLolResults()
    ]);
  const mergedProviderDotaLiveRows = mergeEffectiveDotaLiveRows(
    stratzLiveState.rows,
    openDotaLiveState.rows,
    steamLiveState.rows
  );
  const dotaScheduleState = await loadProviderDotaScheduleMatches({
    knownRows: dedupeRowsById([
      ...mergedProviderDotaLiveRows,
      ...(Array.isArray(openDotaResultsState?.rows) ? openDotaResultsState.rows : [])
    ])
  });
  const canonicalDotaScheduleRows = canonicalizeDotaScheduleRows(dotaScheduleState.rows, {
    liveRows: mergedProviderDotaLiveRows,
    resultRows: openDotaResultsState.rows
  });
  const syntheticLiveRows = canonicalDotaScheduleRows.filter((row) => row.status === "live");
  const unresolvedScheduledTeams = canonicalDotaScheduleRows.reduce((total, row) => {
    const ids = [row?.teams?.left?.id, row?.teams?.right?.id];
    return total + ids.filter((id) => !/^\d+$/.test(String(id || ""))).length;
  }, 0);

  return {
    generatedAt: new Date().toISOString(),
    providerMode: dataMode,
    dota: {
      stratz: {
        ...stratzProvider.getCapabilities(),
        cacheStatus: stratzLiveState.status,
        liveRows: Array.isArray(stratzLiveState.rows) ? stratzLiveState.rows.length : 0
      },
      steam: {
        ...steamWebApiDotaProvider.getCapabilities(),
        cacheStatus: steamLiveState.status,
        liveRows: Array.isArray(steamLiveState.rows) ? steamLiveState.rows.length : 0
      },
      openDota: {
        cacheStatus: openDotaLiveState.status,
        liveRows: Array.isArray(openDotaLiveState.rows) ? openDotaLiveState.rows.length : 0,
        resultStatus: openDotaResultsState.status,
        resultRows: Array.isArray(openDotaResultsState.rows) ? openDotaResultsState.rows.length : 0,
        resultSnapshotRows: countRowsWithSnapshot(openDotaResultsState.rows)
      },
      liquipedia: {
        apiOnly: true,
        cacheStatus: dotaScheduleState.status,
        scheduleRows: Array.isArray(dotaScheduleState.rows) ? dotaScheduleState.rows.length : 0,
        snapshotRows: countRowsWithSnapshot(dotaScheduleState.rows),
        retainedRows: countRetainedRows(dotaScheduleState.rows),
        unresolvedScheduledTeams
      },
      effectiveLiveCoverage: {
        mergedLiveRows: mergedProviderDotaLiveRows.length,
        syntheticPromotions: syntheticLiveRows.length,
        effectiveLiveRows: mergeDotaScheduleRows(mergedProviderDotaLiveRows, syntheticLiveRows).length
      }
    },
    lol: {
      liveStatus: lolLiveState.status,
      liveRows: Array.isArray(lolLiveState.rows) ? lolLiveState.rows.length : 0,
      liveSnapshotRows: countRowsWithSnapshot(lolLiveState.rows),
      scheduleStatus: lolScheduleState.status,
      scheduleRows: Array.isArray(lolScheduleState.rows) ? lolScheduleState.rows.length : 0,
      scheduleSnapshotRows: countRowsWithSnapshot(lolScheduleState.rows),
      resultsStatus: lolResultsState.status,
      resultRows: Array.isArray(lolResultsState.rows) ? lolResultsState.rows.length : 0,
      resultSnapshotRows: countRowsWithSnapshot(lolResultsState.rows)
    }
  };
}

export function getProviderDiagnostics() {
  return {
    mode: dataMode,
    providerEnabled: isProviderModeEnabled(),
    providerCacheMs,
    providerTimeoutMs,
    providerSlowMs,
    diagnosticsHistoryLimit,
    providerDetailCacheLimit,
    providerTeamProfileCacheLimit,
    providerSnapshot: {
      ...providerSnapshotMeta
    },
    detailCacheEntries: providerState.detailById.size,
    lolDetailCacheEntries: providerState.lolDetailById.size,
    teamProfileCacheEntries: providerState.teamProfileByKey.size,
    providers: providerSnapshotKeys.map((stateKey) => providerDiagnosticsRow(stateKey)),
    recentRefreshes: providerRefreshHistory.slice().reverse(),
    recentWarmRuns: providerWarmHistory.slice().reverse()
  };
}

export async function warmProviderCaches() {
  return forceRefreshProviderCaches({
    reason: "warm"
  });
}

export async function refreshProviderCaches(providerKeys = []) {
  return forceRefreshProviderCaches({
    providerKeys,
    reason: "manual"
  });
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

function buildAlertSummary(alerts = [], matchedFollowIds = new Set()) {
  const byType = {};
  for (const alert of alerts) {
    const type = String(alert?.type || "alert");
    byType[type] = (byType[type] || 0) + 1;
  }
  return {
    totalAlerts: alerts.length,
    matchedFollows: matchedFollowIds.size,
    byType
  };
}

function syncAlertOutbox(userId, alerts = [], preferences = {}) {
  const normalizedUserId = String(userId || "").trim();
  const existing = alertOutboxByUser.get(normalizedUserId) || [];
  const next = [];

  for (const alert of alerts) {
    const current = existing.find((row) => row.id === alert.id);
    if (current) {
      current.lastSeenAt = new Date().toISOString();
      current.title = alert.title;
      current.detail = alert.detail;
      current.tone = alert.tone;
      current.deliveryStatus = current.deliveryStatus || "pending";
      next.push(current);
      continue;
    }

    next.push({
      ...cloneValue(alert),
      deliveryStatus: "pending",
      deliveryChannels: [
        preferences.webPush ? "webPush" : null,
        preferences.emailDigest ? "emailDigest" : null
      ].filter(Boolean),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }

  alertOutboxByUser.set(normalizedUserId, next);
  return next;
}

function matchTeamFollowAgainstRow(follow, row) {
  if (!follow || follow.entityType !== "team") {
    return false;
  }
  return (
    String(row?.teams?.left?.id || "") === String(follow.entityId) ||
    String(row?.teams?.right?.id || "") === String(follow.entityId)
  );
}

function buildAlertCollections({
  userId,
  followsForUser,
  preferences,
  liveRows,
  upcomingRows,
  resultRows
}) {
  const candidates = [];
  const matchedFollowIds = new Set();
  const nowMs = Date.now();

  function pushAlert({ type, tone = "neutral", row, occurredAt, title, detail }) {
    candidates.push({
      id: `${type}:${row.id}`,
      type,
      tone,
      matchId: row.id,
      occurredAt,
      title,
      detail,
      tournament: row.tournament,
      teams: cloneValue(row.teams)
    });
  }

  for (const row of liveRows) {
    const matchingFollows = followsForUser.filter((follow) => matchTeamFollowAgainstRow(follow, row));
    if (!matchingFollows.length) {
      continue;
    }
    matchingFollows.forEach((follow) => matchedFollowIds.add(follow.id));

    if (preferences.matchStart) {
      pushAlert({
        type: "start",
        tone: "live",
        row,
        occurredAt: row.startAt || new Date().toISOString(),
        title: `${row.teams.left.name} vs ${row.teams.right.name} is live`,
        detail: `Series ${row.seriesScore.left}-${row.seriesScore.right}${row.tournament ? ` · ${row.tournament}` : ""}.`
      });
    }

    if (preferences.swingAlerts && row.keySignal) {
      pushAlert({
        type: "swing",
        tone: "warning",
        row,
        occurredAt: row.updatedAt || row.startAt || new Date().toISOString(),
        title: `${row.teams.left.name} vs ${row.teams.right.name} has a live signal`,
        detail: `${String(row.keySignal).replaceAll("_", " ")}.`
      });
    }
  }

  for (const row of upcomingRows) {
    const matchingFollows = followsForUser.filter((follow) => matchTeamFollowAgainstRow(follow, row));
    if (!matchingFollows.length) {
      continue;
    }
    matchingFollows.forEach((follow) => matchedFollowIds.add(follow.id));

    const startMs = Date.parse(row.startAt || "");
    if (!preferences.matchStart || !Number.isFinite(startMs) || startMs - nowMs > 45 * oneMinute || startMs < nowMs - 15 * oneMinute) {
      continue;
    }

    pushAlert({
      type: "start",
      tone: "warning",
      row,
      occurredAt: row.startAt,
      title: `${row.teams.left.name} vs ${row.teams.right.name} starts soon`,
      detail: `Scheduled for ${new Date(row.startAt).toLocaleString()}.`
    });
  }

  for (const row of resultRows) {
    const matchingFollows = followsForUser.filter((follow) => matchTeamFollowAgainstRow(follow, row));
    if (!matchingFollows.length) {
      continue;
    }
    matchingFollows.forEach((follow) => matchedFollowIds.add(follow.id));

    const endMs = Date.parse(row.endAt || row.startAt || "");
    if (!preferences.matchFinal || !Number.isFinite(endMs) || nowMs - endMs > 18 * oneHour) {
      continue;
    }

    const winnerName =
      row.winnerTeamId === row?.teams?.left?.id
        ? row.teams.left.name
        : row.winnerTeamId === row?.teams?.right?.id
          ? row.teams.right.name
          : "Series finished";

    pushAlert({
      type: "final",
      tone: "complete",
      row,
      occurredAt: row.endAt || row.startAt,
      title: `${row.teams.left.name} vs ${row.teams.right.name} is final`,
      detail: `${winnerName} · ${row.seriesScore.left}-${row.seriesScore.right}.`
    });
  }

  candidates.sort((left, right) => Date.parse(right.occurredAt || 0) - Date.parse(left.occurredAt || 0));
  const outbox = syncAlertOutbox(userId, candidates, preferences);

  return {
    summary: buildAlertSummary(candidates, matchedFollowIds),
    alerts: candidates.slice(0, 12),
    outbox
  };
}

function buildAlertOutboxSummary(rows = []) {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.deliveryStatus === "pending").length,
    acknowledged: rows.filter((row) => row.deliveryStatus === "acknowledged").length
  };
}

export async function getAlertPreview(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      userId: normalizedUserId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAlerts: 0,
        matchedFollows: 0,
        byType: {}
      },
      alerts: []
    };
  }

  const followsForUser = follows.filter((follow) => follow.userId === normalizedUserId);
  const preferences = getNotificationPreferences(normalizedUserId);
  const [liveRows, upcomingRows, resultRows] = await Promise.all([
    listLiveMatches({ followedOnly: false, userId: null }),
    listSchedule({ dateFrom: Date.now() - 30 * oneMinute, dateTo: Date.now() + 6 * oneHour }),
    listResults({ dateFrom: Date.now() - 12 * oneHour, dateTo: Date.now() + oneHour })
  ]);
  const collection = buildAlertCollections({
    userId: normalizedUserId,
    followsForUser,
    preferences,
    liveRows,
    upcomingRows,
    resultRows
  });

  return {
    userId: normalizedUserId,
    generatedAt: new Date().toISOString(),
    summary: collection.summary,
    alerts: collection.alerts
  };
}

export async function getAlertOutbox(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      userId: normalizedUserId,
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        pending: 0,
        acknowledged: 0
      },
      alerts: []
    };
  }

  await getAlertPreview(normalizedUserId);
  const rows = (alertOutboxByUser.get(normalizedUserId) || []).slice().sort((left, right) =>
    Date.parse(right.lastSeenAt || 0) - Date.parse(left.lastSeenAt || 0)
  );

  return {
    userId: normalizedUserId,
    generatedAt: new Date().toISOString(),
    summary: buildAlertOutboxSummary(rows),
    alerts: rows
  };
}

export function acknowledgeAlertOutboxItems(userId, alertIds = []) {
  const normalizedUserId = String(userId || "").trim();
  const rows = alertOutboxByUser.get(normalizedUserId) || [];
  const idSet = new Set((Array.isArray(alertIds) ? alertIds : []).map((item) => String(item || "").trim()).filter(Boolean));
  const acknowledgedAt = new Date().toISOString();
  let updated = 0;

  for (const row of rows) {
    if (!idSet.has(row.id)) {
      continue;
    }
    row.deliveryStatus = "acknowledged";
    row.acknowledgedAt = acknowledgedAt;
    updated += 1;
  }

  return {
    userId: normalizedUserId,
    updated,
    acknowledgedAt,
    alerts: rows
  };
}
