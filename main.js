import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl } from "./routes.js";
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
const AUTO_REFRESH_MS = 15000;
const MOBILE_BREAKPOINT = 760;

const elements = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  gameSelect: document.querySelector("#gameSelect"),
  regionInput: document.querySelector("#regionInput"),
  dotaTiersInput: document.querySelector("#dotaTiersInput"),
  userIdInput: document.querySelector("#userIdInput"),
  followedOnlyInput: document.querySelector("#followedOnlyInput"),
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
  metaText: document.querySelector("#metaText"),
  liveStatusSwitch: document.querySelector("#liveStatusSwitch"),
  liveStatusButtons: Array.from(document.querySelectorAll("#liveStatusSwitch [data-status]")),
  liveSearchInput: document.querySelector("#liveSearchInput"),
  liveResetFiltersButton: document.querySelector("#liveResetFiltersButton"),
  liveFilterMeta: document.querySelector("#liveFilterMeta"),
  cardGrid: document.querySelector("#cardGrid")
};
const liveDeskState = {
  rows: [],
  statusFilter: "all",
  searchTerm: ""
};
const LIVE_STATUS_LABELS = {
  all: "All",
  live: "Live",
  upcoming: "Next",
  completed: "Final"
};
const GAME_OPTION_VALUES = new Set(["", "lol", "dota2"]);

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
}

function preferredTitleQueryValue() {
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  return game || null;
}

function refreshLiveSeo() {
  const titleGame = preferredTitleQueryValue();
  const titlePrefix = titleGame ? `${gameLabel(titleGame)} Live Scores` : "Live Esports Scores";
  const pageTitle = `${titlePrefix} | Pulseboard`;
  const pageDescription = titleGame
    ? `${gameLabel(titleGame)} live series, map tracking, and score updates with state-aware context on Pulseboard.`
    : "Live League of Legends and Dota 2 series with score, status, and map context on Pulseboard.";
  const canonicalPath = buildCanonicalPath({
    pathname: "/index.html",
    allowedQueryParams: titleGame ? ["title"] : []
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
      { name: "Live Desk", path: canonicalPath }
    ])
  );
  setJsonLd("site-meta", {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pulseboard",
    url: toAbsoluteSiteUrl("/index.html")
  });
}

function statusPillClass(status) {
  if (status === "live") return "live";
  if (status === "upcoming") return "upcoming";
  return "complete";
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

function signalLabel(signal) {
  if (!signal) return "No major signal";
  return signal.replaceAll("_", " ");
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

function teamShortLabel(team, game) {
  const code = resolveLocalTeamCode({
    game,
    id: team?.id,
    name: team?.name,
    code: team?.code
  });
  if (code && code.length <= 6) {
    return code;
  }
  return String(team?.name || "Team");
}

function teamBadgeMarkup(team, game) {
  const label = String(team?.name || "Team");
  const logo = resolveLocalTeamLogo({
    game,
    id: team?.id,
    name: team?.name
  });
  if (logo) {
    return `<span class="team-badge has-logo"><img src="${logo}" alt="${label} logo" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="team-badge">${teamShortLabel(team, game).slice(0, 3).toUpperCase()}</span>`;
}

function buildQuery({ game, region, dotaTiers, followedOnly, userId }) {
  const params = new URLSearchParams();
  if (game) params.set("game", game);
  if (region) params.set("region", region.trim().toLowerCase());
  if (dotaTiers) params.set("dota_tiers", dotaTiers.trim());
  if (followedOnly) params.set("followed_only", "true");
  if (userId) params.set("user_id", userId.trim());
  return params.toString();
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
    const saved = localStorage.getItem("pulseboard.live.controlsCollapsed");
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
      localStorage.setItem("pulseboard.live.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function normalizeLiveStatus(value) {
  return value === "live" || value === "upcoming" || value === "completed" ? value : "all";
}

function applyLiveStatusButtons() {
  for (const button of elements.liveStatusButtons) {
    const active = button.getAttribute("data-status") === liveDeskState.statusFilter;
    button.setAttribute("aria-pressed", String(active));
  }
}

function applyLiveStatusCounts(counts = { all: 0, live: 0, upcoming: 0, completed: 0 }) {
  for (const button of elements.liveStatusButtons) {
    const status = normalizeLiveStatus(button.getAttribute("data-status"));
    const label = LIVE_STATUS_LABELS[status] || "All";
    const value = Number.isFinite(Number(counts?.[status])) ? Number(counts[status]) : 0;
    button.textContent = `${label} ${value}`;
    button.setAttribute("aria-label", `${label} matches ${value}`);
  }
}

function statusCounts(rows = []) {
  const counts = {
    all: rows.length,
    live: 0,
    upcoming: 0,
    completed: 0
  };

  for (const row of rows) {
    const status = String(row?.status || "").toLowerCase();
    if (status === "live") counts.live += 1;
    else if (status === "upcoming") counts.upcoming += 1;
    else counts.completed += 1;
  }
  return counts;
}

function rowMatchesSearch(row, searchTerm) {
  const normalized = String(searchTerm || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    row?.teams?.left?.name,
    row?.teams?.right?.name,
    row?.tournament,
    row?.region
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(normalized);
}

function applyClientFilters(rows = []) {
  return rows.filter((row) => {
    const status = String(row?.status || "completed").toLowerCase();
    if (liveDeskState.statusFilter !== "all" && status !== liveDeskState.statusFilter) {
      return false;
    }
    if (!rowMatchesSearch(row, liveDeskState.searchTerm)) {
      return false;
    }
    return true;
  });
}

function liveFilterSummaryText(filtered, total, counts) {
  const statusLabel =
    liveDeskState.statusFilter === "all"
      ? "all statuses"
      : liveDeskState.statusFilter === "live"
        ? "live only"
        : liveDeskState.statusFilter === "upcoming"
          ? "upcoming only"
          : "final only";
  const searchLabel = liveDeskState.searchTerm.trim()
    ? ` · search “${liveDeskState.searchTerm.trim()}”`
    : "";
  return `Showing ${filtered}/${total} · Live ${counts.live} · Next ${counts.upcoming} · Final ${counts.completed} · ${statusLabel}${searchLabel}`;
}

function updateNav(apiBase) {
  const liveUrl = new URL("./index.html", window.location.href);

  const scheduleUrl = new URL("./schedule.html", window.location.href);

  const followsUrl = new URL("./follows.html", window.location.href);
  const lolHubUrl = new URL("./lol.html", window.location.href);
  const dotaHubUrl = new URL("./dota2.html", window.location.href);
  const titleValue = preferredTitleQueryValue();
  if (titleValue) {
    liveUrl.searchParams.set("title", titleValue);
    scheduleUrl.searchParams.set("title", titleValue);
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

function renderLoadingCards() {
  elements.cardGrid.innerHTML = `
    <div class="loading-grid" aria-hidden="true">
      ${Array.from({ length: 6 })
        .map(
          () => `
            <article class="match-card loading">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderEmpty(message) {
  elements.cardGrid.innerHTML = `
    <div class="empty">
      <p class="empty-title">No Matches</p>
      <p class="meta-text">${message}</p>
    </div>
  `;
}

function renderCards(rows) {
  const orderedRows = rows
    .slice()
    .sort((left, right) => {
      const rank = (status) => (status === "live" ? 0 : status === "upcoming" ? 1 : 2);
      const statusDelta = rank(left.status) - rank(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return Date.parse(String(left.startAt || "")) - Date.parse(String(right.startAt || ""));
    });

  elements.cardGrid.innerHTML = orderedRows
    .map((match, index) => {
      const link = buildMatchUrl({ matchId: match.id });
      const statusClass = statusPillClass(match.status);
      const statusLabel = String(match.status || "upcoming").toUpperCase();

      return `
        <a class="match-card" style="--delay:${index * 55}ms" href="${link}">
          <div class="match-card-topline">
            <span class="pill ${statusClass}">${statusLabel}</span>
            <span class="subline"><span class="hub-chip-link" title="${gameLabel(match.game)}">${gameChipMarkup(match.game)}</span> ${match.tournament || "Tournament"}</span>
          </div>
          <div class="match-card-scoreboard">
            <div class="team-line compact">
              <span class="team-line-main">${teamBadgeMarkup(match.teams.left, match.game)}<span class="team-name">${teamShortLabel(match.teams.left, match.game)}</span></span>
              <strong>${match.seriesScore.left}</strong>
            </div>
            <div class="team-line compact">
              <span class="team-line-main">${teamBadgeMarkup(match.teams.right, match.game)}<span class="team-name">${teamShortLabel(match.teams.right, match.game)}</span></span>
              <strong>${match.seriesScore.right}</strong>
            </div>
          </div>
          <p class="signal">${signalLabel(match.keySignal)}</p>
          <div class="match-card-footer">
            <p class="subline">${dateTimeLabel(match.startAt)}${match.region ? ` · ${String(match.region).toUpperCase()}` : ""}</p>
            <span class="match-card-cta">Open</span>
          </div>
          <p class="subline">Updated ${dateTimeLabel(match.updatedAt)}</p>
        </a>
      `;
    })
    .join("");
}

function applyLiveStructuredData(rows = []) {
  const list = rows.slice(0, 16).map((match, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: toAbsoluteSiteUrl(`/match.html?id=${encodeURIComponent(String(match?.id || ""))}`),
    name: `${match?.teams?.left?.name || "Team A"} vs ${match?.teams?.right?.name || "Team B"}`
  }));

  if (!list.length) {
    setJsonLd("live-itemlist", null);
    return;
  }

  setJsonLd("live-itemlist", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Pulseboard Live and Upcoming Matches",
    itemListElement: list
  });
}

function renderLiveDesk() {
  const totalRows = liveDeskState.rows.length;
  const counts = statusCounts(liveDeskState.rows);
  const filteredRows = applyClientFilters(liveDeskState.rows);

  if (!filteredRows.length) {
    if (totalRows === 0) {
      renderEmpty("No matches found for the selected filters.");
    } else {
      renderEmpty("No matches for this quick filter. Try `All` or clear search.");
    }
  } else {
    renderCards(filteredRows);
  }

  if (elements.liveFilterMeta) {
    elements.liveFilterMeta.textContent = liveFilterSummaryText(
      filteredRows.length,
      totalRows,
      counts
    );
  }
  applyLiveStatusCounts(counts);
  applyLiveStatusButtons();
  applyLiveStructuredData(filteredRows);
  refreshLiveSeo();
}

async function loadMatches() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const game = elements.gameSelect.value;
  const region = elements.regionInput.value;
  const dotaTiers = elements.dotaTiersInput.value;
  const followedOnly = elements.followedOnlyInput.checked;
  const userId = elements.userIdInput.value;

  if (followedOnly && !userId.trim()) {
    setStatus("User ID is required for followed-only mode.", "error");
    renderEmpty("Add a User ID to filter by follows.");
    return;
  }

  const query = buildQuery({ game, region, dotaTiers, followedOnly, userId });
  const requestUrl = `${apiBase}/v1/live-matches${query ? `?${query}` : ""}`;
  try {
    localStorage.setItem("pulseboard.apiBase", apiBase);
  } catch {
    // Ignore storage failures in private mode.
  }
  updateNav(apiBase);

  try {
    renderLoadingCards();
    setStatus("Loading live matches...", "loading");
    const response = await fetch(requestUrl);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }

    liveDeskState.rows = Array.isArray(payload.data) ? payload.data : [];
    renderLiveDesk();
    elements.metaText.textContent = `Showing ${payload?.meta?.count ?? 0} matches. Updated ${dateTimeLabel(payload?.meta?.generatedAt)}`;
    setStatus("Live desk synced.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
    liveDeskState.rows = [];
    if (elements.liveFilterMeta) {
      elements.liveFilterMeta.textContent = "";
    }
    setJsonLd("live-itemlist", null);
    refreshLiveSeo();
    renderEmpty("Unable to load matches. Check API base and API server status.");
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadMatches);

  elements.saveButton.addEventListener("click", () => {
    const value = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    saveApiBase(value);
    setStatus("API base saved locally.", "success");
  });

  elements.gameSelect.addEventListener("change", loadMatches);
  elements.regionInput.addEventListener("change", loadMatches);
  elements.dotaTiersInput.addEventListener("change", loadMatches);
  elements.followedOnlyInput.addEventListener("change", loadMatches);
  elements.userIdInput.addEventListener("change", loadMatches);
  elements.userIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadMatches();
    }
  });

  if (elements.liveStatusSwitch) {
    elements.liveStatusSwitch.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-status]");
      if (!button) {
        return;
      }

      liveDeskState.statusFilter = normalizeLiveStatus(button.getAttribute("data-status"));
      try {
        localStorage.setItem("pulseboard.live.quickStatus", liveDeskState.statusFilter);
      } catch {
        // Ignore storage failures.
      }
      renderLiveDesk();
    });
  }

  if (elements.liveSearchInput) {
    elements.liveSearchInput.addEventListener("input", () => {
      liveDeskState.searchTerm = String(elements.liveSearchInput.value || "").trim();
      try {
        localStorage.setItem("pulseboard.live.quickSearch", liveDeskState.searchTerm);
      } catch {
        // Ignore storage failures.
      }
      renderLiveDesk();
    });
  }

  if (elements.liveResetFiltersButton) {
    elements.liveResetFiltersButton.addEventListener("click", () => {
      liveDeskState.statusFilter = "all";
      liveDeskState.searchTerm = "";
      if (elements.liveSearchInput) {
        elements.liveSearchInput.value = "";
      }
      try {
        localStorage.removeItem("pulseboard.live.quickStatus");
        localStorage.removeItem("pulseboard.live.quickSearch");
      } catch {
        // Ignore storage failures.
      }
      renderLiveDesk();
    });
  }
}

function applyInitialUrlFilters() {
  const url = new URL(window.location.href);
  const initialGame =
    normalizeGameKey(url.searchParams.get("title")) ||
    normalizeGameKey(url.searchParams.get("game"));
  if (initialGame && GAME_OPTION_VALUES.has(initialGame) && elements.gameSelect) {
    elements.gameSelect.value = initialGame;
  }
}

function boot() {
  const startupApiBase = readApiBase();
  elements.apiBaseInput.value = startupApiBase;
  applyInitialUrlFilters();
  updateNav(startupApiBase);
  setupControlsPanel();
  try {
    liveDeskState.statusFilter = normalizeLiveStatus(localStorage.getItem("pulseboard.live.quickStatus"));
  } catch {
    liveDeskState.statusFilter = "all";
  }
  try {
    liveDeskState.searchTerm = String(localStorage.getItem("pulseboard.live.quickSearch") || "").trim();
  } catch {
    liveDeskState.searchTerm = "";
  }
  if (elements.liveSearchInput) {
    elements.liveSearchInput.value = liveDeskState.searchTerm;
  }
  applyLiveStatusCounts(statusCounts([]));
  applyLiveStatusButtons();
  refreshLiveSeo();
  elements.dotaTiersInput.value = "1,2,3,4";
  elements.userIdInput.value = "demo-user";
  installEvents();
  loadMatches();
  setInterval(loadMatches, AUTO_REFRESH_MS);
}

boot();
