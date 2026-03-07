import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl, buildTeamUrl } from "./routes.js";
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

const DEFAULT_API_BASE = resolveInitialApiBase();
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
  gameSelect: document.querySelector("#gameSelect"),
  regionInput: document.querySelector("#regionInput"),
  dotaTiersInput: document.querySelector("#dotaTiersInput"),
  dateFromInput: document.querySelector("#dateFromInput"),
  dateToInput: document.querySelector("#dateToInput"),
  scheduleRangePresets: Array.from(document.querySelectorAll("#scheduleRangePresets [data-range]")),
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
  resultsMeta: null
};
const SCHEDULE_RANGE_PRESETS = {
  live: { pastHours: 12, futureHours: 18 },
  "24h": { pastHours: 0, futureHours: 24 },
  "3d": { pastHours: 0, futureHours: 72 },
  "7d": { pastHours: 0, futureHours: 168 }
};

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

function scheduleCardStatusLabel(row, type) {
  if (type === "result") return "FINAL";
  return row?.status === "live" ? "LIVE" : "SCHEDULED";
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

  return {
    primary: tournament,
    secondary: formatLabel
  };
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
  const liveUrl = new URL("./index.html", window.location.href);

  const scheduleUrl = new URL("./schedule.html", window.location.href);

  const followsUrl = new URL("./follows.html", window.location.href);
  const lolHubUrl = new URL("./lol.html", window.location.href);
  const dotaHubUrl = new URL("./dota2.html", window.location.href);
  const titleKey = selectedTitleKey();
  if (titleKey) {
    liveUrl.searchParams.set("title", titleKey);
    scheduleUrl.searchParams.set("title", titleKey);
  }
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

function renderLoadingTable(container) {
  container.innerHTML = `
    <div class="schedule-mobile-list loading-grid" aria-hidden="true">
      ${Array.from({ length: 5 })
        .map(
          () => `
            <article class="schedule-row-card loading">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
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

      return `
        <tr class="schedule-row schedule-row-${String(row.status || (type === "result" ? "completed" : "upcoming")).toLowerCase()}" data-href="${detailUrl}" tabindex="0" role="link" aria-label="Open ${leftName} vs ${rightName}">
          <td class="schedule-time-cell">${dateTimeCompact(row.startAt)}</td>
          <td class="schedule-game-cell"><a class="hub-chip-link" href="${hubUrl}" aria-label="Open ${gameLabel(row.game)} hub">${gameChipMarkup(row.game)}</a></td>
          <td class="schedule-match-cell">${leftTeam} <span class="vs-token">vs</span> ${rightTeam}</td>
          <td class="schedule-score-cell">${scoreLabel}</td>
          <td class="schedule-winner-cell">${type === "result" ? winnerLong : "—"}</td>
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
              const statusClass = type === "result" ? "complete" : row.status === "live" ? "live" : "upcoming";
              const stateClass = scheduleCardState(row, type);
              const context = scheduleCardContext(row, type, scoreLabel, winnerLong);
              const footer = scheduleCardFooter(row, type, winnerLong);
              const showSeriesScore = type === "result" || row?.status === "live" || scoreLabel !== "—";
              const leftSeriesScore = Number(row?.seriesScore?.left ?? 0);
              const rightSeriesScore = Number(row?.seriesScore?.right ?? 0);
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
  const response = await fetch(`${apiBase}${endpoint}${query ? `?${query}` : ""}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "API request failed.");
  }

  return payload;
}

async function loadCollections() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const query = buildQuery();
  try {
    localStorage.setItem("pulseboard.apiBase", apiBase);
  } catch {
    // Ignore storage failures in private mode.
  }
  updateNav();

  try {
    renderLoadingTable(elements.scheduleTableWrap);
    renderLoadingTable(elements.resultsTableWrap);
    setStatus("Loading schedule and results...", "loading");
    const [schedulePayload, resultsPayload] = await Promise.all([
      fetchCollection(apiBase, "/v1/schedule", query),
      fetchCollection(apiBase, "/v1/results", query)
    ]);

    const scheduleRows = Array.isArray(schedulePayload.data) ? schedulePayload.data : [];
    const resultRows = Array.isArray(resultsPayload.data) ? resultsPayload.data : [];
    renderTable(elements.scheduleTableWrap, scheduleRows, "scheduled");
    renderTable(elements.resultsTableWrap, resultRows, "result");
    applyScheduleStructuredData(scheduleRows, resultRows);
    refreshScheduleSeo();
    scheduleCollectionState.scheduleMeta = schedulePayload.meta || null;
    scheduleCollectionState.resultsMeta = resultsPayload.meta || null;
    renderScheduleCollectionMeta();
    setStatus("Schedule and results synced.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
    elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
    elements.resultsTableWrap.innerHTML = `<div class="empty">Unable to load results.</div>`;
    setJsonLd("schedule-itemlist", null);
    scheduleCollectionState.scheduleMeta = null;
    scheduleCollectionState.resultsMeta = null;
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
}

function applyInitialUrlFilters() {
  const url = new URL(window.location.href);
  const title =
    normalizeGameKey(url.searchParams.get("title")) ||
    normalizeGameKey(url.searchParams.get("game"));
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
