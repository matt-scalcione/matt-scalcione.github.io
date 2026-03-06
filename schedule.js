import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl, buildTeamUrl } from "./routes.js";
import {
  applySeo,
  buildCanonicalPath,
  gameLabel,
  inferRobotsDirective,
  normalizeGameKey,
  setJsonLd,
  toAbsoluteSiteUrl
} from "./seo.js";

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
  controlsPanel: document.querySelector("#controlsPanel"),
  controlsToggle: document.querySelector("#controlsToggle"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
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

function shortTeamName(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return "TBD";
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
  const dotaTiers = elements.dotaTiersInput.value.trim();
  const dateFromIso = parseLocalInputToIso(elements.dateFromInput.value);
  const dateToIso = parseLocalInputToIso(elements.dateToInput.value);

  if (game) params.set("game", game);
  if (region) params.set("region", region);
  if (dotaTiers) params.set("dota_tiers", dotaTiers);
  if (dateFromIso) params.set("date_from", dateFromIso);
  if (dateToIso) params.set("date_to", dateToIso);

  return params.toString();
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
  elements.controlsToggle.textContent = collapsed ? "Show Filters" : "Hide Filters";
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
}

function setStatus(message, tone = "neutral") {
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
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
      const winnerLong =
        row.winnerTeamId === row.teams.left.id
          ? row.teams.left.name
          : row.winnerTeamId === row.teams.right.id
            ? row.teams.right.name
            : "TBD";
      const leftShort = shortTeamName(row.teams.left.name);
      const rightShort = shortTeamName(row.teams.right.name);
      const winnerShort = winnerLong === "TBD" ? "—" : shortTeamName(winnerLong);
      const scoreLabel = seriesScoreLabel(row, type);
      const leftTeam = teamLink({
        teamId: row.teams.left.id,
        teamName: row.teams.left.name,
        label: leftShort,
        game: row.game,
        matchId: row.id,
        opponentId: row.teams.right.id
      });
      const rightTeam = teamLink({
        teamId: row.teams.right.id,
        teamName: row.teams.right.name,
        label: rightShort,
        game: row.game,
        matchId: row.id,
        opponentId: row.teams.left.id
      });

      return `
        <tr class="schedule-row schedule-row-${String(row.status || (type === "result" ? "completed" : "upcoming")).toLowerCase()}" data-href="${detailUrl}" tabindex="0" role="link" aria-label="Open ${leftShort} vs ${rightShort}">
          <td class="schedule-time-cell">${dateTimeCompact(row.startAt)}</td>
          <td class="schedule-game-cell">${gameChipMarkup(row.game)}</td>
          <td class="schedule-match-cell">${leftTeam} <span class="vs-token">vs</span> ${rightTeam}</td>
          <td class="schedule-score-cell">${scoreLabel}</td>
          <td class="schedule-winner-cell">${type === "result" ? winnerShort : "—"}</td>
        </tr>
      `;
    })
    .join("");

  const mobileCards = rows
    .map((row) => {
      const detailUrl = rowLink(row.id);
      const leftShort = shortTeamName(row.teams.left.name);
      const rightShort = shortTeamName(row.teams.right.name);
      const winnerLong =
        row.winnerTeamId === row.teams.left.id
          ? row.teams.left.name
          : row.winnerTeamId === row.teams.right.id
            ? row.teams.right.name
            : null;
      const winnerShort = winnerLong ? shortTeamName(winnerLong) : "—";
      const scoreLabel = seriesScoreLabel(row, type);
      const statusLabel = type === "result" ? "FINAL" : String(row.status || "upcoming").toUpperCase();
      const statusClass = type === "result" ? "complete" : row.status === "live" ? "live" : "upcoming";

      return `
        <a class="schedule-row-card schedule-${String(row.status || (type === "result" ? "completed" : "upcoming")).toLowerCase()}" href="${detailUrl}" aria-label="Open ${leftShort} vs ${rightShort}">
          <div class="schedule-card-top">
            <div class="schedule-card-game">${gameChipMarkup(row.game)} <span>${dateTimeCompact(row.startAt)}</span></div>
            <span class="pill ${statusClass} schedule-card-status">${statusLabel}</span>
          </div>
          <p class="schedule-card-match">${leftShort} <span>vs</span> ${rightShort}</p>
          <p class="schedule-card-score">${scoreLabel}</p>
          <p class="schedule-card-meta">${type === "result" ? `Winner: ${winnerShort}` : "Tap for full match context"}</p>
        </a>
      `;
    })
    .join("");

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

    elements.scheduleMeta.textContent = `Showing ${schedulePayload.meta.count} matches · Updated ${dateTimeCompact(schedulePayload.meta.generatedAt)}`;
    elements.resultsMeta.textContent = `Showing ${resultsPayload.meta.count} matches · Updated ${dateTimeCompact(resultsPayload.meta.generatedAt)}`;
    setStatus("Schedule and results synced.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
    elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
    elements.resultsTableWrap.innerHTML = `<div class="empty">Unable to load results.</div>`;
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

  elements.gameSelect.addEventListener("change", loadCollections);
  elements.regionInput.addEventListener("change", loadCollections);
  elements.dotaTiersInput.addEventListener("change", loadCollections);
  elements.dateFromInput.addEventListener("change", loadCollections);
  elements.dateToInput.addEventListener("change", loadCollections);
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
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 18 * 60 * 60 * 1000);
  elements.dateFromInput.value = toLocalInputValue(start);
  elements.dateToInput.value = toLocalInputValue(end);

  installEvents();
  refreshScheduleSeo();
  loadCollections();
}

window.addEventListener("resize", () => {
  applyScheduleViewMode(scheduleViewMode);
});

boot();
