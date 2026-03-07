import { fetchJson } from "../shared/http.js";

const LOL_API_BASE_URL =
  process.env.LOL_ESPORTS_API_BASE_URL || "https://esports-api.lolesports.com/persisted/gw";
const LOL_API_KEY =
  process.env.LOL_ESPORTS_API_KEY || "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const LOL_LOCALE = process.env.LOL_ESPORTS_LOCALE || "en-US";
const LOL_LIVESTATS_BASE_URL =
  process.env.LOL_LIVESTATS_BASE_URL || "https://feed.lolesports.com/livestats/v1";
const LOL_LIVESTATS_WINDOW_SECONDS = clampInt(
  Number.parseInt(process.env.LOL_LIVESTATS_WINDOW_SECONDS || "300", 10),
  120,
  900,
  300
);
const LOL_LIVE_TREND_BACKFILL_WINDOWS = clampInt(
  Number.parseInt(process.env.LOL_LIVE_TREND_BACKFILL_WINDOWS || "24", 10),
  0,
  60,
  24
);
const LOL_LIVE_TREND_BACKFILL_STEP_SECONDS = clampInt(
  Number.parseInt(process.env.LOL_LIVE_TREND_BACKFILL_STEP_SECONDS || "120", 10),
  30,
  300,
  120
);
const LOL_LIVE_TREND_BACKFILL_CACHE_MS = clampInt(
  Number.parseInt(process.env.LOL_LIVE_TREND_BACKFILL_CACHE_MS || "60000", 10),
  10000,
  300000,
  60000
);
const MIN_GOLD_SWING_FOR_TICKER = clampInt(
  Number.parseInt(process.env.LOL_LIVE_TICKER_GOLD_SWING || "1500", 10),
  500,
  5000,
  1500
);
const SCHEDULE_LOOKUP_CACHE_MS = clampInt(
  Number.parseInt(process.env.LOL_SCHEDULE_LOOKUP_CACHE_MS || "60000", 10),
  10000,
  300000,
  60000
);
const SCHEDULE_LOOKUP_MAX_PAGES = clampInt(
  Number.parseInt(process.env.LOL_SCHEDULE_LOOKUP_MAX_PAGES || "3", 10),
  1,
  6,
  3
);
const ESTIMATED_GAME_SECONDS = clampInt(
  Number.parseInt(process.env.LOL_ESTIMATED_GAME_SECONDS || "2700", 10),
  1200,
  5400,
  2700
);
const ESTIMATED_BETWEEN_GAMES_SECONDS = clampInt(
  Number.parseInt(process.env.LOL_ESTIMATED_BETWEEN_GAMES_SECONDS || "480", 10),
  120,
  1200,
  480
);
const LOL_SERIES_SNAPSHOT_GAMES = clampInt(
  Number.parseInt(process.env.LOL_SERIES_SNAPSHOT_GAMES || "3", 10),
  1,
  5,
  3
);
const LOL_RECENT_RESULTS_CACHE_MS = clampInt(
  Number.parseInt(process.env.LOL_RECENT_RESULTS_CACHE_MS || "120000", 10),
  30000,
  600000,
  120000
);
const LOL_PREMATCH_RESULTS_MAX_ROWS = clampInt(
  Number.parseInt(process.env.LOL_PREMATCH_RESULTS_MAX_ROWS || "120", 10),
  40,
  300,
  120
);
const LOL_PREMATCH_RESULTS_MAX_PAGES = clampInt(
  Number.parseInt(process.env.LOL_PREMATCH_RESULTS_MAX_PAGES || "4", 10),
  2,
  8,
  4
);

function clampInt(value, min, max, fallback) {
  if (!Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function statusFromState(state) {
  if (state === "inProgress") return "live";
  if (state === "completed") return "completed";
  return "upcoming";
}

function winsNeededFromBestOf(bestOf) {
  const normalized = Math.max(1, Number(bestOf || 1));
  return Math.floor(normalized / 2) + 1;
}

function estimatedSeriesDurationMs(bestOf) {
  const normalized = Math.max(1, Number(bestOf || 1));
  return (
    normalized * ESTIMATED_GAME_SECONDS * 1000 +
    Math.max(0, normalized - 1) * ESTIMATED_BETWEEN_GAMES_SECONDS * 1000
  );
}

function teamSeriesSignals(teams = [], bestOf = 1) {
  const leftTeam = teams[0] || {};
  const rightTeam = teams[1] || {};
  const leftWins = Number(leftTeam?.result?.gameWins || 0);
  const rightWins = Number(rightTeam?.result?.gameWins || 0);
  const leftOutcome = String(leftTeam?.result?.outcome || "").toLowerCase();
  const rightOutcome = String(rightTeam?.result?.outcome || "").toLowerCase();
  const winsNeeded = winsNeededFromBestOf(bestOf);

  return {
    leftWins,
    rightWins,
    winsNeeded,
    hasWinnerOutcome:
      leftOutcome === "win" ||
      rightOutcome === "win" ||
      leftOutcome === "loss" ||
      rightOutcome === "loss",
    hasDecisiveScore: leftWins >= winsNeeded || rightWins >= winsNeeded,
    hasPartialScore: leftWins + rightWins > 0
  };
}

export function resolveRiotEventState({
  eventState,
  scheduleState,
  teams = [],
  games = [],
  bestOf = 1,
  startTime,
  nowMs = Date.now()
} = {}) {
  const normalizedEventState = String(eventState || "").trim() || null;
  const normalizedScheduleState = String(scheduleState || "").trim() || null;
  const inferredGamesState = inferStateFromGames(games);
  const signals = teamSeriesSignals(teams, bestOf);
  const gameStates = Array.isArray(games)
    ? games.map((game) => String(game?.state || "").trim()).filter(Boolean)
    : [];
  const hasCompletedGame = gameStates.includes("completed");
  const hasLiveGame = gameStates.includes("inProgress");
  const hasSeriesActivity = signals.hasPartialScore || hasCompletedGame || hasLiveGame;
  const hasCompletionEvidence =
    signals.hasWinnerOutcome || signals.hasDecisiveScore || inferredGamesState === "completed";
  const startTimestamp = Date.parse(String(startTime || ""));
  const hasValidStart = Number.isFinite(startTimestamp);
  const hasStarted = hasValidStart ? startTimestamp <= nowMs : false;
  const withinSeriesWindow = hasValidStart
    ? nowMs <= startTimestamp + estimatedSeriesDurationMs(bestOf)
    : false;
  const staleSeries = hasValidStart
    ? nowMs > startTimestamp + estimatedSeriesDurationMs(bestOf)
    : false;

  if (hasCompletionEvidence) {
    return "completed";
  }

  if (
    hasLiveGame ||
    normalizedEventState === "inProgress" ||
    normalizedScheduleState === "inProgress"
  ) {
    return "inProgress";
  }

  if (hasSeriesActivity) {
    return staleSeries ? "completed" : "inProgress";
  }

  if (normalizedEventState === "completed" || normalizedScheduleState === "completed") {
    if (!hasStarted) {
      return "unstarted";
    }

    if (withinSeriesWindow) {
      return "inProgress";
    }

    return "completed";
  }

  return "unstarted";
}

function regionFromLeagueSlug(leagueSlug) {
  const slug = String(leagueSlug || "").toLowerCase();

  if (slug.startsWith("lck") || slug.includes("korea")) {
    return "kr";
  }

  if (slug.startsWith("lpl") || slug.includes("china")) {
    return "cn";
  }

  if (slug.startsWith("lec") || slug.includes("emea") || slug.includes("europe")) {
    return "eu";
  }

  if (slug.startsWith("lta") || slug.startsWith("lcs") || slug.includes("americas")) {
    return "na";
  }

  if (slug.startsWith("ljl") || slug.includes("japan")) {
    return "jp";
  }

  if (slug.startsWith("lcp") || slug.includes("pacific")) {
    return "apac";
  }

  return "global";
}

function isMatchEvent(event) {
  return event?.type === "match" && (event?.match?.id || event?.id);
}

export function normalizeMatchSummary(event) {
  if (!isMatchEvent(event)) {
    return null;
  }

  const matchId = String(event?.match?.id || event?.id);
  const teams = Array.isArray(event.match.teams) ? event.match.teams : [];
  const leftTeam = teams[0] || {};
  const rightTeam = teams[1] || {};
  const leftOutcome = String(leftTeam?.result?.outcome || "").toLowerCase();
  const rightOutcome = String(rightTeam?.result?.outcome || "").toLowerCase();
  const league = event.league || {};
  const bestOf = Number(event?.match?.strategy?.count || 1);
  const status = statusFromState(
    resolveRiotEventState({
      eventState: event?.state,
      teams,
      games: event?.match?.games,
      bestOf,
      startTime: event?.startTime
    })
  );

  const summary = {
    id: `lol_riot_${matchId}`,
    providerMatchId: matchId,
    game: "lol",
    region: regionFromLeagueSlug(league.slug),
    tournament: league.name || "LoL Esports",
    status,
    startAt: event.startTime || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bestOf,
    seriesScore: {
      left: Number(leftTeam?.result?.gameWins || 0),
      right: Number(rightTeam?.result?.gameWins || 0)
    },
    teams: {
      left: {
        id: String(leftTeam.id || `lol_left_${matchId}`),
        name: leftTeam.name || "Team 1"
      },
      right: {
        id: String(rightTeam.id || `lol_right_${matchId}`),
        name: rightTeam.name || "Team 2"
      }
    },
    keySignal: status === "live" ? "provider_live" : "provider_schedule"
  };

  if (leftOutcome === "win") {
    summary.winnerTeamId = summary.teams.left.id;
  } else if (rightOutcome === "win") {
    summary.winnerTeamId = summary.teams.right.id;
  }

  return summary;
}

function normalizeResultSummary(event) {
  const summary = normalizeMatchSummary(event);
  if (!summary || summary.status !== "completed") {
    return null;
  }

  const teams = Array.isArray(event?.match?.teams) ? event.match.teams : [];
  const leftOutcome = teams[0]?.result?.outcome;
  const rightOutcome = teams[1]?.result?.outcome;

  if (leftOutcome === "win") {
    summary.winnerTeamId = summary.teams.left.id;
  } else if (rightOutcome === "win") {
    summary.winnerTeamId = summary.teams.right.id;
  }

  summary.endAt = summary.startAt;
  return summary;
}

function parseProviderMatchId(matchId) {
  if (!matchId) return null;

  const parts = String(matchId).split("_");
  const tail = parts[parts.length - 1];
  return /^\d+$/.test(tail) ? tail : null;
}

function inferStateFromGames(games = []) {
  if (!Array.isArray(games) || games.length === 0) {
    return "unstarted";
  }

  if (games.some((game) => game?.state === "inProgress")) {
    return "inProgress";
  }

  if (games.every((game) => game?.state === "completed")) {
    return "completed";
  }

  return "unstarted";
}

function buildQuery(params = {}) {
  const query = new URLSearchParams({
    hl: LOL_LOCALE,
    ...params
  });

  return query.toString();
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return toFiniteNumber(value);
}

function toCount(value) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? 0 : Math.round(parsed);
}

function signed(value) {
  const num = toCount(value);
  if (num === 0) {
    return "0";
  }

  return `${num > 0 ? "+" : ""}${num}`;
}

function parseTimestamp(value, fallback = Date.now()) {
  const parsed = Date.parse(String(value || ""));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sortFramesByTimestamp(frames) {
  return frames
    .slice()
    .sort((left, right) => parseTimestamp(left?.rfc460Timestamp) - parseTimestamp(right?.rfc460Timestamp));
}

function teamColorMapFromMetadata(summary, metadata) {
  const blueTeamId = String(metadata?.blueTeamMetadata?.esportsTeamId || "");
  const redTeamId = String(metadata?.redTeamMetadata?.esportsTeamId || "");
  const leftTeamId = String(summary?.teams?.left?.id || "");
  const rightTeamId = String(summary?.teams?.right?.id || "");

  if (blueTeamId && redTeamId) {
    if (blueTeamId === leftTeamId) {
      return { left: "blue", right: "red" };
    }

    if (blueTeamId === rightTeamId) {
      return { left: "red", right: "blue" };
    }
  }

  return { left: "blue", right: "red" };
}

function sideForColor(teamColorMap, color) {
  return teamColorMap.left === color ? "left" : "right";
}

function teamFrameBySide(frame, teamColorMap, side) {
  const color = teamColorMap[side] || (side === "left" ? "blue" : "red");
  return color === "red" ? frame?.redTeam : frame?.blueTeam;
}

function formatDragonName(dragonType) {
  const raw = String(dragonType || "").replace(/_/g, " ").trim();
  if (!raw) {
    return "Dragon";
  }

  return `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()} Dragon`;
}

function parseRequestedGameNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    return null;
  }

  return parsed;
}

function selectFocusedGame(games = [], requestedGameNumber = null) {
  if (!Array.isArray(games) || games.length === 0) {
    return {
      game: null,
      requestedGameNumber: parseRequestedGameNumber(requestedGameNumber),
      requestedMissing: false,
      selectedReason: "none"
    };
  }

  const ordered = games
    .filter((game) => game?.id)
    .slice()
    .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0));

  if (!ordered.length) {
    return {
      game: null,
      requestedGameNumber: parseRequestedGameNumber(requestedGameNumber),
      requestedMissing: false,
      selectedReason: "none"
    };
  }

  const normalizedRequested = parseRequestedGameNumber(requestedGameNumber);
  if (normalizedRequested !== null) {
    const requested = ordered.find((game) => Number(game?.number || 0) === normalizedRequested);
    if (requested) {
      return {
        game: requested,
        requestedGameNumber: normalizedRequested,
        requestedMissing: false,
        selectedReason: "requested"
      };
    }

    const nearest = ordered.reduce((best, game) => {
      const bestDiff = Math.abs(Number(best?.number || 0) - normalizedRequested);
      const nextDiff = Math.abs(Number(game?.number || 0) - normalizedRequested);
      return nextDiff < bestDiff ? game : best;
    }, ordered[0]);

    return {
      game: nearest,
      requestedGameNumber: normalizedRequested,
      requestedMissing: true,
      selectedReason: "fallback_nearest"
    };
  }

  const inProgress = ordered.find((game) => game.state === "inProgress");
  if (inProgress) {
    return {
      game: inProgress,
      requestedGameNumber: null,
      requestedMissing: false,
      selectedReason: "in_progress"
    };
  }

  const completed = ordered.filter((game) => game.state === "completed").pop();
  if (completed) {
    return {
      game: completed,
      requestedGameNumber: null,
      requestedMissing: false,
      selectedReason: "latest_completed"
    };
  }

  return {
    game: ordered[0],
    requestedGameNumber: null,
    requestedMissing: false,
    selectedReason: "first_scheduled"
  };
}

function inferStartFromGames(games = []) {
  if (!Array.isArray(games) || games.length === 0) {
    return null;
  }

  const timestamps = games
    .flatMap((game) => (Array.isArray(game?.vods) ? game.vods : []))
    .map((vod) => vod?.firstFrameTime)
    .map((iso) => Date.parse(String(iso || "")))
    .filter((value) => Number.isFinite(value));

  if (!timestamps.length) {
    return null;
  }

  const earliest = Math.min(...timestamps);
  return new Date(earliest).toISOString();
}

function normalizeScheduleSnapshot(event) {
  const providerMatchId = String(event?.match?.id || event?.id || "");
  if (!providerMatchId) {
    return null;
  }

  return {
    providerMatchId,
    startTime: event?.startTime || null,
    state: event?.state || null,
    tournament: event?.league?.name || null
  };
}

function chooseStartTime(eventStartTime, scheduleStartTime, inferredStartTime) {
  return eventStartTime || scheduleStartTime || inferredStartTime || new Date().toISOString();
}

function resolveWinnerTeamId(summary) {
  if (!summary) {
    return null;
  }

  if (summary.winnerTeamId) {
    return summary.winnerTeamId;
  }

  if (summary.status !== "completed") {
    return null;
  }

  if (summary.seriesScore.left > summary.seriesScore.right) {
    return summary.teams.left.id;
  }

  if (summary.seriesScore.right > summary.seriesScore.left) {
    return summary.teams.right.id;
  }

  return null;
}

function pickPreferredVod(vods = [], preferredLocale = LOL_LOCALE) {
  if (!Array.isArray(vods) || vods.length === 0) {
    return null;
  }

  const preferred = vods.find((vod) => vod?.locale === preferredLocale);
  if (preferred) {
    return preferred;
  }

  const english = vods.find((vod) => vod?.locale === "en-US");
  if (english) {
    return english;
  }

  return vods[0];
}

function buildVodUrl(vod) {
  if (!vod || !vod.provider || !vod.parameter) {
    return null;
  }

  const provider = String(vod.provider).toLowerCase();
  const parameter = String(vod.parameter).trim();

  if (!parameter) {
    return null;
  }

  if (provider === "youtube") {
    const url = new URL("https://www.youtube.com/watch");
    url.searchParams.set("v", parameter);

    if (Number.isInteger(vod?.startMillis) && vod.startMillis > 0) {
      url.searchParams.set("t", `${Math.floor(vod.startMillis / 1000)}s`);
    }

    return url.toString();
  }

  if (provider === "twitch") {
    return `https://www.twitch.tv/videos/${parameter}`;
  }

  return null;
}

function formatLocaleLabel(vod) {
  const translated = vod?.mediaLocale?.translatedName;
  const english = vod?.mediaLocale?.englishName;
  const locale = vod?.locale;

  return translated || english || locale || "Unknown locale";
}

function buildWatchOptions(vods = []) {
  if (!Array.isArray(vods) || vods.length === 0) {
    return [];
  }

  return vods
    .map((vod) => ({
      id: String(vod?.id || `${vod?.provider || "vod"}_${vod?.locale || "x"}`),
      locale: vod?.locale || "unknown",
      label: formatLocaleLabel(vod),
      provider: vod?.provider || "unknown",
      watchUrl: buildVodUrl(vod),
      startedAt: vod?.firstFrameTime || null,
      startMillis: Number.isInteger(vod?.startMillis) ? vod.startMillis : null,
      endMillis: Number.isInteger(vod?.endMillis) ? vod.endMillis : null
    }))
    .filter((row) => row.watchUrl);
}

function gameSideSummary(game, summary) {
  const teams = Array.isArray(game?.teams) ? game.teams : [];
  const leftTeamId = String(summary?.teams?.left?.id || "");
  const rightTeamId = String(summary?.teams?.right?.id || "");
  const leftGameRow = teams.find((team) => String(team?.id || "") === leftTeamId) || null;
  const rightGameRow = teams.find((team) => String(team?.id || "") === rightTeamId) || null;

  return {
    leftSide: leftGameRow?.side || null,
    rightSide: rightGameRow?.side || null
  };
}

function gameTeamsBySide(game, summary) {
  const teams = Array.isArray(game?.teams) ? game.teams : [];
  const leftTeamId = String(summary?.teams?.left?.id || "");
  const rightTeamId = String(summary?.teams?.right?.id || "");

  return {
    left: teams.find((team) => String(team?.id || "") === leftTeamId) || null,
    right: teams.find((team) => String(team?.id || "") === rightTeamId) || null
  };
}

function resolveGameWinnerTeamId(game, summary) {
  const teams = gameTeamsBySide(game, summary);
  const leftOutcome = String(teams.left?.result?.outcome || "").toLowerCase();
  const rightOutcome = String(teams.right?.result?.outcome || "").toLowerCase();

  if (leftOutcome === "win") {
    return summary?.teams?.left?.id || null;
  }

  if (rightOutcome === "win") {
    return summary?.teams?.right?.id || null;
  }

  return null;
}

function durationMinutesFromWatchOptions(watchOptions = []) {
  if (!Array.isArray(watchOptions) || watchOptions.length === 0) {
    return null;
  }

  const candidate = watchOptions.find((option) => Number.isInteger(option?.endMillis) && option.endMillis > 0);
  if (!candidate || !Number.isInteger(candidate.startMillis) || candidate.endMillis <= candidate.startMillis) {
    return null;
  }

  return Number(((candidate.endMillis - candidate.startMillis) / 60000).toFixed(1));
}

function buildSeriesGames(games = [], summary, selectedGameNumber = null) {
  if (!Array.isArray(games) || games.length === 0) {
    return [];
  }

  const matchStartTs = parseTimestamp(summary?.startAt, Number.NaN);

  return games
    .slice()
    .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0))
    .map((game) => {
      const selectedVod = pickPreferredVod(game?.vods || []);
      const watchUrl = buildVodUrl(selectedVod);
      const watchOptions = buildWatchOptions(game?.vods || []);
      const state = game?.state || "unstarted";
      const sides = gameSideSummary(game, summary);
      const gameNumber = Number(game?.number || 0);
      const winnerTeamId = resolveGameWinnerTeamId(game, summary);
      const durationMinutes = durationMinutesFromWatchOptions(watchOptions);
      const estimatedStartedAt =
        Number.isFinite(matchStartTs) && Number.isInteger(gameNumber) && gameNumber > 0
          ? new Date(
              matchStartTs +
                (gameNumber - 1) * (ESTIMATED_GAME_SECONDS + ESTIMATED_BETWEEN_GAMES_SECONDS) * 1000
            ).toISOString()
          : null;

      return {
        id: String(game?.id || `game_${game?.number || "x"}`),
        number: gameNumber,
        state,
        selected: Number.isInteger(selectedGameNumber) && selectedGameNumber === gameNumber,
        label: state === "unneeded"
          ? "Not played (series already decided)."
          : state === "completed"
            ? "Completed game."
            : state === "inProgress"
              ? "Currently live."
              : "Scheduled next.",
        winnerTeamId,
        sideInfo: sides,
        durationMinutes,
        startedAt: selectedVod?.firstFrameTime || estimatedStartedAt || null,
        watchUrl,
        watchProvider: selectedVod?.provider || null,
        watchOptions
      };
    });
}

function buildSeriesProjection(summary, seriesGames) {
  const bestOf = Number(summary?.bestOf || seriesGames?.length || 1);
  const startAt = summary?.startAt;
  const startTs = Date.parse(String(startAt || ""));
  if (!Number.isFinite(startTs)) {
    return null;
  }

  const games = [];
  for (let number = 1; number <= bestOf; number += 1) {
    const gameStart = startTs + (number - 1) * (ESTIMATED_GAME_SECONDS + ESTIMATED_BETWEEN_GAMES_SECONDS) * 1000;
    games.push({
      number,
      estimatedStartAt: new Date(gameStart).toISOString()
    });
  }

  const estimatedEndAt = startTs +
    bestOf * ESTIMATED_GAME_SECONDS * 1000 +
    Math.max(0, bestOf - 1) * ESTIMATED_BETWEEN_GAMES_SECONDS * 1000;

  return {
    matchStartAt: new Date(startTs).toISOString(),
    countdownSeconds: Math.max(0, Math.round((startTs - Date.now()) / 1000)),
    estimatedEndAt: new Date(estimatedEndAt).toISOString(),
    games
  };
}

function sampleSeries(rows, maxPoints = 60) {
  if (!Array.isArray(rows) || rows.length <= maxPoints) {
    return rows || [];
  }

  const step = Math.ceil(rows.length / maxPoints);
  const sampled = [];

  for (let index = 0; index < rows.length; index += step) {
    sampled.push(rows[index]);
  }

  const last = rows[rows.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }

  return sampled;
}

function alignTimestampTo10Seconds(timestamp) {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed / 10000) * 10000;
}

function mergeLiveFrames(frameCollections = []) {
  const byTimestamp = new Map();
  for (const collection of frameCollections) {
    const frames = Array.isArray(collection) ? collection : [];
    for (const frame of frames) {
      const key = String(frame?.rfc460Timestamp || "");
      if (!key) {
        continue;
      }

      if (!byTimestamp.has(key)) {
        byTimestamp.set(key, frame);
      }
    }
  }

  return sortFramesByTimestamp(Array.from(byTimestamp.values()));
}

function buildBackfillStartingTimes(anchorTimestampMs) {
  const anchorAligned = alignTimestampTo10Seconds(anchorTimestampMs);
  if (!Number.isFinite(anchorAligned)) {
    return [];
  }

  const rows = [];
  for (let index = 1; index <= LOL_LIVE_TREND_BACKFILL_WINDOWS; index += 1) {
    const shifted = anchorAligned - index * LOL_LIVE_TREND_BACKFILL_STEP_SECONDS * 1000;
    if (shifted <= 0) {
      break;
    }
    rows.push(new Date(shifted).toISOString());
  }

  return rows;
}

function buildGoldLeadSeries(windowFrames, teamColorMap) {
  if (!Array.isArray(windowFrames) || windowFrames.length === 0) {
    return [];
  }

  const rows = windowFrames
    .map((frame) => {
      const left = toFiniteNumber(teamFrameBySide(frame, teamColorMap, "left")?.totalGold);
      const right = toFiniteNumber(teamFrameBySide(frame, teamColorMap, "right")?.totalGold);
      if (left === null || right === null) {
        return null;
      }

      return {
        at: frame?.rfc460Timestamp || new Date().toISOString(),
        lead: Math.round(left - right)
      };
    })
    .filter(Boolean);

  return sampleSeries(rows, 360);
}

function buildMomentum(summary, windowFrames, teamColorMap) {
  if (!Array.isArray(windowFrames) || windowFrames.length === 0) {
    return null;
  }

  const lastFrame = windowFrames[windowFrames.length - 1];
  const firstFrame = windowFrames[0];

  const leftLast = teamFrameBySide(lastFrame, teamColorMap, "left");
  const rightLast = teamFrameBySide(lastFrame, teamColorMap, "right");
  if (!leftLast || !rightLast) {
    return null;
  }

  const leftGold = toCount(leftLast.totalGold);
  const rightGold = toCount(rightLast.totalGold);
  const leftFirstGold = toCount(teamFrameBySide(firstFrame, teamColorMap, "left")?.totalGold);
  const rightFirstGold = toCount(teamFrameBySide(firstFrame, teamColorMap, "right")?.totalGold);
  const lead = leftGold - rightGold;
  const leadAtWindowStart = leftFirstGold - rightFirstGold;

  const winnerTeamId = lead > 0
    ? summary?.teams?.left?.id
    : lead < 0
      ? summary?.teams?.right?.id
      : null;

  return {
    leaderTeamId: winnerTeamId,
    goldLead: lead,
    goldLeadDeltaWindow: lead - leadAtWindowStart,
    killDiff: toCount(leftLast.totalKills) - toCount(rightLast.totalKills),
    towerDiff: toCount(leftLast.towers) - toCount(rightLast.towers),
    dragonDiff: toCount(Array.isArray(leftLast.dragons) ? leftLast.dragons.length : leftLast.dragons) -
      toCount(Array.isArray(rightLast.dragons) ? rightLast.dragons.length : rightLast.dragons),
    baronDiff: toCount(leftLast.barons) - toCount(rightLast.barons),
    inhibitorDiff: toCount(leftLast.inhibitors) - toCount(rightLast.inhibitors)
  };
}

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return Number.isFinite(numerator) && numerator > 0 ? numerator : 0;
  }

  return numerator / denominator;
}

function buildTopPerformers(detailsFrames, gameMetadata, teamColorMap, limit = 6) {
  if (!Array.isArray(detailsFrames) || detailsFrames.length === 0) {
    return [];
  }

  const sorted = sortFramesByTimestamp(detailsFrames);
  const latest = sorted[sorted.length - 1];
  const participants = Array.isArray(latest?.participants) ? latest.participants : [];
  if (!participants.length) {
    return [];
  }

  const metadataById = buildParticipantMetadataMap(gameMetadata, teamColorMap);

  return participants
    .map((participant) => {
      const snapshot = normalizePlayerSnapshot(participant);
      if (!snapshot) {
        return null;
      }

      const metadata = metadataById.get(snapshot.participantId) || {};
      const fallbackTeam = snapshot.participantId <= 5
        ? sideForColor(teamColorMap, "blue")
        : sideForColor(teamColorMap, "red");

      const kda = safeRatio(snapshot.kills + snapshot.assists, Math.max(1, snapshot.deaths));
      const killParticipationPct = toFiniteNumber(participant?.killParticipation);
      const impactScore =
        snapshot.kills * 2.4 +
        snapshot.assists * 1.3 -
        snapshot.deaths * 1.1 +
        snapshot.cs * 0.03 +
        snapshot.goldEarned * 0.0013;

      return {
        participantId: snapshot.participantId,
        team: metadata.team || fallbackTeam,
        name: metadata.name || `Player ${snapshot.participantId}`,
        champion: metadata.champion || "Unknown",
        role: metadata.role || "flex",
        kills: snapshot.kills,
        deaths: snapshot.deaths,
        assists: snapshot.assists,
        cs: snapshot.cs,
        goldEarned: snapshot.goldEarned,
        itemCount: snapshot.itemCount,
        kda,
        killParticipationPct: killParticipationPct !== null ? killParticipationPct * 100 : null,
        impactScore
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, limit);
}

function roleOrder(role) {
  const order = {
    top: 1,
    jungle: 2,
    mid: 3,
    bottom: 4,
    support: 5
  };

  return order[String(role || "").toLowerCase()] || 99;
}

function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "adc") {
    return "bottom";
  }

  if (normalized === "bot") {
    return "bottom";
  }

  if (normalized === "sup") {
    return "support";
  }

  return normalized || "flex";
}

function participantIsDead(participant = {}) {
  if (typeof participant?.isDead === "boolean") {
    return participant.isDead;
  }

  if (typeof participant?.isAlive === "boolean") {
    return !participant.isAlive;
  }

  if (typeof participant?.alive === "boolean") {
    return !participant.alive;
  }

  const currentHealth = toOptionalFiniteNumber(participant?.currentHealth);
  return currentHealth !== null ? currentHealth <= 0 : false;
}

function readRespawnSeconds(participant = {}) {
  const keys = [
    "respawnTimerSeconds",
    "respawnSeconds",
    "timeUntilRespawnSeconds",
    "timeUntilRespawn",
    "respawnTimer",
    "deathTimerSeconds",
    "deathTimer"
  ];

  for (const key of keys) {
    const value = toOptionalFiniteNumber(participant?.[key]);
    if (value !== null && value >= 0) {
      return Math.round(value);
    }
  }

  return null;
}

function medianSeconds(values = []) {
  const cleaned = values
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null && value >= 1)
    .sort((left, right) => left - right);

  if (!cleaned.length) {
    return null;
  }

  const middle = Math.floor(cleaned.length / 2);
  if (cleaned.length % 2 === 0) {
    return Math.round((cleaned[middle - 1] + cleaned[middle]) / 2);
  }

  return Math.round(cleaned[middle]);
}

function buildWindowParticipantState(windowFrames, teamColorMap) {
  if (!Array.isArray(windowFrames) || windowFrames.length === 0) {
    return new Map();
  }

  const sorted = sortFramesByTimestamp(windowFrames);
  const latest = sorted[sorted.length - 1] || {};
  const latestTimestamp = parseTimestamp(latest?.rfc460Timestamp, Date.now());
  const rowsByParticipantId = new Map();

  for (const frame of sorted) {
    const frameTimestamp = parseTimestamp(frame?.rfc460Timestamp, Date.now());
    const frameSides = [
      { color: "blue", participants: frame?.blueTeam?.participants },
      { color: "red", participants: frame?.redTeam?.participants }
    ];

    for (const sideFrame of frameSides) {
      const side = sideForColor(teamColorMap, sideFrame.color);
      const participants = Array.isArray(sideFrame.participants) ? sideFrame.participants : [];

      for (const participant of participants) {
        const participantId = toFiniteNumber(participant?.participantId);
        if (participantId === null) {
          continue;
        }

        const normalizedParticipantId = Math.round(participantId);
        const isDead = participantIsDead(participant);
        const currentHealth = toOptionalFiniteNumber(participant?.currentHealth);
        const maxHealth = toOptionalFiniteNumber(participant?.maxHealth);
        const respawnSeconds = readRespawnSeconds(participant);
        const next = rowsByParticipantId.get(normalizedParticipantId) || {
          participantId: normalizedParticipantId,
          team: side,
          currentHealth: null,
          maxHealth: null,
          healthPct: null,
          isDead: false,
          deadStartedAt: null,
          deadForSeconds: null,
          respawnSeconds: null,
          respawnEstimated: false,
          respawnConfidence: null,
          respawnAt: null,
          _previousDead: false,
          _deathDurations: []
        };

        if (side && !next.team) {
          next.team = side;
        }

        if (next._previousDead === false && isDead) {
          next.deadStartedAt = frameTimestamp;
        } else if (next._previousDead === true && !isDead && Number.isFinite(next.deadStartedAt)) {
          const deathDurationSeconds = Math.round((frameTimestamp - next.deadStartedAt) / 1000);
          if (deathDurationSeconds >= 1 && deathDurationSeconds <= 240) {
            next._deathDurations.push(deathDurationSeconds);
          }
          next.deadStartedAt = null;
        }

        next._previousDead = isDead;
        next.currentHealth = currentHealth;
        next.maxHealth = maxHealth;
        next.healthPct =
          currentHealth !== null && maxHealth !== null && maxHealth > 0
            ? Number(((currentHealth / maxHealth) * 100).toFixed(1))
            : null;
        next.isDead = isDead;

        if (isDead && respawnSeconds !== null) {
          next.respawnSeconds = respawnSeconds;
          next.respawnEstimated = false;
          next.respawnConfidence = "exact_api";
          next.respawnAt = latestTimestamp + respawnSeconds * 1000;
        } else if (isDead) {
          next.respawnSeconds = null;
          next.respawnEstimated = false;
          next.respawnConfidence = null;
          next.respawnAt = null;
        } else if (!isDead) {
          next.respawnSeconds = null;
          next.respawnEstimated = false;
          next.respawnConfidence = null;
          next.respawnAt = null;
        }

        rowsByParticipantId.set(normalizedParticipantId, next);
      }
    }
  }

  const globalDurations = [];
  for (const row of rowsByParticipantId.values()) {
    globalDurations.push(...row._deathDurations);
  }
  const fallbackDuration = medianSeconds(globalDurations);

  for (const row of rowsByParticipantId.values()) {
    if (row.isDead && Number.isFinite(row.deadStartedAt)) {
      row.deadForSeconds = Math.max(0, Math.round((latestTimestamp - row.deadStartedAt) / 1000));
    } else {
      row.deadForSeconds = null;
    }

    if (!row.isDead) {
      row.deadStartedAt = null;
      continue;
    }

    if (Number.isFinite(row.respawnSeconds)) {
      row.respawnAt = latestTimestamp + row.respawnSeconds * 1000;
      continue;
    }

    if (!Number.isFinite(row.deadForSeconds)) {
      row.respawnSeconds = null;
      row.respawnEstimated = false;
      row.respawnConfidence = "unavailable";
      row.respawnAt = null;
      continue;
    }

    const participantMedian = medianSeconds(row._deathDurations);
    const expectedDuration = participantMedian ?? fallbackDuration;
    if (!Number.isFinite(expectedDuration)) {
      row.respawnSeconds = null;
      row.respawnEstimated = false;
      row.respawnConfidence = "unavailable";
      row.respawnAt = null;
      continue;
    }

    const remaining = Math.max(0, Math.round(expectedDuration - row.deadForSeconds));
    row.respawnSeconds = remaining;
    row.respawnEstimated = true;
    row.respawnConfidence = participantMedian ? "player_window_estimate" : "series_window_estimate";
    row.respawnAt = latestTimestamp + remaining * 1000;
  }

  return rowsByParticipantId;
}

function buildTeamDraft(gameMetadata, teamColorMap) {
  const left = [];
  const right = [];
  const blueParticipants = Array.isArray(gameMetadata?.blueTeamMetadata?.participantMetadata)
    ? gameMetadata.blueTeamMetadata.participantMetadata
    : [];
  const redParticipants = Array.isArray(gameMetadata?.redTeamMetadata?.participantMetadata)
    ? gameMetadata.redTeamMetadata.participantMetadata
    : [];

  for (const row of blueParticipants) {
    const side = sideForColor(teamColorMap, "blue");
    const target = side === "left" ? left : right;
    target.push({
      participantId: toCount(row?.participantId),
      name: row?.summonerName || `Player ${row?.participantId || "?"}`,
      champion: row?.championId || "Unknown",
      role: normalizeRole(row?.role)
    });
  }

  for (const row of redParticipants) {
    const side = sideForColor(teamColorMap, "red");
    const target = side === "left" ? left : right;
    target.push({
      participantId: toCount(row?.participantId),
      name: row?.summonerName || `Player ${row?.participantId || "?"}`,
      champion: row?.championId || "Unknown",
      role: normalizeRole(row?.role)
    });
  }

  left.sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  right.sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  if (!left.length && !right.length) {
    return null;
  }

  return {
    left,
    right
  };
}

function buildPlayerEconomy(detailsFrames, gameMetadata, teamColorMap, windowFrames = []) {
  if (!Array.isArray(detailsFrames) || detailsFrames.length === 0) {
    return null;
  }

  const sorted = sortFramesByTimestamp(detailsFrames);
  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];
  const elapsedSeconds = Math.max(
    1,
    Math.round(
      (parseTimestamp(latest?.rfc460Timestamp, Date.now()) - parseTimestamp(baseline?.rfc460Timestamp, Date.now())) /
        1000
    )
  );
  const elapsedMinutes = Math.max(1, elapsedSeconds / 60);
  const metadataById = buildParticipantMetadataMap(gameMetadata, teamColorMap);
  const windowStateByParticipantId = buildWindowParticipantState(windowFrames, teamColorMap);
  const participants = Array.isArray(latest?.participants) ? latest.participants : [];

  const rows = participants
    .map((participant) => {
      const snapshot = normalizePlayerSnapshot(participant);
      if (!snapshot) {
        return null;
      }

      const metadata = metadataById.get(snapshot.participantId) || {};
      const fallbackTeam = snapshot.participantId <= 5
        ? sideForColor(teamColorMap, "blue")
        : sideForColor(teamColorMap, "red");
      const liveState = windowStateByParticipantId.get(snapshot.participantId) || {};

      return {
        participantId: snapshot.participantId,
        team: metadata.team || liveState.team || fallbackTeam,
        name: metadata.name || `Player ${snapshot.participantId}`,
        champion: metadata.champion || "Unknown",
        role: metadata.role || "flex",
        kills: snapshot.kills,
        deaths: snapshot.deaths,
        assists: snapshot.assists,
        cs: snapshot.cs,
        goldEarned: snapshot.goldEarned,
        gpm: Math.round(snapshot.goldEarned / elapsedMinutes),
        itemCount: snapshot.itemCount,
        currentHealth: toOptionalFiniteNumber(liveState.currentHealth),
        maxHealth: toOptionalFiniteNumber(liveState.maxHealth),
        healthPct: toOptionalFiniteNumber(liveState.healthPct),
        isDead: Boolean(liveState.isDead),
        deadForSeconds: toOptionalFiniteNumber(liveState.deadForSeconds),
        respawnSeconds: toOptionalFiniteNumber(liveState.respawnSeconds),
        respawnEstimated: Boolean(liveState.respawnEstimated),
        respawnConfidence: liveState.respawnConfidence || null,
        respawnAt: Number.isFinite(liveState.respawnAt) ? new Date(liveState.respawnAt).toISOString() : null
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.goldEarned - left.goldEarned);

  return {
    elapsedSeconds,
    updatedAt: latest?.rfc460Timestamp || new Date().toISOString(),
    left: rows.filter((row) => row.team === "left"),
    right: rows.filter((row) => row.team === "right")
  };
}

function buildObjectiveControl(teams = {}) {
  const left = teams?.left || {};
  const right = teams?.right || {};

  const leftTotals = {
    towers: toCount(left.towers),
    dragons: toCount(left.dragons),
    barons: toCount(left.barons),
    inhibitors: toCount(left.inhibitors)
  };
  const rightTotals = {
    towers: toCount(right.towers),
    dragons: toCount(right.dragons),
    barons: toCount(right.barons),
    inhibitors: toCount(right.inhibitors)
  };

  const leftScore =
    leftTotals.towers * 1.4 +
    leftTotals.dragons * 2.2 +
    leftTotals.barons * 3.1 +
    leftTotals.inhibitors * 2.4;
  const rightScore =
    rightTotals.towers * 1.4 +
    rightTotals.dragons * 2.2 +
    rightTotals.barons * 3.1 +
    rightTotals.inhibitors * 2.4;
  const total = leftScore + rightScore;

  return {
    left: {
      ...leftTotals,
      score: Number(leftScore.toFixed(2)),
      controlPct: total > 0 ? Number(((leftScore / total) * 100).toFixed(1)) : 50
    },
    right: {
      ...rightTotals,
      score: Number(rightScore.toFixed(2)),
      controlPct: total > 0 ? Number(((rightScore / total) * 100).toFixed(1)) : 50
    }
  };
}

function buildSeriesProgress(summary, seriesGames) {
  const bestOf = Number(summary?.bestOf || seriesGames?.length || 1);
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const leftWins = toCount(summary?.seriesScore?.left);
  const rightWins = toCount(summary?.seriesScore?.right);
  const completedGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game.state === "completed").length
    : 0;
  const inProgressGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game.state === "inProgress").length
    : 0;
  const skippedGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game.state === "unneeded").length
    : 0;

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

function buildPulseCard(summary, momentum, seriesProgress) {
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";

  if (summary?.status === "upcoming") {
    return {
      tone: "warn",
      title: "Series Not Started",
      summary: `Upcoming BO${seriesProgress?.bestOf || summary?.bestOf || 1}. Watch opening draft and lane setup in Game 1.`
    };
  }

  if (summary?.status === "completed") {
    const winnerId = resolveWinnerTeamId(summary);
    const winnerName =
      winnerId === summary?.teams?.left?.id
        ? leftName
        : winnerId === summary?.teams?.right?.id
          ? rightName
          : "Series complete";

    return {
      tone: "good",
      title: "Series Finalized",
      summary: `${winnerName} closed it ${toCount(summary?.seriesScore?.left)}:${toCount(summary?.seriesScore?.right)}.`
    };
  }

  if (!momentum) {
    return {
      tone: "neutral",
      title: "Live Signal Building",
      summary: "Waiting for enough in-game frames to detect momentum."
    };
  }

  const leader =
    momentum.goldLead > 0 ? leftName : momentum.goldLead < 0 ? rightName : "Neither team";
  const lead = Math.abs(toCount(momentum.goldLead)).toLocaleString();
  const swing = Math.abs(toCount(momentum.goldLeadDeltaWindow)).toLocaleString();
  const highPressure = Math.abs(toCount(momentum.goldLead)) >= 3000 || Math.abs(toCount(momentum.towerDiff)) >= 3;

  return {
    tone: highPressure ? "good" : "neutral",
    title: highPressure ? "High Pressure Window" : "Contested Mid Game",
    summary: `${leader} up ${lead} gold (window swing ${swing}). Towers ${signed(momentum.towerDiff)}.`
  };
}

function nextRefreshSecondsForStatus(status) {
  if (status === "live") {
    return 10;
  }

  if (status === "upcoming") {
    return 30;
  }

  return 60;
}

function buildTeamEconomyTotals(playerEconomy) {
  const left = Array.isArray(playerEconomy?.left) ? playerEconomy.left : [];
  const right = Array.isArray(playerEconomy?.right) ? playerEconomy.right : [];

  const leftGold = left.reduce((sum, row) => sum + toCount(row?.goldEarned), 0);
  const rightGold = right.reduce((sum, row) => sum + toCount(row?.goldEarned), 0);
  const leftGpm = left.reduce((sum, row) => sum + toCount(row?.gpm), 0);
  const rightGpm = right.reduce((sum, row) => sum + toCount(row?.gpm), 0);

  return {
    left: {
      totalGold: leftGold,
      totalGpm: leftGpm,
      avgGpm: left.length ? Math.round(leftGpm / left.length) : 0
    },
    right: {
      totalGold: rightGold,
      totalGpm: rightGpm,
      avgGpm: right.length ? Math.round(rightGpm / right.length) : 0
    }
  };
}

function mapEconomyByRole(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const role = normalizeRole(row?.role);
    if (!map.has(role)) {
      map.set(role, row);
    }
  }

  return map;
}

function buildLaneMatchups(teamDraft, playerEconomy) {
  if (!teamDraft || !playerEconomy) {
    return [];
  }

  const leftDraftByRole = new Map((teamDraft.left || []).map((row) => [normalizeRole(row.role), row]));
  const rightDraftByRole = new Map((teamDraft.right || []).map((row) => [normalizeRole(row.role), row]));
  const leftEconomyByRole = mapEconomyByRole(playerEconomy.left || []);
  const rightEconomyByRole = mapEconomyByRole(playerEconomy.right || []);

  const orderedRoles = ["top", "jungle", "mid", "bottom", "support"];

  return orderedRoles
    .map((role) => {
      const leftDraft = leftDraftByRole.get(role) || {};
      const rightDraft = rightDraftByRole.get(role) || {};
      const leftEco = leftEconomyByRole.get(role) || null;
      const rightEco = rightEconomyByRole.get(role) || null;

      if (!leftDraft.name && !rightDraft.name) {
        return null;
      }

      const leftGold = toCount(leftEco?.goldEarned);
      const rightGold = toCount(rightEco?.goldEarned);

      return {
        role,
        left: {
          player: leftDraft.name || leftEco?.name || "Unknown",
          champion: leftDraft.champion || leftEco?.champion || "Unknown",
          kda: leftEco ? `${leftEco.kills}/${leftEco.deaths}/${leftEco.assists}` : null,
          cs: leftEco?.cs ?? null,
          gold: leftEco?.goldEarned ?? null
        },
        right: {
          player: rightDraft.name || rightEco?.name || "Unknown",
          champion: rightDraft.champion || rightEco?.champion || "Unknown",
          kda: rightEco ? `${rightEco.kills}/${rightEco.deaths}/${rightEco.assists}` : null,
          cs: rightEco?.cs ?? null,
          gold: rightEco?.goldEarned ?? null
        },
        goldDiff: leftGold - rightGold
      };
    })
    .filter(Boolean);
}

function buildObjectiveRuns(objectiveTimeline = [], teams = {}) {
  const rows = Array.isArray(objectiveTimeline) ? objectiveTimeline.slice() : [];
  if (!rows.length) {
    return [];
  }

  const descending = rows
    .slice()
    .sort((left, right) => parseTimestamp(right.at) - parseTimestamp(left.at))
    .slice(0, 24);

  const runs = [];
  let current = null;

  for (const row of descending) {
    const team = row?.team === "right" ? "right" : "left";
    if (!current || current.team !== team) {
      if (current) {
        runs.push(current);
      }

      current = {
        team,
        count: 0,
        types: new Set(),
        startedAt: row.at,
        endedAt: row.at
      };
    }

    current.count += 1;
    current.types.add(String(row.type || "objective"));
    current.startedAt = row.at;
  }

  if (current) {
    runs.push(current);
  }

  return runs.slice(0, 6).map((run, index) => ({
    id: `run_${index + 1}_${run.team}`,
    team: run.team,
    teamName: run.team === "left" ? teams?.left?.name || "Left Team" : teams?.right?.name || "Right Team",
    count: run.count,
    types: Array.from(run.types),
    startedAt: run.startedAt,
    endedAt: run.endedAt
  }));
}

function playerIdentityKey(team, name) {
  return `${team}::${String(name || "").trim().toLowerCase()}`;
}

function winnerSideFromTeamId(winnerTeamId, summary) {
  if (!winnerTeamId || !summary?.teams) {
    return null;
  }

  if (winnerTeamId === summary.teams.left?.id) {
    return "left";
  }

  if (winnerTeamId === summary.teams.right?.id) {
    return "right";
  }

  return null;
}

function sumTeamKills(rows = []) {
  return rows.reduce((sum, row) => sum + toCount(row?.kills), 0);
}

function derivePrimaryRole(roleCounts = new Map()) {
  const entries = Array.from(roleCounts.entries());
  if (!entries.length) {
    return "flex";
  }

  entries.sort((left, right) => right[1] - left[1]);
  return entries[0][0];
}

function buildSeriesPlayerTrends(seriesGameSnapshots = [], summary) {
  if (!Array.isArray(seriesGameSnapshots) || seriesGameSnapshots.length === 0) {
    return [];
  }

  const aggregate = new Map();

  for (const snapshot of seriesGameSnapshots) {
    const playerEconomy = snapshot?.playerEconomy;
    if (!playerEconomy) {
      continue;
    }

    const leftRows = Array.isArray(playerEconomy.left) ? playerEconomy.left : [];
    const rightRows = Array.isArray(playerEconomy.right) ? playerEconomy.right : [];
    const teamKills = {
      left: Math.max(1, sumTeamKills(leftRows)),
      right: Math.max(1, sumTeamKills(rightRows))
    };
    const winnerSide = winnerSideFromTeamId(snapshot?.winnerTeamId, summary);
    const allRows = [
      ...leftRows.map((row) => ({ ...row, team: "left" })),
      ...rightRows.map((row) => ({ ...row, team: "right" }))
    ];

    for (const row of allRows) {
      const key = playerIdentityKey(row.team, row.name);
      const role = normalizeRole(row?.role);
      const kills = toCount(row?.kills);
      const deaths = Math.max(0, toCount(row?.deaths));
      const assists = toCount(row?.assists);
      const goldEarned = toCount(row?.goldEarned);
      const gpm = toCount(row?.gpm);
      const killParticipationPct = Number(((kills + assists) / teamKills[row.team]) * 100);
      const point = {
        gameNumber: Number(snapshot?.gameNumber || 0),
        gpm,
        goldEarned,
        kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
        champion: row?.champion || "Unknown"
      };

      if (!aggregate.has(key)) {
        aggregate.set(key, {
          id: key,
          team: row.team,
          name: row?.name || "Player",
          roleCounts: new Map(),
          championSet: new Set(),
          mapsPlayed: 0,
          mapWins: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
          totalGold: 0,
          totalGpm: 0,
          totalKillParticipationPct: 0,
          mapPoints: []
        });
      }

      const target = aggregate.get(key);
      target.mapsPlayed += 1;
      if (winnerSide && row.team === winnerSide) {
        target.mapWins += 1;
      }
      target.totalKills += kills;
      target.totalDeaths += deaths;
      target.totalAssists += assists;
      target.totalGold += goldEarned;
      target.totalGpm += gpm;
      target.totalKillParticipationPct += killParticipationPct;
      target.championSet.add(row?.champion || "Unknown");
      target.roleCounts.set(role, (target.roleCounts.get(role) || 0) + 1);
      target.mapPoints.push(point);
    }
  }

  return Array.from(aggregate.values())
    .map((row) => ({
      id: row.id,
      team: row.team,
      name: row.name,
      role: derivePrimaryRole(row.roleCounts),
      mapsPlayed: row.mapsPlayed,
      mapWins: row.mapWins,
      winRatePct: row.mapsPlayed > 0 ? (row.mapWins / row.mapsPlayed) * 100 : 0,
      avgKda: (row.totalKills + row.totalAssists) / Math.max(1, row.totalDeaths),
      avgKillParticipationPct: row.mapsPlayed > 0 ? row.totalKillParticipationPct / row.mapsPlayed : 0,
      avgGold: row.mapsPlayed > 0 ? row.totalGold / row.mapsPlayed : 0,
      avgGpm: row.mapsPlayed > 0 ? row.totalGpm / row.mapsPlayed : 0,
      champions: Array.from(row.championSet),
      mapPoints: row.mapPoints.sort((left, right) => left.gameNumber - right.gameNumber)
    }))
    .sort((left, right) => {
      if (right.mapsPlayed !== left.mapsPlayed) return right.mapsPlayed - left.mapsPlayed;
      if (right.mapWins !== left.mapWins) return right.mapWins - left.mapWins;
      if (right.avgKda !== left.avgKda) return right.avgKda - left.avgKda;
      return right.avgGpm - left.avgGpm;
    })
    .slice(0, 24);
}

function mapDraftByRole(rows = []) {
  const mapped = new Map();
  for (const row of rows) {
    const role = normalizeRole(row?.role);
    if (!mapped.has(role)) {
      mapped.set(role, row?.champion || "Unknown");
    }
  }

  return mapped;
}

function buildDraftDelta({
  selectedGameNumber,
  seriesGameSnapshots = [],
  fallbackSelectedDraft = null
}) {
  if (!Number.isInteger(selectedGameNumber) || selectedGameNumber < 1) {
    return null;
  }

  const draftByGameNumber = new Map(
    seriesGameSnapshots
      .filter((snapshot) => snapshot?.teamDraft && Number.isInteger(snapshot?.gameNumber))
      .map((snapshot) => [snapshot.gameNumber, snapshot])
  );
  const selectedDraft = draftByGameNumber.get(selectedGameNumber)?.teamDraft || fallbackSelectedDraft;
  if (!selectedDraft) {
    return null;
  }

  const snapshots = seriesGameSnapshots
    .filter((snapshot) => snapshot?.teamDraft && Number.isInteger(snapshot?.gameNumber))
    .slice();
  if (!snapshots.length) {
    return null;
  }

  const previousCompleted = snapshots
    .filter((snapshot) => snapshot.gameNumber < selectedGameNumber && snapshot.state === "completed")
    .sort((left, right) => right.gameNumber - left.gameNumber);
  const fallbackCompleted = snapshots
    .filter((snapshot) => snapshot.gameNumber !== selectedGameNumber && snapshot.state === "completed")
    .sort((left, right) => right.gameNumber - left.gameNumber);
  const reference = previousCompleted[0] || fallbackCompleted[0] || null;
  if (!reference?.teamDraft) {
    return null;
  }

  const selectedLeft = mapDraftByRole(selectedDraft.left || []);
  const selectedRight = mapDraftByRole(selectedDraft.right || []);
  const referenceLeft = mapDraftByRole(reference.teamDraft.left || []);
  const referenceRight = mapDraftByRole(reference.teamDraft.right || []);
  const orderedRoles = ["top", "jungle", "mid", "bottom", "support"];
  let leftChanges = 0;
  let rightChanges = 0;

  const rows = orderedRoles.map((role) => {
    const leftReferenceChampion = referenceLeft.get(role) || null;
    const leftSelectedChampion = selectedLeft.get(role) || null;
    const rightReferenceChampion = referenceRight.get(role) || null;
    const rightSelectedChampion = selectedRight.get(role) || null;
    const leftChanged = Boolean(
      leftReferenceChampion &&
      leftSelectedChampion &&
      leftReferenceChampion !== leftSelectedChampion
    );
    const rightChanged = Boolean(
      rightReferenceChampion &&
      rightSelectedChampion &&
      rightReferenceChampion !== rightSelectedChampion
    );

    if (leftChanged) leftChanges += 1;
    if (rightChanged) rightChanges += 1;

    return {
      role,
      leftReferenceChampion,
      leftSelectedChampion,
      leftChanged,
      rightReferenceChampion,
      rightSelectedChampion,
      rightChanged
    };
  });

  return {
    selectedGameNumber,
    referenceGameNumber: reference.gameNumber,
    leftChanges,
    rightChanges,
    totalChanges: leftChanges + rightChanges,
    rows
  };
}

function buildObjectiveForecast({
  summary,
  selectedSeriesGame,
  selectedGame,
  playerEconomy,
  objectiveTimeline
}) {
  if (!selectedSeriesGame || selectedSeriesGame.state !== "inProgress") {
    return [];
  }

  const elapsedSeconds = toFiniteNumber(playerEconomy?.elapsedSeconds);
  if (elapsedSeconds === null || elapsedSeconds <= 0) {
    return [];
  }

  const updatedTs = parseTimestamp(playerEconomy?.updatedAt, Date.now());
  const startedTs = Number.isFinite(Date.parse(String(selectedSeriesGame?.startedAt || "")))
    ? Date.parse(String(selectedSeriesGame.startedAt))
    : updatedTs - Math.round(elapsedSeconds * 1000);
  const rows = Array.isArray(objectiveTimeline) ? objectiveTimeline : [];
  const dragons = rows
    .filter((row) => String(row?.type || "").toLowerCase() === "dragon")
    .map((row) => parseTimestamp(row?.at, Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);
  const barons = rows
    .filter((row) => String(row?.type || "").toLowerCase() === "baron")
    .map((row) => parseTimestamp(row?.at, Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left);

  const target = [];
  const now = Date.now();
  const sinceStartSeconds = Math.max(0, Math.round((updatedTs - startedTs) / 1000));
  const clockSeconds = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : sinceStartSeconds;

  let nextDragonTs = null;
  let dragonState = "countdown";
  let dragonNote = "";

  if (clockSeconds < 5 * 60) {
    nextDragonTs = startedTs + 5 * 60 * 1000;
    dragonNote = "First dragon spawn window.";
  } else if (dragons.length > 0) {
    nextDragonTs = dragons[0] + 5 * 60 * 1000;
    dragonNote = "Estimated from last dragon capture.";
  } else {
    nextDragonTs = now;
    dragonState = "available";
    dragonNote = "Dragon likely up if still uncontested.";
  }

  let nextBaronTs = null;
  let baronState = "countdown";
  let baronNote = "";

  if (clockSeconds < 20 * 60) {
    nextBaronTs = startedTs + 20 * 60 * 1000;
    baronNote = "Baron spawns at 20:00.";
  } else if (barons.length > 0) {
    nextBaronTs = barons[0] + 6 * 60 * 1000;
    baronNote = "Estimated from last Baron capture.";
  } else {
    nextBaronTs = now;
    baronState = "available";
    baronNote = "Baron should be available now.";
  }

  const dragonEta = Math.max(0, Math.round((nextDragonTs - now) / 1000));
  const baronEta = Math.max(0, Math.round((nextBaronTs - now) / 1000));

  target.push({
    id: "dragon",
    type: "dragon",
    label: "Next Dragon Window",
    nextAt: new Date(nextDragonTs).toISOString(),
    etaSeconds: dragonEta,
    state: dragonState,
    confidence: dragons.length > 0 ? "high" : "estimated",
    note: dragonNote
  });

  target.push({
    id: "baron",
    type: "baron",
    label: "Next Baron Window",
    nextAt: new Date(nextBaronTs).toISOString(),
    etaSeconds: baronEta,
    state: baronState,
    confidence: barons.length > 0 ? "high" : "estimated",
    note: baronNote
  });

  const leftDragons = toCount(selectedGame?.snapshot?.left?.dragons);
  const rightDragons = toCount(selectedGame?.snapshot?.right?.dragons);
  if (Math.max(leftDragons, rightDragons) >= 4) {
    const referenceTs = dragons.length > 0 ? dragons[0] : now;
    const elderTs = referenceTs + 6 * 60 * 1000;
    const elderEta = Math.max(0, Math.round((elderTs - now) / 1000));
    target.push({
      id: "elder",
      type: "elder",
      label: "Elder Dragon Window",
      nextAt: new Date(elderTs).toISOString(),
      etaSeconds: elderEta,
      state: elderEta <= 0 ? "available" : "countdown",
      confidence: dragons.length > 0 ? "medium" : "estimated",
      note: "Soul threshold reached; elder timing estimate."
    });
  }

  return target
    .sort((left, right) => Number(left.etaSeconds || 0) - Number(right.etaSeconds || 0))
    .slice(0, 4);
}

function roleGoldDiff(snapshot, role) {
  const playerEconomy = snapshot?.playerEconomy;
  if (!playerEconomy) {
    return null;
  }

  const leftByRole = mapEconomyByRole(playerEconomy.left || []);
  const rightByRole = mapEconomyByRole(playerEconomy.right || []);
  const left = leftByRole.get(role);
  const right = rightByRole.get(role);
  if (!left && !right) {
    return null;
  }

  return toCount(left?.goldEarned) - toCount(right?.goldEarned);
}

function buildRoleMatchupDeltas({
  seriesGameSnapshots = [],
  summary,
  selectedGameNumber
}) {
  if (!Array.isArray(seriesGameSnapshots) || seriesGameSnapshots.length === 0) {
    return [];
  }

  const roles = ["top", "jungle", "mid", "bottom", "support"];
  const ordered = seriesGameSnapshots
    .filter((snapshot) => snapshot?.playerEconomy && Number.isInteger(snapshot?.gameNumber))
    .slice()
    .sort((left, right) => left.gameNumber - right.gameNumber);
  if (!ordered.length) {
    return [];
  }

  return roles.map((role) => {
    let mapsTracked = 0;
    let leftLeadMaps = 0;
    let rightLeadMaps = 0;
    let evenMaps = 0;
    let leadWonMaps = 0;
    let totalDiff = 0;
    let selectedDiff = null;
    const trend = [];

    for (const snapshot of ordered) {
      const diff = roleGoldDiff(snapshot, role);
      if (!Number.isFinite(diff)) {
        continue;
      }

      mapsTracked += 1;
      totalDiff += diff;
      trend.push({
        gameNumber: snapshot.gameNumber,
        diff
      });
      if (Number(snapshot.gameNumber) === Number(selectedGameNumber)) {
        selectedDiff = diff;
      }

      const winnerSide = winnerSideFromTeamId(snapshot.winnerTeamId, summary);
      if (diff > 0) {
        leftLeadMaps += 1;
        if (winnerSide === "left") {
          leadWonMaps += 1;
        }
      } else if (diff < 0) {
        rightLeadMaps += 1;
        if (winnerSide === "right") {
          leadWonMaps += 1;
        }
      } else {
        evenMaps += 1;
      }
    }

    const leadMaps = leftLeadMaps + rightLeadMaps;
    return {
      role,
      mapsTracked,
      selectedDiff,
      avgDiff: mapsTracked > 0 ? totalDiff / mapsTracked : null,
      leftLeadMaps,
      rightLeadMaps,
      evenMaps,
      leadConversionPct: leadMaps > 0 ? (leadWonMaps / leadMaps) * 100 : null,
      trend
    };
  });
}

function sideForTeamInResult(row, teamId) {
  if (row?.teams?.left?.id === teamId) {
    return "left";
  }

  if (row?.teams?.right?.id === teamId) {
    return "right";
  }

  return null;
}

function opponentSide(side) {
  return side === "left" ? "right" : "left";
}

function resultPerspective(row, teamId) {
  const side = sideForTeamInResult(row, teamId);
  if (!side) {
    return null;
  }

  const other = opponentSide(side);
  const ownScore = toCount(row?.seriesScore?.[side]);
  const oppScore = toCount(row?.seriesScore?.[other]);
  const opponent = row?.teams?.[other] || {};
  const didWin = row?.winnerTeamId
    ? row.winnerTeamId === teamId
    : ownScore > oppScore;
  const didLose = row?.winnerTeamId
    ? row.winnerTeamId !== teamId
    : oppScore > ownScore;

  return {
    id: row?.id,
    startAt: row?.startAt || row?.updatedAt || new Date().toISOString(),
    tournament: row?.tournament || "Unknown",
    opponentId: opponent?.id || null,
    opponentName: opponent?.name || "Unknown",
    ownScore,
    oppScore,
    scoreLabel: `${ownScore}-${oppScore}`,
    result: didWin ? "win" : didLose ? "loss" : "draw"
  };
}

function computeStreakFromMatches(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      value: 0,
      label: "n/a"
    };
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
    return {
      value: 0,
      label: "n/a"
    };
  }

  return {
    value: mode === "win" ? streak : -streak,
    label: `${mode === "win" ? "W" : "L"}${streak}`
  };
}

function buildTeamFormProfile({
  summary,
  teamId,
  recentResults,
  sampleSize = 8
}) {
  const teamName =
    teamId === summary?.teams?.left?.id
      ? summary?.teams?.left?.name || "Left Team"
      : teamId === summary?.teams?.right?.id
        ? summary?.teams?.right?.name || "Right Team"
        : "Team";
  const relevant = recentResults
    .map((row) => resultPerspective(row, teamId))
    .filter(Boolean)
    .sort((left, right) => parseTimestamp(right.startAt) - parseTimestamp(left.startAt))
    .slice(0, sampleSize);
  const wins = relevant.filter((row) => row.result === "win").length;
  const losses = relevant.filter((row) => row.result === "loss").length;
  const draws = relevant.filter((row) => row.result === "draw").length;
  const gameWins = relevant.reduce((sum, row) => sum + toCount(row.ownScore), 0);
  const gameLosses = relevant.reduce((sum, row) => sum + toCount(row.oppScore), 0);
  const totalSeries = Math.max(1, relevant.length);
  const totalGames = Math.max(1, gameWins + gameLosses);
  const streak = computeStreakFromMatches(relevant);
  const formLabel = `${wins}-${losses}${draws > 0 ? `-${draws}` : ""}`;

  return {
    teamId,
    teamName,
    matches: relevant.length,
    wins,
    losses,
    draws,
    gameWins,
    gameLosses,
    seriesWinRatePct: (wins / totalSeries) * 100,
    gameWinRatePct: (gameWins / totalGames) * 100,
    streakValue: streak.value,
    streakLabel: streak.label,
    formLabel,
    recentMatches: relevant.slice(0, 5)
  };
}

function buildHeadToHead({
  summary,
  recentResults,
  sampleSize = 6
}) {
  const leftTeamId = summary?.teams?.left?.id;
  const rightTeamId = summary?.teams?.right?.id;
  const meetings = recentResults
    .filter((row) => {
      const leftId = row?.teams?.left?.id;
      const rightId = row?.teams?.right?.id;
      return (
        (leftId === leftTeamId && rightId === rightTeamId) ||
        (leftId === rightTeamId && rightId === leftTeamId)
      );
    })
    .sort((left, right) => parseTimestamp(right.startAt) - parseTimestamp(left.startAt))
    .slice(0, sampleSize);
  const leftWins = meetings.filter((row) => row?.winnerTeamId === leftTeamId).length;
  const rightWins = meetings.filter((row) => row?.winnerTeamId === rightTeamId).length;
  const lastMeetings = meetings.map((row) => ({
    id: row.id,
    startAt: row.startAt,
    winnerTeamId: row.winnerTeamId || null,
    winnerName:
      row.winnerTeamId === leftTeamId
        ? summary?.teams?.left?.name || "Left Team"
        : row.winnerTeamId === rightTeamId
          ? summary?.teams?.right?.name || "Right Team"
          : "TBD",
    scoreLabel: `${toCount(row?.seriesScore?.left)}-${toCount(row?.seriesScore?.right)}`,
    tournament: row.tournament
  }));

  return {
    total: meetings.length,
    leftWins,
    rightWins,
    leftWinRatePct: meetings.length ? (leftWins / meetings.length) * 100 : null,
    rightWinRatePct: meetings.length ? (rightWins / meetings.length) * 100 : null,
    lastMeetings
  };
}

function clampPercent(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function buildPredictionDrivers({
  summary,
  seriesRateDiff,
  gameRateDiff,
  headToHeadDiff,
  streakDiff
}) {
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";
  const drivers = [];

  if (Math.abs(seriesRateDiff) >= 0.08) {
    const leader = seriesRateDiff > 0 ? leftName : rightName;
    drivers.push(`${leader} has stronger recent series win rate.`);
  }

  if (Math.abs(gameRateDiff) >= 0.1) {
    const leader = gameRateDiff > 0 ? leftName : rightName;
    drivers.push(`${leader} shows better map-level conversion in recent matches.`);
  }

  if (Math.abs(headToHeadDiff) >= 0.12) {
    const leader = headToHeadDiff > 0 ? leftName : rightName;
    drivers.push(`${leader} holds the edge in recent head-to-head meetings.`);
  }

  if (Math.abs(streakDiff) >= 1) {
    const leader = streakDiff > 0 ? leftName : rightName;
    drivers.push(`${leader} carries stronger current streak momentum.`);
  }

  if (!drivers.length) {
    drivers.push("Both teams have closely matched recent form.");
  }

  return drivers.slice(0, 4);
}

function predictionConfidence({
  leftForm,
  rightForm,
  headToHead
}) {
  const minSamples = Math.min(toCount(leftForm?.matches), toCount(rightForm?.matches));
  const h2hSamples = toCount(headToHead?.total);
  if (minSamples >= 6 && h2hSamples >= 3) {
    return "high";
  }

  if (minSamples >= 4) {
    return "medium";
  }

  return "low";
}

function buildPreMatchPrediction({
  summary,
  leftForm,
  rightForm,
  headToHead
}) {
  const leftSeriesRate = toFiniteNumber(leftForm?.seriesWinRatePct);
  const rightSeriesRate = toFiniteNumber(rightForm?.seriesWinRatePct);
  const leftGameRate = toFiniteNumber(leftForm?.gameWinRatePct);
  const rightGameRate = toFiniteNumber(rightForm?.gameWinRatePct);
  const leftH2H = toFiniteNumber(headToHead?.leftWinRatePct);
  const rightH2H = toFiniteNumber(headToHead?.rightWinRatePct);
  const seriesRateDiff = ((leftSeriesRate ?? 50) - (rightSeriesRate ?? 50)) / 100;
  const gameRateDiff = ((leftGameRate ?? 50) - (rightGameRate ?? 50)) / 100;
  const headToHeadDiff = ((leftH2H ?? 50) - (rightH2H ?? 50)) / 100;
  const streakDiff = toCount(leftForm?.streakValue) - toCount(rightForm?.streakValue);
  const weighted =
    seriesRateDiff * 22 +
    gameRateDiff * 14 +
    headToHeadDiff * 10 +
    Math.max(-2, Math.min(2, streakDiff)) * 2.5;
  const leftWinPct = clampPercent(50 + weighted, 8, 92);
  const rightWinPct = clampPercent(100 - leftWinPct, 8, 92);
  const favoriteTeamId =
    leftWinPct > rightWinPct
      ? summary?.teams?.left?.id
      : rightWinPct > leftWinPct
        ? summary?.teams?.right?.id
        : null;
  const favoriteTeamName =
    favoriteTeamId === summary?.teams?.left?.id
      ? summary?.teams?.left?.name || "Left Team"
      : favoriteTeamId === summary?.teams?.right?.id
        ? summary?.teams?.right?.name || "Right Team"
        : "Even";
  const drivers = buildPredictionDrivers({
    summary,
    seriesRateDiff,
    gameRateDiff,
    headToHeadDiff,
    streakDiff
  });

  return {
    leftWinPct: Number(leftWinPct.toFixed(1)),
    rightWinPct: Number(rightWinPct.toFixed(1)),
    favoriteTeamId,
    favoriteTeamName,
    confidence: predictionConfidence({
      leftForm,
      rightForm,
      headToHead
    }),
    modelVersion: "heuristic-v2",
    drivers
  };
}

function dedupeWatchOptions(rows = []) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = String(row?.url || "").trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

function buildStorylines({
  summary,
  momentum,
  leadTrend,
  objectiveControl,
  topPerformers,
  seriesProgress,
  objectiveRuns
}) {
  const rows = [];
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";

  if (summary?.status === "upcoming") {
    rows.push(`Opening game in BO${seriesProgress?.bestOf || summary?.bestOf || 1}; focus early jungle pathing and first dragon timing.`);
  }

  if (summary?.status === "completed") {
    rows.push(`Series finished ${summary?.seriesScore?.left}:${summary?.seriesScore?.right}; result is locked.`);
  }

  if (momentum) {
    const leader = momentum.goldLead >= 0 ? leftName : rightName;
    rows.push(`${leader} currently holds ${Math.abs(toCount(momentum.goldLead)).toLocaleString()} gold lead.`);
  }

  if (objectiveControl) {
    const leftPct = toCount(objectiveControl?.left?.controlPct);
    const rightPct = toCount(objectiveControl?.right?.controlPct);
    rows.push(`Objective control split: ${leftName} ${leftPct}% vs ${rightName} ${rightPct}%.`);
  }

  if (leadTrend && leadTrend.largestSwing > 0) {
    rows.push(`Largest single-window lead swing: ${Math.abs(toCount(leadTrend.largestSwing)).toLocaleString()} gold.`);
  }

  if (Array.isArray(objectiveRuns) && objectiveRuns.length > 0) {
    const run = objectiveRuns[0];
    rows.push(`${run.teamName} chained ${run.count} objective events (${run.types.join(", ")}).`);
  }

  if (Array.isArray(topPerformers) && topPerformers.length > 0) {
    const top = topPerformers[0];
    rows.push(`Top impact: ${top.name} on ${top.champion} (${top.kills}/${top.deaths}/${top.assists}).`);
  }

  return rows.slice(0, 6);
}

function buildDataConfidence({
  summary,
  freshnessSource,
  playerDeltaPanel,
  liveTicker,
  objectiveTimeline,
  topPerformers,
  teamDraft,
  playerEconomy,
  seriesGames
}) {
  let score = 0;
  const notes = [];

  if (summary?.status === "upcoming") {
    score += 40;
    notes.push("Upcoming: pre-game metadata only.");
  } else {
    if (playerDeltaPanel?.players?.length) {
      score += 20;
      notes.push("Player deltas available.");
    }

    if (Array.isArray(liveTicker) && liveTicker.length > 0) {
      score += 15;
      notes.push("Live ticker events detected.");
    }

    if (Array.isArray(objectiveTimeline) && objectiveTimeline.length > 0) {
      score += 15;
      notes.push("Objective timeline populated.");
    }

    if (Array.isArray(topPerformers) && topPerformers.length > 0) {
      score += 10;
      notes.push("Top performer metrics populated.");
    }

    if (teamDraft) {
      score += 10;
      notes.push("Draft metadata available.");
    }

    if (playerEconomy) {
      score += 10;
      notes.push("Economy board available.");
    }
  }

  if (Array.isArray(seriesGames) && seriesGames.some((game) => Array.isArray(game.watchOptions) && game.watchOptions.length > 0)) {
    score += 5;
    notes.push("VOD links available.");
  }

  if (String(freshnessSource || "").includes("livestats")) {
    score += 5;
    notes.push("Live stats feed active.");
  }

  const capped = Math.max(0, Math.min(100, score));
  const grade = capped >= 85 ? "high" : capped >= 60 ? "medium" : "low";

  return {
    score: capped,
    grade,
    telemetry: String(freshnessSource || "").includes("livestats") ? "derived_live_frames" : "schedule_metadata",
    notes
  };
}

function buildGameNavigation({
  seriesGames,
  selectedGameNumber,
  requestedGameNumber,
  requestedMissing
}) {
  const games = Array.isArray(seriesGames) ? seriesGames : [];
  const numbers = games
    .map((game) => Number(game?.number || 0))
    .filter((number) => Number.isInteger(number) && number > 0)
    .sort((left, right) => left - right);
  const selectedNumber = Number.isInteger(selectedGameNumber)
    ? selectedGameNumber
    : numbers.length
      ? numbers[0]
      : null;
  const selectedIndex = selectedNumber ? numbers.indexOf(selectedNumber) : -1;

  return {
    selectedGameNumber: selectedNumber,
    requestedGameNumber: Number.isInteger(requestedGameNumber) ? requestedGameNumber : null,
    requestedMissing: Boolean(requestedMissing),
    previousGameNumber: selectedIndex > 0 ? numbers[selectedIndex - 1] : null,
    nextGameNumber: selectedIndex >= 0 && selectedIndex < numbers.length - 1 ? numbers[selectedIndex + 1] : null,
    availableGames: games.map((game) => ({
      number: game.number,
      state: game.state,
      selected: game.number === selectedNumber
    })),
    counts: {
      completed: games.filter((game) => game.state === "completed").length,
      inProgress: games.filter((game) => game.state === "inProgress").length,
      upcoming: games.filter((game) => game.state === "unstarted").length,
      skipped: games.filter((game) => game.state === "unneeded").length
    }
  };
}

function buildSeriesHeader(summary, seriesProgress, gameNavigation) {
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";
  const winnerId = resolveWinnerTeamId(summary);
  const winnerName =
    winnerId === summary?.teams?.left?.id
      ? leftName
      : winnerId === summary?.teams?.right?.id
        ? rightName
        : null;
  const selectedGameNumber = gameNavigation?.selectedGameNumber;
  const selectedSuffix = Number.isInteger(selectedGameNumber) ? ` · Focus: Game ${selectedGameNumber}` : "";
  const winsNeeded = Number(seriesProgress?.winsNeeded || Math.floor((summary?.bestOf || 1) / 2) + 1);

  const headline =
    summary?.status === "completed"
      ? `${winnerName || "Series"} won ${toCount(summary?.seriesScore?.left)}:${toCount(summary?.seriesScore?.right)}`
      : summary?.status === "live"
        ? `${leftName} ${toCount(summary?.seriesScore?.left)} - ${toCount(summary?.seriesScore?.right)} ${rightName}`
        : `Upcoming BO${toCount(summary?.bestOf || 1)} between ${leftName} and ${rightName}`;

  return {
    headline,
    subhead:
      `First to ${winsNeeded} wins · Completed ${toCount(seriesProgress?.completedGames)} ` +
      `· Live ${toCount(seriesProgress?.inProgressGames)} · Remaining ${Math.max(0, toCount(summary?.bestOf || 1) - toCount(seriesProgress?.completedGames) - toCount(seriesProgress?.inProgressGames))}` +
      selectedSuffix,
    winnerTeamId: winnerId,
    winnerName
  };
}

function buildSelectedGameContext({
  summary,
  selectedSeriesGame,
  gameSelection,
  hasTelemetry,
  liveTicker,
  objectiveTimeline,
  playerEconomy,
  combatBursts,
  goldMilestones
}) {
  if (!selectedSeriesGame) {
    return null;
  }

  const leftSide = String(selectedSeriesGame?.sideInfo?.leftSide || "").toLowerCase();
  const rightSide = String(selectedSeriesGame?.sideInfo?.rightSide || "").toLowerCase();
  const leftLabel = leftSide ? `${summary?.teams?.left?.name || "Left Team"} on ${leftSide.toUpperCase()}` : null;
  const rightLabel = rightSide ? `${summary?.teams?.right?.name || "Right Team"} on ${rightSide.toUpperCase()}` : null;

  let telemetryStatus = "none";
  if (hasTelemetry) {
    telemetryStatus = "rich";
  } else if (selectedSeriesGame.state === "inProgress") {
    telemetryStatus = "pending";
  } else if (selectedSeriesGame.state === "completed") {
    telemetryStatus = "limited";
  }

  const tips = [];
  if (telemetryStatus === "rich") {
    tips.push("Live frame telemetry is active for this game.");
  } else if (telemetryStatus === "pending") {
    tips.push("Game is live but telemetry has not stabilized yet.");
  } else if (telemetryStatus === "limited") {
    tips.push("Post-game stats are limited; use VOD and series metrics.");
  } else {
    tips.push("No in-game telemetry yet for this map.");
  }

  if (gameSelection?.requestedMissing) {
    tips.push(`Requested Game ${gameSelection.requestedGameNumber} was not found; showing nearest available game.`);
  }

  if (Number.isFinite(playerEconomy?.elapsedSeconds) && playerEconomy.elapsedSeconds > 0) {
    tips.push(`Tracked window: ${Math.round(playerEconomy.elapsedSeconds / 60)}m elapsed.`);
  }

  if (Array.isArray(combatBursts) && combatBursts.length > 0) {
    tips.push(`${combatBursts.length} combat burst window${combatBursts.length === 1 ? "" : "s"} detected.`);
  }

  if (Array.isArray(goldMilestones) && goldMilestones.length > 0) {
    tips.push(`${goldMilestones.length} gold milestone${goldMilestones.length === 1 ? "" : "s"} reached.`);
  }

  const leftTeam = summary?.teams?.left || {};
  const rightTeam = summary?.teams?.right || {};
  const snapshot = {
    left: {
      kills: toCount(leftTeam.kills),
      gold: toFiniteNumber(leftTeam.gold),
      towers: toCount(leftTeam.towers),
      dragons: toCount(leftTeam.dragons),
      barons: toCount(leftTeam.barons),
      inhibitors: toCount(leftTeam.inhibitors)
    },
    right: {
      kills: toCount(rightTeam.kills),
      gold: toFiniteNumber(rightTeam.gold),
      towers: toCount(rightTeam.towers),
      dragons: toCount(rightTeam.dragons),
      barons: toCount(rightTeam.barons),
      inhibitors: toCount(rightTeam.inhibitors)
    }
  };

  return {
    number: selectedSeriesGame.number,
    state: selectedSeriesGame.state,
    label: selectedSeriesGame.label,
    startedAt: selectedSeriesGame.startedAt,
    watchUrl: selectedSeriesGame.watchUrl,
    watchOptions: selectedSeriesGame.watchOptions || [],
    sideSummary: [leftLabel, rightLabel].filter(Boolean),
    telemetryStatus,
    telemetryCounts: {
      tickerEvents: Array.isArray(liveTicker) ? liveTicker.length : 0,
      objectiveEvents: Array.isArray(objectiveTimeline) ? objectiveTimeline.length : 0,
      combatBursts: Array.isArray(combatBursts) ? combatBursts.length : 0,
      goldMilestones: Array.isArray(goldMilestones) ? goldMilestones.length : 0
    },
    snapshot,
    tips
  };
}

function estimateGameDurationMinutes(game) {
  const declared = toFiniteNumber(game?.durationMinutes);
  if (declared !== null && declared > 0) {
    return declared;
  }

  const options = Array.isArray(game?.watchOptions) ? game.watchOptions : [];
  const candidate = options.find((option) => Number.isInteger(option?.endMillis) && option.endMillis > 0);

  if (!candidate || !Number.isInteger(candidate.startMillis) || candidate.endMillis <= candidate.startMillis) {
    return null;
  }

  return (candidate.endMillis - candidate.startMillis) / 60000;
}

function buildTempoSnapshot({ summary, seriesGames, playerEconomy, objectiveTimeline }) {
  const rows = Array.isArray(seriesGames) ? seriesGames : [];
  const completed = rows.filter((row) => row.state === "completed");
  const durations = completed
    .map((row) => estimateGameDurationMinutes(row))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageDurationMinutes = durations.length
    ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1))
    : null;
  const shortestDurationMinutes = durations.length ? Number(Math.min(...durations).toFixed(1)) : null;
  const longestDurationMinutes = durations.length ? Number(Math.max(...durations).toFixed(1)) : null;
  const currentGameMinutes =
    Number.isFinite(playerEconomy?.elapsedSeconds) && playerEconomy.elapsedSeconds > 0
      ? Number((playerEconomy.elapsedSeconds / 60).toFixed(1))
      : null;

  const objectiveRows = Array.isArray(objectiveTimeline) ? objectiveTimeline : [];
  const objectiveTimestamps = objectiveRows
    .map((row) => parseTimestamp(row?.at, Number.NaN))
    .filter((value) => Number.isFinite(value));
  const objectiveSpanMinutes =
    objectiveTimestamps.length >= 2
      ? Math.max(1 / 60, Math.abs(Math.max(...objectiveTimestamps) - Math.min(...objectiveTimestamps)) / 60000)
      : currentGameMinutes || null;
  const objectivePer10Minutes =
    objectiveRows.length && Number.isFinite(objectiveSpanMinutes) && objectiveSpanMinutes > 0
      ? Number(((objectiveRows.length / objectiveSpanMinutes) * 10).toFixed(2))
      : null;

  return {
    status: summary?.status || "unknown",
    completedGames: completed.length,
    averageDurationMinutes,
    shortestDurationMinutes,
    longestDurationMinutes,
    currentGameMinutes,
    objectiveEvents: objectiveRows.length,
    objectivePer10Minutes
  };
}

function buildObjectiveBreakdown(objectiveTimeline = []) {
  const makeTotals = () => ({
    tower: 0,
    dragon: 0,
    baron: 0,
    inhibitor: 0,
    other: 0,
    total: 0
  });
  const rows = Array.isArray(objectiveTimeline) ? objectiveTimeline : [];
  const summary = {
    left: makeTotals(),
    right: makeTotals()
  };

  for (const row of rows) {
    const side = row?.team === "right" ? "right" : "left";
    const type = String(row?.type || "other").toLowerCase();
    if (type in summary[side]) {
      summary[side][type] += 1;
    } else {
      summary[side].other += 1;
    }
    summary[side].total += 1;
  }

  return summary;
}

function clampRange(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildEdgeMeter({
  summary,
  seriesProgress,
  momentum,
  objectiveControl,
  topPerformers,
  leadTrend
}) {
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";

  let leftScore = 50;
  let rightScore = 50;
  const leftDrivers = [];
  const rightDrivers = [];

  if (seriesProgress) {
    const scoreEdge = toCount(seriesProgress.leftWins) - toCount(seriesProgress.rightWins);
    if (scoreEdge !== 0) {
      const shift = clampRange(scoreEdge * 8, -20, 20);
      leftScore += shift;
      rightScore -= shift;
      if (shift > 0) {
        leftDrivers.push("Series lead advantage");
      } else {
        rightDrivers.push("Series lead advantage");
      }
    }
  }

  if (momentum && Number.isFinite(momentum.goldLead)) {
    const shift = clampRange(Math.round(toCount(momentum.goldLead) / 500), -20, 20);
    leftScore += shift;
    rightScore -= shift;
    if (shift > 0) {
      leftDrivers.push("Gold lead pressure");
    } else if (shift < 0) {
      rightDrivers.push("Gold lead pressure");
    }
  }

  if (objectiveControl) {
    const leftPct = toFiniteNumber(objectiveControl?.left?.controlPct);
    const rightPct = toFiniteNumber(objectiveControl?.right?.controlPct);
    if (leftPct !== null && rightPct !== null) {
      const shift = clampRange(Math.round((leftPct - rightPct) / 3), -15, 15);
      leftScore += shift;
      rightScore -= shift;
      if (shift > 0) {
        leftDrivers.push("Objective control");
      } else if (shift < 0) {
        rightDrivers.push("Objective control");
      }
    }
  }

  const topRows = Array.isArray(topPerformers) ? topPerformers.slice(0, 4) : [];
  if (topRows.length) {
    const leftCount = topRows.filter((row) => row.team === "left").length;
    const rightCount = topRows.filter((row) => row.team === "right").length;
    const shift = clampRange((leftCount - rightCount) * 4, -12, 12);
    leftScore += shift;
    rightScore -= shift;
    if (shift > 0) {
      leftDrivers.push("Player impact edge");
    } else if (shift < 0) {
      rightDrivers.push("Player impact edge");
    }
  }

  if (leadTrend?.largestSwing && leadTrend.largestSwing >= 2500) {
    leftDrivers.push("High volatility game");
    rightDrivers.push("High volatility game");
  }

  leftScore = clampRange(Math.round(leftScore), 5, 95);
  rightScore = clampRange(Math.round(rightScore), 5, 95);
  const diff = leftScore - rightScore;
  const verdict =
    Math.abs(diff) < 6
      ? "Pressure is close to even."
      : diff > 0
        ? `${leftName} currently has stronger close-out pressure.`
        : `${rightName} currently has stronger close-out pressure.`;

  return {
    left: {
      team: leftName,
      score: leftScore,
      drivers: leftDrivers.slice(0, 3)
    },
    right: {
      team: rightName,
      score: rightScore,
      drivers: rightDrivers.slice(0, 3)
    },
    verdict
  };
}

function checklistItem(id, tone, title, detail) {
  return { id, tone, title, detail };
}

function buildTacticalChecklist({
  summary,
  seriesProgress,
  momentum,
  objectiveControl,
  objectiveRuns,
  topPerformers,
  leadTrend,
  edgeMeter,
  dataConfidence
}) {
  const rows = [];
  const leftName = summary?.teams?.left?.name || "Left Team";
  const rightName = summary?.teams?.right?.name || "Right Team";

  if (summary?.status === "upcoming") {
    rows.push(
      checklistItem(
        "open_draft",
        "warn",
        "Opening Draft Priority",
        `BO${seriesProgress?.bestOf || summary?.bestOf || 1} starts soon; focus side selection and first-rotation comfort picks.`
      )
    );
    rows.push(
      checklistItem(
        "early_objective",
        "neutral",
        "Early Objective Plan",
        "Track first dragon and first Herald setup to spot intended tempo."
      )
    );
    rows.push(
      checklistItem(
        "series_path",
        "neutral",
        "Series Win Path",
        `Race to ${seriesProgress?.winsNeeded || Math.floor((summary?.bestOf || 1) / 2) + 1} wins; Game 1 draft read matters most.`
      )
    );
  } else if (summary?.status === "completed") {
    const winnerId = resolveWinnerTeamId(summary);
    const winnerName =
      winnerId === summary?.teams?.left?.id
        ? leftName
        : winnerId === summary?.teams?.right?.id
          ? rightName
          : "Series winner";

    rows.push(
      checklistItem(
        "series_final",
        "good",
        "Series Closed",
        `${winnerName} secured the series ${toCount(summary?.seriesScore?.left)}:${toCount(summary?.seriesScore?.right)}.`
      )
    );

    if (leadTrend?.largestSwing > 0) {
      rows.push(
        checklistItem(
          "swing_note",
          "neutral",
          "Largest Swing",
          `${Math.abs(toCount(leadTrend.largestSwing)).toLocaleString()} gold moved in one tracked window.`
        )
      );
    }

    const standout = Array.isArray(topPerformers) ? topPerformers[0] : null;
    if (standout) {
      rows.push(
        checklistItem(
          "standout",
          "neutral",
          "Standout Performance",
          `${standout.name} posted ${standout.kills}/${standout.deaths}/${standout.assists} on ${standout.champion}.`
        )
      );
    }
  } else {
    if (momentum) {
      const leaderName = momentum.goldLead >= 0 ? leftName : rightName;
      rows.push(
        checklistItem(
          "lead_state",
          Math.abs(toCount(momentum.goldLead)) >= 3000 ? "good" : "neutral",
          "Gold Lead Watch",
          `${leaderName} up ${Math.abs(toCount(momentum.goldLead)).toLocaleString()} gold.`
        )
      );
    }

    if (objectiveControl) {
      const leftPct = toCount(objectiveControl?.left?.controlPct);
      const rightPct = toCount(objectiveControl?.right?.controlPct);
      const dominant = leftPct > rightPct ? leftName : rightName;
      const dominantPct = Math.max(leftPct, rightPct);
      rows.push(
        checklistItem(
          "objective_hold",
          dominantPct >= 60 ? "good" : "neutral",
          "Objective Control",
          `${dominant} controls ${dominantPct}% of weighted objectives.`
        )
      );
    }

    if (Array.isArray(objectiveRuns) && objectiveRuns.length > 0) {
      const run = objectiveRuns[0];
      rows.push(
        checklistItem(
          "run_watch",
          run.count >= 3 ? "warn" : "neutral",
          "Current Objective Run",
          `${run.teamName} chained ${run.count} objectives (${run.types.join(", ")}).`
        )
      );
    }

    if (edgeMeter?.verdict) {
      rows.push(checklistItem("edge_meter", "neutral", "Close-Out Signal", edgeMeter.verdict));
    }
  }

  if (dataConfidence?.grade === "low") {
    rows.push(
      checklistItem(
        "feed_quality",
        "warn",
        "Data Quality",
        "Coverage is partial right now; confirm key moments against broadcast before reacting."
      )
    );
  }

  return rows.slice(0, 6);
}

function mergeSummaryWithWindowStats(summary, windowFrames, teamColorMap) {
  if (!Array.isArray(windowFrames) || windowFrames.length === 0) {
    return summary;
  }

  const lastFrame = windowFrames[windowFrames.length - 1];
  if (!lastFrame) {
    return summary;
  }

  const merged = {
    ...summary,
    teams: {
      left: { ...summary.teams.left },
      right: { ...summary.teams.right }
    }
  };

  for (const side of ["left", "right"]) {
    const teamFrame = teamFrameBySide(lastFrame, teamColorMap, side);
    if (!teamFrame) {
      continue;
    }

    const dragons = Array.isArray(teamFrame.dragons) ? teamFrame.dragons : [];
    const gold = toFiniteNumber(teamFrame.totalGold);

    if (gold !== null) {
      merged.teams[side].gold = Math.round(gold);
    }

    merged.teams[side].kills = toCount(teamFrame.totalKills);
    merged.teams[side].towers = toCount(teamFrame.towers);
    merged.teams[side].dragons = dragons.length;
    merged.teams[side].barons = toCount(teamFrame.barons);
    merged.teams[side].inhibitors = toCount(teamFrame.inhibitors);
  }

  return merged;
}

function deriveTickerAndObjectiveTimeline({ summary, windowFrames, teamColorMap }) {
  if (!Array.isArray(windowFrames) || windowFrames.length < 2) {
    return {
      liveTicker: [],
      objectiveTimeline: [],
      combatBursts: [],
      goldMilestones: []
    };
  }

  const liveTicker = [];
  const objectiveTimeline = [];
  const combatBursts = [];
  const goldMilestones = [];
  let sequence = 0;
  const milestoneStep = 5000;

  const pushTicker = ({ type, occurredAt, importance, title, summaryText, team }) => {
    liveTicker.push({
      id: `lol_ticker_${type}_${sequence += 1}`,
      type,
      occurredAt,
      importance,
      title,
      summary: summaryText,
      team: team || null
    });
  };

  const pushObjective = ({ type, at, team, label }) => {
    objectiveTimeline.push({
      id: `lol_objective_${type}_${sequence += 1}`,
      type,
      at,
      team,
      label
    });
  };

  for (let index = 1; index < windowFrames.length; index += 1) {
    const previousFrame = windowFrames[index - 1];
    const currentFrame = windowFrames[index];
    const occurredAt = currentFrame?.rfc460Timestamp || new Date().toISOString();
    const killDeltaBySide = {
      left: 0,
      right: 0
    };

    for (const side of ["left", "right"]) {
      const teamName = summary?.teams?.[side]?.name || "Team";
      const previousTeam = teamFrameBySide(previousFrame, teamColorMap, side);
      const currentTeam = teamFrameBySide(currentFrame, teamColorMap, side);
      if (!previousTeam || !currentTeam) {
        continue;
      }

      const killDelta = toCount(currentTeam.totalKills) - toCount(previousTeam.totalKills);
      killDeltaBySide[side] = killDelta;
      if (killDelta > 0) {
        pushTicker({
          type: "kills",
          occurredAt,
          importance: killDelta >= 3 ? "high" : "medium",
          title: `${teamName} found ${killDelta} kill${killDelta === 1 ? "" : "s"}`,
          summaryText: "Play-by-play derived from team kill deltas.",
          team: side
        });
      }

      const towerDelta = toCount(currentTeam.towers) - toCount(previousTeam.towers);
      if (towerDelta > 0) {
        const label = `${teamName} destroyed ${towerDelta} tower${towerDelta === 1 ? "" : "s"}`;
        pushObjective({
          type: "tower",
          at: occurredAt,
          team: side,
          label
        });
        pushTicker({
          type: "tower",
          occurredAt,
          importance: towerDelta >= 2 ? "high" : "medium",
          title: label,
          summaryText: "Structure pressure shifted the map.",
          team: side
        });
      }

      const previousDragons = Array.isArray(previousTeam.dragons) ? previousTeam.dragons : [];
      const currentDragons = Array.isArray(currentTeam.dragons) ? currentTeam.dragons : [];
      if (currentDragons.length > previousDragons.length) {
        const newlySecured = currentDragons.slice(previousDragons.length);
        for (const dragonType of newlySecured) {
          const dragonName = formatDragonName(dragonType);
          const label = `${teamName} secured ${dragonName}`;
          pushObjective({
            type: "dragon",
            at: occurredAt,
            team: side,
            label
          });
          pushTicker({
            type: "dragon",
            occurredAt,
            importance: "high",
            title: label,
            summaryText: "Objective control changed lane pressure.",
            team: side
          });
        }
      }

      const baronDelta = toCount(currentTeam.barons) - toCount(previousTeam.barons);
      if (baronDelta > 0) {
        const label = `${teamName} secured Baron`;
        pushObjective({
          type: "baron",
          at: occurredAt,
          team: side,
          label
        });
        pushTicker({
          type: "baron",
          occurredAt,
          importance: "critical",
          title: label,
          summaryText: "Major power spike for siege timing.",
          team: side
        });
      }

      const inhibitorDelta = toCount(currentTeam.inhibitors) - toCount(previousTeam.inhibitors);
      if (inhibitorDelta > 0) {
        const label = `${teamName} broke ${inhibitorDelta} inhibitor${inhibitorDelta === 1 ? "" : "s"}`;
        pushObjective({
          type: "inhibitor",
          at: occurredAt,
          team: side,
          label
        });
        pushTicker({
          type: "inhibitor",
          occurredAt,
          importance: "high",
          title: label,
          summaryText: "Base pressure increased for the next push.",
          team: side
        });
      }
    }

    const combinedKills = toCount(killDeltaBySide.left) + toCount(killDeltaBySide.right);
    if (combinedKills >= 2) {
      const winnerSide =
        killDeltaBySide.left > killDeltaBySide.right
          ? "left"
          : killDeltaBySide.right > killDeltaBySide.left
            ? "right"
            : null;
      const winnerTeamName = winnerSide ? summary?.teams?.[winnerSide]?.name || "Team" : "Both teams";
      combatBursts.push({
        id: `lol_burst_${sequence += 1}`,
        occurredAt,
        leftKills: toCount(killDeltaBySide.left),
        rightKills: toCount(killDeltaBySide.right),
        totalKills: combinedKills,
        winnerSide,
        winnerTeamName,
        importance: combinedKills >= 4 ? "critical" : combinedKills >= 3 ? "high" : "medium",
        title: `${winnerTeamName} combat burst`,
        summary:
          winnerSide
            ? `${summary?.teams?.left?.name || "Left"} ${toCount(killDeltaBySide.left)} - ${toCount(killDeltaBySide.right)} ${summary?.teams?.right?.name || "Right"} in this window.`
            : `Trade window: ${summary?.teams?.left?.name || "Left"} ${toCount(killDeltaBySide.left)} and ${summary?.teams?.right?.name || "Right"} ${toCount(killDeltaBySide.right)} kills.`
      });
    }

    const previousLeftGold = toFiniteNumber(teamFrameBySide(previousFrame, teamColorMap, "left")?.totalGold);
    const previousRightGold = toFiniteNumber(teamFrameBySide(previousFrame, teamColorMap, "right")?.totalGold);
    const currentLeftGold = toFiniteNumber(teamFrameBySide(currentFrame, teamColorMap, "left")?.totalGold);
    const currentRightGold = toFiniteNumber(teamFrameBySide(currentFrame, teamColorMap, "right")?.totalGold);

    if (
      previousLeftGold !== null &&
      previousRightGold !== null &&
      currentLeftGold !== null &&
      currentRightGold !== null
    ) {
      const previousLead = previousLeftGold - previousRightGold;
      const currentLead = currentLeftGold - currentRightGold;
      const swing = Math.round(currentLead - previousLead);

      if (Math.abs(swing) >= MIN_GOLD_SWING_FOR_TICKER) {
        const gainingSide = swing > 0 ? "left" : "right";
        const gainingTeamName = summary?.teams?.[gainingSide]?.name || "Team";
        pushTicker({
          type: "gold_swing",
          occurredAt,
          importance: Math.abs(swing) >= MIN_GOLD_SWING_FOR_TICKER * 2 ? "high" : "medium",
          title: `${gainingTeamName} gold swing`,
          summaryText: `${Math.abs(swing).toLocaleString()} lead change in this frame window.`,
          team: gainingSide
        });
      }

      for (const side of ["left", "right"]) {
        const teamGoldNow = side === "left" ? currentLeftGold : currentRightGold;
        const teamGoldPrev = side === "left" ? previousLeftGold : previousRightGold;
        const teamName = summary?.teams?.[side]?.name || "Team";

        if (teamGoldNow === null || teamGoldPrev === null) {
          continue;
        }

        const prevTier = Math.floor(teamGoldPrev / milestoneStep);
        const nextTier = Math.floor(teamGoldNow / milestoneStep);
        if (nextTier <= prevTier) {
          continue;
        }

        for (let tier = prevTier + 1; tier <= nextTier; tier += 1) {
          const targetGold = tier * milestoneStep;
          goldMilestones.push({
            id: `lol_gold_milestone_${sequence += 1}`,
            occurredAt,
            team: side,
            teamName,
            targetGold,
            importance: targetGold >= 40000 ? "high" : "medium",
            title: `${teamName} reached ${targetGold.toLocaleString()} gold`,
            summary: "Economy threshold reached in live frame telemetry."
          });
        }
      }
    }
  }

  liveTicker.sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt));
  objectiveTimeline.sort((left, right) => parseTimestamp(right.at) - parseTimestamp(left.at));
  combatBursts.sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt));
  goldMilestones.sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt));

  return {
    liveTicker: liveTicker.slice(0, 36),
    objectiveTimeline: objectiveTimeline.slice(0, 36),
    combatBursts: combatBursts.slice(0, 24),
    goldMilestones: goldMilestones.slice(0, 24)
  };
}

function derivePlayerActionTicker({ summary, detailsFrames, gameMetadata, teamColorMap }) {
  if (!Array.isArray(detailsFrames) || detailsFrames.length < 2) {
    return [];
  }

  const sorted = sortFramesByTimestamp(detailsFrames);
  const metadataById = buildParticipantMetadataMap(gameMetadata, teamColorMap);
  const rows = [];
  let sequence = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const occurredAt = current?.rfc460Timestamp || new Date().toISOString();
    const previousParticipants = Array.isArray(previous?.participants) ? previous.participants : [];
    const currentParticipants = Array.isArray(current?.participants) ? current.participants : [];
    if (!currentParticipants.length) {
      continue;
    }

    const previousById = new Map();
    for (const participant of previousParticipants) {
      const snapshot = normalizePlayerSnapshot(participant);
      if (snapshot) {
        previousById.set(snapshot.participantId, snapshot);
      }
    }

    for (const participant of currentParticipants) {
      const now = normalizePlayerSnapshot(participant);
      if (!now) {
        continue;
      }

      const prev = previousById.get(now.participantId) || now;
      const metadata = metadataById.get(now.participantId) || {};
      const side = metadata.team || (now.participantId <= 5 ? sideForColor(teamColorMap, "blue") : sideForColor(teamColorMap, "red"));
      const teamName = summary?.teams?.[side]?.name || "Team";
      const playerName = metadata.name || `Player ${now.participantId}`;
      const killDelta = now.kills - prev.kills;
      const deathDelta = now.deaths - prev.deaths;
      const assistDelta = now.assists - prev.assists;
      const levelDelta = now.level - prev.level;
      const itemDelta = now.itemCount - prev.itemCount;
      const goldDelta = now.goldEarned - prev.goldEarned;

      if (killDelta > 0) {
        rows.push({
          id: `lol_player_kill_${sequence += 1}`,
          type: "player_kill",
          occurredAt,
          importance: killDelta >= 2 ? "high" : "medium",
          team: side,
          title: `${playerName} picked up ${killDelta} kill${killDelta === 1 ? "" : "s"}`,
          summary:
            `${teamName} skirmish impact. ` +
            `Now ${now.kills}/${now.deaths}/${now.assists} (${metadata.champion || "Unknown"}).`
        });
      }

      if (itemDelta >= 2) {
        rows.push({
          id: `lol_item_spike_${sequence += 1}`,
          type: "item_spike",
          occurredAt,
          importance: "medium",
          team: side,
          title: `${playerName} item spike (+${itemDelta})`,
          summary: `${teamName} power spike from inventory progression.`
        });
      }

      if (levelDelta >= 2) {
        rows.push({
          id: `lol_level_spike_${sequence += 1}`,
          type: "level_spike",
          occurredAt,
          importance: "low",
          team: side,
          title: `${playerName} level spike (+${levelDelta})`,
          summary: `${teamName} gained experience edge in this window.`
        });
      }

      if (goldDelta >= 1500 && killDelta === 0) {
        rows.push({
          id: `lol_player_gold_${sequence += 1}`,
          type: "player_gold_spike",
          occurredAt,
          importance: goldDelta >= 2200 ? "high" : "medium",
          team: side,
          title: `${playerName} gold surge (+${goldDelta.toLocaleString()})`,
          summary: `${teamName} accelerated economy on this player.`
        });
      }

      if (deathDelta > 0 && killDelta === 0 && assistDelta === 0) {
        rows.push({
          id: `lol_player_death_${sequence += 1}`,
          type: "player_death",
          occurredAt,
          importance: deathDelta >= 2 ? "high" : "medium",
          team: side,
          title: `${playerName} was caught (${deathDelta} death${deathDelta === 1 ? "" : "s"})`,
          summary: `${teamName} temporarily loses map tempo until respawn.`
        });
      }
    }
  }

  rows.sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt));
  return rows.slice(0, 48);
}

function normalizePlayerSnapshot(participant) {
  const participantId = toFiniteNumber(participant?.participantId);
  if (participantId === null) {
    return null;
  }

  return {
    participantId: Math.round(participantId),
    level: toCount(participant?.level),
    kills: toCount(participant?.kills),
    deaths: toCount(participant?.deaths),
    assists: toCount(participant?.assists),
    cs: toCount(participant?.creepScore),
    goldEarned: toCount(participant?.totalGoldEarned),
    itemCount: Array.isArray(participant?.items) ? participant.items.length : 0
  };
}

function buildParticipantMetadataMap(gameMetadata, teamColorMap) {
  const map = new Map();
  const blueParticipants = Array.isArray(gameMetadata?.blueTeamMetadata?.participantMetadata)
    ? gameMetadata.blueTeamMetadata.participantMetadata
    : [];
  const redParticipants = Array.isArray(gameMetadata?.redTeamMetadata?.participantMetadata)
    ? gameMetadata.redTeamMetadata.participantMetadata
    : [];

  for (const participant of blueParticipants) {
    const participantId = toFiniteNumber(participant?.participantId);
    if (participantId === null) {
      continue;
    }

    map.set(Math.round(participantId), {
      name: participant?.summonerName || `Player ${participantId}`,
      champion: participant?.championId || "Unknown",
      role: participant?.role || "flex",
      team: sideForColor(teamColorMap, "blue")
    });
  }

  for (const participant of redParticipants) {
    const participantId = toFiniteNumber(participant?.participantId);
    if (participantId === null) {
      continue;
    }

    map.set(Math.round(participantId), {
      name: participant?.summonerName || `Player ${participantId}`,
      champion: participant?.championId || "Unknown",
      role: participant?.role || "flex",
      team: sideForColor(teamColorMap, "red")
    });
  }

  return map;
}

function buildPlayerDeltaPanel(detailsFrames, gameMetadata, teamColorMap) {
  if (!Array.isArray(detailsFrames) || detailsFrames.length < 2) {
    return null;
  }

  const sorted = sortFramesByTimestamp(detailsFrames);
  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];
  const baselineParticipants = Array.isArray(baseline?.participants) ? baseline.participants : [];
  const latestParticipants = Array.isArray(latest?.participants) ? latest.participants : [];

  if (!latestParticipants.length) {
    return null;
  }

  const baselineById = new Map();
  for (const participant of baselineParticipants) {
    const snapshot = normalizePlayerSnapshot(participant);
    if (snapshot) {
      baselineById.set(snapshot.participantId, snapshot);
    }
  }

  const metadataById = buildParticipantMetadataMap(gameMetadata, teamColorMap);

  const players = latestParticipants
    .map((participant) => {
      const latestSnapshot = normalizePlayerSnapshot(participant);
      if (!latestSnapshot) {
        return null;
      }

      const baselineSnapshot = baselineById.get(latestSnapshot.participantId) || latestSnapshot;
      const metadata = metadataById.get(latestSnapshot.participantId) || {};
      const fallbackTeam = latestSnapshot.participantId <= 5
        ? sideForColor(teamColorMap, "blue")
        : sideForColor(teamColorMap, "red");

      return {
        participantId: latestSnapshot.participantId,
        team: metadata.team || fallbackTeam,
        name: metadata.name || `Player ${latestSnapshot.participantId}`,
        champion: metadata.champion || "Unknown",
        role: metadata.role || "flex",
        now: latestSnapshot,
        delta: {
          level: latestSnapshot.level - baselineSnapshot.level,
          kills: latestSnapshot.kills - baselineSnapshot.kills,
          deaths: latestSnapshot.deaths - baselineSnapshot.deaths,
          assists: latestSnapshot.assists - baselineSnapshot.assists,
          cs: latestSnapshot.cs - baselineSnapshot.cs,
          goldEarned: latestSnapshot.goldEarned - baselineSnapshot.goldEarned,
          itemCount: latestSnapshot.itemCount - baselineSnapshot.itemCount
        }
      };
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(right.delta.goldEarned) - Math.abs(left.delta.goldEarned));

  const baselineTimestamp = parseTimestamp(baseline?.rfc460Timestamp);
  const latestTimestamp = parseTimestamp(latest?.rfc460Timestamp);

  return {
    updatedAt: latest?.rfc460Timestamp || new Date().toISOString(),
    windowSeconds: Math.max(0, Math.round((latestTimestamp - baselineTimestamp) / 1000)),
    players
  };
}

export class LolEsportsProvider {
  constructor({ timeoutMs = 15000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.scheduleLookupCache = {
      fetchedAt: 0,
      byMatchId: new Map()
    };
    this.recentResultsCache = {
      fetchedAt: 0,
      rows: []
    };
    this.windowHistoryCache = new Map();
  }

  async fetchPersisted(operation, params = {}) {
    const query = buildQuery(params);
    const url = `${LOL_API_BASE_URL}/${operation}?${query}`;

    return fetchJson(url, {
      timeoutMs: this.timeoutMs,
      headers: {
        "x-api-key": LOL_API_KEY
      }
    });
  }

  async refreshScheduleLookup({ maxPages = SCHEDULE_LOOKUP_MAX_PAGES } = {}) {
    const ageMs = Date.now() - this.scheduleLookupCache.fetchedAt;
    if (ageMs <= SCHEDULE_LOOKUP_CACHE_MS && this.scheduleLookupCache.byMatchId.size > 0) {
      return this.scheduleLookupCache.byMatchId;
    }

    const byMatchId = new Map();
    let pageToken;
    let pageCount = 0;

    while (pageCount < maxPages) {
      const payload = await this.fetchPersisted("getSchedule", pageToken ? { pageToken } : {});
      const schedule = payload?.data?.schedule;
      const events = Array.isArray(schedule?.events) ? schedule.events : [];

      for (const event of events) {
        const snapshot = normalizeScheduleSnapshot(event);
        if (snapshot) {
          byMatchId.set(snapshot.providerMatchId, snapshot);
        }
      }

      pageCount += 1;
      pageToken = schedule?.pages?.older;
      if (!pageToken) {
        break;
      }
    }

    this.scheduleLookupCache = {
      fetchedAt: Date.now(),
      byMatchId
    };

    return byMatchId;
  }

  async findScheduleSnapshot(providerMatchId) {
    if (!providerMatchId) {
      return null;
    }

    try {
      const byMatchId = await this.refreshScheduleLookup();
      return byMatchId.get(String(providerMatchId)) || null;
    } catch {
      return null;
    }
  }

  async fetchWindowFramesForStart(gameId, startingTimeIso) {
    const query = `startingTime=${encodeURIComponent(startingTimeIso)}`;
    const windowUrl = `${LOL_LIVESTATS_BASE_URL}/window/${encodeURIComponent(gameId)}?${query}`;
    const payload = await fetchJson(windowUrl, {
      timeoutMs: this.timeoutMs
    });
    return Array.isArray(payload?.frames) ? payload.frames : [];
  }

  async fetchWindowHistory(gameId, anchorTimestampMs) {
    if (LOL_LIVE_TREND_BACKFILL_WINDOWS <= 0) {
      return [];
    }

    const cacheKey = String(gameId || "");
    const cached = this.windowHistoryCache.get(cacheKey);
    const anchorAligned = alignTimestampTo10Seconds(anchorTimestampMs);
    if (
      cached &&
      Date.now() - cached.fetchedAt <= LOL_LIVE_TREND_BACKFILL_CACHE_MS &&
      Number(cached.anchorAligned) === Number(anchorAligned)
    ) {
      return cached.frames;
    }

    const startingTimes = buildBackfillStartingTimes(anchorTimestampMs);
    if (!startingTimes.length) {
      return [];
    }

    const settled = await Promise.allSettled(
      startingTimes.map((startingTimeIso) => this.fetchWindowFramesForStart(gameId, startingTimeIso))
    );
    const frames = mergeLiveFrames(
      settled
        .filter((row) => row.status === "fulfilled")
        .map((row) => row.value)
    );

    this.windowHistoryCache.set(cacheKey, {
      fetchedAt: Date.now(),
      anchorAligned,
      frames
    });

    return frames;
  }

  async fetchLiveStats(gameId, { includeHistory = false } = {}) {
    const alignedStartingTime = new Date(
      Math.floor((Date.now() - LOL_LIVESTATS_WINDOW_SECONDS * 1000) / 10000) * 10000
    ).toISOString();
    const query = `startingTime=${encodeURIComponent(alignedStartingTime)}`;
    const windowUrl = `${LOL_LIVESTATS_BASE_URL}/window/${encodeURIComponent(gameId)}?${query}`;
    const detailsUrl = `${LOL_LIVESTATS_BASE_URL}/details/${encodeURIComponent(gameId)}?${query}`;

    const [windowPayload, detailsPayload] = await Promise.all([
      fetchJson(windowUrl, {
        timeoutMs: this.timeoutMs
      }),
      fetchJson(detailsUrl, {
        timeoutMs: this.timeoutMs
      })
    ]);

    const directWindowFrames = Array.isArray(windowPayload?.frames) ? windowPayload.frames : [];
    let mergedWindowFrames = directWindowFrames;
    if (includeHistory) {
      const anchorTimestampMs = parseTimestamp(
        directWindowFrames[0]?.rfc460Timestamp,
        Date.parse(alignedStartingTime)
      );
      try {
        const historicalFrames = await this.fetchWindowHistory(gameId, anchorTimestampMs);
        mergedWindowFrames = mergeLiveFrames([directWindowFrames, historicalFrames]);
      } catch {
        mergedWindowFrames = directWindowFrames;
      }
    }

    return {
      metadata: windowPayload?.gameMetadata || {},
      windowFrames: mergedWindowFrames,
      detailsFrames: Array.isArray(detailsPayload?.frames) ? detailsPayload.frames : []
    };
  }

  async fetchLiveMatches() {
    const [livePayload, schedulePage] = await Promise.all([
      this.fetchPersisted("getLive"),
      this.fetchSchedulePage()
    ]);
    const liveEvents = Array.isArray(livePayload?.data?.schedule?.events)
      ? livePayload.data.schedule.events
      : [];
    const scheduleEvents = Array.isArray(schedulePage?.events) ? schedulePage.events : [];
    const byId = new Map();

    for (const event of [...liveEvents, ...scheduleEvents]) {
      const summary = normalizeMatchSummary(event);
      if (summary?.status === "live") {
        byId.set(summary.id, summary);
      }
    }

    return Array.from(byId.values());
  }

  async fetchSchedulePage({ pageToken } = {}) {
    const payload = await this.fetchPersisted("getSchedule", pageToken ? { pageToken } : {});
    const schedule = payload?.data?.schedule;
    if (!schedule) {
      return {
        events: [],
        pages: {}
      };
    }

    const events = Array.isArray(schedule.events) ? schedule.events : [];
    return {
      events,
      pages: schedule.pages || {}
    };
  }

  async fetchScheduleMatches() {
    const page = await this.fetchSchedulePage();
    return page.events.map((event) => normalizeMatchSummary(event)).filter(Boolean);
  }

  async fetchRecentResults({ maxRows = 40, maxPages = 2 } = {}) {
    const results = [];
    let pageToken;
    let pageCount = 0;

    while (pageCount < maxPages && results.length < maxRows) {
      const page = await this.fetchSchedulePage({ pageToken });
      results.push(
        ...page.events
          .map((event) => normalizeResultSummary(event))
          .filter(Boolean)
      );

      pageToken = page?.pages?.older;
      pageCount += 1;

      if (!pageToken) {
        break;
      }
    }

    return results.slice(0, maxRows);
  }

  async getCachedRecentResults({
    maxRows = LOL_PREMATCH_RESULTS_MAX_ROWS,
    maxPages = LOL_PREMATCH_RESULTS_MAX_PAGES
  } = {}) {
    const ageMs = Date.now() - this.recentResultsCache.fetchedAt;
    if (ageMs <= LOL_RECENT_RESULTS_CACHE_MS && this.recentResultsCache.rows.length > 0) {
      return this.recentResultsCache.rows.slice(0, maxRows);
    }

    try {
      const rows = await this.fetchRecentResults({ maxRows, maxPages });
      this.recentResultsCache = {
        fetchedAt: Date.now(),
        rows
      };
      return rows;
    } catch {
      return this.recentResultsCache.rows.slice(0, maxRows);
    }
  }

  async buildPreMatchInsights({
    summary,
    seriesGames,
    seriesProjection
  }) {
    const recentResults = await this.getCachedRecentResults();
    const sorted = recentResults
      .slice()
      .sort((left, right) => parseTimestamp(right.startAt) - parseTimestamp(left.startAt));
    const leftForm = buildTeamFormProfile({
      summary,
      teamId: summary?.teams?.left?.id,
      recentResults: sorted
    });
    const rightForm = buildTeamFormProfile({
      summary,
      teamId: summary?.teams?.right?.id,
      recentResults: sorted
    });
    const headToHead = buildHeadToHead({
      summary,
      recentResults: sorted
    });
    const prediction = buildPreMatchPrediction({
      summary,
      leftForm,
      rightForm,
      headToHead
    });
    const inferredWatchOptions = dedupeWatchOptions(
      (Array.isArray(seriesGames) ? seriesGames : [])
        .flatMap((game) => (Array.isArray(game.watchOptions) ? game.watchOptions : []))
        .map((option) => ({
          label: option?.label || "Broadcast",
          url: option?.watchUrl || null,
          note: option?.provider ? `Provider: ${option.provider}` : null
        }))
    );
    const watchOptions = inferredWatchOptions.length
      ? inferredWatchOptions
      : [
          {
            label: "LoL Esports (Official)",
            url: "https://lolesports.com/",
            note: "Official broadcast hub."
          }
        ];

    return {
      essentials: {
        scheduledAt: summary?.startAt || null,
        countdownSeconds: Number.isFinite(seriesProjection?.countdownSeconds)
          ? seriesProjection.countdownSeconds
          : Math.max(0, Math.round((parseTimestamp(summary?.startAt, Date.now()) - Date.now()) / 1000)),
        estimatedEndAt: seriesProjection?.estimatedEndAt || null,
        bestOf: summary?.bestOf || 1,
        tournament: summary?.tournament || "LoL Esports",
        region: summary?.region || "global"
      },
      watchOptions,
      teamForm: {
        left: leftForm,
        right: rightForm
      },
      headToHead,
      prediction
    };
  }

  async fetchMatchDetail(matchId, { gameNumber } = {}) {
    const providerMatchId = parseProviderMatchId(matchId);
    if (!providerMatchId) {
      return null;
    }

    const [payload, scheduleSnapshot] = await Promise.all([
      this.fetchPersisted("getEventDetails", {
        id: providerMatchId
      }),
      this.findScheduleSnapshot(providerMatchId)
    ]);
    const event = payload?.data?.event;
    if (!event?.match) {
      return null;
    }

    const resolvedStartTime = chooseStartTime(
      event?.startTime,
      scheduleSnapshot?.startTime,
      inferStartFromGames(event?.match?.games)
    );
    const bestOf = Number(event?.match?.strategy?.count || 1);
    const resolvedState = resolveRiotEventState({
      eventState: event?.state,
      scheduleState: scheduleSnapshot?.state,
      games: event?.match?.games,
      teams: event?.match?.teams,
      bestOf,
      startTime: resolvedStartTime
    });

    const summary = normalizeMatchSummary({
      ...event,
      startTime: resolvedStartTime,
      state: resolvedState
    });

    if (!summary) {
      return null;
    }

    const games = Array.isArray(event?.match?.games) ? event.match.games : [];
    const gameSelection = selectFocusedGame(games, gameNumber);
    const focusedGame = gameSelection.game;
    const focusedGameNumber = Number.isFinite(Number(focusedGame?.number))
      ? Number(focusedGame.number)
      : null;
    const seriesGames = buildSeriesGames(games, summary, focusedGameNumber);
    const timeline = seriesGames.map((game) => ({
      at: `Game ${game.number}`,
      type: "game",
      label: `${game.state}${game.selected ? " · selected" : ""}${game.watchUrl ? " · vod" : ""}`,
      watchUrl: game.watchUrl
    }));
    const seriesProjection = buildSeriesProjection(summary, seriesGames);
    const seriesGameInfoByNumber = new Map(
      seriesGames.map((game) => [Number(game?.number || 0), game])
    );
    const projectedStartByGameNumber = new Map(
      Array.isArray(seriesProjection?.games)
        ? seriesProjection.games.map((game) => [Number(game?.number || 0), game?.estimatedStartAt || null])
        : []
    );
    const stableFallbackMomentTime = summary.startAt || resolvedStartTime || "1970-01-01T00:00:00.000Z";

    const fallbackSeriesMoments = seriesGames
      .filter((game) => game.state === "completed" || game.state === "inProgress")
      .map((game) => ({
        id: `lol_riot_game_${game.id}`,
        gameNumber: Number(game?.number || 0),
        occurredAt:
          game.startedAt ||
          projectedStartByGameNumber.get(Number(game?.number || 0)) ||
          stableFallbackMomentTime,
        importance: game.state === "inProgress" ? "high" : "medium",
        title: `Game ${game.number} ${game.state === "inProgress" ? "in progress" : "completed"}`,
        summary: `${summary.teams.left.name} vs ${summary.teams.right.name}`
      }));
    const fallbackSelectedMoments = Number.isInteger(focusedGameNumber)
      ? fallbackSeriesMoments.filter((moment) => moment.gameNumber === focusedGameNumber)
      : fallbackSeriesMoments;
    let patchVersion = "unknown";
    let freshnessSource = "riot_lolesports";
    let enrichedSummary = summary;
    let liveTicker = [];
    let objectiveTimeline = [];
    let combatBursts = [];
    let goldMilestones = [];
    let playerDeltaPanel = null;
    let goldLeadSeries = [];
    let momentum = null;
    let topPerformers = [];
    let teamDraft = null;
    let playerEconomy = null;
    let selectedSeriesSnapshot = null;
    let seriesGameSnapshots = [];
    let seriesPlayerTrends = [];
    let draftDelta = null;
    let roleMatchupDeltas = [];
    let preMatchInsights = null;
    let selectedGameTelemetryAvailable = false;

    if (focusedGame?.id && summary.status !== "upcoming") {
      try {
        const liveStats = await this.fetchLiveStats(focusedGame.id, {
          includeHistory: true
        });
        const windowFrames = sortFramesByTimestamp(liveStats.windowFrames);
        const detailsFrames = sortFramesByTimestamp(liveStats.detailsFrames);
        const teamColorMap = teamColorMapFromMetadata(summary, liveStats.metadata);

        enrichedSummary = mergeSummaryWithWindowStats(summary, windowFrames, teamColorMap);

        const derived = deriveTickerAndObjectiveTimeline({
          summary: enrichedSummary,
          windowFrames,
          teamColorMap
        });
        const playerActionTicker = derivePlayerActionTicker({
          summary: enrichedSummary,
          detailsFrames,
          gameMetadata: liveStats.metadata,
          teamColorMap
        });

        liveTicker = [...derived.liveTicker, ...playerActionTicker]
          .sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt))
          .slice(0, 60);
        objectiveTimeline = derived.objectiveTimeline;
        combatBursts = derived.combatBursts;
        goldMilestones = derived.goldMilestones;
        playerDeltaPanel = buildPlayerDeltaPanel(detailsFrames, liveStats.metadata, teamColorMap);
        goldLeadSeries = buildGoldLeadSeries(windowFrames, teamColorMap);
        momentum = buildMomentum(enrichedSummary, windowFrames, teamColorMap);
        topPerformers = buildTopPerformers(detailsFrames, liveStats.metadata, teamColorMap);
        teamDraft = buildTeamDraft(liveStats.metadata, teamColorMap);
        playerEconomy = buildPlayerEconomy(detailsFrames, liveStats.metadata, teamColorMap, windowFrames);
        const focusedSeriesGameInfo = seriesGameInfoByNumber.get(Number(focusedGameNumber || 0)) || null;
        selectedSeriesSnapshot = {
          gameNumber: Number(focusedGameNumber || 0),
          state: focusedGame?.state || focusedSeriesGameInfo?.state || "unstarted",
          winnerTeamId: focusedSeriesGameInfo?.winnerTeamId || null,
          durationMinutes: focusedSeriesGameInfo?.durationMinutes || null,
          teamDraft,
          playerEconomy
        };
        patchVersion = liveStats.metadata?.patchVersion || "unknown";
        freshnessSource = "riot_lolesports+livestats";
        selectedGameTelemetryAvailable =
          liveTicker.length > 0 ||
          objectiveTimeline.length > 0 ||
          combatBursts.length > 0 ||
          goldMilestones.length > 0 ||
          Boolean(playerDeltaPanel) ||
          Boolean(playerEconomy) ||
          topPerformers.length > 0;
      } catch {
        // Keep stable payload even when live stats are temporarily unavailable.
      }
    }

    if (summary.status !== "upcoming") {
      try {
        const comparableGames = games
          .filter((game) => game?.id && (game.state === "completed" || game.state === "inProgress"))
          .sort((left, right) => Number(right?.number || 0) - Number(left?.number || 0));
        const prioritized = comparableGames.slice();

        if (Number.isInteger(focusedGameNumber)) {
          prioritized.sort((left, right) => {
            const leftNumber = Number(left?.number || 0);
            const rightNumber = Number(right?.number || 0);
            if (leftNumber === focusedGameNumber) return -1;
            if (rightNumber === focusedGameNumber) return 1;
            return rightNumber - leftNumber;
          });
        }

        const selectedGames = prioritized.slice(0, LOL_SERIES_SNAPSHOT_GAMES);
        const snapshots = await Promise.all(
          selectedGames.map(async (game) => {
            const gameNumberValue = Number(game?.number || 0);
            if (!Number.isInteger(gameNumberValue) || gameNumberValue <= 0) {
              return null;
            }

            const seriesGameInfo = seriesGameInfoByNumber.get(gameNumberValue) || null;
            if (
              selectedSeriesSnapshot &&
              selectedSeriesSnapshot.gameNumber === gameNumberValue &&
              (selectedSeriesSnapshot.teamDraft || selectedSeriesSnapshot.playerEconomy)
            ) {
              return {
                ...selectedSeriesSnapshot,
                state: game?.state || selectedSeriesSnapshot.state,
                winnerTeamId: seriesGameInfo?.winnerTeamId || selectedSeriesSnapshot.winnerTeamId || null,
                durationMinutes: seriesGameInfo?.durationMinutes || selectedSeriesSnapshot.durationMinutes || null
              };
            }

            try {
              const liveStats = await this.fetchLiveStats(game.id);
              const detailsFrames = sortFramesByTimestamp(liveStats.detailsFrames);
              const teamColorMap = teamColorMapFromMetadata(enrichedSummary, liveStats.metadata);
              const gameDraft = buildTeamDraft(liveStats.metadata, teamColorMap);
              const gameWindowFrames = sortFramesByTimestamp(liveStats.windowFrames);
              const gameEconomy = buildPlayerEconomy(detailsFrames, liveStats.metadata, teamColorMap, gameWindowFrames);
              if (!gameDraft && !gameEconomy) {
                return null;
              }

              return {
                gameNumber: gameNumberValue,
                state: game?.state || seriesGameInfo?.state || "unstarted",
                winnerTeamId: seriesGameInfo?.winnerTeamId || null,
                durationMinutes: seriesGameInfo?.durationMinutes || null,
                teamDraft: gameDraft,
                playerEconomy: gameEconomy
              };
            } catch {
              return null;
            }
          })
        );

        seriesGameSnapshots = snapshots
          .filter(Boolean)
          .sort((left, right) => Number(left.gameNumber || 0) - Number(right.gameNumber || 0));
      } catch {
        seriesGameSnapshots = [];
      }
    }

    if (
      (!Array.isArray(seriesGameSnapshots) || seriesGameSnapshots.length === 0) &&
      selectedSeriesSnapshot &&
      Number.isInteger(selectedSeriesSnapshot.gameNumber) &&
      selectedSeriesSnapshot.gameNumber > 0 &&
      (selectedSeriesSnapshot.teamDraft || selectedSeriesSnapshot.playerEconomy)
    ) {
      seriesGameSnapshots = [selectedSeriesSnapshot];
    }

    seriesPlayerTrends = buildSeriesPlayerTrends(seriesGameSnapshots, enrichedSummary);
    draftDelta = buildDraftDelta({
      selectedGameNumber: focusedGameNumber,
      seriesGameSnapshots,
      fallbackSelectedDraft: teamDraft
    });
    roleMatchupDeltas = buildRoleMatchupDeltas({
      seriesGameSnapshots,
      summary: enrichedSummary,
      selectedGameNumber: focusedGameNumber
    });

    if (enrichedSummary.status === "upcoming") {
      preMatchInsights = await this.buildPreMatchInsights({
        summary: enrichedSummary,
        seriesGames,
        seriesProjection
      });
    }

    const keyMoments = liveTicker.length
      ? [...liveTicker.slice(0, 8), ...fallbackSelectedMoments].slice(0, 8)
      : fallbackSelectedMoments;
    const seriesMoments = fallbackSeriesMoments.slice(0, 12);
    const winnerTeamId = resolveWinnerTeamId(enrichedSummary);
    const seriesProgress = buildSeriesProgress(enrichedSummary, seriesGames);
    const objectiveControl = buildObjectiveControl(enrichedSummary.teams);
    const leadTrend = buildLeadTrend(goldLeadSeries);
    const pulseCard = buildPulseCard(enrichedSummary, momentum, seriesProgress);
    const teamEconomyTotals = buildTeamEconomyTotals(playerEconomy);
    const laneMatchups = buildLaneMatchups(teamDraft, playerEconomy);
    const objectiveRuns = buildObjectiveRuns(objectiveTimeline, enrichedSummary.teams);
    const storylines = buildStorylines({
      summary: enrichedSummary,
      momentum,
      leadTrend,
      objectiveControl,
      topPerformers,
      seriesProgress,
      objectiveRuns
    });
    const dataConfidence = buildDataConfidence({
      summary: enrichedSummary,
      freshnessSource,
      playerDeltaPanel,
      liveTicker,
      objectiveTimeline,
      topPerformers,
      teamDraft,
      playerEconomy,
      seriesGames
    });
    const objectiveBreakdown = buildObjectiveBreakdown(objectiveTimeline);
    const tempoSnapshot = buildTempoSnapshot({
      summary: enrichedSummary,
      seriesGames,
      playerEconomy,
      objectiveTimeline
    });
    const edgeMeter = buildEdgeMeter({
      summary: enrichedSummary,
      seriesProgress,
      momentum,
      objectiveControl,
      topPerformers,
      leadTrend
    });
    const tacticalChecklist = buildTacticalChecklist({
      summary: enrichedSummary,
      seriesProgress,
      momentum,
      objectiveControl,
      objectiveRuns,
      topPerformers,
      leadTrend,
      edgeMeter,
      dataConfidence
    });
    const gameNavigation = buildGameNavigation({
      seriesGames,
      selectedGameNumber: focusedGameNumber,
      requestedGameNumber: gameSelection.requestedGameNumber,
      requestedMissing: gameSelection.requestedMissing
    });
    const seriesHeader = buildSeriesHeader(enrichedSummary, seriesProgress, gameNavigation);
    const selectedSeriesGame = seriesGames.find((game) => game.selected) || seriesGames[0] || null;
    const selectedGame = buildSelectedGameContext({
      summary: enrichedSummary,
      selectedSeriesGame,
      gameSelection,
      hasTelemetry: selectedGameTelemetryAvailable,
      liveTicker,
      objectiveTimeline,
      playerEconomy,
      combatBursts,
      goldMilestones
    });
    const objectiveForecast = buildObjectiveForecast({
      summary: enrichedSummary,
      selectedSeriesGame,
      selectedGame,
      playerEconomy,
      objectiveTimeline
    });
    const refreshAfterSeconds = nextRefreshSecondsForStatus(enrichedSummary.status);

    return {
      id: enrichedSummary.id,
      game: "lol",
      region: enrichedSummary.region,
      tournament: enrichedSummary.tournament,
      patch: patchVersion,
      status: enrichedSummary.status,
      startAt: enrichedSummary.startAt,
      bestOf: enrichedSummary.bestOf,
      freshness: {
        source: freshnessSource,
        status: "healthy",
        updatedAt: new Date().toISOString()
      },
      seriesScore: enrichedSummary.seriesScore,
      winnerTeamId,
      teams: enrichedSummary.teams,
      seriesHeader,
      gameNavigation,
      selectedGame,
      keyMoments,
      seriesMoments,
      timeline,
      seriesGames,
      seriesProjection,
      preMatchInsights,
      seriesPlayerTrends,
      draftDelta,
      roleMatchupDeltas,
      topPerformers,
      teamDraft,
      playerEconomy,
      teamEconomyTotals,
      laneMatchups,
      objectiveRuns,
      storylines,
      dataConfidence,
      objectiveBreakdown,
      tempoSnapshot,
      edgeMeter,
      tacticalChecklist,
      seriesProgress,
      objectiveControl,
      leadTrend,
      pulseCard,
      refreshAfterSeconds,
      momentum,
      goldLeadSeries,
      liveTicker,
      objectiveTimeline,
      objectiveForecast,
      combatBursts,
      goldMilestones,
      playerDeltaPanel
    };
  }
}
