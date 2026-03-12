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
  scheduleMobileOverview: document.querySelector("#scheduleMobileOverview"),
  scheduleMeta: document.querySelector("#scheduleMeta"),
  resultsMeta: document.querySelector("#resultsMeta"),
  scheduleViewSwitch: document.querySelector("#scheduleViewSwitch"),
  scheduleViewButtons: Array.from(document.querySelectorAll("#scheduleViewSwitch [data-view]")),
  scheduleSectionJump: document.querySelector("#scheduleSectionJump"),
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
let restoredScheduleModeFromStorage = false;

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
const SCHEDULE_VIEW_LABELS = {
  both: "Both",
  schedule: "Schedule",
  results: "Results"
};
let scheduleSectionJumpRaf = 0;

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
  const competitionTiers = elements.dotaTiersInput.value.trim();
  const dateFromIso = parseLocalInputToIso(elements.dateFromInput.value);
  const dateToIso = parseLocalInputToIso(elements.dateToInput.value);

  if (game) params.set("game", game);
  if (region) params.set("region", region);
  if (competitionTiers) {
    const normalizedGame = normalizeGameKey(game);
    if (!normalizedGame || normalizedGame === "dota2") {
      params.set("dota_tiers", competitionTiers);
    }
    if (!normalizedGame || normalizedGame === "lol") {
      params.set("lol_tiers", competitionTiers);
    }
  }
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
  for (const field of elements.scheduleDotaOnlyFields || []) {
    field.hidden = false;
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
    ? (collapsed ? "Filters" : "Close")
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

  renderScheduleSectionJump();
  updateScheduleSectionJumpActiveFromViewport();
  updateNav();
  refreshScheduleSeo();
}

function applyScheduleViewButtonCounts(scheduleCount = 0, resultCount = 0) {
  for (const button of elements.scheduleViewButtons) {
    const view = String(button.getAttribute("data-view") || "both");
    const label = SCHEDULE_VIEW_LABELS[view] || "Both";
    const count =
      view === "schedule"
        ? scheduleCount
        : view === "results"
          ? resultCount
          : scheduleCount + resultCount;

    button.innerHTML = `
      <span class="mobile-segment-label">${escapeHtml(label)}</span>
      <span class="mobile-segment-count">${count}</span>
    `;
    button.setAttribute("aria-label", `${label} rows ${count}`);
  }
}

function setScheduleSectionJumpActive(targetId = "scheduleSection") {
  if (!elements.scheduleSectionJump || elements.scheduleSectionJump.hidden) {
    return;
  }

  for (const button of elements.scheduleSectionJump.querySelectorAll("[data-target]")) {
    const active = button.getAttribute("data-target") === targetId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function scrollToScheduleSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const offset = isCompactViewport() ? 120 : 24;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth"
  });
}

function renderScheduleSectionJump() {
  if (!elements.scheduleSectionJump) {
    return;
  }

  const showJump =
    isCompactViewport() &&
    Boolean(elements.scheduleSection && !elements.scheduleSection.hidden) &&
    Boolean(elements.resultsSection && !elements.resultsSection.hidden);

  if (!showJump) {
    elements.scheduleSectionJump.hidden = true;
    elements.scheduleSectionJump.innerHTML = "";
    return;
  }

  elements.scheduleSectionJump.hidden = false;
  elements.scheduleSectionJump.innerHTML = `
    <button type="button" class="team-jump-chip" data-target="scheduleSection" aria-pressed="true">Schedule</button>
    <button type="button" class="team-jump-chip" data-target="resultsSection" aria-pressed="false">Results</button>
  `;
  setScheduleSectionJumpActive("scheduleSection");
}

function updateScheduleSectionJumpActiveFromViewport() {
  if (!elements.scheduleSectionJump || elements.scheduleSectionJump.hidden) {
    return;
  }

  const anchor = 132;
  const targets = [
    elements.scheduleSection,
    elements.resultsSection
  ].filter((section) => section && !section.hidden);

  if (!targets.length) {
    return;
  }

  const closest = targets
    .map((section) => ({
      id: section.id,
      distance: Math.abs(section.getBoundingClientRect().top - anchor)
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (closest?.id) {
    setScheduleSectionJumpActive(closest.id);
  }
}

function scheduleSectionJumpOnScroll() {
  if (scheduleSectionJumpRaf) {
    return;
  }

  scheduleSectionJumpRaf = window.requestAnimationFrame(() => {
    scheduleSectionJumpRaf = 0;
    updateScheduleSectionJumpActiveFromViewport();
  });
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
  const fallbackSummary = buildCollectionFallbackSummary([...scheduleRows, ...resultRows], {
    game: "dota2",
    label: "Dota"
  });
  elements.heroContextLabel.textContent = "Window";
  elements.heroContextValue.textContent = scheduleRows.length || resultRows.length ? `${slateModeLabel(scheduleDiscoveryState.mode)} slate` : "Slate clear";
  elements.heroContextCopy.textContent = scheduleRows.length || resultRows.length
    ? `${scheduleRows.length} schedule rows and ${resultRows.length} finals in view${query ? ` for "${query}"` : ""}.${liveCount ? ` ${liveCount} live right now.` : ""}${fallbackSummary.text ? ` ${fallbackSummary.text}.` : ""}`
    : "Shape the window first, then narrow by title, region, or search to isolate the exact slate.";

  if (elements.heroContextChips) {
    elements.heroContextChips.innerHTML = `
      <span class="hero-chip">${scheduleRows.length} schedule</span>
      <span class="hero-chip">${resultRows.length} finals</span>
      <span class="hero-chip">${liveCount} live</span>
      ${fallbackSummary.text ? `<span class="hero-chip warn">${escapeHtml(fallbackSummary.text)}</span>` : ""}
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
  if (tiers) chips.push(`<span class="lens-chip">Tiers ${escapeHtml(tiers)}</span>`);

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

  renderScheduleMobileOverview(scheduleRows, resultRows);

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
  const totalScheduleRows = scheduleCollectionState.scheduleRows.length;
  const totalResultRows = scheduleCollectionState.resultRows.length;
  const modeFilteredEmpty =
    !scheduleRows.length &&
    !resultRows.length &&
    !scheduleDiscoveryState.searchTerm &&
    scheduleDiscoveryState.mode !== "all" &&
    (totalScheduleRows > 0 || totalResultRows > 0);

  if (!scheduleRows.length && !resultRows.length) {
    elements.scheduleSummary.innerHTML = productEmptyMarkup({
      eyebrow: modeFilteredEmpty ? "Mode narrowed" : "Slate clear",
      title: "No matches in the current slate",
      body: modeFilteredEmpty
        ? `No ${slateModeLabel(scheduleDiscoveryState.mode).toLowerCase()} rows are active in this window. Switch to All to see ${totalScheduleRows} scheduled row${totalScheduleRows === 1 ? "" : "s"} and ${totalResultRows} final${totalResultRows === 1 ? "" : "s"}.`
        : "Widen the time window, clear search, or switch the slate mode to bring matches back into view.",
      tips: modeFilteredEmpty ? ["Switch to All", "Try Up Next", "Try Finals"] : ["Try All", "Clear search", "Expand the date range"],
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

function renderScheduleMobileOverview(scheduleRows = [], resultRows = []) {
  if (!elements.scheduleMobileOverview) {
    return;
  }

  if (!isCompactViewport()) {
    elements.scheduleMobileOverview.hidden = true;
    elements.scheduleMobileOverview.innerHTML = "";
    return;
  }

  elements.scheduleMobileOverview.hidden = false;

  const liveCount = scheduleRows.filter((row) => scheduleDisplayState(row, "scheduled") === "live").length;
  const overdueCount = scheduleRows.filter((row) => scheduleDisplayState(row, "scheduled") === "overdue").length;
  const spotlight = scheduleRows[0] || resultRows[0] || null;
  const search = String(scheduleDiscoveryState.searchTerm || "").trim();
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  const fallbackSummary = buildCollectionFallbackSummary([...scheduleRows, ...resultRows], {
    game: "dota2",
    label: "Dota"
  });
  const chips = [
    `<span class="mobile-glance-chip primary">${escapeHtml(slateModeLabel(scheduleDiscoveryState.mode))}</span>`,
    `<span class="mobile-glance-chip">${escapeHtml(scheduleViewMode === "both" ? "Schedule + Results" : SCHEDULE_VIEW_LABELS[scheduleViewMode] || "Both")}</span>`,
    game ? `<span class="mobile-glance-chip">${escapeHtml(gameLabel(game))}</span>` : "",
    search ? `<span class="mobile-glance-chip">Search: ${escapeHtml(search)}</span>` : "",
    fallbackSummary.text ? `<span class="mobile-glance-chip warn">${escapeHtml(fallbackSummary.text)}</span>` : ""
  ].filter(Boolean);
  const totalScheduleRows = scheduleCollectionState.scheduleRows.length;
  const totalResultRows = scheduleCollectionState.resultRows.length;
  const modeFilteredEmpty =
    !scheduleRows.length &&
    !resultRows.length &&
    !scheduleDiscoveryState.searchTerm &&
    scheduleDiscoveryState.mode !== "all" &&
    (totalScheduleRows > 0 || totalResultRows > 0);

  if (!scheduleRows.length && !resultRows.length) {
    elements.scheduleMobileOverview.innerHTML = `
      <div class="mobile-glance-shell">
        <div class="mobile-glance-head">
          <div>
            <p class="mobile-glance-kicker">Slate glance</p>
            <h3 class="mobile-glance-title">No rows in the current slate</h3>
          </div>
          <p class="mobile-glance-copy">${
            modeFilteredEmpty
              ? `No ${escapeHtml(slateModeLabel(scheduleDiscoveryState.mode).toLowerCase())} rows are active. Switch to All to see ${totalScheduleRows} scheduled and ${totalResultRows} finals.`
              : "Widen the window or clear search to bring schedule and results back into view."
          }</p>
        </div>
        <div class="mobile-glance-chip-row">
          ${chips.join("")}
        </div>
      </div>
    `;
    return;
  }

  const summaryTitle = spotlight
    ? isCompactViewport()
      ? `${shortTeamName(spotlight.teams.left, spotlight.game)} vs ${shortTeamName(spotlight.teams.right, spotlight.game)}`
      : `${teamNameValue(spotlight.teams.left)} vs ${teamNameValue(spotlight.teams.right)}`
    : `${scheduleRows.length} schedule · ${resultRows.length} finals`;
  const spotlightTitle = spotlight
    ? isCompactViewport()
      ? `${shortTeamName(spotlight.teams.left, spotlight.game)} vs ${shortTeamName(spotlight.teams.right, spotlight.game)}`
      : `${teamNameValue(spotlight.teams.left)} vs ${teamNameValue(spotlight.teams.right)}`
    : "";
  const summaryCopy = `${scheduleRows.length} schedule rows · ${resultRows.length} finals${liveCount ? ` · ${liveCount} live now` : ""}${overdueCount ? ` · ${overdueCount} overdue` : ""}`;

  elements.scheduleMobileOverview.innerHTML = `
    <div class="mobile-glance-shell">
      <div class="mobile-glance-head">
        <div>
          <p class="mobile-glance-kicker">Slate glance</p>
          <h3 class="mobile-glance-title">${escapeHtml(summaryTitle)}</h3>
        </div>
        <p class="mobile-glance-copy">${escapeHtml(summaryCopy)}</p>
      </div>
      <div class="mobile-glance-chip-row">
        ${chips.join("")}
      </div>
      <div class="mobile-glance-stat-row">
        <article class="mobile-glance-stat live">
          <span>Live</span>
          <strong>${liveCount}</strong>
        </article>
        <article class="mobile-glance-stat upcoming">
          <span>Schedule</span>
          <strong>${scheduleRows.length}</strong>
        </article>
        <article class="mobile-glance-stat final">
          <span>Finals</span>
          <strong>${resultRows.length}</strong>
        </article>
      </div>
      ${spotlight
        ? `
          <a class="mobile-glance-spotlight" href="${rowLink(spotlight.id)}">
            <div class="mobile-glance-spotlight-top">
              <span class="mobile-glance-spotlight-label">Spotlight</span>
              <span class="mobile-glance-spotlight-meta">${escapeHtml(scheduleCardStatusLabel(spotlight, resultRows.includes(spotlight) ? "result" : "scheduled"))} · ${escapeHtml(timeOnlyLabel(spotlight.startAt))}</span>
            </div>
            <strong>${escapeHtml(spotlightTitle)}</strong>
            <span>${escapeHtml(spotlight.tournament || "Tournament")}</span>
          </a>
        `
        : ""}
    </div>
  `;
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
    let message = `No ${type} matches for current filters.`;
    if (!scheduleDiscoveryState.searchTerm && scheduleDiscoveryState.mode === "live") {
      message =
        type === "scheduled"
          ? "No live matches are active in this window. Switch to All or Up Next."
          : "Live slate is active. Switch to All or Finals to review completed matches.";
    } else if (!scheduleDiscoveryState.searchTerm && scheduleDiscoveryState.mode === "completed") {
      message =
        type === "scheduled"
          ? "Finals mode hides the schedule. Switch to All or Up Next."
          : "No completed matches landed in this window.";
    } else if (!scheduleDiscoveryState.searchTerm && scheduleDiscoveryState.mode === "upcoming") {
      message =
        type === "scheduled"
          ? "No upcoming matches are in this window. Try All or widen the date range."
          : "Up Next mode hides the finals list. Switch to All or Finals.";
    }
    container.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  container.innerHTML = `<div class="schedule-board-groups">${renderGroupedScheduleMarkup(rows, type)}</div>`;
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
  applyScheduleViewButtonCounts(filteredSchedule.length, filteredResults.length);

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

  renderScheduleSectionJump();
  updateScheduleSectionJumpActiveFromViewport();
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

function syncSlateModeButtons() {
  if (!elements.slateModeBar) {
    return;
  }

  for (const chip of elements.slateModeBar.querySelectorAll(".preset-chip")) {
    chip.classList.toggle("active", chip.getAttribute("data-mode") === scheduleDiscoveryState.mode);
  }
}

function setScheduleDiscoveryMode(mode, { persist = true } = {}) {
  scheduleDiscoveryState.mode =
    mode === "live" || mode === "upcoming" || mode === "completed" || mode === "all" ? mode : "all";
  syncSlateModeButtons();
  if (!persist) {
    return;
  }
  try {
    localStorage.setItem("pulseboard.schedule.mode", scheduleDiscoveryState.mode);
  } catch {
    // Ignore storage failures.
  }
}

function maybeRecoverSavedSlateMode() {
  if (!restoredScheduleModeFromStorage || scheduleDiscoveryState.mode === "all") {
    return false;
  }
  if (scheduleDiscoveryState.searchTerm) {
    return false;
  }

  const filteredSchedule = applySlateFilters(scheduleCollectionState.scheduleRows, "scheduled");
  const filteredResults = applySlateFilters(scheduleCollectionState.resultRows, "result");

  if (filteredSchedule.length || filteredResults.length) {
    restoredScheduleModeFromStorage = false;
    return false;
  }

  if (!scheduleCollectionState.scheduleRows.length && !scheduleCollectionState.resultRows.length) {
    return false;
  }

  setScheduleDiscoveryMode("all");
  restoredScheduleModeFromStorage = false;
  return true;
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
    maybeRecoverSavedSlateMode();
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
      restoredScheduleModeFromStorage = false;
      setScheduleDiscoveryMode(String(button.getAttribute("data-mode") || "all"));
      renderCollectionsFromState();
    });
  }

  if (elements.scheduleSectionJump) {
    elements.scheduleSectionJump.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-target]");
      if (!button) {
        return;
      }

      const targetId = String(button.getAttribute("data-target") || "scheduleSection");
      setScheduleSectionJumpActive(targetId);
      scrollToScheduleSection(targetId);
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

  window.addEventListener("scroll", scheduleSectionJumpOnScroll, { passive: true });
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
  elements.dotaTiersInput.value = "1,2,3";
  applyInitialUrlFilters();
  updateNav();
  setupControlsPanel();
  setupScheduleViewSwitch();
  applyScheduleViewButtonCounts(0, 0);

  const now = new Date();
  const initialWindow = presetWindow("live", now);
  elements.dateFromInput.value = toLocalInputValue(initialWindow.start);
  elements.dateToInput.value = toLocalInputValue(initialWindow.end);
  try {
    scheduleDiscoveryState.mode = String(localStorage.getItem("pulseboard.schedule.mode") || "all");
    restoredScheduleModeFromStorage = scheduleDiscoveryState.mode !== "all";
  } catch {
    scheduleDiscoveryState.mode = "all";
    restoredScheduleModeFromStorage = false;
  }
  try {
    scheduleDiscoveryState.searchTerm = String(localStorage.getItem("pulseboard.schedule.search") || "").trim();
  } catch {
    scheduleDiscoveryState.searchTerm = "";
  }
  if (elements.slateSearchInput) {
    elements.slateSearchInput.value = scheduleDiscoveryState.searchTerm;
  }
  syncSlateModeButtons();
  syncScheduleFilterVisibility();
  syncScheduleRangePresetState();

  installEvents();
  refreshScheduleSeo();
  loadCollections();
}

window.addEventListener("resize", () => {
  applyScheduleViewMode(scheduleViewMode);
  renderScheduleCollectionMeta();
  renderCollectionsFromState();
  if (elements.controlsPanel) {
    applyControlsCollapsed(elements.controlsPanel.classList.contains("collapsed"));
  }
});

boot();
