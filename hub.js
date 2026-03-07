import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl, buildTeamUrl } from "./routes.js";
import { resolveLocalTeamCode, resolveLocalTeamLogo } from "./team-logos.js";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  inferRobotsDirective,
  normalizeGameKey,
  setJsonLd,
  toAbsoluteSiteUrl
} from "./seo.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const HUB_GAME_META = {
  lol: {
    key: "lol",
    shortLabel: "LoL",
    fullLabel: "League of Legends",
    canonicalPath: "/lol.html"
  },
  dota2: {
    key: "dota2",
    shortLabel: "Dota 2",
    fullLabel: "Dota 2",
    canonicalPath: "/dota2.html"
  }
};

const elements = {
  pageTitle: document.querySelector("#hubPageTitle"),
  pageSubtitle: document.querySelector("#hubSubtitle"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  lolHubNav: document.querySelector("#lolHubNav"),
  dotaHubNav: document.querySelector("#dotaHubNav"),
  mobileLiveNav: document.querySelector("#mobileLiveNav"),
  mobileScheduleNav: document.querySelector("#mobileScheduleNav"),
  mobileFollowsNav: document.querySelector("#mobileFollowsNav"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  controlsPanel: document.querySelector("#controlsPanel"),
  controlsToggle: document.querySelector("#controlsToggle"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  hubMeta: document.querySelector("#hubMeta"),
  hubKpis: document.querySelector("#hubKpis"),
  liveRows: document.querySelector("#hubLiveRows"),
  upcomingRows: document.querySelector("#hubUpcomingRows"),
  resultRows: document.querySelector("#hubResultRows"),
  tournamentRadar: document.querySelector("#hubTournamentRadar")
};

const state = {
  gameKey: "lol",
  rows: {
    live: [],
    upcoming: [],
    results: []
  }
};

function resolveGameKey() {
  const bodyGame = normalizeGameKey(document.body?.dataset?.game || "");
  if (bodyGame && HUB_GAME_META[bodyGame]) {
    return bodyGame;
  }

  const url = new URL(window.location.href);
  const titleGame = normalizeGameKey(url.searchParams.get("title") || url.searchParams.get("game"));
  if (titleGame && HUB_GAME_META[titleGame]) {
    return titleGame;
  }

  const pathname = String(window.location.pathname || "").toLowerCase();
  if (pathname.endsWith("/dota2.html")) {
    return "dota2";
  }
  return "lol";
}

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
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

function isCompactViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function applyControlsCollapsed(collapsed) {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  elements.controlsPanel.classList.toggle("collapsed", collapsed);
  elements.controlsToggle.textContent = collapsed ? "Show Controls" : "Hide Controls";
  elements.controlsToggle.setAttribute("aria-expanded", String(!collapsed));
}

function setupControlsPanel() {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  let collapsed = isCompactViewport();
  try {
    const saved = localStorage.getItem(`pulseboard.hub.${state.gameKey}.controlsCollapsed`);
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
      localStorage.setItem(`pulseboard.hub.${state.gameKey}.controlsCollapsed`, next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  });
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
    return String(iso || "");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortTeamName(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return "TBD";
  }

  return raw.length > 20 ? `${raw.slice(0, 19)}…` : raw;
}

function winnerName(row) {
  const leftId = String(row?.teams?.left?.id || "");
  const rightId = String(row?.teams?.right?.id || "");
  const winnerId = String(row?.winnerTeamId || "");
  if (winnerId && winnerId === leftId) {
    return row?.teams?.left?.name || "Left team";
  }
  if (winnerId && winnerId === rightId) {
    return row?.teams?.right?.name || "Right team";
  }

  const left = Number(row?.seriesScore?.left || 0);
  const right = Number(row?.seriesScore?.right || 0);
  if (left > right) {
    return row?.teams?.left?.name || "Left team";
  }
  if (right > left) {
    return row?.teams?.right?.name || "Right team";
  }

  return "No winner";
}

function teamShortLabel(team) {
  const code = resolveLocalTeamCode({
    game: state.gameKey,
    id: team?.id,
    name: team?.name,
    code: team?.code
  });
  if (code && code.length <= 6) {
    return code;
  }
  return shortTeamName(team?.name || "Team");
}

function teamBadgeMarkup(team) {
  const label = String(team?.name || "Team");
  const logo = resolveLocalTeamLogo({
    game: state.gameKey,
    id: team?.id,
    name: team?.name
  });
  if (logo) {
    return `<span class="schedule-card-badge has-logo"><img src="${logo}" alt="${escapeHtml(label)} logo" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="schedule-card-badge">${escapeHtml(teamShortLabel(team).slice(0, 4).toUpperCase())}</span>`;
}

function formatLabel(bestOf) {
  const value = Number(bestOf || 1);
  return value > 1 ? `Best of ${value}` : "Single map";
}

function recapTemplate(row, type) {
  const leftName = shortTeamName(row?.teams?.left?.name);
  const rightName = shortTeamName(row?.teams?.right?.name);
  const score = `${Number(row?.seriesScore?.left || 0)}-${Number(row?.seriesScore?.right || 0)}`;

  if (type === "live") {
    return `Live: ${leftName} vs ${rightName} in ${row?.tournament || "event"} · Series ${score} · ${formatLabel(row?.bestOf)}.`;
  }

  if (type === "upcoming") {
    return `Preview: ${leftName} vs ${rightName} starts ${dateTimeLabel(row?.startAt)} · ${formatLabel(row?.bestOf)} · ${row?.tournament || "event"}.`;
  }

  const winner = shortTeamName(winnerName(row));
  return `Recap: ${winner} won ${score} in ${row?.tournament || "event"}.`;
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "live") {
    return "live";
  }
  if (normalized === "upcoming") {
    return "upcoming";
  }
  return "complete";
}

function statusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "live") {
    return "LIVE";
  }
  if (normalized === "upcoming") {
    return "UPCOMING";
  }
  return "FINAL";
}

function matchCard(row, type) {
  const left = row?.teams?.left || {};
  const right = row?.teams?.right || {};
  const scoreLeft = Number(row?.seriesScore?.left || 0);
  const scoreRight = Number(row?.seriesScore?.right || 0);
  const normalizedType = String(type || "").toLowerCase();
  const effectiveStatus = normalizedType === "results" ? "completed" : row?.status;
  const status = String(effectiveStatus || "").toLowerCase();
  const detailUrl = buildMatchUrl({ matchId: row?.id || "" });
  const leftTeamUrl = buildTeamUrl({
    teamId: left.id,
    teamName: left.name,
    game: state.gameKey,
    matchId: row?.id || "",
    opponentId: right.id
  });
  const rightTeamUrl = buildTeamUrl({
    teamId: right.id,
    teamName: right.name,
    game: state.gameKey,
    matchId: row?.id || "",
    opponentId: left.id
  });
  const footPrimary = row?.tournament || "Event";
  const footSecondary =
    normalizedType === "live"
      ? `${formatLabel(row?.bestOf)} · Live now`
      : normalizedType === "upcoming"
        ? `${formatLabel(row?.bestOf)} · Starts ${dateTimeLabel(row?.startAt)}`
        : `Winner · ${shortTeamName(winnerName(row))}`;

  return `
    <article class="schedule-row-card hub-match-card schedule-${status}">
      <div class="schedule-card-top">
        <div class="schedule-card-game"><span class="game-chip ${state.gameKey === "lol" ? "lol" : "dota2"}">${state.gameKey === "lol" ? "L" : "D"}</span> <span>${dateTimeLabel(row?.startAt)}</span></div>
        <span class="pill ${statusClass(effectiveStatus)} schedule-card-status">${statusLabel(effectiveStatus)}</span>
      </div>
      <div class="schedule-card-board hub-match-board">
        <div class="schedule-card-team">
          ${teamBadgeMarkup(left)}
          <a class="schedule-card-name team-link" href="${leftTeamUrl}">${escapeHtml(shortTeamName(left.name))}</a>
        </div>
        <div class="schedule-card-center">
          <p class="schedule-card-score">${scoreLeft}-${scoreRight}</p>
          <p class="schedule-card-center-meta">${escapeHtml(formatLabel(row?.bestOf))}</p>
        </div>
        <div class="schedule-card-team right">
          ${teamBadgeMarkup(right)}
          <a class="schedule-card-name team-link" href="${rightTeamUrl}">${escapeHtml(shortTeamName(right.name))}</a>
        </div>
      </div>
      <p class="schedule-card-meta hub-match-card-recap">${escapeHtml(recapTemplate(row, type))}</p>
      <div class="schedule-card-foot hub-match-card-foot">
        <p class="schedule-card-meta primary">${escapeHtml(footPrimary)}</p>
        <p class="schedule-card-meta secondary">${escapeHtml(footSecondary)}</p>
      </div>
      <p class="meta-text"><a class="table-link" href="${detailUrl}">Open match</a></p>
    </article>
  `;
}

function renderRows(container, rows, type) {
  if (!container) {
    return;
  }

  if (!rows.length) {
    container.innerHTML = `<div class="empty">No ${type} series right now.</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => matchCard(row, type)).join("");
}

function buildTournamentRadar(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const name = String(row?.tournament || "Unknown Tournament").trim();
    const key = name.toLowerCase();
    const current = map.get(key) || { name, total: 0, live: 0, upcoming: 0, results: 0 };
    current.total += 1;
    const status = String(row?.status || "").toLowerCase();
    if (status === "live") {
      current.live += 1;
    } else if (status === "upcoming") {
      current.upcoming += 1;
    } else {
      current.results += 1;
    }
    map.set(key, current);
  }

  return Array.from(map.values())
    .sort((left, right) => {
      const leftWeight = left.live * 4 + left.upcoming * 2 + left.results;
      const rightWeight = right.live * 4 + right.upcoming * 2 + right.results;
      if (rightWeight !== leftWeight) {
        return rightWeight - leftWeight;
      }
      return right.total - left.total;
    })
    .slice(0, 10);
}

function renderTournamentRadar(rows) {
  if (!elements.tournamentRadar) {
    return;
  }

  if (!rows.length) {
    elements.tournamentRadar.innerHTML = `<div class="empty">Tournament radar will populate once data is available.</div>`;
    return;
  }

  elements.tournamentRadar.innerHTML = `
    <div class="hub-tournament-grid">
      ${rows
        .map(
          (row) => `
          <article class="upcoming-card hub-radar-card">
            <div class="hub-radar-card-head">
              <p class="tempo-label">Tournament</p>
              <p class="hub-radar-total">${row.total}</p>
            </div>
            <p class="tempo-value">${escapeHtml(row.name)}</p>
            <div class="hub-radar-pills">
              <span class="hub-radar-pill live">Live ${row.live}</span>
              <span class="hub-radar-pill upcoming">Next ${row.upcoming}</span>
              <span class="hub-radar-pill final">Final ${row.results}</span>
            </div>
          </article>
        `
        )
        .join("")}
    </div>
  `;
}

function renderKpis() {
  if (!elements.hubKpis) {
    return;
  }

  const liveCount = state.rows.live.length;
  const upcomingCount = state.rows.upcoming.length;
  const resultCount = state.rows.results.length;
  const tournamentCount = buildTournamentRadar([
    ...state.rows.live,
    ...state.rows.upcoming,
    ...state.rows.results
  ]).length;

  elements.hubKpis.innerHTML = `
    <article class="upcoming-card hub-kpi-card live">
      <p class="tempo-label">On Now</p>
      <p class="tempo-value">${liveCount}</p>
      <p class="meta-text">Series currently live</p>
    </article>
    <article class="upcoming-card hub-kpi-card upcoming">
      <p class="tempo-label">Next Up</p>
      <p class="tempo-value">${upcomingCount}</p>
      <p class="meta-text">Scheduled over the next week</p>
    </article>
    <article class="upcoming-card hub-kpi-card result">
      <p class="tempo-label">Finals</p>
      <p class="tempo-value">${resultCount}</p>
      <p class="meta-text">Series completed in the last week</p>
    </article>
    <article class="upcoming-card hub-kpi-card radar">
      <p class="tempo-label">Radar</p>
      <p class="tempo-value">${tournamentCount}</p>
      <p class="meta-text">Active tournaments in the current window</p>
    </article>
  `;
}

function updateNav() {
  const liveUrl = new URL("./index.html", window.location.href);
  liveUrl.searchParams.set("title", state.gameKey);
  const scheduleUrl = new URL("./schedule.html", window.location.href);
  scheduleUrl.searchParams.set("title", state.gameKey);
  const followsUrl = new URL("./follows.html", window.location.href);
  const lolHubUrl = new URL("./lol.html", window.location.href);
  const dotaHubUrl = new URL("./dota2.html", window.location.href);

  if (elements.liveDeskNav) elements.liveDeskNav.href = liveUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = liveUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolHubUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaHubUrl.toString();
}

function refreshHubSeo() {
  const meta = HUB_GAME_META[state.gameKey] || HUB_GAME_META.lol;
  applySeo({
    title: `${meta.fullLabel} Hub | Pulseboard`,
    description: `${meta.fullLabel} live series, previews, and recaps with quick links to team and match detail.`,
    canonicalPath: meta.canonicalPath,
    robots: inferRobotsDirective({ allowedQueryParams: [] })
  });

  setJsonLd(
    "page-breadcrumb",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", path: "/index.html" },
      { name: `${meta.shortLabel} Hub`, path: meta.canonicalPath }
    ])
  );
}

function applyStructuredData() {
  const meta = HUB_GAME_META[state.gameKey] || HUB_GAME_META.lol;
  const rows = [...state.rows.live, ...state.rows.upcoming, ...state.rows.results].slice(0, 24);
  if (!rows.length) {
    setJsonLd("hub-itemlist", null);
    return;
  }

  setJsonLd("hub-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${meta.fullLabel} hub matches`,
    itemListElement: rows.map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteSiteUrl(`/match.html?id=${encodeURIComponent(String(row?.id || ""))}`),
      name: `${row?.teams?.left?.name || "Team A"} vs ${row?.teams?.right?.name || "Team B"}`
    }))
  });
}

function rangeQuery({ daysBack = 0, daysForward = 0 }) {
  const now = Date.now();
  const start = new Date(now - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now + daysForward * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams();
  params.set("game", state.gameKey);
  params.set("date_from", start);
  params.set("date_to", end);
  return params.toString();
}

async function fetchCollection(apiBase, endpoint, query = "") {
  const response = await fetch(`${apiBase}${endpoint}${query ? `?${query}` : ""}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Failed loading ${endpoint}`);
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function loadHubData() {
  const apiBase = elements.apiBaseInput?.value?.trim() || DEFAULT_API_BASE;
  try {
    localStorage.setItem("pulseboard.apiBase", apiBase);
  } catch {
    // Ignore storage failures.
  }

  setStatus("Loading hub data...", "loading");

  try {
    const [liveRows, scheduleRows, resultRows] = await Promise.all([
      fetchCollection(apiBase, "/v1/live-matches", new URLSearchParams({ game: state.gameKey }).toString()),
      fetchCollection(apiBase, "/v1/schedule", rangeQuery({ daysBack: 0, daysForward: 7 })),
      fetchCollection(apiBase, "/v1/results", rangeQuery({ daysBack: 7, daysForward: 1 }))
    ]);

    state.rows.live = liveRows.slice(0, 8);
    state.rows.upcoming = scheduleRows
      .filter((row) => String(row?.status || "").toLowerCase() !== "completed")
      .slice(0, 12);
    state.rows.results = resultRows.slice(0, 12);

    renderKpis();
    renderRows(elements.liveRows, state.rows.live, "live");
    renderRows(elements.upcomingRows, state.rows.upcoming, "upcoming");
    renderRows(elements.resultRows, state.rows.results, "results");
    renderTournamentRadar(
      buildTournamentRadar([...state.rows.live, ...state.rows.upcoming, ...state.rows.results])
    );
    applyStructuredData();

    if (elements.hubMeta) {
      elements.hubMeta.textContent = `Updated ${dateTimeLabel(new Date().toISOString())} · Live ${state.rows.live.length} · Upcoming ${state.rows.upcoming.length} · Final ${state.rows.results.length}`;
    }
    setStatus("Hub synced.", "success");
  } catch (error) {
    renderKpis();
    renderRows(elements.liveRows, [], "live");
    renderRows(elements.upcomingRows, [], "upcoming");
    renderRows(elements.resultRows, [], "results");
    renderTournamentRadar([]);
    setJsonLd("hub-itemlist", null);
    setStatus(`Error: ${error.message}`, "error");
  }
}

function installEvents() {
  if (elements.refreshButton) {
    elements.refreshButton.addEventListener("click", loadHubData);
  }

  if (elements.saveButton) {
    elements.saveButton.addEventListener("click", () => {
      const value = elements.apiBaseInput?.value?.trim() || DEFAULT_API_BASE;
      saveApiBase(value);
      setStatus("API base saved locally.", "success");
    });
  }
}

function boot() {
  state.gameKey = resolveGameKey();
  const meta = HUB_GAME_META[state.gameKey] || HUB_GAME_META.lol;
  const storedApi = readApiBase();
  if (elements.apiBaseInput) {
    elements.apiBaseInput.value = storedApi;
  }

  if (elements.pageTitle) {
    elements.pageTitle.textContent = `${meta.fullLabel} Hub`;
  }
  if (elements.pageSubtitle) {
    elements.pageSubtitle.textContent =
      "Live series, upcoming previews, and recent recaps in one game-specific surface.";
  }

  updateNav();
  setupControlsPanel();
  refreshHubSeo();
  installEvents();
  loadHubData();
}

boot();
