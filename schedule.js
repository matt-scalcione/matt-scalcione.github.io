import { resolveInitialApiBase } from "./api-config.js";
import { applyRouteContext, buildMatchUrl } from "./routes.js?v=20260309c";
import {
  buildCollectionFallbackSummary,
  buildRowDataProvenance,
  buildRowQualityNotice
} from "./data-provenance.js?v=20260310a";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  buildCanonicalPath,
  gameLabel,
  inferRobotsDirective,
  normalizeGameKey,
  setJsonLd,
  toAbsoluteSiteUrl
} from "./seo.js";
import { resolveLocalTeamCode, resolveLocalTeamLogo } from "./team-logos.js";
import { tableSkeletonMarkup } from "./loading.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_API_TIMEOUT_MS = 8000;
const MOBILE_BREAKPOINT = 760;
const TEAM_SHORT_NAMES = {
  "cloud9 kia": "C9",
  "cloud9": "C9",
  "team liquid honda": "Liquid",
  "team liquid": "Liquid",
  "gen.g esports": "Gen.G",
  "hanwha life esports": "HLE",
  "dplus kia": "DK",
  "kt rolster": "KT",
  "nongshim redforce": "NS",
  "liiv sandbox": "LSB",
  "g2 esports": "G2",
  "karmine corp": "KC",
  "mad lions koi": "MAD",
  "movistar koi": "KOI",
  "team bds": "BDS",
  "team vitality": "VIT",
  "th team heretics": "TH",
  "bilibili gaming": "BLG",
  "top esports": "TES",
  "jd gaming": "JDG",
  "lng esports": "LNG",
  "weibo gaming": "WBG",
  "edward gaming": "EDG",
  "invictus gaming": "iG",
  "funplus phoenix": "FPX",
  "anyone's legend": "AL",
  "ninjas in pyjamas": "NIP",
  "red canids kalunga": "RED",
  "red canids": "RED",
  "royal never give up": "RNG",
  "team we": "WE",
  "ultra prime": "UP",
  "lgd gaming": "LGD",
  "rare atom": "RA",
  "thundertalk gaming": "TT",
  "gaimin gladiators": "GG",
  "team spirit": "Spirit",
  "team falcons": "Falcons",
  "betboom team": "BetBoom",
  "tundra esports": "Tundra",
  "shopify rebellion": "SR",
  "aurora gaming": "Aurora",
  "nouns esports": "Nouns",
  "psg.quest": "Quest",
  "xtreme gaming": "XG",
  "azure ray": "AR",
  entity: "Entity",
  "nigma galaxy": "Nigma",
  "virtus.pro": "VP",
  "team secret": "Secret",
  "evil geniuses": "EG",
  "boom esports": "BOOM",
  "blacklist international": "BLCK",
  "talon esports": "Talon",
  "natus vincere": "NAVI"
};

const elements = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  slateSearchInput: document.querySelector("#slateSearchInput"),
  gameSelect: document.querySelector("#gameSelect"),
  dateFromInput: document.querySelector("#dateFromInput"),
  dateToInput: document.querySelector("#dateToInput"),
  scheduleRangePresets: Array.from(document.querySelectorAll("#scheduleRangePresets [data-range]")),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  lolHubNav: document.querySelector("#lolHubNav"),
  dotaHubNav: document.querySelector("#dotaHubNav"),
  mobileLiveNav: document.querySelector("#mobileLiveNav"),
  mobileScheduleNav: document.querySelector("#mobileScheduleNav"),
  mobileFollowsNav: document.querySelector("#mobileFollowsNav"),
  statusText: document.querySelector("#statusText"),
  scheduleMeta: document.querySelector("#scheduleMeta"),
  resultsMeta: document.querySelector("#resultsMeta"),
  scheduleSection: document.querySelector("#scheduleSection"),
  resultsSection: document.querySelector("#resultsSection"),
  scheduleTableWrap: document.querySelector("#scheduleTableWrap"),
  resultsTableWrap: document.querySelector("#resultsTableWrap")
};
const scheduleCollectionState = {
  scheduleMeta: null,
  resultsMeta: null,
  scheduleRows: [],
  resultRows: []
};
const scheduleDiscoveryState = {
  searchTerm: ""
};
let activeLoadRequestId = 0;
let resultsRetryHandle = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const SCHEDULE_RANGE_PRESETS = {
  live: { pastHours: 12, futureHours: 18 },
  "24h": { pastHours: 0, futureHours: 24 },
  "3d": { pastHours: 0, futureHours: 72 },
  "7d": { pastHours: 0, futureHours: 168 }
};
const SCHEDULE_OVERDUE_GRACE_MS = 15 * 60 * 1000;

function selectedTitleKey() {
  return normalizeGameKey(elements.gameSelect?.value || "");
}

function refreshScheduleSeo() {
  const titleKey = selectedTitleKey();
  const titlePrefix = titleKey ? `${gameLabel(titleKey)} ` : "";
  const viewLabel = "Schedule & Results";
  const pageTitle = `${titlePrefix}${viewLabel} | Pulseboard`;
  const pageDescription = titleKey
    ? `${viewLabel} for ${gameLabel(titleKey)} series on Pulseboard, with fast match access and state-aware context.`
    : "Upcoming schedule and completed results for League of Legends and Dota 2 series on Pulseboard.";
  const canonicalPath = buildCanonicalPath({
    pathname: "/schedule.html",
    allowedQueryParams: []
  });
  const robots = inferRobotsDirective({
    allowedQueryParams: ["title", "game"]
  });

  applySeo({
    title: pageTitle,
    description: pageDescription,
    canonicalPath,
    robots
  });
  setJsonLd(
    "page-breadcrumb",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", path: "/index.html" },
      { name: "Schedule & Results", path: canonicalPath }
    ])
  );
}

function readApiBase() {
  return resolveInitialApiBase();
}

function dateTimeLabel(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function dateTimeCompact(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return String(iso || "");
    }

    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return String(iso || "");
  }
}

function scheduleTimestamp(iso) {
  const parsed = Date.parse(String(iso || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function seriesScoreLabel(row, type) {
  const left = Number(row?.seriesScore?.left ?? 0);
  const right = Number(row?.seriesScore?.right ?? 0);
  const status = String(row?.status || "").toLowerCase();
  const hasPlayed = left > 0 || right > 0;

  if (type === "scheduled" && !hasPlayed && status !== "live") {
    return "—";
  }

  return `${left}-${right}`;
}

function normalizeTeamKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function teamNameValue(teamOrName) {
  if (teamOrName && typeof teamOrName === "object") {
    return String(teamOrName.name || "").trim();
  }
  return String(teamOrName || "").trim();
}

function teamCodeValue(teamOrName, game = null) {
  return resolveLocalTeamCode({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: teamNameValue(teamOrName),
    code: teamOrName && typeof teamOrName === "object" ? teamOrName.code : null
  });
}

function teamLogoUrl(teamOrName, game = null) {
  return resolveLocalTeamLogo({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: teamNameValue(teamOrName)
  });
}

function shortTeamName(teamOrName, game = null) {
  const raw = teamNameValue(teamOrName);
  if (!raw) {
    return "TBD";
  }

  const providerCode = teamCodeValue(teamOrName, game);
  if (providerCode && providerCode.length <= 6) {
    return providerCode;
  }

  const mapped = TEAM_SHORT_NAMES[normalizeTeamKey(raw)];
  if (mapped) {
    return mapped;
  }

  const stripped = raw
    .replace(/\b(Esports?|E-Sports?|Gaming|Club|Kia|Honda)\b/gi, "")
    .replace(/\bTeam\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length >= 3) {
    return stripped;
  }

  return raw;
}

function scheduleBadgeToken(teamOrName, game = null) {
  const short = shortTeamName(teamOrName, game);
  if (short.length <= 4) {
    return short;
  }

  const tokens = short.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return tokens
      .slice(0, 3)
      .map((token) => token[0])
      .join("")
      .toUpperCase();
  }

  return short.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
}

function scheduleBadgeMarkup(team, game = null) {
  const logo = teamLogoUrl(team, game);
  const label = teamNameValue(team) || "Team";
  if (logo) {
    return `<span class="schedule-card-badge has-logo"><img src="${logo}" alt="${label} logo" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="schedule-card-badge">${scheduleBadgeToken(team, game)}</span>`;
}

function timeOnlyLabel(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return String(iso || "");
    }

    return parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return String(iso || "");
  }
}

function scheduleDayKey(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return String(iso || "");
    }

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  } catch {
    return String(iso || "");
  }
}

function scheduleDayLabel(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return String(iso || "");
    }

    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const deltaDays = Math.round((target - startToday) / 86_400_000);

    if (deltaDays === 0) return "Today";
    if (deltaDays === 1) return "Tomorrow";
    if (deltaDays === -1) return "Yesterday";

    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  } catch {
    return String(iso || "");
  }
}

function groupRowsByDay(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = scheduleDayKey(row?.startAt);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: scheduleDayLabel(row?.startAt),
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  }
  return Array.from(groups.values());
}

function scheduleCardState(row, type) {
  return String(row?.status || (type === "result" ? "completed" : "upcoming")).toLowerCase();
}

function isOverdueScheduledRow(row, type, nowMs = Date.now()) {
  if (type === "result") {
    return false;
  }

  const state = scheduleCardState(row, type);
  if (state === "live" || state === "completed") {
    return false;
  }

  const startMs = scheduleTimestamp(row?.startAt);
  return startMs !== null && nowMs > startMs + SCHEDULE_OVERDUE_GRACE_MS;
}

function scheduleDisplayState(row, type) {
  if (type === "result") {
    return "completed";
  }

  if (scheduleCardState(row, type) === "live") {
    return "live";
  }

  return isOverdueScheduledRow(row, type) ? "overdue" : "upcoming";
}

function scheduleCardStatusLabel(row, type) {
  if (type === "result") return "FINAL";
  if (row?.status === "live") return "LIVE";
  return isOverdueScheduledRow(row, type) ? "OVERDUE" : "SCHEDULED";
}

function scheduleCardContext(row, type, scoreLabel, winnerName) {
  const formatLabel = `BO${Math.max(1, Number(row?.bestOf || 1))}`;
  const hasSeriesScore = scoreLabel !== "—";

  if (type === "result") {
    return {
      format: formatLabel,
      note: winnerName ? `${winnerName} won` : hasSeriesScore ? `${scoreLabel} final` : "Final"
    };
  }

  if (row?.status === "live") {
    return {
      format: formatLabel,
      note: hasSeriesScore ? `${scoreLabel} in series` : "Series live"
    };
  }

  if (isOverdueScheduledRow(row, type)) {
    return {
      format: formatLabel,
      note: "Start time passed; waiting for live update"
    };
  }

  return {
    format: formatLabel,
    note: "Upcoming series"
  };
}

function scheduleCardFooter(row, type, winnerName) {
  const tournament = row?.tournament || gameLabel(row?.game) || "Tournament";
  const formatLabel = `BO${Math.max(1, Number(row?.bestOf || 1))}`;

  if (type === "result") {
    return {
      primary: tournament,
      secondary: winnerName ? `Winner ${winnerName}` : "Final"
    };
  }

  if (row?.status === "live") {
    return {
      primary: tournament,
      secondary: `${formatLabel} · live now`
    };
  }

  if (isOverdueScheduledRow(row, type)) {
    return {
      primary: tournament,
      secondary: `${formatLabel} · start overdue`
    };
  }

  return {
    primary: tournament,
    secondary: formatLabel
  };
}

function scheduleDisplayPriority(row, type) {
  const state = scheduleDisplayState(row, type);
  if (state === "live") return 0;
  if (state === "overdue") return 1;
  if (state === "upcoming") return 2;
  return 3;
}

function sortRowsForDisplay(rows = [], type) {
  if (type === "result") {
    return rows.slice();
  }

  return rows
    .slice()
    .sort((left, right) => {
      const priorityDelta = scheduleDisplayPriority(left, type) - scheduleDisplayPriority(right, type);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftStart = scheduleTimestamp(left?.startAt) ?? Number.POSITIVE_INFINITY;
      const rightStart = scheduleTimestamp(right?.startAt) ?? Number.POSITIVE_INFINITY;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
}

function gameChipMarkup(game) {
  const normalized = String(game || "").toLowerCase();
  if (normalized === "lol") {
    return `<span class="game-chip lol" title="League of Legends">L</span>`;
  }

  if (normalized === "dota2") {
    return `<span class="game-chip dota2" title="Dota 2">D</span>`;
  }

  return `<span class="game-chip">${String(game || "?").slice(0, 1).toUpperCase()}</span>`;
}

function toLocalInputValue(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function parseLocalInputToIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function buildQuery() {
  const params = new URLSearchParams();
  const game = elements.gameSelect?.value || "";
  const dateFromIso = parseLocalInputToIso(elements.dateFromInput.value);
  const dateToIso = parseLocalInputToIso(elements.dateToInput.value);

  if (game) params.set("game", game);
  if (dateFromIso) params.set("date_from", dateFromIso);
  if (dateToIso) params.set("date_to", dateToIso);

  return params.toString();
}

function presetWindow(rangeKey, baseDate = new Date()) {
  const preset = SCHEDULE_RANGE_PRESETS[rangeKey];
  if (!preset) {
    return null;
  }

  return {
    start: new Date(baseDate.getTime() - preset.pastHours * 60 * 60 * 1000),
    end: new Date(baseDate.getTime() + preset.futureHours * 60 * 60 * 1000)
  };
}

function scheduleRangeMatches(rangeKey) {
  const preset = presetWindow(rangeKey);
  if (!preset) {
    return false;
  }

  const fromIso = parseLocalInputToIso(elements.dateFromInput?.value || "");
  const toIso = parseLocalInputToIso(elements.dateToInput?.value || "");
  if (!fromIso || !toIso) {
    return false;
  }

  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();
  const presetFromMs = preset.start.getTime();
  const presetToMs = preset.end.getTime();
  const toleranceMs = 5 * 60 * 1000;

  return Math.abs(fromMs - presetFromMs) <= toleranceMs && Math.abs(toMs - presetToMs) <= toleranceMs;
}

function syncScheduleRangePresetState() {
  if (!Array.isArray(elements.scheduleRangePresets)) {
    return;
  }

  for (const button of elements.scheduleRangePresets) {
    const active = scheduleRangeMatches(button.getAttribute("data-range") || "");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function applyScheduleRangePreset(rangeKey, options = {}) {
  const preset = presetWindow(rangeKey);
  if (!preset || !elements.dateFromInput || !elements.dateToInput) {
    return;
  }

  elements.dateFromInput.value = toLocalInputValue(preset.start);
  elements.dateToInput.value = toLocalInputValue(preset.end);
  syncScheduleRangePresetState();
  if (options.load !== false) {
    loadCollections();
  }
}

function rowLink(id) {
  return buildMatchUrl({ matchId: id });
}

function isCompactViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function updateNav() {
  const apiBase = elements.apiBaseInput?.value.trim() || null;
  const liveUrl = applyRouteContext(new URL("./index.html", window.location.href), { apiBase });
  const scheduleUrl = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase });
  const followsUrl = applyRouteContext(new URL("./follows.html", window.location.href), { apiBase });
  const lolHubUrl = applyRouteContext(new URL("./lol.html", window.location.href), { apiBase });
  const dotaHubUrl = applyRouteContext(new URL("./dota2.html", window.location.href), { apiBase });

  if (elements.liveDeskNav) elements.liveDeskNav.href = liveUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = liveUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolHubUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaHubUrl.toString();
}

function setStatus(message, tone = "neutral") {
  if (!elements.statusText) {
    return;
  }
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function scheduleMetaText(meta, kind, rows = []) {
  const count = Number(meta?.count || 0);
  const generatedAt = meta?.generatedAt || null;
  const fallbackSummary = buildCollectionFallbackSummary(rows, {
    game: "dota2",
    label: "Dota"
  });
  if (isCompactViewport()) {
    const noun = kind === "results"
      ? count === 1 ? "result" : "results"
      : count === 1 ? "match" : "matches";
    return [count > 0 ? `${count} ${noun}` : `0 ${noun}`, generatedAt ? timeOnlyLabel(generatedAt) : null, fallbackSummary.text ? "Snapshot mode" : null]
      .filter(Boolean)
      .join(" · ");
  }

  return `Showing ${count} matches · Updated ${generatedAt ? dateTimeCompact(generatedAt) : "n/a"}${fallbackSummary.text ? ` · ${fallbackSummary.text}` : ""}`;
}

function renderScheduleCollectionMeta() {
  if (elements.scheduleMeta && scheduleCollectionState.scheduleMeta) {
    elements.scheduleMeta.textContent = scheduleMetaText(
      scheduleCollectionState.scheduleMeta,
      "schedule",
      scheduleCollectionState.scheduleRows
    );
  }
  if (elements.resultsMeta && scheduleCollectionState.resultsMeta) {
    elements.resultsMeta.textContent = scheduleMetaText(
      scheduleCollectionState.resultsMeta,
      "results",
      scheduleCollectionState.resultRows
    );
  }
}

function matchesSlateSearch(row, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    row?.teams?.left?.name,
    row?.teams?.right?.name,
    row?.tournament,
    row?.region,
    row?.game
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalized);
}

function applySlateFilters(rows = []) {
  return rows.filter((row) => matchesSlateSearch(row, scheduleDiscoveryState.searchTerm));
}

function renderLoadingTable(container) {
  container.innerHTML = tableSkeletonMarkup({ rows: 5, columns: 5 });
}

function groupRowsByTournament(rows = []) {
  const groups = new Map();

  for (const row of rows) {
    const game = normalizeGameKey(row?.game) || String(row?.game || "").toLowerCase() || "unknown";
    const tournament = String(row?.tournament || gameLabel(row?.game) || "Tournament").trim() || "Tournament";
    const key = `${game}::${tournament.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        game,
        tournament,
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  }

  return Array.from(groups.values());
}

function scheduleEventMetaLabel(group, type) {
  const regions = Array.from(
    new Set(
      group.rows
        .map((row) => String(row?.region || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
  const count = group.rows.length;
  const countLabel =
    type === "result"
      ? `${count} ${count === 1 ? "final" : "finals"}`
      : `${count} ${count === 1 ? "match" : "matches"}`;
  const liveCount =
    type === "scheduled"
      ? group.rows.filter((row) => scheduleDisplayState(row, type) === "live").length
      : 0;
  const parts = [];

  if (regions.length === 1) {
    parts.push(regions[0]);
  } else if (regions.length > 1) {
    parts.push(`${regions.length} regions`);
  }

  parts.push(countLabel);

  if (liveCount > 0) {
    parts.push(`${liveCount} live`);
  }

  return parts.join(" · ");
}

function renderScheduleBoardRow(row, type) {
  const detailUrl = rowLink(row.id);
  const leftName = teamNameValue(row.teams.left) || "Team A";
  const rightName = teamNameValue(row.teams.right) || "Team B";
  const leftBadge = scheduleBadgeMarkup(row.teams.left, row.game);
  const rightBadge = scheduleBadgeMarkup(row.teams.right, row.game);
  const winnerLong =
    row.winnerTeamId === row.teams.left.id
      ? row.teams.left.name
      : row.winnerTeamId === row.teams.right.id
        ? row.teams.right.name
        : null;
  const scoreLabel = seriesScoreLabel(row, type);
  const statusLabel = scheduleCardStatusLabel(row, type);
  const stateClass = scheduleDisplayState(row, type);
  const context = scheduleCardContext(row, type, scoreLabel, winnerLong);
  const footer = scheduleCardFooter(row, type, winnerLong);
  const showSeriesScore = type === "result" || row?.status === "live" || scoreLabel !== "—";
  const leftSeriesScore = Number(row?.seriesScore?.left ?? 0);
  const rightSeriesScore = Number(row?.seriesScore?.right ?? 0);
  const provenance = buildRowDataProvenance(row);
  const qualityNotice = buildRowQualityNotice(row);
  const boardNote = type === "result" ? footer.secondary : context.note;

  return `
    <a class="schedule-board-row schedule-${stateClass}" href="${detailUrl}" aria-label="Open ${leftName} vs ${rightName}">
      <div class="schedule-board-time">
        <span class="schedule-board-time-main">${timeOnlyLabel(row.startAt)}</span>
      </div>
      <div class="schedule-board-matchup">
        <div class="schedule-board-team">
          <span class="schedule-board-team-main">
            ${leftBadge}
            <span class="schedule-board-team-name">${escapeHtml(leftName)}</span>
          </span>
          ${showSeriesScore ? `<span class="schedule-board-team-score">${leftSeriesScore}</span>` : ""}
        </div>
        <div class="schedule-board-team">
          <span class="schedule-board-team-main">
            ${rightBadge}
            <span class="schedule-board-team-name">${escapeHtml(rightName)}</span>
          </span>
          ${showSeriesScore ? `<span class="schedule-board-team-score">${rightSeriesScore}</span>` : ""}
        </div>
      </div>
      <div class="schedule-board-series">
        <div class="schedule-board-chip-row">
          <span class="schedule-board-format">${escapeHtml(context.format)}</span>
          ${row?.region ? `<span class="schedule-board-chip">${escapeHtml(String(row.region).toUpperCase())}</span>` : ""}
          <span class="pill ${stateClass} schedule-board-status">${escapeHtml(statusLabel)}</span>
        </div>
        <p class="schedule-board-note">${escapeHtml(boardNote)}</p>
      </div>
      <div class="schedule-board-meta">
        ${provenance.text
          ? `<span class="data-provenance-line ${provenance.tone} schedule-board-tag" title="${escapeHtml(provenance.title)}">${escapeHtml(provenance.text)}</span>`
          : ""}
        ${qualityNotice.text
          ? `<span class="data-quality-line ${qualityNotice.tone} schedule-board-tag" title="${escapeHtml(qualityNotice.title)}">${escapeHtml(qualityNotice.text)}</span>`
          : ""}
      </div>
    </a>
  `;
}

function renderGroupedScheduleMarkup(rows, type) {
  return groupRowsByDay(rows)
    .map((dayGroup) => {
      const eventGroups = groupRowsByTournament(dayGroup.rows)
        .map((eventGroup) => {
          const eventMeta = scheduleEventMetaLabel(eventGroup, type);
          const rowsMarkup = eventGroup.rows.map((row) => renderScheduleBoardRow(row, type)).join("");

          return `
            <section class="schedule-event-group">
              <div class="schedule-event-head">
                <div class="schedule-event-title-row">
                  <span class="schedule-event-game" title="${escapeHtml(gameLabel(eventGroup.game))}">${gameChipMarkup(eventGroup.game)}</span>
                  <div class="schedule-event-copy">
                    <p class="schedule-event-title">${escapeHtml(eventGroup.tournament)}</p>
                    <p class="schedule-event-subtitle">${escapeHtml(eventMeta)}</p>
                  </div>
                </div>
                <span class="schedule-event-count">${eventGroup.rows.length}</span>
              </div>
              <div class="schedule-event-list">${rowsMarkup}</div>
            </section>
          `;
        })
        .join("");

      return `
        <section class="schedule-day-group">
          <div class="schedule-day-label">
            <span>${dayGroup.label}</span>
            <span class="schedule-day-count">${dayGroup.rows.length}</span>
          </div>
          <div class="schedule-event-groups">${eventGroups}</div>
        </section>
      `;
    })
    .join("");
}

function renderTable(container, rows, type) {
  if (!rows.length) {
    let message = type === "scheduled"
      ? "No scheduled matches in this window."
      : "No completed matches in this window.";
    if (scheduleDiscoveryState.searchTerm) {
      message = type === "scheduled"
        ? `No scheduled matches match "${scheduleDiscoveryState.searchTerm}".`
        : `No results match "${scheduleDiscoveryState.searchTerm}".`;
    }
    container.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  container.innerHTML = `<div class="schedule-board-groups">${renderGroupedScheduleMarkup(rows, type)}</div>`;
}

function renderCollectionsFromState() {
  const filteredSchedule = sortRowsForDisplay(
    applySlateFilters(scheduleCollectionState.scheduleRows),
    "scheduled"
  );
  const filteredResults = sortRowsForDisplay(
    applySlateFilters(scheduleCollectionState.resultRows),
    "result"
  );

  renderTable(elements.scheduleTableWrap, filteredSchedule, "scheduled");
  renderTable(elements.resultsTableWrap, filteredResults, "result");

  if (elements.scheduleTableWrap) {
    elements.scheduleTableWrap.dataset.loaded = "1";
  }
  if (elements.resultsTableWrap) {
    elements.resultsTableWrap.dataset.loaded = "1";
  }

  if (elements.scheduleSection) {
    elements.scheduleSection.hidden = false;
  }
  if (elements.resultsSection) {
    elements.resultsSection.hidden = false;
    elements.resultsSection.classList.add("top-space");
  }
}

function applyScheduleStructuredData(scheduleRows = [], resultRows = []) {
  const allRows = [...scheduleRows, ...resultRows].slice(0, 20);
  if (!allRows.length) {
    setJsonLd("schedule-itemlist", null);
    return;
  }

  const items = allRows.map((row, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: toAbsoluteSiteUrl(`/match.html?id=${encodeURIComponent(String(row?.id || ""))}`),
    name: `${row?.teams?.left?.name || "Team A"} vs ${row?.teams?.right?.name || "Team B"}`
  }));

  setJsonLd("schedule-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Pulseboard Schedule and Results",
    itemListElement: items
  });
}

async function fetchCollection(apiBase, endpoint, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBase}${endpoint}${query ? `?${query}` : ""}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        endpoint === "/v1/results" ? "Results request timed out." : "Schedule request timed out."
      );
      timeoutError.code = "timeout";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function clearResultsRetry() {
  if (resultsRetryHandle) {
    window.clearTimeout(resultsRetryHandle);
    resultsRetryHandle = null;
  }
}

function scheduleResultsRetry(requestId, apiBase, query) {
  clearResultsRetry();
  resultsRetryHandle = window.setTimeout(async () => {
    try {
      const payload = await fetchCollection(apiBase, "/v1/results", query);
      if (requestId !== activeLoadRequestId) {
        return;
      }

      scheduleCollectionState.resultRows = Array.isArray(payload.data) ? payload.data : [];
      scheduleCollectionState.resultsMeta = payload.meta || null;
      renderScheduleCollectionMeta();
      renderCollectionsFromState();
      applyScheduleStructuredData(
        scheduleCollectionState.scheduleRows,
        scheduleCollectionState.resultRows
      );
      setStatus("Schedule and results synced.", "success");
    } catch (error) {
      if (requestId !== activeLoadRequestId) {
        return;
      }
      if (!scheduleCollectionState.resultRows.length && elements.resultsTableWrap) {
        elements.resultsTableWrap.innerHTML = `<div class="empty">Results are temporarily unavailable.</div>`;
      }
      if (elements.resultsMeta) {
        elements.resultsMeta.textContent = "Results unavailable right now.";
      }
      setStatus("Partial sync. Results feed was unavailable.", "error");
    } finally {
      resultsRetryHandle = null;
    }
  }, 1200);
}

async function loadCollections() {
  const requestId = ++activeLoadRequestId;
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const query = buildQuery();
  clearResultsRetry();
  try {
    localStorage.setItem("pulseboard.apiBase", apiBase);
  } catch {
    // Ignore storage failures in private mode.
  }
  updateNav();

  try {
    if (elements.scheduleTableWrap?.dataset.loaded !== "1") {
      renderLoadingTable(elements.scheduleTableWrap);
    }
    if (elements.resultsTableWrap?.dataset.loaded !== "1") {
      renderLoadingTable(elements.resultsTableWrap);
    }
    setStatus("Loading schedule and results...", "loading");
    const [scheduleResult, resultsResult] = await Promise.allSettled([
      fetchCollection(apiBase, "/v1/schedule", query),
      fetchCollection(apiBase, "/v1/results", query)
    ]);

    if (requestId !== activeLoadRequestId) {
      return;
    }

    const scheduleOk = scheduleResult.status === "fulfilled";
    const resultsOk = resultsResult.status === "fulfilled";

    if (scheduleOk) {
      const schedulePayload = scheduleResult.value;
      const scheduleRows = Array.isArray(schedulePayload.data) ? schedulePayload.data : [];
      scheduleCollectionState.scheduleRows = scheduleRows;
      scheduleCollectionState.scheduleMeta = schedulePayload.meta || null;
    } else if (elements.scheduleTableWrap?.dataset.loaded !== "1") {
      elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
      scheduleCollectionState.scheduleMeta = null;
    }

    if (resultsOk) {
      const resultsPayload = resultsResult.value;
      const resultRows = Array.isArray(resultsPayload.data) ? resultsPayload.data : [];
      scheduleCollectionState.resultRows = resultRows;
      scheduleCollectionState.resultsMeta = resultsPayload.meta || null;
    } else {
      if (elements.resultsMeta) {
        elements.resultsMeta.textContent = "Retrying results...";
      }
      if (!scheduleCollectionState.resultRows.length && elements.resultsTableWrap?.dataset.loaded !== "1") {
        renderLoadingTable(elements.resultsTableWrap);
      }
      scheduleResultsRetry(requestId, apiBase, query);
    }

    applyScheduleStructuredData(
      scheduleCollectionState.scheduleRows,
      scheduleCollectionState.resultRows
    );
    renderScheduleCollectionMeta();
    renderCollectionsFromState();
    refreshScheduleSeo();

    if (scheduleOk && resultsOk) {
      setStatus("Schedule and results synced.", "success");
    } else if (scheduleOk || resultsOk) {
      setStatus("Partial sync. One feed was slow or unavailable.", "error");
    } else {
      throw scheduleResult.reason || resultsResult.reason || new Error("Unable to load schedule or results.");
    }
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
    if (elements.scheduleTableWrap?.dataset.loaded !== "1") {
      elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
    }
    if (elements.resultsTableWrap?.dataset.loaded !== "1") {
      elements.resultsTableWrap.innerHTML = `<div class="empty">Unable to load results.</div>`;
    }
    setJsonLd("schedule-itemlist", null);
    refreshScheduleSeo();
  }
}

function installEvents() {
  elements.gameSelect?.addEventListener("change", loadCollections);
  elements.dateFromInput?.addEventListener("change", () => {
    syncScheduleRangePresetState();
    loadCollections();
  });
  elements.dateToInput?.addEventListener("change", () => {
    syncScheduleRangePresetState();
    loadCollections();
  });

  if (Array.isArray(elements.scheduleRangePresets)) {
    for (const button of elements.scheduleRangePresets) {
      button.addEventListener("click", () => {
        const rangeKey = button.getAttribute("data-range") || "";
        applyScheduleRangePreset(rangeKey);
      });
    }
  }

  if (elements.slateSearchInput) {
    elements.slateSearchInput.addEventListener("input", () => {
      scheduleDiscoveryState.searchTerm = String(elements.slateSearchInput.value || "").trim();
      try {
        localStorage.setItem("pulseboard.schedule.search", scheduleDiscoveryState.searchTerm);
      } catch {
        // Ignore storage failures.
      }
      renderCollectionsFromState();
    });
  }
}

function applyInitialUrlFilters() {
  const url = new URL(window.location.href);
  const title = normalizeGameKey(url.searchParams.get("game") || url.searchParams.get("title"));
  if (title && elements.gameSelect) {
    elements.gameSelect.value = title;
  }
}

function boot() {
  const apiBase = readApiBase();
  elements.apiBaseInput.value = apiBase;
  applyInitialUrlFilters();
  updateNav();

  const now = new Date();
  const initialWindow = presetWindow("live", now);
  elements.dateFromInput.value = toLocalInputValue(initialWindow.start);
  elements.dateToInput.value = toLocalInputValue(initialWindow.end);
  try {
    scheduleDiscoveryState.searchTerm = String(localStorage.getItem("pulseboard.schedule.search") || "").trim();
  } catch {
    scheduleDiscoveryState.searchTerm = "";
  }
  if (elements.slateSearchInput) {
    elements.slateSearchInput.value = scheduleDiscoveryState.searchTerm;
  }
  syncScheduleRangePresetState();

  installEvents();
  refreshScheduleSeo();
  loadCollections();
}

window.addEventListener("resize", () => {
  renderScheduleCollectionMeta();
  renderCollectionsFromState();
});

boot();
