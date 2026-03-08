import { fetchJson } from "../shared/http.js";

const OPENDOTA_BASE_URL = process.env.OPENDOTA_BASE_URL || "https://api.opendota.com/api";
const LEAGUE_CACHE_MS = Number.parseInt(process.env.OPENDOTA_LEAGUE_CACHE_MS || "21600000", 10);
const HERO_CACHE_MS = Number.parseInt(process.env.OPENDOTA_HERO_CACHE_MS || "21600000", 10);
const TEAM_DIRECTORY_CACHE_MS = Number.parseInt(process.env.OPENDOTA_TEAM_CACHE_MS || "21600000", 10);
const TEAM_MATCH_CACHE_MS = Number.parseInt(process.env.OPENDOTA_TEAM_MATCH_CACHE_MS || "900000", 10);
const MIN_GOLD_SWING_FOR_TICKER = Number.parseInt(process.env.DOTA_LIVE_TICKER_GOLD_SWING || "1500", 10);
const ESTIMATED_GAME_SECONDS = Number.parseInt(process.env.DOTA_ESTIMATED_GAME_SECONDS || "2400", 10);
const ESTIMATED_BETWEEN_GAMES_SECONDS = Number.parseInt(
  process.env.DOTA_ESTIMATED_BETWEEN_GAMES_SECONDS || "420",
  10
);
const INCOMPLETE_SERIES_GRACE_SECONDS = Number.parseInt(
  process.env.DOTA_INCOMPLETE_SERIES_GRACE_SECONDS || "3600",
  10
);
const DOTA_TOWER_TOTAL = 11;
const DOTA_BARRACKS_TOTAL = 6;

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

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value) {
  const parsed = toFiniteNumber(value);
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

function parseProviderMatchId(matchId) {
  if (!matchId) return null;

  const parts = String(matchId).split("_");
  const tail = parts[parts.length - 1];
  return /^\d+$/.test(tail) ? tail : null;
}

function normalizeProviderTeamKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function stripCommonTeamTerms(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(team|esports|e-sports|gaming|gg)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function buildTeamLookupKeys({ name, tag } = {}) {
  const keys = new Set();
  const directName = normalizeProviderTeamKey(name);
  const simplifiedName = stripCommonTeamTerms(name);
  const directTag = normalizeProviderTeamKey(tag);

  if (directName) keys.add(directName);
  if (simplifiedName) keys.add(simplifiedName);
  if (directTag) keys.add(directTag);

  return Array.from(keys.values());
}

function parseRequestedGameNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    return null;
  }

  return parsed;
}

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return Number.isFinite(numerator) && numerator > 0 ? numerator : 0;
  }

  return numerator / denominator;
}

function normalizeRole(role) {
  const value = String(role || "").toLowerCase().trim();
  if (value === "carry" || value === "pos1" || value === "position1") return "pos1";
  if (value === "mid" || value === "midlane" || value === "pos2" || value === "position2") return "pos2";
  if (value === "offlane" || value === "off" || value === "pos3" || value === "position3") return "pos3";
  if (value === "softsupport" || value === "support4" || value === "pos4" || value === "position4") return "pos4";
  if (value === "hardsupport" || value === "support5" || value === "pos5" || value === "position5") return "pos5";
  return value || "flex";
}

function roleLabelFromLaneRole(laneRole, sortedNetWorthIndex = 0) {
  const parsed = Number.parseInt(String(laneRole ?? ""), 10);
  if (parsed === 2) return "pos2";
  if (parsed === 1) {
    return sortedNetWorthIndex <= 1 ? "pos1" : "pos5";
  }
  if (parsed === 3) {
    return sortedNetWorthIndex <= 2 ? "pos3" : "pos4";
  }

  const byNetWorth = ["pos1", "pos2", "pos3", "pos4", "pos5"];
  return byNetWorth[Math.min(Math.max(sortedNetWorthIndex, 0), 4)] || "flex";
}

function heroNameFromMap(heroMap, heroId) {
  const key = Number(heroId);
  if (!Number.isInteger(key)) {
    return "Unknown";
  }

  return heroMap.get(key) || `Hero ${key}`;
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
  const seriesId = rowSeriesId(row);
  const competitiveTier = leagueTierMap.get(leagueId) ?? null;
  const tournament = row?.league_name || `League ${leagueId}`;
  const providerMatchId = String(seriesId || matchId);

  return {
    id: seriesId ? `dota_od_series_${seriesId}` : `dota_od_live_${matchId}`,
    providerMatchId,
    sourceMatchId: String(matchId),
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

function rowLeagueId(row) {
  return Number(row?.leagueid || row?.league_id || 0);
}

function rowLeagueName(row) {
  return row?.league_name || row?.league?.name || null;
}

function rowSeriesId(row) {
  const parsed = Number(row?.series_id || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function rowMatchId(row) {
  const parsed = Number(row?.match_id || 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function rowStartSeconds(row) {
  return toOptionalNumber(row?.start_time ?? row?.activate_time);
}

function rowUpdatedSeconds(row) {
  return toOptionalNumber(row?.last_update_time ?? row?.start_time ?? row?.activate_time);
}

function rowEndSeconds(row) {
  const start = rowStartSeconds(row);
  const duration = toOptionalNumber(row?.duration);
  if (start === null) {
    return null;
  }

  return start + Math.max(0, duration || 0);
}

function rowRadiantTeam(row) {
  const id = toOptionalNumber(row?.team_id_radiant ?? row?.radiant_team_id);
  return {
    id: id !== null && id > 0 ? String(id) : null,
    name: String(row?.team_name_radiant || row?.radiant_name || "").trim() || null
  };
}

function rowDireTeam(row) {
  const id = toOptionalNumber(row?.team_id_dire ?? row?.dire_team_id);
  return {
    id: id !== null && id > 0 ? String(id) : null,
    name: String(row?.team_name_dire || row?.dire_name || "").trim() || null
  };
}

function sameTeamReference(source, target) {
  if (!source || !target) {
    return false;
  }

  if (source.id && target.id) {
    return source.id === target.id;
  }

  const sourceName = String(source.name || "").trim().toLowerCase();
  const targetName = String(target.name || "").trim().toLowerCase();
  return Boolean(sourceName) && sourceName === targetName;
}

function summarizeSeriesRows(rows = [], leagueTierMap = new Map()) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const ordered = rows
    .slice()
    .filter((row) => rowMatchId(row))
    .sort((left, right) => {
      const startDiff = (rowStartSeconds(left) || 0) - (rowStartSeconds(right) || 0);
      if (startDiff !== 0) {
        return startDiff;
      }

      return (rowMatchId(left) || 0) - (rowMatchId(right) || 0);
    });
  if (!ordered.length) {
    return null;
  }

  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const seriesId = rowSeriesId(first);
  const leagueId = rowLeagueId(first);
  if (leagueId <= 0) {
    return null;
  }

  const competitiveTier = leagueTierMap.get(leagueId) ?? null;
  const bestOf = normalizeSeriesType(first?.series_type);
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const leftTeam = rowRadiantTeam(first);
  const rightTeam = rowDireTeam(first);
  let leftWins = 0;
  let rightWins = 0;

  for (const row of ordered) {
    const radiantTeam = rowRadiantTeam(row);
    const direTeam = rowDireTeam(row);
    const radiantWin = typeof row?.radiant_win === "boolean" ? row.radiant_win : null;
    if (radiantWin === null) {
      continue;
    }

    if (sameTeamReference(radiantTeam, leftTeam) && sameTeamReference(direTeam, rightTeam)) {
      if (radiantWin) {
        leftWins += 1;
      } else {
        rightWins += 1;
      }
      continue;
    }

    if (sameTeamReference(radiantTeam, rightTeam) && sameTeamReference(direTeam, leftTeam)) {
      if (radiantWin) {
        rightWins += 1;
      } else {
        leftWins += 1;
      }
    }
  }

  const startSeconds = rowStartSeconds(first);
  const updatedSeconds = Math.max(...ordered.map((row) => rowUpdatedSeconds(row) || 0));
  const endSeconds = Math.max(...ordered.map((row) => rowEndSeconds(row) || 0));
  const completed = leftWins >= winsNeeded || rightWins >= winsNeeded;
  const liveWindowMs =
    bestOf * ESTIMATED_GAME_SECONDS * 1000 +
    Math.max(0, bestOf - 1) * ESTIMATED_BETWEEN_GAMES_SECONDS * 1000;
  const recentEndWindowMs = INCOMPLETE_SERIES_GRACE_SECONDS * 1000;
  const liveEligible =
    !completed &&
    startSeconds !== null &&
    (
      Date.now() <= startSeconds * 1000 + liveWindowMs ||
      (endSeconds !== null && Date.now() <= endSeconds * 1000 + recentEndWindowMs)
    );
  const providerMatchId = String(seriesId || rowMatchId(latest));
  const summary = {
    id: seriesId ? `dota_od_series_${seriesId}` : `dota_od_result_${providerMatchId}`,
    providerMatchId,
    sourceMatchId: String(rowMatchId(latest) || providerMatchId),
    leagueId,
    competitiveTier,
    game: "dota2",
    region: "global",
    tournament: rowLeagueName(first) || `League ${leagueId}`,
    startAt: toIsoFromSeconds(startSeconds, Date.now()),
    updatedAt: toIsoFromSeconds(updatedSeconds || endSeconds || startSeconds, Date.now()),
    endAt: endSeconds ? toIsoFromSeconds(endSeconds, Date.now()) : null,
    bestOf,
    seriesScore: {
      left: leftWins,
      right: rightWins
    },
    teams: {
      left: {
        id: leftTeam.id || `od_left_${providerMatchId}`,
        name: leftTeam.name || "Radiant"
      },
      right: {
        id: rightTeam.id || `od_right_${providerMatchId}`,
        name: rightTeam.name || "Dire"
      }
    },
    seriesMatchIds: ordered.map((row) => String(rowMatchId(row))).filter(Boolean),
    keySignal: "provider_pro_series",
    status: completed ? "completed" : liveEligible ? "live" : "upcoming"
  };

  if (completed) {
    summary.winnerTeamId =
      leftWins > rightWins ? summary.teams.left.id : summary.teams.right.id;
  }

  return summary;
}

export function buildSeriesSummaries(rows = [], leagueTierMap = new Map()) {
  const grouped = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const matchId = rowMatchId(row);
    if (!matchId) {
      continue;
    }

    const seriesId = rowSeriesId(row);
    const key = seriesId ? `series:${seriesId}` : `match:${matchId}`;
    const group = grouped.get(key) || [];
    group.push(row);
    grouped.set(key, group);
  }

  return Array.from(grouped.values())
    .map((group) => summarizeSeriesRows(group, leagueTierMap))
    .filter(Boolean)
    .sort((left, right) => parseTimestamp(right.endAt || right.updatedAt || right.startAt) - parseTimestamp(left.endAt || left.updatedAt || left.startAt));
}

function swapSide(side) {
  if (side === "left") return "right";
  if (side === "right") return "left";
  return side;
}

function cloneSideValue(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (value && typeof value === "object") {
    return { ...value };
  }
  return value;
}

function swapLeftRightObject(value) {
  return {
    left: cloneSideValue(value?.right),
    right: cloneSideValue(value?.left)
  };
}

function seriesWinnerFromRow(row, summary) {
  if (typeof row?.radiant_win !== "boolean") {
    return null;
  }

  const radiantTeam = rowRadiantTeam(row);
  const direTeam = rowDireTeam(row);
  if (sameTeamReference(radiantTeam, summary?.teams?.left) && sameTeamReference(direTeam, summary?.teams?.right)) {
    return row.radiant_win ? summary?.teams?.left?.id || null : summary?.teams?.right?.id || null;
  }

  if (sameTeamReference(radiantTeam, summary?.teams?.right) && sameTeamReference(direTeam, summary?.teams?.left)) {
    return row.radiant_win ? summary?.teams?.right?.id || null : summary?.teams?.left?.id || null;
  }

  return null;
}

function seriesSideInfoFromRow(row, summary) {
  const radiantTeam = rowRadiantTeam(row);
  const direTeam = rowDireTeam(row);
  const leftSide = sameTeamReference(radiantTeam, summary?.teams?.left)
    ? "radiant"
    : sameTeamReference(direTeam, summary?.teams?.left)
      ? "dire"
      : null;
  const rightSide = sameTeamReference(radiantTeam, summary?.teams?.right)
    ? "radiant"
    : sameTeamReference(direTeam, summary?.teams?.right)
      ? "dire"
      : null;

  return {
    leftSide,
    rightSide
  };
}

function buildSeriesGamesFromRows(summary, rows = [], { selectedGameNumber } = {}) {
  const orderedRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => rowMatchId(row))
    .slice()
    .sort((left, right) => {
      const startDiff = (rowStartSeconds(left) || 0) - (rowStartSeconds(right) || 0);
      if (startDiff !== 0) {
        return startDiff;
      }
      return (rowMatchId(left) || 0) - (rowMatchId(right) || 0);
    });

  const bestOf = Math.max(1, Number(summary?.bestOf || 1));
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const completedMaps = Math.max(0, toCount(summary?.seriesScore?.left) + toCount(summary?.seriesScore?.right));
  const currentGameNumber =
    summary?.status === "live"
      ? Math.max(1, completedMaps + 1)
      : summary?.status === "completed"
        ? Math.max(1, completedMaps || orderedRows.length || 1)
        : 1;
  const totalSlots = Math.max(bestOf, currentGameNumber, orderedRows.length);

  const actualGames = new Map();
  orderedRows.forEach((row, index) => {
    const number = index + 1;
    const completed = typeof row?.radiant_win === "boolean";
    const state =
      completed
        ? "completed"
        : summary?.status === "live" && number === currentGameNumber
          ? "inProgress"
          : number > currentGameNumber && completedMaps >= winsNeeded
            ? "unneeded"
            : "unstarted";
    const matchId = rowMatchId(row);
    actualGames.set(number, {
      id: `dota_game_${number}`,
      number,
      state,
      selected: Number.isInteger(selectedGameNumber) && selectedGameNumber === number,
      label:
        state === "completed"
          ? "Completed game."
          : state === "inProgress"
            ? "Currently live."
            : state === "unneeded"
              ? "Not played (series already decided)."
              : "Scheduled next.",
      winnerTeamId: completed ? seriesWinnerFromRow(row, summary) : null,
      sideInfo: seriesSideInfoFromRow(row, summary),
      durationMinutes: Number.isFinite(toFiniteNumber(row?.duration))
        ? Number((Math.max(0, Number(row.duration)) / 60).toFixed(1))
        : null,
      startedAt: toIsoFromSeconds(rowStartSeconds(row), Date.now()),
      watchUrl: matchId ? `https://www.opendota.com/matches/${matchId}` : null,
      watchProvider: matchId ? "opendota" : null,
      watchOptions: matchId
        ? [
            {
              id: `dota_watch_${number}`,
              locale: "global",
              label: "OpenDota Match",
              shortLabel: "OpenDota",
              provider: "opendota",
              watchUrl: `https://www.opendota.com/matches/${matchId}`,
              startedAt: toIsoFromSeconds(rowStartSeconds(row), Date.now()),
              startMillis: null,
              endMillis: null
            }
          ]
        : [],
      sourceMatchId: matchId ? String(matchId) : null
    });
  });

  const games = [];
  for (let number = 1; number <= totalSlots; number += 1) {
    const existing = actualGames.get(number);
    if (existing) {
      games.push(existing);
      continue;
    }

    let state = "unstarted";
    if (number < currentGameNumber) {
      state = "completed";
    } else if (number === currentGameNumber) {
      state = summary?.status === "live" ? "inProgress" : summary?.status === "completed" ? "completed" : "unstarted";
    }

    if (number > currentGameNumber && completedMaps >= winsNeeded) {
      state = "unneeded";
    }

    games.push({
      id: `dota_game_${number}`,
      number,
      state,
      selected: Number.isInteger(selectedGameNumber) && selectedGameNumber === number,
      label:
        state === "completed"
          ? "Completed game."
          : state === "inProgress"
            ? "Currently live."
            : state === "unneeded"
              ? "Not played (series already decided)."
              : "Scheduled next.",
      winnerTeamId: null,
      sideInfo: {
        leftSide: null,
        rightSide: null
      },
      durationMinutes: null,
      startedAt: null,
      watchUrl: null,
      watchProvider: null,
      watchOptions: [],
      sourceMatchId: null
    });
  }

  return {
    currentGameNumber,
    games
  };
}

function findMatchingLiveRowForSeries(summary, liveRows = []) {
  const targetSeriesId = Number.parseInt(String(summary?.providerMatchId || ""), 10);
  const targetLeft = summary?.teams?.left;
  const targetRight = summary?.teams?.right;

  const rows = Array.isArray(liveRows) ? liveRows : [];
  return (
    rows.find((row) => {
      const rowSeries = rowSeriesId(row);
      return Number.isInteger(targetSeriesId) && targetSeriesId > 0 && rowSeries === targetSeriesId;
    }) ||
    rows.find((row) => {
      const radiant = rowRadiantTeam(row);
      const dire = rowDireTeam(row);
      return (
        (sameTeamReference(radiant, targetLeft) && sameTeamReference(dire, targetRight)) ||
        (sameTeamReference(radiant, targetRight) && sameTeamReference(dire, targetLeft))
      );
    }) ||
    null
  );
}

function shouldFlipSeriesSides(mapDetail, summary) {
  return (
    sameTeamReference(mapDetail?.teams?.left, summary?.teams?.right) &&
    sameTeamReference(mapDetail?.teams?.right, summary?.teams?.left)
  );
}

function flipObjectiveTimeline(rows = []) {
  return rows.map((row) => ({
    ...row,
    team: swapSide(row?.team)
  }));
}

function flipGoldLeadSeries(rows = []) {
  return rows.map((row) => ({
    ...row,
    lead: -toCount(row?.lead)
  }));
}

function flipPlayerEconomy(playerEconomy) {
  const leftRows = Array.isArray(playerEconomy?.right)
    ? playerEconomy.right.map((row) => ({
        ...row,
        team: "left"
      }))
    : [];
  const rightRows = Array.isArray(playerEconomy?.left)
    ? playerEconomy.left.map((row) => ({
        ...row,
        team: "right"
      }))
    : [];

  return {
    elapsedSeconds: toCount(playerEconomy?.elapsedSeconds),
    updatedAt: playerEconomy?.updatedAt || new Date().toISOString(),
    left: leftRows,
    right: rightRows
  };
}

function flipTeamDraft(teamDraft) {
  if (!teamDraft) {
    return null;
  }

  return {
    left: Array.isArray(teamDraft?.right) ? teamDraft.right.slice() : [],
    right: Array.isArray(teamDraft?.left) ? teamDraft.left.slice() : [],
    leftBans: Array.isArray(teamDraft?.rightBans) ? teamDraft.rightBans.slice() : [],
    rightBans: Array.isArray(teamDraft?.leftBans) ? teamDraft.leftBans.slice() : [],
    leftTeamId: teamDraft?.rightTeamId || null,
    rightTeamId: teamDraft?.leftTeamId || null
  };
}

function sideSummaryFromSeriesGame(summary, seriesGame) {
  const leftSide = String(seriesGame?.sideInfo?.leftSide || "").trim();
  const rightSide = String(seriesGame?.sideInfo?.rightSide || "").trim();
  if (!leftSide || !rightSide) {
    return [];
  }

  return [
    `${summary?.teams?.left?.name || "Left"} ${leftSide.charAt(0).toUpperCase()}${leftSide.slice(1)}`,
    `${summary?.teams?.right?.name || "Right"} ${rightSide.charAt(0).toUpperCase()}${rightSide.slice(1)}`
  ];
}

function buildSeriesDetail({
  matchId,
  summary,
  mapDetail,
  seriesGames,
  selectedGameNumber,
  requestedGameNumber,
  requestedMissing,
  selectedReason
}) {
  const selectedSeriesGame =
    (Array.isArray(seriesGames) ? seriesGames : []).find((game) => Number(game?.number) === Number(selectedGameNumber)) || null;
  const flipSides = mapDetail ? shouldFlipSeriesSides(mapDetail, summary) : false;
  const objectiveTimeline = mapDetail
    ? flipSides
      ? flipObjectiveTimeline(Array.isArray(mapDetail?.objectiveTimeline) ? mapDetail.objectiveTimeline : [])
      : Array.isArray(mapDetail?.objectiveTimeline)
        ? mapDetail.objectiveTimeline.slice()
        : []
    : [];
  const goldLeadSeries = mapDetail
    ? flipSides
      ? flipGoldLeadSeries(Array.isArray(mapDetail?.goldLeadSeries) ? mapDetail.goldLeadSeries : [])
      : Array.isArray(mapDetail?.goldLeadSeries)
        ? mapDetail.goldLeadSeries.slice()
        : []
    : [];
  const baseObjectiveControl = mapDetail
    ? flipSides
      ? swapLeftRightObject(mapDetail?.objectiveControl || {})
      : mapDetail?.objectiveControl || null
    : null;
  const playerEconomy = mapDetail
    ? flipSides
      ? flipPlayerEconomy(mapDetail?.playerEconomy)
      : {
          elapsedSeconds: toCount(mapDetail?.playerEconomy?.elapsedSeconds),
          updatedAt: mapDetail?.playerEconomy?.updatedAt || new Date().toISOString(),
          left: Array.isArray(mapDetail?.playerEconomy?.left) ? mapDetail.playerEconomy.left.slice() : [],
          right: Array.isArray(mapDetail?.playerEconomy?.right) ? mapDetail.playerEconomy.right.slice() : []
        }
    : {
        elapsedSeconds: 0,
        updatedAt: new Date().toISOString(),
        left: [],
        right: []
      };
  const sourceSnapshot = mapDetail?.selectedGame?.snapshot || {
    left: { kills: 0, towers: 0, dragons: 0, barons: 0, inhibitors: 0, gold: 0 },
    right: { kills: 0, towers: 0, dragons: 0, barons: 0, inhibitors: 0, gold: 0 }
  };
  const selectedSnapshot = flipSides ? swapLeftRightObject(sourceSnapshot) : sourceSnapshot;
  const objectiveBreakdown = buildObjectiveBreakdown(objectiveTimeline);
  const objectiveControl = baseObjectiveControl || buildObjectiveControl({}, objectiveBreakdown);
  const teamEconomyTotals = buildTeamEconomyTotals(playerEconomy);
  const leadTrend = buildLeadTrend(goldLeadSeries);
  const momentum = buildMomentum(summary, selectedSnapshot, leadTrend);
  const seriesProgress = buildSeriesProgress(summary, seriesGames);
  const selectedState =
    selectedSeriesGame?.state ||
    (summary?.status === "live" ? "inProgress" : summary?.status === "completed" ? "completed" : "unstarted");
  const startedAt = selectedSeriesGame?.startedAt || summary?.startAt || new Date().toISOString();
  const durationSeconds = Number.isFinite(Number(selectedSeriesGame?.durationMinutes))
    ? Math.round(Number(selectedSeriesGame.durationMinutes) * 60)
    : 0;
  const liveTicker = buildLiveTicker({
    objectiveTimeline,
    goldLeadSeries,
    teams: summary?.teams,
    selectedGameNumber,
    status: summary?.status,
    startAtIso: startedAt
  });
  const keyMoments = buildKeyMoments({
    objectiveTimeline,
    goldLeadSeries,
    teams: summary?.teams
  });
  const telemetryStatus =
    selectedState === "unstarted"
      ? "none"
      : mapDetail
        ? String(mapDetail?.selectedGame?.telemetryStatus || "basic")
        : selectedState === "inProgress"
          ? "pending"
          : "none";
  const selectedGame = buildSelectedGameContext({
    selectedGameNumber,
    state: selectedState,
    selectedSnapshot,
    objectiveTimeline,
    liveTicker,
    watchUrl: selectedSeriesGame?.watchUrl || null,
    startedAt,
    duration: durationSeconds,
    leftName: summary?.teams?.left?.name,
    rightName: summary?.teams?.right?.name,
    requestedMissing
  });
  selectedGame.telemetryStatus = telemetryStatus;
  selectedGame.telemetryCounts = {
    tickerEvents: Array.isArray(liveTicker) ? liveTicker.length : 0,
    objectiveEvents: Array.isArray(objectiveTimeline) ? objectiveTimeline.length : 0,
    combatBursts: Array.isArray(mapDetail?.combatBursts) ? mapDetail.combatBursts.length : 0,
    goldMilestones: Array.isArray(mapDetail?.goldMilestones) ? mapDetail.goldMilestones.length : 0
  };
  selectedGame.winnerTeamId = selectedSeriesGame?.winnerTeamId || selectedGame.winnerTeamId || null;
  selectedGame.title =
    selectedGame.title ||
    (Number.isInteger(selectedGameNumber) ? `Game ${selectedGameNumber}` : null);
  selectedGame.sideSummary = sideSummaryFromSeriesGame(summary, selectedSeriesGame);
  selectedGame.watchUrl = selectedSeriesGame?.watchUrl || null;
  selectedGame.watchOptions = Array.isArray(selectedSeriesGame?.watchOptions) ? selectedSeriesGame.watchOptions : [];
  selectedGame.durationMinutes = Number.isFinite(Number(selectedSeriesGame?.durationMinutes))
    ? Number(selectedSeriesGame.durationMinutes)
    : selectedGame.durationMinutes;
  selectedGame.snapshot = selectedSnapshot;
  selectedGame.requestedMissing = Boolean(requestedMissing);

  const gameNavigation = buildGameNavigation({
    seriesGames,
    selectedGame,
    requestedGameNumber,
    requestedMissing,
    selectedReason
  });
  const dataConfidence = buildDataConfidence(
    {
      duration: durationSeconds
    },
    playerEconomy,
    objectiveTimeline,
    goldLeadSeries
  );
  const pulseCard = buildPulseCard(summary, momentum, seriesProgress);
  const edgeMeter = buildEdgeMeter(summary, momentum, objectiveControl);
  const tempoSnapshot = buildTempoSnapshot(
    {
      duration: durationSeconds
    },
    objectiveTimeline,
    seriesGames
  );
  const tacticalChecklist = buildTacticalChecklist(summary, momentum, objectiveControl);
  const storylines = buildStorylines(summary, momentum, leadTrend, objectiveControl);
  const teamDraft = mapDetail
    ? flipSides
      ? flipTeamDraft(mapDetail?.teamDraft)
      : mapDetail?.teamDraft || null
    : null;
  const allEconomyRows = [
    ...(Array.isArray(playerEconomy?.left) ? playerEconomy.left : []),
    ...(Array.isArray(playerEconomy?.right) ? playerEconomy.right : [])
  ];
  const topPerformers = buildTopPerformers(allEconomyRows);
  const objectiveRuns = buildObjectiveRuns(objectiveTimeline, summary?.teams);
  const teamForm = buildTeamFormFromSeriesScore(summary);
  const headToHead = buildHeadToHead(summary);
  const prediction = buildPrediction(summary, momentum, summary?.status);
  const seriesProjection = buildSeriesProjection(summary);
  const preMatchInsights = buildPreMatchInsights(summary, {
    seriesProjection,
    seriesGames,
    teamForm,
    headToHead,
    prediction
  });
  const combatBursts = buildCombatBursts(
    {
      radiant_score: selectedSnapshot?.left?.kills,
      dire_score: selectedSnapshot?.right?.kills
    },
    summary?.teams,
    startedAt
  );
  const goldMilestones = buildGoldMilestones(goldLeadSeries, summary?.teams);
  const freshness = mapDetail?.freshness || {
    source: "opendota",
    status: selectedState === "inProgress" && !mapDetail ? "pending" : "healthy",
    updatedAt: summary?.updatedAt || new Date().toISOString()
  };

  return {
    ...summary,
    id: matchId,
    providerMatchId: summary?.providerMatchId,
    sourceMatchId: selectedSeriesGame?.sourceMatchId || summary?.sourceMatchId || null,
    patch: mapDetail?.patch || summary?.patch || "unknown",
    freshness,
    timeline: objectiveTimeline.slice(-12).map((row) => ({
      at:
        row.gameTimeSeconds !== null
          ? `${Math.floor(row.gameTimeSeconds / 60)}:${String(row.gameTimeSeconds % 60).padStart(2, "0")}`
          : "--:--",
      type: row.type,
      label: row.label
    })),
    keyMoments,
    liveTicker,
    objectiveTimeline,
    objectiveControl,
    objectiveBreakdown,
    objectiveRuns,
    gameNavigation,
    selectedGame,
    seriesGames,
    seriesHeader: buildSeriesHeader(summary, seriesProgress, gameNavigation),
    seriesProgress,
    seriesProjection,
    dataConfidence,
    pulseCard,
    edgeMeter,
    tempoSnapshot,
    tacticalChecklist,
    storylines,
    teamDraft,
    playerEconomy,
    teamEconomyTotals,
    topPerformers,
    momentum,
    goldLeadSeries,
    leadTrend,
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
    watchGuide: buildUpcomingWatch(summary, selectedSeriesGame?.watchUrl || null),
    teamForm,
    headToHead,
    prediction,
    preMatchInsights,
    matchupReadiness: null,
    matchupKeyFactors: [],
    matchupAlertLevel: null,
    matchupMeta: null,
    combatBursts,
    goldMilestones,
    liveAlerts: []
  };
}

function inferMatchState(payload) {
  if (typeof payload?.radiant_win === "boolean") {
    return "completed";
  }

  const duration = toFiniteNumber(payload?.duration);
  if (duration !== null && duration > 0) {
    return "live";
  }

  return "upcoming";
}

function inferCurrentGameNumber(seriesScore, state) {
  const completedMaps = toCount(seriesScore?.left) + toCount(seriesScore?.right);
  if (state === "live") {
    return Math.max(1, completedMaps + 1);
  }

  if (state === "completed") {
    return Math.max(1, completedMaps || 1);
  }

  return 1;
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
    .filter((game) => Number.isInteger(game?.number) && game.number > 0)
    .slice()
    .sort((left, right) => left.number - right.number);

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
    const requested = ordered.find((game) => game.number === normalizedRequested);
    if (requested) {
      return {
        game: requested,
        requestedGameNumber: normalizedRequested,
        requestedMissing: false,
        selectedReason: "requested"
      };
    }

    const nearest = ordered.reduce((best, game) => {
      const bestDiff = Math.abs(best.number - normalizedRequested);
      const nextDiff = Math.abs(game.number - normalizedRequested);
      return nextDiff < bestDiff ? game : best;
    }, ordered[0]);

    return {
      game: nearest,
      requestedGameNumber: normalizedRequested,
      requestedMissing: true,
      selectedReason: "fallback_nearest"
    };
  }

  const live = ordered.find((game) => game.state === "inProgress");
  if (live) {
    return {
      game: live,
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

function buildSeriesGames({
  status,
  bestOf,
  seriesScore,
  currentGameNumber,
  startedAt,
  selectedGameNumber,
  watchUrl,
  winnerTeamId
}) {
  const completedMaps = Math.max(0, toCount(seriesScore.left) + toCount(seriesScore.right));
  const totalSlots = Math.max(currentGameNumber, bestOf || 1);
  const rows = [];

  for (let number = 1; number <= totalSlots; number += 1) {
    let state = "unstarted";
    if (number < currentGameNumber) {
      state = "completed";
    } else if (number === currentGameNumber) {
      state = status === "live" ? "inProgress" : status === "completed" ? "completed" : "unstarted";
    }

    if (number > currentGameNumber && completedMaps >= Math.floor((bestOf || 1) / 2) + 1) {
      state = "unneeded";
    }

    const estimatedStartAt =
      Number.isFinite(startedAt)
        ? new Date(
            startedAt +
              Math.max(0, number - 1) * (ESTIMATED_GAME_SECONDS + ESTIMATED_BETWEEN_GAMES_SECONDS) * 1000
          ).toISOString()
        : null;

    rows.push({
      id: `dota_game_${number}`,
      number,
      state,
      selected: Number.isInteger(selectedGameNumber) && selectedGameNumber === number,
      label:
        state === "completed"
          ? "Completed game."
          : state === "inProgress"
            ? "Currently live."
            : state === "unneeded"
              ? "Not played (series already decided)."
              : "Scheduled next.",
      winnerTeamId: state === "completed" && number === currentGameNumber ? winnerTeamId || null : null,
      sideInfo: {
        leftSide: "radiant",
        rightSide: "dire"
      },
      durationMinutes: state === "completed" ? Number((ESTIMATED_GAME_SECONDS / 60).toFixed(1)) : null,
      startedAt: estimatedStartAt,
      watchUrl,
      watchProvider: watchUrl ? "opendota" : null,
      watchOptions: watchUrl
        ? [
            {
              id: `dota_watch_${number}`,
              locale: "global",
              label: "OpenDota Match",
              shortLabel: "OpenDota",
              provider: "opendota",
              watchUrl,
              startedAt: estimatedStartAt,
              startMillis: null,
              endMillis: null
            }
          ]
        : []
    });
  }

  return rows;
}

function buildGameNavigation({ seriesGames, selectedGame, requestedGameNumber, requestedMissing, selectedReason }) {
  const availableGames = Array.isArray(seriesGames) ? seriesGames : [];
  const selectedNumber = Number.isInteger(selectedGame?.number) ? selectedGame.number : null;
  const ordered = availableGames
    .filter((game) => Number.isInteger(game?.number))
    .slice()
    .sort((left, right) => left.number - right.number);

  const selectedIndex = selectedNumber
    ? ordered.findIndex((game) => game.number === selectedNumber)
    : -1;
  const previousGameNumber = selectedIndex > 0 ? ordered[selectedIndex - 1].number : null;
  const nextGameNumber =
    selectedIndex >= 0 && selectedIndex < ordered.length - 1
      ? ordered[selectedIndex + 1].number
      : null;
  const currentLiveGame = ordered.find((game) => game.state === "inProgress");

  return {
    availableGames,
    selectedGameNumber: selectedNumber,
    previousGameNumber,
    nextGameNumber,
    currentLiveGameNumber: currentLiveGame?.number || null,
    requestedGameNumber: parseRequestedGameNumber(requestedGameNumber),
    requestedMissing: Boolean(requestedMissing),
    selectedReason: selectedReason || "none"
  };
}

function normalizeObjectiveType(rawType) {
  const value = String(rawType || "").toLowerCase();
  if (value.includes("roshan") || value.includes("aegis")) return "baron";
  if (value.includes("tower")) return "tower";
  if (value.includes("barracks") || value.includes("rax")) return "inhibitor";
  if (value.includes("firstblood") || value.includes("kill")) return "teamfight";
  return "other";
}

function normalizeObjectiveTeam(rawTeam) {
  if (rawTeam === 0 || rawTeam === "0" || String(rawTeam).toLowerCase() === "radiant") {
    return "left";
  }
  if (rawTeam === 1 || rawTeam === "1" || String(rawTeam).toLowerCase() === "dire") {
    return "right";
  }
  if (rawTeam === 2 || rawTeam === "2") {
    return "right";
  }

  return null;
}

function objectiveLabelFromRow(row, teams) {
  const type = normalizeObjectiveType(row?.type);
  const team = normalizeObjectiveTeam(row?.team);
  const teamName =
    team === "left"
      ? teams?.left?.name || "Radiant"
      : team === "right"
        ? teams?.right?.name || "Dire"
        : "Unknown";

  if (type === "baron") {
    return `Roshan secured - ${teamName}`;
  }

  if (type === "tower") {
    return `Tower destroyed - ${teamName}`;
  }

  if (type === "inhibitor") {
    return `Barracks destroyed - ${teamName}`;
  }

  if (type === "teamfight") {
    return `Combat event - ${teamName}`;
  }

  return `${String(row?.type || "Objective")}`;
}

function objectiveImportance(type) {
  if (type === "baron") return "high";
  if (type === "inhibitor") return "high";
  if (type === "tower") return "medium";
  if (type === "teamfight") return "medium";
  return "low";
}

function buildObjectiveTimeline(payload, teams) {
  const objectives = Array.isArray(payload?.objectives) ? payload.objectives : [];
  const startSeconds = toFiniteNumber(payload?.start_time);

  return objectives
    .map((row, index) => {
      const objectiveTimeSeconds = toFiniteNumber(row?.time);
      const occurredAt =
        startSeconds !== null && objectiveTimeSeconds !== null
          ? new Date((startSeconds + objectiveTimeSeconds) * 1000).toISOString()
          : new Date().toISOString();
      const type = normalizeObjectiveType(row?.type);
      const team = normalizeObjectiveTeam(row?.team);

      return {
        id: `obj_${index + 1}`,
        at: occurredAt,
        type,
        team,
        importance: objectiveImportance(type),
        label: objectiveLabelFromRow(row, teams),
        rawType: String(row?.type || ""),
        gameTimeSeconds: objectiveTimeSeconds !== null ? Math.max(0, Math.round(objectiveTimeSeconds)) : null
      };
    })
    .filter((row) => row.type !== "other")
    .sort((left, right) => parseTimestamp(left.at) - parseTimestamp(right.at));
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
    const type = String(event.type || "other").toLowerCase();
    target.total += 1;

    if (type === "dragon") target.dragon += 1;
    else if (type === "baron") target.baron += 1;
    else if (type === "tower") target.tower += 1;
    else if (type === "inhibitor") target.inhibitor += 1;
    else target.other += 1;
  }

  return { left, right };
}

function buildObjectiveControl(payload, objectiveBreakdown) {
  const leftTowersFromStatus = destroyedFromStatus(payload?.tower_status_dire, DOTA_TOWER_TOTAL);
  const rightTowersFromStatus = destroyedFromStatus(payload?.tower_status_radiant, DOTA_TOWER_TOTAL);
  const leftTowers = Math.max(leftTowersFromStatus ?? toCount(objectiveBreakdown?.left?.tower), 0);
  const rightTowers = Math.max(rightTowersFromStatus ?? toCount(objectiveBreakdown?.right?.tower), 0);
  const leftBarons = Math.max(toCount(objectiveBreakdown?.left?.baron), 0);
  const rightBarons = Math.max(toCount(objectiveBreakdown?.right?.baron), 0);
  const leftInhibitorsFromStatus = destroyedFromStatus(payload?.barracks_status_dire, DOTA_BARRACKS_TOTAL);
  const rightInhibitorsFromStatus = destroyedFromStatus(payload?.barracks_status_radiant, DOTA_BARRACKS_TOTAL);
  const leftInhibitors = Math.max(leftInhibitorsFromStatus ?? toCount(objectiveBreakdown?.left?.inhibitor), 0);
  const rightInhibitors = Math.max(rightInhibitorsFromStatus ?? toCount(objectiveBreakdown?.right?.inhibitor), 0);

  const leftDragons = 0;
  const rightDragons = 0;

  const leftScore = leftTowers * 1.4 + leftBarons * 3.1 + leftInhibitors * 2.2;
  const rightScore = rightTowers * 1.4 + rightBarons * 3.1 + rightInhibitors * 2.2;
  const total = leftScore + rightScore;

  return {
    left: {
      towers: leftTowers,
      dragons: leftDragons,
      barons: leftBarons,
      inhibitors: leftInhibitors,
      score: Number(leftScore.toFixed(2)),
      controlPct: total > 0 ? Number(((leftScore / total) * 100).toFixed(1)) : 50
    },
    right: {
      towers: rightTowers,
      dragons: rightDragons,
      barons: rightBarons,
      inhibitors: rightInhibitors,
      score: Number(rightScore.toFixed(2)),
      controlPct: total > 0 ? Number(((rightScore / total) * 100).toFixed(1)) : 50
    }
  };
}

function buildGoldLeadSeries(payload) {
  const rows = Array.isArray(payload?.radiant_gold_adv) ? payload.radiant_gold_adv : [];
  const startSeconds = toFiniteNumber(payload?.start_time);

  if (!rows.length) {
    return [];
  }

  return rows
    .map((lead, index) => {
      const at =
        startSeconds !== null
          ? new Date((startSeconds + index * 60) * 1000).toISOString()
          : new Date(Date.now() - (rows.length - index) * 60 * 1000).toISOString();

      return {
        at,
        lead: toCount(lead)
      };
    })
    .filter((row) => Number.isFinite(row.lead));
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

function buildLiveTicker({
  objectiveTimeline,
  goldLeadSeries,
  teams,
  selectedGameNumber,
  status,
  startAtIso
}) {
  const rows = [];

  const objectiveRows = Array.isArray(objectiveTimeline)
    ? objectiveTimeline.slice(-14)
    : [];

  for (const row of objectiveRows) {
    const teamName =
      row.team === "left"
        ? teams?.left?.name || "Radiant"
        : row.team === "right"
          ? teams?.right?.name || "Dire"
          : "Unknown";

    rows.push({
      id: `ticker_obj_${row.id}`,
      type: row.type,
      team: row.team,
      title: row.label,
      summary: `${teamName} ${row.type === "baron" ? "secured Roshan" : "claimed objective control"}.`,
      importance: row.importance || "medium",
      occurredAt: row.at
    });
  }

  const goldRows = Array.isArray(goldLeadSeries) ? goldLeadSeries : [];
  for (let index = 1; index < goldRows.length; index += 1) {
    const previous = toCount(goldRows[index - 1]?.lead);
    const current = toCount(goldRows[index]?.lead);
    const delta = current - previous;
    if (Math.abs(delta) < MIN_GOLD_SWING_FOR_TICKER) {
      continue;
    }

    const leaderTeam = current > 0 ? "left" : current < 0 ? "right" : "none";
    const leaderName =
      leaderTeam === "left"
        ? teams?.left?.name || "Radiant"
        : leaderTeam === "right"
          ? teams?.right?.name || "Dire"
          : "Neither side";

    rows.push({
      id: `ticker_gold_${index}`,
      type: "economy",
      team: leaderTeam === "none" ? null : leaderTeam,
      title: `${leaderName} gold swing ${signed(delta)}`,
      summary: `Lead now ${signed(current)} gold.`,
      importance: Math.abs(delta) >= 3000 ? "high" : "medium",
      occurredAt: goldRows[index]?.at || new Date().toISOString()
    });
  }

  const hasStartEvent = rows.some((row) => row.type === "state");
  if (!hasStartEvent && status === "live" && startAtIso) {
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

  const objectiveRows = Array.isArray(objectiveTimeline)
    ? objectiveTimeline.filter((row) => row.importance === "high").slice(-6)
    : [];

  for (const row of objectiveRows) {
    const teamName =
      row.team === "left"
        ? teams?.left?.name || "Radiant"
        : row.team === "right"
          ? teams?.right?.name || "Dire"
          : "Unknown";

    rows.push({
      id: `moment_obj_${row.id}`,
      occurredAt: row.at,
      importance: row.importance || "high",
      title: row.label,
      summary: `${teamName} gained a major objective edge.`
    });
  }

  const goldRows = Array.isArray(goldLeadSeries) ? goldLeadSeries : [];
  for (let index = 1; index < goldRows.length; index += 1) {
    const previous = toCount(goldRows[index - 1]?.lead);
    const current = toCount(goldRows[index]?.lead);
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
      occurredAt: goldRows[index]?.at || new Date().toISOString(),
      importance: Math.abs(delta) >= 4500 ? "critical" : "high",
      title: `${leaderName} converted a ${Math.abs(delta).toLocaleString()} gold swing`,
      summary: `Lead moved from ${signed(previous)} to ${signed(current)}.`
    });
  }

  return rows
    .sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt))
    .slice(0, 10);
}

function buildPlayerEconomy(payload, teams, heroMap) {
  const players = Array.isArray(payload?.players) ? payload.players : [];
  if (!players.length) {
    return null;
  }

  const radiant = players
    .filter((row) => row && (Number(row?.player_slot) < 128 || row?.isRadiant === true))
    .sort((left, right) => toCount(right?.net_worth) - toCount(left?.net_worth));
  const dire = players
    .filter((row) => row && (Number(row?.player_slot) >= 128 || row?.isRadiant === false))
    .sort((left, right) => toCount(right?.net_worth) - toCount(left?.net_worth));

  const teamKills = {
    left: Math.max(1, radiant.reduce((sum, row) => sum + toCount(row?.kills), 0)),
    right: Math.max(1, dire.reduce((sum, row) => sum + toCount(row?.kills), 0))
  };

  const mapRow = (row, team, index) => {
    const kills = toCount(row?.kills);
    const deaths = toCount(row?.deaths);
    const assists = toCount(row?.assists);
    const netWorth = toCount(row?.net_worth || row?.gold || row?.total_gold);
    const role = normalizeRole(roleLabelFromLaneRole(row?.lane_role, index));
    const heroName = heroNameFromMap(heroMap, row?.hero_id);
    const itemCount = [
      row?.item_0,
      row?.item_1,
      row?.item_2,
      row?.item_3,
      row?.item_4,
      row?.item_5,
      row?.item_neutral
    ].filter((item) => Number(item) > 0).length;

    return {
      participantId: Number.isInteger(Number(row?.account_id)) ? Number(row.account_id) : Number(row?.player_slot || index + 1),
      team,
      name: row?.name || row?.personaname || `Player ${index + 1}`,
      champion: heroName,
      role,
      kills,
      deaths,
      assists,
      cs: toCount(row?.last_hits),
      denies: toCount(row?.denies),
      gpm: toCount(row?.gold_per_min),
      xpm: toCount(row?.xp_per_min),
      level: toCount(row?.level),
      itemCount,
      goldEarned: netWorth,
      killParticipationPct: Number(
        (safeRatio(kills + assists, team === "left" ? teamKills.left : teamKills.right) * 100).toFixed(1)
      ),
      currentHealth: null,
      maxHealth: null,
      healthPct: null,
      isDead: false,
      deadForSeconds: null,
      respawnSeconds: null,
      respawnEstimated: false,
      respawnConfidence: null,
      respawnAt: null
    };
  };

  const leftRows = radiant.map((row, index) => mapRow(row, "left", index));
  const rightRows = dire.map((row, index) => mapRow(row, "right", index));

  const startedAtMs = parseTimestamp(toIsoFromSeconds(payload?.start_time), Date.now());
  const durationSeconds = Math.max(0, toCount(payload?.duration));

  return {
    elapsedSeconds: durationSeconds,
    updatedAt: new Date(startedAtMs + durationSeconds * 1000).toISOString(),
    left: leftRows,
    right: rightRows
  };
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

function buildSelectedSnapshot(payload, objectiveControl, teamEconomyTotals) {
  return {
    left: {
      kills: toCount(payload?.radiant_score),
      towers: toCount(objectiveControl?.left?.towers),
      dragons: 0,
      barons: toCount(objectiveControl?.left?.barons),
      inhibitors: toCount(objectiveControl?.left?.inhibitors),
      gold: toCount(teamEconomyTotals?.left?.totalGold)
    },
    right: {
      kills: toCount(payload?.dire_score),
      towers: toCount(objectiveControl?.right?.towers),
      dragons: 0,
      barons: toCount(objectiveControl?.right?.barons),
      inhibitors: toCount(objectiveControl?.right?.inhibitors),
      gold: toCount(teamEconomyTotals?.right?.totalGold)
    }
  };
}

function buildMomentum(summary, selectedSnapshot, leadTrend) {
  const left = selectedSnapshot?.left || {};
  const right = selectedSnapshot?.right || {};
  const goldLead = Number.isFinite(leadTrend?.finalLead)
    ? toCount(leadTrend.finalLead)
    : toCount(left?.gold) - toCount(right?.gold);

  return {
    leaderTeamId:
      goldLead > 0
        ? summary?.teams?.left?.id
        : goldLead < 0
          ? summary?.teams?.right?.id
          : null,
    goldLead,
    goldLeadDeltaWindow: toCount(leadTrend?.largestSwing),
    killDiff: toCount(left?.kills) - toCount(right?.kills),
    towerDiff: toCount(left?.towers) - toCount(right?.towers),
    dragonDiff: 0,
    baronDiff: toCount(left?.barons) - toCount(right?.barons),
    inhibitorDiff: toCount(left?.inhibitors) - toCount(right?.inhibitors)
  };
}

function buildSeriesProgress(summary, seriesGames) {
  const bestOf = Number(summary?.bestOf || 1);
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

function buildPulseCard(summary, momentum, seriesProgress) {
  const leftName = summary?.teams?.left?.name || "Radiant";
  const rightName = summary?.teams?.right?.name || "Dire";

  if (summary?.status === "upcoming") {
    return {
      tone: "warn",
      title: "Series Not Started",
      summary: `Upcoming BO${seriesProgress?.bestOf || summary?.bestOf || 1}. Opening lanes and rune control will define early pace.`
    };
  }

  if (summary?.status === "completed") {
    const winnerName =
      summary?.winnerTeamId === summary?.teams?.left?.id
        ? leftName
        : summary?.winnerTeamId === summary?.teams?.right?.id
          ? rightName
          : "Series complete";

    return {
      tone: "good",
      title: "Map Final",
      summary: `${winnerName} secured this map. Final score ${toCount(summary?.seriesScore?.left)}:${toCount(summary?.seriesScore?.right)}.`
    };
  }

  const leader =
    momentum?.goldLead > 0
      ? leftName
      : momentum?.goldLead < 0
        ? rightName
        : "Neither side";
  const lead = Math.abs(toCount(momentum?.goldLead)).toLocaleString();

  return {
    tone: Math.abs(toCount(momentum?.goldLead)) >= 4000 ? "good" : "neutral",
    title: "Live Pressure",
    summary: `${leader} lead by ${lead} net worth with kill diff ${signed(momentum?.killDiff)}.`
  };
}

function buildEdgeMeter(summary, momentum, objectiveControl) {
  const leftTeam = summary?.teams?.left?.name || "Radiant";
  const rightTeam = summary?.teams?.right?.name || "Dire";

  const leftScore =
    50 +
    toCount(momentum?.goldLead) / 220 +
    toCount(momentum?.killDiff) * 1.6 +
    (Number(objectiveControl?.left?.controlPct) - 50) * 0.7;
  const rightScore = 100 - leftScore;

  const safeLeft = Math.max(0, Math.min(100, Math.round(leftScore)));
  const safeRight = Math.max(0, Math.min(100, Math.round(rightScore)));

  const verdict =
    safeLeft > safeRight
      ? `${leftTeam} have the stronger map edge right now.`
      : safeRight > safeLeft
        ? `${rightTeam} currently control the edge.`
        : "Edge is currently even.";

  return {
    left: {
      team: leftTeam,
      score: safeLeft,
      drivers: [
        `Gold ${signed(momentum?.goldLead)}`,
        `Kills ${signed(momentum?.killDiff)}`,
        `Objective ${Number(objectiveControl?.left?.controlPct || 50).toFixed(1)}%`
      ]
    },
    right: {
      team: rightTeam,
      score: safeRight,
      drivers: [
        `Gold ${signed(-(toCount(momentum?.goldLead)))}`,
        `Kills ${signed(-(toCount(momentum?.killDiff)))}`,
        `Objective ${Number(objectiveControl?.right?.controlPct || 50).toFixed(1)}%`
      ]
    },
    verdict
  };
}

function buildTempoSnapshot(payload, objectiveTimeline, seriesGames) {
  const durationMinutes = Number((Math.max(0, toCount(payload?.duration)) / 60).toFixed(1));
  const completedGames = Array.isArray(seriesGames)
    ? seriesGames.filter((game) => game.state === "completed").length
    : 0;

  const objectiveEvents = Array.isArray(objectiveTimeline) ? objectiveTimeline.length : 0;
  const objectivePer10Minutes =
    durationMinutes > 0 ? Number(((objectiveEvents / Math.max(1, durationMinutes)) * 10).toFixed(2)) : null;

  return {
    completedGames,
    averageDurationMinutes: durationMinutes || null,
    shortestDurationMinutes: durationMinutes || null,
    longestDurationMinutes: durationMinutes || null,
    currentGameMinutes: durationMinutes || null,
    objectivePer10Minutes,
    objectiveEvents
  };
}

function buildDataConfidence(payload, playerEconomy, objectiveTimeline, goldLeadSeries) {
  let score = 35;
  const notes = [];

  if (playerEconomy && (playerEconomy.left.length || playerEconomy.right.length)) {
    score += 25;
    notes.push("Player economy rows populated from OpenDota match payload.");
  }

  if (Array.isArray(goldLeadSeries) && goldLeadSeries.length >= 6) {
    score += 20;
    notes.push("Gold lead timeline derived from radiant_gold_adv series.");
  }

  if (Array.isArray(objectiveTimeline) && objectiveTimeline.length >= 3) {
    score += 20;
    notes.push("Objective event timeline derived from OpenDota objectives stream.");
  }

  const grade = score >= 85 ? "high" : score >= 65 ? "medium" : "low";

  return {
    grade,
    score,
    telemetry: payload?.radiant_win === undefined ? "live_partial" : "postgame",
    notes
  };
}

function buildTacticalChecklist(summary, momentum, objectiveControl) {
  const rows = [];

  rows.push({
    tone: "neutral",
    title: "Roshan control",
    detail: `${summary?.teams?.left?.name || "Radiant"} ${toCount(objectiveControl?.left?.barons)} - ${toCount(objectiveControl?.right?.barons)} ${summary?.teams?.right?.name || "Dire"}`
  });

  rows.push({
    tone: Math.abs(toCount(momentum?.goldLead)) >= 3000 ? "good" : "neutral",
    title: "Economy pressure",
    detail: `Net worth lead ${signed(momentum?.goldLead)}.`
  });

  rows.push({
    tone: Math.abs(toCount(momentum?.towerDiff)) >= 3 ? "warn" : "neutral",
    title: "Tower map control",
    detail: `Tower diff ${signed(momentum?.towerDiff)}.`
  });

  return rows;
}

function buildStorylines(summary, momentum, leadTrend, objectiveControl) {
  const rows = [];
  const leftName = summary?.teams?.left?.name || "Radiant";
  const rightName = summary?.teams?.right?.name || "Dire";

  if (Math.abs(toCount(momentum?.goldLead)) >= 4000) {
    const leader = toCount(momentum?.goldLead) > 0 ? leftName : rightName;
    rows.push(`${leader} created a meaningful economy cushion.`);
  } else {
    rows.push("Economy remains contestable; one fight can flip the map.");
  }

  if (Math.abs(toCount(leadTrend?.largestSwing)) >= 3000) {
    rows.push(`Volatile game: largest gold swing reached ${Math.abs(toCount(leadTrend?.largestSwing)).toLocaleString()}.`);
  }

  rows.push(
    `Objective control ${leftName} ${Number(objectiveControl?.left?.controlPct || 50).toFixed(1)}% vs ${Number(
      objectiveControl?.right?.controlPct || 50
    ).toFixed(1)}% ${rightName}.`
  );

  return rows;
}

function buildTeamDraft(payload, heroMap, teamIds) {
  const rows = Array.isArray(payload?.picks_bans) ? payload.picks_bans : [];
  if (!rows.length) {
    return null;
  }

  const left = [];
  const right = [];
  const leftBans = [];
  const rightBans = [];

  for (const row of rows) {
    const hero = heroNameFromMap(heroMap, row?.hero_id);
    const order = toCount(row?.order);
    const team = Number(row?.team);
    const targetSide = team === 1 ? "right" : "left";

    if (row?.is_pick) {
      const target = targetSide === "left" ? left : right;
      target.push({
        role: "flex",
        champion: hero,
        name: `${targetSide === "left" ? "Radiant" : "Dire"} Pick ${target.length + 1}`,
        order,
        isPick: true
      });
    } else {
      const target = targetSide === "left" ? leftBans : rightBans;
      target.push({
        champion: hero,
        order,
        isPick: false
      });
    }
  }

  left.sort((a, b) => a.order - b.order);
  right.sort((a, b) => a.order - b.order);
  leftBans.sort((a, b) => a.order - b.order);
  rightBans.sort((a, b) => a.order - b.order);

  if (!left.length && !right.length) {
    return null;
  }

  return {
    left,
    right,
    leftBans,
    rightBans,
    leftTeamId: teamIds.left,
    rightTeamId: teamIds.right
  };
}

function buildTopPerformers(playerEconomy = [], limit = 6) {
  return playerEconomy
    .map((row) => ({
      ...row,
      kda: safeRatio(row.kills + row.assists, Math.max(1, row.deaths)),
      impactScore:
        row.kills * 2.2 +
        row.assists * 1.1 -
        row.deaths * 1.05 +
        row.goldEarned * 0.0016 +
        toCount(row.level) * 0.8
    }))
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, limit);
}

function buildObjectiveRuns(objectiveTimeline = [], teams = {}) {
  if (!Array.isArray(objectiveTimeline) || !objectiveTimeline.length) {
    return [];
  }

  const descending = objectiveTimeline
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
    teamName: run.team === "left" ? teams?.left?.name || "Radiant" : teams?.right?.name || "Dire",
    count: run.count,
    types: Array.from(run.types),
    startedAt: run.startedAt,
    endedAt: run.endedAt
  }));
}

function buildSelectedGameContext({
  selectedGameNumber,
  state,
  selectedSnapshot,
  objectiveTimeline,
  liveTicker,
  watchUrl,
  startedAt,
  duration,
  leftName,
  rightName,
  requestedMissing
}) {
  const tips = [];
  if (state === "inProgress") {
    tips.push("Track Roshan windows and buyback status before high-ground attempts.");
    tips.push("Watch kill trades plus net worth swings to spot momentum shifts.");
  } else if (state === "completed") {
    tips.push("Review Roshan and tower timing to understand map control conversion.");
  } else {
    tips.push("Draft and lane setup are key in the first 10 minutes.");
  }

  const sideSummary = [`${leftName} Radiant`, `${rightName} Dire`];

  return {
    number: selectedGameNumber,
    state,
    label:
      state === "inProgress"
        ? "Currently live."
        : state === "completed"
          ? "Completed game."
          : "Scheduled next.",
    telemetryStatus: state === "upcoming" ? "none" : "basic",
    telemetryCounts: {
      tickerEvents: Array.isArray(liveTicker) ? liveTicker.length : 0,
      objectiveEvents: Array.isArray(objectiveTimeline) ? objectiveTimeline.length : 0,
      combatBursts: 0,
      goldMilestones: 0
    },
    snapshot: selectedSnapshot,
    tips,
    sideSummary,
    watchUrl,
    watchOptions: watchUrl
      ? [
          {
            id: `watch_${selectedGameNumber}`,
            locale: "global",
            label: "OpenDota Match",
            shortLabel: "OpenDota",
            provider: "opendota",
            watchUrl,
            startedAt,
            startMillis: null,
            endMillis: null
          }
        ]
      : [],
    startedAt,
    durationMinutes: duration > 0 ? Number((duration / 60).toFixed(1)) : null,
    requestedMissing: Boolean(requestedMissing)
  };
}

function buildSeriesHeader(summary, seriesProgress, gameNavigation) {
  const leftName = summary?.teams?.left?.name || "Radiant";
  const rightName = summary?.teams?.right?.name || "Dire";
  const selectedGameNumber = gameNavigation?.selectedGameNumber;
  const selectedSuffix = Number.isInteger(selectedGameNumber) ? ` · Focus: Game ${selectedGameNumber}` : "";

  if (summary?.status === "upcoming") {
    return {
      headline: `${leftName} vs ${rightName}`,
      subhead: `Upcoming BO${seriesProgress?.bestOf || summary?.bestOf || 1}${selectedSuffix}`
    };
  }

  if (summary?.status === "completed") {
    const winnerName =
      summary?.winnerTeamId === summary?.teams?.left?.id
        ? leftName
        : summary?.winnerTeamId === summary?.teams?.right?.id
          ? rightName
          : null;

    return {
      headline: `${leftName} ${toCount(summary?.seriesScore?.left)} - ${toCount(summary?.seriesScore?.right)} ${rightName}`,
      subhead: `Series complete${selectedSuffix}`,
      winnerName
    };
  }

  return {
    headline: `${leftName} ${toCount(summary?.seriesScore?.left)} - ${toCount(summary?.seriesScore?.right)} ${rightName}`,
    subhead:
      `Live BO${seriesProgress?.bestOf || summary?.bestOf || 1}` +
      ` · Completed ${toCount(seriesProgress?.completedGames)}` +
      ` · Live ${toCount(seriesProgress?.inProgressGames)}${selectedSuffix}`
  };
}

function buildSeriesProjection(summary) {
  const bestOf = Number(summary?.bestOf || 1);
  const startTs = Date.parse(String(summary?.startAt || ""));
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

  const estimatedEndAt =
    startTs +
    bestOf * ESTIMATED_GAME_SECONDS * 1000 +
    Math.max(0, bestOf - 1) * ESTIMATED_BETWEEN_GAMES_SECONDS * 1000;

  return {
    matchStartAt: new Date(startTs).toISOString(),
    countdownSeconds: Math.max(0, Math.round((startTs - Date.now()) / 1000)),
    estimatedEndAt: new Date(estimatedEndAt).toISOString(),
    games
  };
}

function buildUpcomingWatch(summary, watchUrl) {
  return {
    venue: summary?.tournament || "Tournament stage",
    streamUrl: watchUrl || null,
    streamLabel: watchUrl ? "OpenDota Match Page" : "Official stream pending",
    language: "Global",
    status: summary?.status === "upcoming" ? "scheduled" : summary?.status
  };
}

function buildPreMatchInsights(summary, { seriesProjection, seriesGames, teamForm, headToHead, prediction } = {}) {
  const watchOptions = Array.isArray(seriesGames)
    ? seriesGames
        .flatMap((game) => (Array.isArray(game?.watchOptions) ? game.watchOptions : []))
        .map((option) => ({
          label: option?.label || "Watch",
          url: option?.watchUrl || null,
          note: option?.provider ? `Provider: ${option.provider}` : null
        }))
        .filter((option) => option.url)
    : [];

  return {
    essentials: {
      scheduledAt: summary?.startAt || null,
      countdownSeconds: Number.isFinite(seriesProjection?.countdownSeconds)
        ? seriesProjection.countdownSeconds
        : Math.max(0, Math.round((parseTimestamp(summary?.startAt, Date.now()) - Date.now()) / 1000)),
      estimatedEndAt: seriesProjection?.estimatedEndAt || null,
      bestOf: summary?.bestOf || 1,
      tournament: summary?.tournament || "Dota 2",
      region: summary?.region || "global"
    },
    watchOptions,
    teamForm,
    headToHead,
    prediction
  };
}

function buildTeamFormFromSeriesScore(summary) {
  const leftWins = toCount(summary?.seriesScore?.left);
  const rightWins = toCount(summary?.seriesScore?.right);

  return {
    left: {
      teamId: summary?.teams?.left?.id,
      teamName: summary?.teams?.left?.name,
      matches: Math.max(1, leftWins + rightWins),
      wins: leftWins,
      losses: rightWins,
      draws: 0,
      gameWins: leftWins,
      gameLosses: rightWins,
      seriesWinRatePct: leftWins + rightWins > 0 ? (leftWins / (leftWins + rightWins)) * 100 : 50,
      gameWinRatePct: leftWins + rightWins > 0 ? (leftWins / (leftWins + rightWins)) * 100 : 50,
      streakValue: 0,
      streakLabel: "n/a",
      formLabel: `${leftWins}-${rightWins}`,
      lastMatches: [],
      recentMatches: []
    },
    right: {
      teamId: summary?.teams?.right?.id,
      teamName: summary?.teams?.right?.name,
      matches: Math.max(1, leftWins + rightWins),
      wins: rightWins,
      losses: leftWins,
      draws: 0,
      gameWins: rightWins,
      gameLosses: leftWins,
      seriesWinRatePct: leftWins + rightWins > 0 ? (rightWins / (leftWins + rightWins)) * 100 : 50,
      gameWinRatePct: leftWins + rightWins > 0 ? (rightWins / (leftWins + rightWins)) * 100 : 50,
      streakValue: 0,
      streakLabel: "n/a",
      formLabel: `${rightWins}-${leftWins}`,
      lastMatches: [],
      recentMatches: []
    }
  };
}

function buildHeadToHead(summary) {
  return {
    leftTeamId: summary?.teams?.left?.id,
    rightTeamId: summary?.teams?.right?.id,
    sampleSize: 1,
    leftWins: toCount(summary?.seriesScore?.left),
    rightWins: toCount(summary?.seriesScore?.right),
    draws: 0,
    lastMeetings: []
  };
}

function buildPrediction(summary, momentum, status) {
  const leftName = summary?.teams?.left?.name || "Radiant";
  const rightName = summary?.teams?.right?.name || "Dire";

  if (status === "upcoming") {
    return {
      modelVersion: "dota-heuristic-v1",
      leftWinPct: 50,
      rightWinPct: 50,
      favoriteTeamName: "Even",
      confidence: "low",
      drivers: ["Awaiting current-series telemetry."]
    };
  }

  const leftPct = Math.max(5, Math.min(95, 50 + toCount(momentum?.goldLead) / 300));
  const rightPct = Number((100 - leftPct).toFixed(1));
  const roundedLeft = Number(leftPct.toFixed(1));

  return {
    modelVersion: "dota-heuristic-v1",
    leftWinPct: roundedLeft,
    rightWinPct: rightPct,
    favoriteTeamName: roundedLeft >= rightPct ? leftName : rightName,
    confidence: Math.abs(roundedLeft - rightPct) >= 18 ? "high" : Math.abs(roundedLeft - rightPct) >= 8 ? "medium" : "low",
    drivers: [
      `Gold lead ${signed(momentum?.goldLead)}`,
      `Kill diff ${signed(momentum?.killDiff)}`,
      `Objective pressure ${signed(momentum?.towerDiff)}`
    ]
  };
}

function buildCombatBursts(payload, teams, startedAt) {
  const rows = [];
  const radiantKills = toCount(payload?.radiant_score);
  const direKills = toCount(payload?.dire_score);

  if (radiantKills + direKills < 8) {
    return rows;
  }

  const winnerTeam = radiantKills >= direKills ? "left" : "right";
  const winnerTeamName = winnerTeam === "left" ? teams?.left?.name || "Radiant" : teams?.right?.name || "Dire";
  rows.push({
    id: "burst_1",
    title: `${winnerTeamName} hold the combat edge`,
    summary: `Kill score ${radiantKills}-${direKills}.`,
    importance: Math.abs(radiantKills - direKills) >= 8 ? "high" : "medium",
    occurredAt: startedAt,
    team: winnerTeam,
    winnerTeamName
  });

  return rows;
}

function buildGoldMilestones(goldLeadSeries, teams) {
  if (!Array.isArray(goldLeadSeries) || !goldLeadSeries.length) {
    return [];
  }

  const milestones = [2000, 4000, 6000, 8000, 10000];
  const rows = [];

  for (const point of goldLeadSeries) {
    const lead = toCount(point?.lead);
    const absLead = Math.abs(lead);
    const threshold = milestones.find((value) => absLead >= value);
    if (!threshold) {
      continue;
    }

    const team = lead > 0 ? "left" : lead < 0 ? "right" : null;
    const teamName =
      team === "left"
        ? teams?.left?.name || "Radiant"
        : team === "right"
          ? teams?.right?.name || "Dire"
          : "Neither side";

    if (rows.some((row) => row.team === team && row.threshold === threshold)) {
      continue;
    }

    rows.push({
      id: `gold_${team || "none"}_${threshold}`,
      team,
      teamName,
      threshold,
      title: `${teamName} reached ${threshold.toLocaleString()} lead`,
      summary: `Current lead ${signed(lead)} net worth.`,
      importance: threshold >= 6000 ? "high" : "medium",
      occurredAt: point.at
    });
  }

  return rows
    .sort((left, right) => parseTimestamp(right.occurredAt) - parseTimestamp(left.occurredAt))
    .slice(0, 10);
}

export function normalizeMatchDetail(
  payload,
  fallbackId,
  leagueTierMap = new Map(),
  heroMap = new Map(),
  { requestedGameNumber } = {}
) {
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

  const status = inferMatchState(payload);
  const startAtIso = toIsoFromSeconds(payload?.start_time);
  const endAtIso =
    status === "completed"
      ? toIsoFromSeconds((toFiniteNumber(payload?.start_time) || 0) + toCount(payload?.duration), Date.now())
      : null;
  const bestOf = normalizeSeriesType(payload?.series_type);
  const seriesScore = normalizeSeriesScore({
    leftWins: payload?.radiant_series_wins,
    rightWins: payload?.dire_series_wins,
    radiantWin: payload?.radiant_win
  });
  const winnerTeamId =
    typeof payload?.radiant_win === "boolean"
      ? payload.radiant_win
        ? leftTeamId
        : rightTeamId
      : null;

  const summary = {
    id: fallbackId || `dota_od_live_${providerMatchId}`,
    providerMatchId: String(providerMatchId),
    game: "dota2",
    region: "global",
    tournament: payload?.league?.name || payload?.league_name || "Dota 2 Pro",
    leagueId,
    competitiveTier,
    patch: payload?.patch ? String(payload.patch) : "unknown",
    status,
    startAt: startAtIso,
    endAt: endAtIso,
    bestOf,
    seriesScore,
    teams: {
      left: {
        id: leftTeamId,
        name: radiantName,
        kills: toCount(payload?.radiant_score)
      },
      right: {
        id: rightTeamId,
        name: direName,
        kills: toCount(payload?.dire_score)
      }
    },
    freshness: {
      source: "opendota",
      status: "healthy",
      updatedAt: new Date().toISOString()
    }
  };

  if (winnerTeamId) {
    summary.winnerTeamId = winnerTeamId;
  }

  const objectiveTimeline = buildObjectiveTimeline(payload, summary.teams);
  const objectiveBreakdown = buildObjectiveBreakdown(objectiveTimeline);
  const objectiveControl = buildObjectiveControl(payload, objectiveBreakdown);

  const playerEconomy = buildPlayerEconomy(payload, summary.teams, heroMap);
  const teamEconomyTotals = buildTeamEconomyTotals(playerEconomy);
  const selectedSnapshot = buildSelectedSnapshot(payload, objectiveControl, teamEconomyTotals);
  const goldLeadSeries = buildGoldLeadSeries(payload);
  const leadTrend = buildLeadTrend(goldLeadSeries);
  const momentum = buildMomentum(summary, selectedSnapshot, leadTrend);

  const currentGameNumber = inferCurrentGameNumber(seriesScore, status);
  const watchUrl = `https://www.opendota.com/matches/${providerMatchId}`;
  const focusedSelection = selectFocusedGame(
    buildSeriesGames({
      status,
      bestOf,
      seriesScore,
      currentGameNumber,
      startedAt: parseTimestamp(startAtIso),
      selectedGameNumber: parseRequestedGameNumber(requestedGameNumber),
      watchUrl,
      winnerTeamId
    }),
    requestedGameNumber
  );

  const selectedGameNumber = focusedSelection.game?.number || currentGameNumber;
  const seriesGames = buildSeriesGames({
    status,
    bestOf,
    seriesScore,
    currentGameNumber,
    startedAt: parseTimestamp(startAtIso),
    selectedGameNumber,
    watchUrl,
    winnerTeamId
  });
  const selectedSeriesGame =
    seriesGames.find((game) => Number(game.number) === Number(selectedGameNumber)) || seriesGames[0] || null;

  const liveTicker = buildLiveTicker({
    objectiveTimeline,
    goldLeadSeries,
    teams: summary.teams,
    selectedGameNumber,
    status,
    startAtIso
  });
  const keyMoments = buildKeyMoments({
    objectiveTimeline,
    goldLeadSeries,
    teams: summary.teams
  });

  const selectedGame = buildSelectedGameContext({
    selectedGameNumber,
    state: selectedSeriesGame?.state || (status === "live" ? "inProgress" : status === "completed" ? "completed" : "unstarted"),
    selectedSnapshot,
    objectiveTimeline,
    liveTicker,
    watchUrl,
    startedAt: startAtIso,
    duration: toCount(payload?.duration),
    leftName: summary.teams.left.name,
    rightName: summary.teams.right.name,
    requestedMissing: focusedSelection.requestedMissing
  });

  const gameNavigation = buildGameNavigation({
    seriesGames,
    selectedGame,
    requestedGameNumber,
    requestedMissing: focusedSelection.requestedMissing,
    selectedReason: focusedSelection.selectedReason
  });

  const seriesProgress = buildSeriesProgress(summary, seriesGames);
  const dataConfidence = buildDataConfidence(payload, playerEconomy, objectiveTimeline, goldLeadSeries);
  const pulseCard = buildPulseCard(summary, momentum, seriesProgress);
  const edgeMeter = buildEdgeMeter(summary, momentum, objectiveControl);
  const tempoSnapshot = buildTempoSnapshot(payload, objectiveTimeline, seriesGames);
  const tacticalChecklist = buildTacticalChecklist(summary, momentum, objectiveControl);
  const storylines = buildStorylines(summary, momentum, leadTrend, objectiveControl);
  const teamDraft = buildTeamDraft(payload, heroMap, {
    left: leftTeamId,
    right: rightTeamId
  });
  const allEconomyRows = [
    ...(Array.isArray(playerEconomy?.left) ? playerEconomy.left : []),
    ...(Array.isArray(playerEconomy?.right) ? playerEconomy.right : [])
  ];
  const topPerformers = buildTopPerformers(allEconomyRows);
  const objectiveRuns = buildObjectiveRuns(objectiveTimeline, summary.teams);
  const teamForm = buildTeamFormFromSeriesScore(summary);
  const headToHead = buildHeadToHead(summary);
  const prediction = buildPrediction(summary, momentum, status);
  const seriesProjection = buildSeriesProjection(summary);
  const preMatchInsights = buildPreMatchInsights(summary, {
    seriesProjection,
    seriesGames,
    teamForm,
    headToHead,
    prediction
  });
  const combatBursts = buildCombatBursts(payload, summary.teams, startAtIso);
  const goldMilestones = buildGoldMilestones(goldLeadSeries, summary.teams);

  const detail = {
    ...summary,
    timeline: objectiveTimeline.slice(-12).map((row) => ({
      at: row.gameTimeSeconds !== null ? `${Math.floor(row.gameTimeSeconds / 60)}:${String(row.gameTimeSeconds % 60).padStart(2, "0")}` : "--:--",
      type: row.type,
      label: row.label
    })),
    keyMoments,
    liveTicker,
    objectiveTimeline,
    objectiveControl,
    objectiveBreakdown,
    objectiveRuns,
    gameNavigation,
    selectedGame,
    seriesGames,
    seriesHeader: buildSeriesHeader(summary, seriesProgress, gameNavigation),
    seriesProgress,
    seriesProjection,
    dataConfidence,
    pulseCard,
    edgeMeter,
    tempoSnapshot,
    tacticalChecklist,
    storylines,
    teamDraft,
    playerEconomy,
    teamEconomyTotals,
    topPerformers,
    momentum,
    goldLeadSeries,
    leadTrend,
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
    watchGuide: buildUpcomingWatch(summary, watchUrl),
    teamForm,
    headToHead,
    prediction,
    preMatchInsights,
    matchupReadiness: null,
    matchupKeyFactors: [],
    matchupAlertLevel: null,
    matchupMeta: null,
    combatBursts,
    goldMilestones,
    liveAlerts: []
  };

  return detail;
}

export class OpenDotaProvider {
  constructor({ timeoutMs = 15000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.leagueTierCache = {
      fetchedAt: 0,
      map: new Map()
    };
    this.heroCache = {
      fetchedAt: 0,
      map: new Map()
    };
    this.teamDirectoryCache = {
      fetchedAt: 0,
      byId: new Map(),
      byKey: new Map()
    };
    this.teamMatchCache = new Map();
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

  async getHeroMap() {
    const ageMs = Date.now() - this.heroCache.fetchedAt;
    if (ageMs <= HERO_CACHE_MS && this.heroCache.map.size > 0) {
      return this.heroCache.map;
    }

    try {
      const heroes = await fetchJson(`${OPENDOTA_BASE_URL}/heroes`, {
        timeoutMs: this.timeoutMs
      });

      const map = new Map();
      if (Array.isArray(heroes)) {
        for (const hero of heroes) {
          const id = Number(hero?.id);
          if (!Number.isInteger(id) || id <= 0) {
            continue;
          }

          const name = String(hero?.localized_name || hero?.name || `Hero ${id}`).trim();
          if (!name) {
            continue;
          }

          map.set(id, name);
        }
      }

      this.heroCache = {
        fetchedAt: Date.now(),
        map
      };
    } catch {
      // Keep stale cache if available, otherwise return empty map.
    }

    return this.heroCache.map;
  }

  async getTeamDirectory() {
    const ageMs = Date.now() - this.teamDirectoryCache.fetchedAt;
    if (ageMs <= TEAM_DIRECTORY_CACHE_MS && this.teamDirectoryCache.byId.size > 0) {
      return this.teamDirectoryCache;
    }

    try {
      const rows = await fetchJson(`${OPENDOTA_BASE_URL}/teams`, {
        timeoutMs: this.timeoutMs
      });

      const byId = new Map();
      const byKey = new Map();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const teamId = Number(row?.team_id || 0);
          const name = String(row?.name || "").trim();
          const tag = String(row?.tag || "").trim();
          if (teamId <= 0 || !name) {
            continue;
          }

          const team = {
            id: String(teamId),
            name,
            tag: tag || null,
            logoUrl: row?.logo_url || null
          };
          byId.set(team.id, team);
          for (const key of buildTeamLookupKeys({ name, tag })) {
            if (!byKey.has(key)) {
              byKey.set(key, team);
            }
          }
        }
      }

      this.teamDirectoryCache = {
        fetchedAt: Date.now(),
        byId,
        byKey
      };
    } catch {
      // Keep stale cache if available, otherwise return empty maps.
    }

    return this.teamDirectoryCache;
  }

  async resolveTeamIdentityByName(teamName) {
    const normalizedDirect = normalizeProviderTeamKey(teamName);
    const normalizedSimplified = stripCommonTeamTerms(teamName);
    if (!normalizedDirect && !normalizedSimplified) {
      return null;
    }

    const directory = await this.getTeamDirectory();
    return (
      directory.byKey.get(normalizedDirect) ||
      directory.byKey.get(normalizedSimplified) ||
      null
    );
  }

  async fetchTeamMatchHistory(teamId, { maxRows = 40 } = {}) {
    const normalizedTeamId = String(teamId || "").trim();
    if (!/^\d+$/.test(normalizedTeamId)) {
      return [];
    }

    const cached = this.teamMatchCache.get(normalizedTeamId);
    if (cached && Date.now() - cached.fetchedAt <= TEAM_MATCH_CACHE_MS) {
      return cached.rows.slice(0, maxRows);
    }

    try {
      const rows = await fetchJson(`${OPENDOTA_BASE_URL}/teams/${normalizedTeamId}/matches`, {
        timeoutMs: this.timeoutMs
      });
      const normalizedRows = Array.isArray(rows) ? rows : [];
      this.teamMatchCache.set(normalizedTeamId, {
        fetchedAt: Date.now(),
        rows: normalizedRows
      });
      return normalizedRows.slice(0, maxRows);
    } catch {
      return cached ? cached.rows.slice(0, maxRows) : [];
    }
  }

  async fetchLiveMatches({ allowedTiers = [1, 2, 3, 4] } = {}) {
    const [liveRows, recentRows, leagueTierMap] = await Promise.all([
      fetchJson(`${OPENDOTA_BASE_URL}/live`, {
        timeoutMs: this.timeoutMs
      }),
      fetchJson(`${OPENDOTA_BASE_URL}/proMatches`, {
        timeoutMs: this.timeoutMs
      }),
      this.getLeagueTierMap()
    ]);

    const normalizedLive = Array.isArray(liveRows)
      ? liveRows.map((row) => normalizeLiveMatch(row, leagueTierMap)).filter(Boolean)
      : [];
    const derivedSeriesLive = buildSeriesSummaries(recentRows, leagueTierMap).filter(
      (row) => row.status === "live"
    );
    const byId = new Map();

    for (const row of derivedSeriesLive) {
      const matchingLiveRow = findMatchingLiveRowForSeries(row, liveRows);
      byId.set(row.id, matchingLiveRow
        ? {
            ...row,
            sourceMatchId: String(rowMatchId(matchingLiveRow) || row.sourceMatchId || ""),
            updatedAt: toIsoFromSeconds(rowUpdatedSeconds(matchingLiveRow), Date.now()),
            keySignal: "provider_series_live"
          }
        : row);
    }

    for (const row of normalizedLive) {
      byId.set(row.id, row);
    }

    return Array.from(byId.values()).filter((row) =>
      hasTierAllowed(row.competitiveTier, allowedTiers)
    );
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

    return buildSeriesSummaries(rows, leagueTierMap)
      .filter((row) => row.status === "completed")
      .filter((row) => hasTierAllowed(row.competitiveTier, allowedTiers))
      .slice(0, maxRows)
  }

  async fetchMatchDetail(matchId, { gameNumber } = {}) {
    if (String(matchId || "").startsWith("dota_od_series_")) {
      const seriesId = Number.parseInt(String(parseProviderMatchId(matchId) || ""), 10);
      if (!Number.isInteger(seriesId) || seriesId <= 0) {
        return null;
      }

      const [recentRows, liveRows, leagueTierMap, heroMap] = await Promise.all([
        fetchJson(`${OPENDOTA_BASE_URL}/proMatches`, {
          timeoutMs: this.timeoutMs
        }),
        fetchJson(`${OPENDOTA_BASE_URL}/live`, {
          timeoutMs: this.timeoutMs
        }).catch(() => []),
        this.getLeagueTierMap(),
        this.getHeroMap()
      ]);

      const seriesRows = Array.isArray(recentRows)
        ? recentRows.filter((row) => rowSeriesId(row) === seriesId)
        : [];
      const summary = summarizeSeriesRows(seriesRows, leagueTierMap);
      if (!summary) {
        return null;
      }

      const matchingLiveRow = findMatchingLiveRowForSeries(summary, liveRows);
      const mergedRows = seriesRows.slice();
      if (matchingLiveRow) {
        const liveMatchId = rowMatchId(matchingLiveRow);
        if (liveMatchId && !mergedRows.some((row) => rowMatchId(row) === liveMatchId)) {
          mergedRows.push(matchingLiveRow);
        }
      }

      const initialGamesState = buildSeriesGamesFromRows(summary, mergedRows, {});
      const focusedSelection = selectFocusedGame(initialGamesState.games, gameNumber);
      const selectedGameNumber = focusedSelection.game?.number || initialGamesState.currentGameNumber;
      const seriesGamesState = buildSeriesGamesFromRows(summary, mergedRows, {
        selectedGameNumber
      });
      const seriesGames = seriesGamesState.games;
      const selectedSeriesGame =
        seriesGames.find((game) => Number(game?.number) === Number(selectedGameNumber)) || seriesGames[0] || null;

      let mapDetail = null;
      if (selectedSeriesGame?.sourceMatchId) {
        try {
          const payload = await fetchJson(`${OPENDOTA_BASE_URL}/matches/${selectedSeriesGame.sourceMatchId}`, {
            timeoutMs: this.timeoutMs
          });
          mapDetail = normalizeMatchDetail(
            payload,
            `dota_od_live_${selectedSeriesGame.sourceMatchId}`,
            leagueTierMap,
            heroMap,
            {
              requestedGameNumber: selectedGameNumber
            }
          );
        } catch {
          mapDetail = null;
        }
      }

      return buildSeriesDetail({
        matchId,
        summary,
        mapDetail,
        seriesGames,
        selectedGameNumber,
        requestedGameNumber: gameNumber,
        requestedMissing: focusedSelection.requestedMissing,
        selectedReason: focusedSelection.selectedReason
      });
    }

    const providerMatchId = parseProviderMatchId(matchId);
    if (!providerMatchId) {
      return null;
    }

    const [payload, leagueTierMap, heroMap] = await Promise.all([
      fetchJson(`${OPENDOTA_BASE_URL}/matches/${providerMatchId}`, {
        timeoutMs: this.timeoutMs
      }),
      this.getLeagueTierMap(),
      this.getHeroMap()
    ]);

    return normalizeMatchDetail(payload, matchId, leagueTierMap, heroMap, {
      requestedGameNumber: gameNumber
    });
  }
}
