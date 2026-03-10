import { resolveInitialApiBase } from "./api-config.js";
import { applyRouteContext, buildMatchUrl, buildTeamUrl } from "./routes.js?v=20260309c";
import { buildRowDataProvenance } from "./data-provenance.js?v=20260309a";
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
import {
  overviewSkeletonMarkup,
  productEmptyMarkup,
  tableSkeletonMarkup
} from "./loading.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_API_TIMEOUT_MS = 8000;
const MOBILE_BREAKPOINT = 760;
const PRODUCT_GUIDE_KEY = "pulseboard.productGuideDismissed.schedule";
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
  regionInput: document.querySelector("#regionInput"),
  dotaTiersInput: document.querySelector("#dotaTiersInput"),
  dateFromInput: document.querySelector("#dateFromInput"),
  dateToInput: document.querySelector("#dateToInput"),
  scheduleRangePresets: Array.from(document.querySelectorAll("#scheduleRangePresets [data-range]")),
  slateModeBar: document.querySelector("#slateModeBar"),
  scheduleDotaOnlyFields: Array.from(document.querySelectorAll(".schedule-dota-only")),
  controlsPanel: document.querySelector("#controlsPanel"),
  controlsToggle: document.querySelector("#controlsToggle"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  lolHubNav: document.querySelector("#lolHubNav"),
  dotaHubNav: document.querySelector("#dotaHubNav"),
  mobileLiveNav: document.querySelector("#mobileLiveNav"),
  mobileScheduleNav: document.querySelector("#mobileScheduleNav"),
  mobileFollowsNav: document.querySelector("#mobileFollowsNav"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  heroContextLabel: document.querySelector("#heroContextLabel"),
  heroContextValue: document.querySelector("#heroContextValue"),
  heroContextCopy: document.querySelector("#heroContextCopy"),
  heroContextChips: document.querySelector("#heroContextChips"),
  heroActionRow: document.querySelector("#heroActionRow"),
  productGuidePanel: document.querySelector("#productGuidePanel"),
  slateLensStrip: document.querySelector("#slateLensStrip"),
  scheduleSummary: document.querySelector("#scheduleSummary"),
  scheduleMeta: document.querySelector("#scheduleMeta"),
  resultsMeta: document.querySelector("#resultsMeta"),
  scheduleViewSwitch: document.querySelector("#scheduleViewSwitch"),
  scheduleViewButtons: Array.from(document.querySelectorAll("#scheduleViewSwitch [data-view]")),
  scheduleSection: document.querySelector("#scheduleSection"),
  resultsSection: document.querySelector("#resultsSection"),
  scheduleTableWrap: document.querySelector("#scheduleTableWrap"),
  resultsTableWrap: document.querySelector("#resultsTableWrap")
};
let scheduleViewMode = "both";
const scheduleCollectionState = {
  scheduleMeta: null,
  resultsMeta: null,
  scheduleRows: [],
  resultRows: []
};
const scheduleDiscoveryState = {
  mode: "all",
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
  const viewKey = scheduleViewMode === "schedule" || scheduleViewMode === "results"
    ? scheduleViewMode
    : null;
  const titlePrefix = titleKey ? `${gameLabel(titleKey)} ` : "";
  const viewLabel = viewKey === "results" ? "Results" : viewKey === "schedule" ? "Upcoming Schedule" : "Schedule & Results";
  const pageTitle = `${titlePrefix}${viewLabel} | Pulseboard`;
  const pageDescription = titleKey
    ? `${viewLabel} for ${gameLabel(titleKey)} series on Pulseboard, with fast match access and state-aware context.`
    : "Upcoming schedule and completed results for League of Legends and Dota 2 series on Pulseboard.";
  const canonicalPath = buildCanonicalPath({
    pathname: "/schedule.html",
    allowedQueryParams: []
  });
  const robots = inferRobotsDirective({
    allowedQueryParams: ["title", "game", "view"]
  });

  applySeo({
    title: pageTitle,
    description: pageDescription,
    canonicalPath,
    robots
  });

  const crumbLabel =
    viewKey === "results"
      ? "Results"
      : viewKey === "schedule"
        ? "Schedule"
        : "Schedule & Results";
  setJsonLd(
    "page-breadcrumb",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", path: "/index.html" },
      { name: crumbLabel, path: canonicalPath }
    ])
  );
}

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
}

function guideDismissed() {
  return localStorage.getItem(PRODUCT_GUIDE_KEY) === "1";
}

function setGuideDismissed(value) {
  if (value) {
    localStorage.setItem(PRODUCT_GUIDE_KEY, "1");
    return;
  }
  localStorage.removeItem(PRODUCT_GUIDE_KEY);
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

function slateModeLabel(mode) {
  if (mode === "live") return "Live";
  if (mode === "upcoming") return "Up Next";
  if (mode === "completed") return "Finals";
  return "All";
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

function hubUrlForGame(game) {
  const normalized = normalizeGameKey(game);
  const page = normalized === "dota2" ? "dota2.html" : "lol.html";
  return new URL(`./${page}`, window.location.href).toString();
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
  const game = elements.gameSelect.value;
  const region = elements.regionInput.value.trim().toLowerCase();
  const dotaTiers = elements.dotaTiersInput.value.trim();
  const dateFromIso = parseLocalInputToIso(elements.dateFromInput.value);
  const dateToIso = parseLocalInputToIso(elements.dateToInput.value);

  if (game) params.set("game", game);
  if (region) params.set("region", region);
  if (dotaTiers && normalizeGameKey(game) !== "lol") params.set("dota_tiers", dotaTiers);
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

function syncScheduleFilterVisibility() {
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  const showDotaTiers = game !== "lol";
  for (const field of elements.scheduleDotaOnlyFields || []) {
    field.hidden = !showDotaTiers;
  }
}

function rowLink(id) {
  return buildMatchUrl({ matchId: id });
}

function isCompactViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function applyControlsCollapsed(collapsed) {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  elements.controlsPanel.classList.toggle("collapsed", collapsed);
  const compact = isCompactViewport();
  elements.controlsToggle.textContent = compact
    ? (collapsed ? "Show" : "Hide")
    : (collapsed ? "Show Filters" : "Hide Filters");
  elements.controlsToggle.setAttribute("aria-expanded", String(!collapsed));
}

function setupControlsPanel() {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  let collapsed = isCompactViewport();
  try {
    const saved = localStorage.getItem("pulseboard.schedule.controlsCollapsed");
    if (saved === "1" || saved === "0") {
      collapsed = saved === "1";
    }
  } catch {
    collapsed = isCompactViewport();
  }

  applyControlsCollapsed(collapsed);
  elements.controlsToggle.addEventListener("click", () => {
    const next = !elements.controlsPanel.classList.contains("collapsed");
    applyControlsCollapsed(next);
    try {
      localStorage.setItem("pulseboard.schedule.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function applyScheduleViewMode(mode) {
  const normalized =
    mode === "schedule" || mode === "results" || mode === "both" ? mode : "both";
  scheduleViewMode = normalized;

  const compact = isCompactViewport();
  const showSchedule = !compact || normalized === "both" || normalized === "schedule";
  const showResults = !compact || normalized === "both" || normalized === "results";

  if (elements.scheduleSection) {
    elements.scheduleSection.hidden = !showSchedule;
  }
  if (elements.resultsSection) {
    elements.resultsSection.hidden = !showResults;
    elements.resultsSection.classList.toggle("top-space", showSchedule && showResults);
  }

  for (const button of elements.scheduleViewButtons) {
    const active = button.getAttribute("data-view") === normalized;
    button.setAttribute("aria-pressed", String(active));
  }

  updateNav();
  refreshScheduleSeo();
}

function setupScheduleViewSwitch() {
  if (!elements.scheduleViewSwitch) {
    return;
  }

  try {
    const saved = localStorage.getItem("pulseboard.schedule.mobileView");
    if (saved === "schedule" || saved === "results" || saved === "both") {
      scheduleViewMode = saved;
    }
  } catch {
    scheduleViewMode = "both";
  }

  applyScheduleViewMode(scheduleViewMode);
  elements.scheduleViewSwitch.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-view]");
    if (!button) {
      return;
    }

    const next = button.getAttribute("data-view") || "both";
    applyScheduleViewMode(next);
    try {
      localStorage.setItem("pulseboard.schedule.mobileView", scheduleViewMode);
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function teamLink({
  teamId,
  teamName,
  label = null,
  game,
  matchId = null,
  opponentId = null
}) {
  if (!teamId) {
    return teamName || "Unknown";
  }

  const url = buildTeamUrl({
    teamId,
    game,
    matchId,
    opponentId,
    teamName
  });
  return `<a class="team-link" href="${url}">${label || teamName || teamId}</a>`;
}

function updateNav() {
  const apiBase = elements.apiBaseInput?.value.trim() || null;
  const liveUrl = applyRouteContext(new URL("./index.html", window.location.href), { apiBase });
  const scheduleUrl = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase });
  const followsUrl = applyRouteContext(new URL("./follows.html", window.location.href), { apiBase });
  const lolHubUrl = applyRouteContext(new URL("./lol.html", window.location.href), { apiBase });
  const dotaHubUrl = applyRouteContext(new URL("./dota2.html", window.location.href), { apiBase });
  if (scheduleViewMode === "schedule" || scheduleViewMode === "results") {
    scheduleUrl.searchParams.set("view", scheduleViewMode);
  }

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
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function scheduleMetaText(meta, kind) {
  const count = Number(meta?.count || 0);
  const generatedAt = meta?.generatedAt || null;
  if (isCompactViewport()) {
    const noun = kind === "results"
      ? count === 1 ? "result" : "results"
      : count === 1 ? "match" : "matches";
    return [count > 0 ? `${count} ${noun}` : `0 ${noun}`, generatedAt ? timeOnlyLabel(generatedAt) : null]
      .filter(Boolean)
      .join(" · ");
  }

  return `Showing ${count} matches · Updated ${generatedAt ? dateTimeCompact(generatedAt) : "n/a"}`;
}

function renderScheduleCollectionMeta() {
  if (elements.scheduleMeta && scheduleCollectionState.scheduleMeta) {
    elements.scheduleMeta.textContent = scheduleMetaText(scheduleCollectionState.scheduleMeta, "schedule");
  }
  if (elements.resultsMeta && scheduleCollectionState.resultsMeta) {
    elements.resultsMeta.textContent = scheduleMetaText(scheduleCollectionState.resultsMeta, "results");
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

function scheduleModeMatches(row, type) {
  const status = String(row?.status || "").toLowerCase();
  if (scheduleDiscoveryState.mode === "live") {
    return type === "scheduled" && status === "live";
  }
  if (scheduleDiscoveryState.mode === "upcoming") {
    return type === "scheduled" && status !== "live";
  }
  if (scheduleDiscoveryState.mode === "completed") {
    return type === "result";
  }
  return true;
}

function applySlateFilters(rows = [], type) {
  return rows.filter((row) => scheduleModeMatches(row, type) && matchesSlateSearch(row, scheduleDiscoveryState.searchTerm));
}

function scheduleGuideMarkup(scheduleRows = [], resultRows = []) {
  const spotlight = scheduleRows[0] || resultRows[0] || null;
  const matchHref = spotlight ? rowLink(spotlight.id) : null;
  return `
    <div class="guide-shell">
      <div class="guide-head">
        <div>
          <p class="guide-kicker">Quick start</p>
          <h2>Use Schedule to plan the slate</h2>
          <p class="guide-copy">Shape the time window first, then narrow by title or search. Open Match Center only after the slate is clear.</p>
        </div>
        <button type="button" class="ghost guide-dismiss" data-guide-dismiss="true">Hide guide</button>
      </div>
      <div class="guide-step-grid">
        <article class="guide-step">
          <p class="guide-step-index">01</p>
          <h3>Set the window</h3>
          <p>Start with Live, 24h, 3d, or a custom date range to shape the slate before filtering further.</p>
        </article>
        <article class="guide-step">
          <p class="guide-step-index">02</p>
          <h3>Find the right series</h3>
          <p>${spotlight ? `${escapeHtml(teamNameValue(spotlight.teams.left))} vs ${escapeHtml(teamNameValue(spotlight.teams.right))} is the clearest current jump-off point.` : "Use search and slate mode to narrow to the exact match you want."}</p>
          ${matchHref ? `<a class="link-btn" href="${matchHref}">Open spotlight match</a>` : ""}
        </article>
        <article class="guide-step">
          <p class="guide-step-index">03</p>
          <h3>Move with intent</h3>
          <p>Use Live Desk for triage, Schedule for planning, and Watchlist only after you know what deserves alerts.</p>
        </article>
      </div>
    </div>
  `;
}

function renderScheduleHeroContext(scheduleRows = [], resultRows = []) {
  if (!elements.heroContextLabel || !elements.heroContextValue || !elements.heroContextCopy) {
    return;
  }

  const query = String(scheduleDiscoveryState.searchTerm || "").trim();
  const liveCount = scheduleRows.filter((row) => String(row?.status || "").toLowerCase() === "live").length;
  elements.heroContextLabel.textContent = "Window";
  elements.heroContextValue.textContent = scheduleRows.length || resultRows.length ? `${slateModeLabel(scheduleDiscoveryState.mode)} slate` : "Slate clear";
  elements.heroContextCopy.textContent = scheduleRows.length || resultRows.length
    ? `${scheduleRows.length} schedule rows and ${resultRows.length} finals in view${query ? ` for "${query}"` : ""}.${liveCount ? ` ${liveCount} live right now.` : ""}`
    : "Shape the window first, then narrow by title, region, or search to isolate the exact slate.";

  if (elements.heroContextChips) {
    elements.heroContextChips.innerHTML = `
      <span class="hero-chip">${scheduleRows.length} schedule</span>
      <span class="hero-chip">${resultRows.length} finals</span>
      <span class="hero-chip">${liveCount} live</span>
    `;
  }
}

function renderScheduleHeroActions(scheduleRows = [], resultRows = []) {
  if (!elements.heroActionRow) {
    return;
  }

  const spotlight = scheduleRows[0] || resultRows[0] || null;
  const apiBase = elements.apiBaseInput?.value.trim() || DEFAULT_API_BASE;
  const primaryHref = spotlight
    ? rowLink(spotlight.id)
    : applyRouteContext(new URL("./index.html", window.location.href), { apiBase }).toString();
  const followsHref = applyRouteContext(new URL("./follows.html", window.location.href), { apiBase }).toString();
  elements.heroActionRow.innerHTML = `
    <a class="link-btn" href="${primaryHref}">${spotlight ? "Open spotlight" : "Open live desk"}</a>
    <a class="link-btn ghost" href="${followsHref}">Open watchlist</a>
  `;
}

function renderScheduleGuide(scheduleRows = [], resultRows = []) {
  if (!elements.productGuidePanel) {
    return;
  }
  if (guideDismissed()) {
    elements.productGuidePanel.classList.add("hidden-panel");
    elements.productGuidePanel.innerHTML = "";
    return;
  }
  elements.productGuidePanel.classList.remove("hidden-panel");
  elements.productGuidePanel.innerHTML = scheduleGuideMarkup(scheduleRows, resultRows);
}

function renderSlateLens(scheduleRows = [], resultRows = []) {
  if (!elements.slateLensStrip) {
    return;
  }

  if (isCompactViewport()) {
    elements.slateLensStrip.innerHTML = "";
    elements.slateLensStrip.hidden = true;
    return;
  }
  elements.slateLensStrip.hidden = false;

  const game = normalizeGameKey(elements.gameSelect?.value || "");
  const region = String(elements.regionInput?.value || "").trim();
  const search = String(scheduleDiscoveryState.searchTerm || "").trim();
  const tiers = String(elements.dotaTiersInput?.value || "").trim();
  const chips = [`<span class="lens-chip lens-chip-primary">${escapeHtml(slateModeLabel(scheduleDiscoveryState.mode))}</span>`];
  if (game) chips.push(`<span class="lens-chip">${escapeHtml(gameLabel(game))}</span>`);
  if (region) chips.push(`<span class="lens-chip">${escapeHtml(region.toUpperCase())}</span>`);
  if (search) chips.push(`<span class="lens-chip">Search: ${escapeHtml(search)}</span>`);
  if ((game === "dota2" || !game) && tiers) chips.push(`<span class="lens-chip">Tiers ${escapeHtml(tiers)}</span>`);

  elements.slateLensStrip.innerHTML = `
    <div class="lens-strip-shell">
      <div>
        <p class="lens-kicker">Current lens</p>
        <p class="lens-copy">${scheduleRows.length + resultRows.length} rows in view across schedule and finals.</p>
      </div>
      <div class="lens-chip-row">${chips.join("")}</div>
    </div>
  `;
}

function renderScheduleSummary(scheduleRows = [], resultRows = []) {
  if (!elements.scheduleSummary) {
    return;
  }

  if (isCompactViewport()) {
    elements.scheduleSummary.innerHTML = "";
    elements.scheduleSummary.hidden = true;
    renderScheduleHeroContext(scheduleRows, resultRows);
    renderScheduleHeroActions(scheduleRows, resultRows);
    renderScheduleGuide(scheduleRows, resultRows);
    renderSlateLens(scheduleRows, resultRows);
    return;
  }
  elements.scheduleSummary.hidden = false;

  renderScheduleHeroContext(scheduleRows, resultRows);
  renderScheduleHeroActions(scheduleRows, resultRows);
  renderScheduleGuide(scheduleRows, resultRows);
  renderSlateLens(scheduleRows, resultRows);

  const liveCount = scheduleRows.filter((row) => scheduleDisplayState(row, "scheduled") === "live").length;
  const upcomingCount = scheduleRows.filter((row) => scheduleDisplayState(row, "scheduled") === "upcoming").length;
  const overdueCount = scheduleRows.filter((row) => scheduleDisplayState(row, "scheduled") === "overdue").length;
  const spotlight = scheduleRows[0] || resultRows[0] || null;

  if (!scheduleRows.length && !resultRows.length) {
    elements.scheduleSummary.innerHTML = productEmptyMarkup({
      eyebrow: "Slate clear",
      title: "No matches in the current slate",
      body: "Widen the time window, clear search, or switch the slate mode to bring matches back into view.",
      tips: ["Try All", "Clear search", "Expand the date range"],
      compact: true
    });
    elements.scheduleSummary.dataset.loaded = "1";
    return;
  }

  elements.scheduleSummary.innerHTML = `
    <article class="overview-card">
      <p class="overview-label">Live Window</p>
      <p class="overview-value">${liveCount}</p>
      <p class="overview-note">Series already underway in the current slate.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Up Next</p>
      <p class="overview-value">${upcomingCount}</p>
      <p class="overview-note">${overdueCount ? `${overdueCount} start overdue${overdueCount === 1 ? "" : "s"} awaiting provider updates.` : "Scheduled series still ahead."}</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Finals</p>
      <p class="overview-value">${resultRows.length}</p>
      <p class="overview-note">Completed series available for review.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">View</p>
      <p class="overview-value">${escapeHtml(slateModeLabel(scheduleDiscoveryState.mode))}</p>
      <p class="overview-note">${scheduleDiscoveryState.searchTerm ? `Search "${escapeHtml(scheduleDiscoveryState.searchTerm)}"` : "No search applied."}</p>
    </article>
    ${
      spotlight
        ? `
          <a class="overview-featured overview-featured-spotlight" href="${rowLink(spotlight.id)}">
            <div class="overview-featured-top">
              <span class="pill ${scheduleDisplayState(spotlight, resultRows.includes(spotlight) ? "result" : "scheduled")}">${escapeHtml(scheduleCardStatusLabel(spotlight, resultRows.includes(spotlight) ? "result" : "scheduled"))}</span>
              <span class="overview-featured-meta">${escapeHtml(timeOnlyLabel(spotlight.startAt))}</span>
            </div>
            <p class="overview-label">Slate Spotlight</p>
            <p class="overview-featured-match">${escapeHtml(teamNameValue(spotlight.teams.left))} <span>vs</span> ${escapeHtml(teamNameValue(spotlight.teams.right))}</p>
            <div class="overview-inline-row">
              <span class="mini-chip">BO${Math.max(1, Number(spotlight?.bestOf || 1))}</span>
              <span class="mini-chip">${escapeHtml(spotlight.tournament || "Tournament")}</span>
            </div>
            <p class="overview-note">${escapeHtml(scheduleCardFooter(spotlight, resultRows.includes(spotlight) ? "result" : "scheduled", null).secondary)}</p>
          </a>
        `
        : ""
    }
  `;
  elements.scheduleSummary.dataset.loaded = "1";
}

function renderLoadingTable(container) {
  container.innerHTML = tableSkeletonMarkup({ rows: 5, columns: 5 });
}

function renderTable(container, rows, type) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty">No ${type} matches for current filters.</div>`;
    return;
  }

  const desktopBody = rows
    .map((row) => {
      const detailUrl = rowLink(row.id);
      const hubUrl = hubUrlForGame(row.game);
      const leftName = teamNameValue(row.teams.left) || "Team A";
      const rightName = teamNameValue(row.teams.right) || "Team B";
      const winnerLong =
        row.winnerTeamId === row.teams.left.id
          ? row.teams.left.name
          : row.winnerTeamId === row.teams.right.id
            ? row.teams.right.name
            : "TBD";
      const scoreLabel = seriesScoreLabel(row, type);
      const leftTeam = teamLink({
        teamId: row.teams.left.id,
        teamName: row.teams.left.name,
        label: leftName,
        game: row.game,
        matchId: row.id,
        opponentId: row.teams.right.id
      });
      const rightTeam = teamLink({
        teamId: row.teams.right.id,
        teamName: row.teams.right.name,
        label: rightName,
        game: row.game,
        matchId: row.id,
        opponentId: row.teams.left.id
      });
      const provenance = buildRowDataProvenance(row);

      return `
        <tr class="schedule-row schedule-row-${scheduleDisplayState(row, type)}" data-href="${detailUrl}" tabindex="0" role="link" aria-label="Open ${leftName} vs ${rightName}">
          <td class="schedule-time-cell">
            <div class="schedule-time-stack">
              <span class="schedule-time-label">${dateTimeCompact(row.startAt)}</span>
              ${provenance.text
                ? `<span class="data-provenance-line ${provenance.tone} schedule-table-provenance" title="${escapeHtml(provenance.title)}">${escapeHtml(provenance.text)}</span>`
                : ""}
            </div>
          </td>
          <td class="schedule-game-cell"><a class="hub-chip-link" href="${hubUrl}" aria-label="Open ${gameLabel(row.game)} hub">${gameChipMarkup(row.game)}</a></td>
          <td class="schedule-match-cell">${leftTeam} <span class="vs-token">vs</span> ${rightTeam}</td>
          <td class="schedule-score-cell"><span class="schedule-score-pill">${scoreLabel}</span></td>
          <td class="schedule-winner-cell"><span class="schedule-winner-text${type === "result" && winnerLong !== "TBD" ? "" : " placeholder"}">${type === "result" ? winnerLong : "—"}</span></td>
        </tr>
      `;
    })
    .join("");

  const mobileCards = rows
    .length
    ? groupRowsByDay(rows)
        .map((group) => {
          const cards = group.rows
            .map((row) => {
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
              const statusClass = scheduleDisplayState(row, type);
              const stateClass = scheduleDisplayState(row, type);
              const context = scheduleCardContext(row, type, scoreLabel, winnerLong);
              const footer = scheduleCardFooter(row, type, winnerLong);
              const showSeriesScore = type === "result" || row?.status === "live" || scoreLabel !== "—";
              const leftSeriesScore = Number(row?.seriesScore?.left ?? 0);
              const rightSeriesScore = Number(row?.seriesScore?.right ?? 0);
              const provenance = buildRowDataProvenance(row);
              const leftScoreMarkup = showSeriesScore
                ? `<span class="schedule-card-team-score">${leftSeriesScore}</span>`
                : "";
              const rightScoreMarkup = showSeriesScore
                ? `<span class="schedule-card-team-score">${rightSeriesScore}</span>`
                : "";

              return `
                <a class="schedule-row-card schedule-${stateClass}" href="${detailUrl}" aria-label="Open ${leftName} vs ${rightName}">
                  <div class="schedule-card-top">
                    <div class="schedule-card-game">
                      <span class="schedule-card-game-icon" title="${gameLabel(row.game)}">${gameChipMarkup(row.game)}</span>
                      <span class="schedule-card-time">${timeOnlyLabel(row.startAt)}</span>
                    </div>
                    <span class="pill ${statusClass} schedule-card-status">${statusLabel}</span>
                  </div>
                  <div class="schedule-card-board schedule-card-board-stacked">
                    <div class="schedule-card-team-row left">
                      <div class="schedule-card-team-main">
                        ${leftBadge}
                        <span class="schedule-card-name">${leftName}</span>
                      </div>
                      ${leftScoreMarkup}
                    </div>
                    <div class="schedule-card-series-row">
                      <span class="schedule-card-format">${context.format}</span>
                      <span class="schedule-card-series-note">${context.note}</span>
                    </div>
                    <div class="schedule-card-team-row right">
                      <div class="schedule-card-team-main">
                        ${rightBadge}
                        <span class="schedule-card-name">${rightName}</span>
                      </div>
                      ${rightScoreMarkup}
                    </div>
                  </div>
                  <div class="schedule-card-foot">
                    <p class="schedule-card-meta primary">${footer.primary}</p>
                    <p class="schedule-card-meta secondary">${footer.secondary}</p>
                  </div>
                  ${provenance.text
                    ? `<p class="data-provenance-line ${provenance.tone} schedule-card-provenance" title="${escapeHtml(provenance.title)}">${escapeHtml(provenance.text)}</p>`
                    : ""}
                </a>
              `;
            })
            .join("");

          return `
            <section class="schedule-day-group">
              <div class="schedule-day-label">
                <span>${group.label}</span>
                <span class="schedule-day-count">${group.rows.length}</span>
              </div>
              <div class="schedule-day-list">${cards}</div>
            </section>
          `;
        })
        .join("")
    : "";

  container.innerHTML = `
    <div class="table-wrap schedule-desktop-wrap">
      <table class="data-table schedule-table">
        <thead>
          <tr>
            <th>Start</th>
            <th>Game</th>
            <th>Match</th>
            <th>Score</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>${desktopBody}</tbody>
      </table>
    </div>
    <div class="schedule-mobile-list">${mobileCards}</div>
  `;
}

function renderCollectionsFromState() {
  const filteredSchedule = sortRowsForDisplay(
    applySlateFilters(scheduleCollectionState.scheduleRows, "scheduled"),
    "scheduled"
  );
  const filteredResults = sortRowsForDisplay(
    applySlateFilters(scheduleCollectionState.resultRows, "result"),
    "result"
  );

  renderScheduleSummary(filteredSchedule, filteredResults);
  renderTable(elements.scheduleTableWrap, filteredSchedule, "scheduled");
  renderTable(elements.resultsTableWrap, filteredResults, "result");

  if (elements.scheduleTableWrap) {
    elements.scheduleTableWrap.dataset.loaded = "1";
  }
  if (elements.resultsTableWrap) {
    elements.resultsTableWrap.dataset.loaded = "1";
  }

  const showSchedule =
    scheduleDiscoveryState.mode === "completed"
      ? false
      : scheduleDiscoveryState.mode === "live" || scheduleDiscoveryState.mode === "upcoming"
        ? true
        : scheduleViewMode !== "results";
  const showResults =
    scheduleDiscoveryState.mode === "completed"
      ? true
      : scheduleDiscoveryState.mode === "live" || scheduleDiscoveryState.mode === "upcoming"
        ? false
        : scheduleViewMode !== "schedule";
  if (elements.scheduleSection) {
    elements.scheduleSection.hidden = !showSchedule;
  }
  if (elements.resultsSection) {
    elements.resultsSection.hidden = !showResults;
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

function wireRowNavigation(container) {
  if (!container) {
    return;
  }

  container.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      return;
    }

    const row = event.target.closest("tr.schedule-row");
    if (!row) {
      return;
    }

    const href = row.getAttribute("data-href");
    if (href) {
      window.location.href = href;
    }
  });

  container.addEventListener("keydown", (event) => {
    const row = event.target.closest("tr.schedule-row");
    if (!row) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const href = row.getAttribute("data-href");
    if (href) {
      window.location.href = href;
    }
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
    if (elements.scheduleSummary?.dataset.loaded !== "1") {
      elements.scheduleSummary.innerHTML = overviewSkeletonMarkup({ cards: 4, featured: true });
    }
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
  wireRowNavigation(elements.scheduleTableWrap);
  wireRowNavigation(elements.resultsTableWrap);

  elements.refreshButton.addEventListener("click", loadCollections);
  elements.saveButton.addEventListener("click", () => {
    const value = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    saveApiBase(value);
    setStatus("API base saved locally.", "success");
  });

  elements.gameSelect.addEventListener("change", () => {
    syncScheduleFilterVisibility();
    loadCollections();
  });
  elements.regionInput.addEventListener("change", loadCollections);
  elements.dotaTiersInput.addEventListener("change", loadCollections);
  elements.dateFromInput.addEventListener("change", () => {
    syncScheduleRangePresetState();
    loadCollections();
  });
  elements.dateToInput.addEventListener("change", () => {
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

  if (elements.slateModeBar) {
    elements.slateModeBar.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-mode]");
      if (!button) {
        return;
      }
      scheduleDiscoveryState.mode = String(button.getAttribute("data-mode") || "all");
      for (const chip of elements.slateModeBar.querySelectorAll(".preset-chip")) {
        chip.classList.toggle("active", chip === button);
      }
      try {
        localStorage.setItem("pulseboard.schedule.mode", scheduleDiscoveryState.mode);
      } catch {
        // Ignore storage failures.
      }
      renderCollectionsFromState();
    });
  }

  if (elements.productGuidePanel) {
    elements.productGuidePanel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-guide-dismiss]");
      if (!button) {
        return;
      }
      setGuideDismissed(true);
      renderScheduleGuide(
        applySlateFilters(scheduleCollectionState.scheduleRows, "scheduled"),
        applySlateFilters(scheduleCollectionState.resultRows, "result")
      );
    });
  }
}

function applyInitialUrlFilters() {
  const url = new URL(window.location.href);
  const title = normalizeGameKey(url.searchParams.get("game") || url.searchParams.get("title"));
  if (title && elements.gameSelect) {
    elements.gameSelect.value = title;
  }

  const view = String(url.searchParams.get("view") || "").toLowerCase();
  if (view === "schedule" || view === "results" || view === "both") {
    scheduleViewMode = view;
  }
}

function boot() {
  const apiBase = readApiBase();
  elements.apiBaseInput.value = apiBase;
  elements.dotaTiersInput.value = "1,2,3,4";
  applyInitialUrlFilters();
  updateNav();
  setupControlsPanel();
  setupScheduleViewSwitch();

  const now = new Date();
  const initialWindow = presetWindow("live", now);
  elements.dateFromInput.value = toLocalInputValue(initialWindow.start);
  elements.dateToInput.value = toLocalInputValue(initialWindow.end);
  try {
    scheduleDiscoveryState.mode = String(localStorage.getItem("pulseboard.schedule.mode") || "all");
  } catch {
    scheduleDiscoveryState.mode = "all";
  }
  try {
    scheduleDiscoveryState.searchTerm = String(localStorage.getItem("pulseboard.schedule.search") || "").trim();
  } catch {
    scheduleDiscoveryState.searchTerm = "";
  }
  if (elements.slateSearchInput) {
    elements.slateSearchInput.value = scheduleDiscoveryState.searchTerm;
  }
  if (elements.slateModeBar) {
    for (const chip of elements.slateModeBar.querySelectorAll(".preset-chip")) {
      chip.classList.toggle("active", chip.getAttribute("data-mode") === scheduleDiscoveryState.mode);
    }
  }
  syncScheduleFilterVisibility();
  syncScheduleRangePresetState();

  installEvents();
  refreshScheduleSeo();
  loadCollections();
}

window.addEventListener("resize", () => {
  applyScheduleViewMode(scheduleViewMode);
  renderScheduleCollectionMeta();
  if (elements.controlsPanel) {
    applyControlsCollapsed(elements.controlsPanel.classList.contains("collapsed"));
  }
});

boot();
