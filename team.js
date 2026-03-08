import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl, buildTeamUrl, parseTeamRoute } from "./routes.js";
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
import { resolveLocalTeamCode, resolveLocalTeamLogo, resolveLocalTeamMeta } from "./team-logos.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_API_TIMEOUT_MS = 8000;
const MOBILE_BREAKPOINT = 760;
const TEAM_MOBILE_PANELS_DEFAULT_OPEN = new Set([
  "Team Snapshot",
  "Performance Insights",
  "Recent Matches",
  "Upcoming Matches"
]);
const TEAM_MOBILE_JUMP_TARGETS = [
  { id: "teamSummaryWrap", label: "Snapshot" },
  { id: "performanceInsightsWrap", label: "Insights" },
  { id: "formTimelineWrap", label: "Form" },
  { id: "recentMatchesWrap", label: "Recent" },
  { id: "upcomingMatchesWrap", label: "Upcoming" },
  { id: "opponentBreakdownWrap", label: "Past" },
  { id: "headToHeadWrap", label: "H2H" }
];

const elements = {
  teamTitle: document.querySelector("#teamTitle"),
  backLink: document.querySelector("#backLink"),
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
  teamQuickNav: document.querySelector("#teamQuickNav"),
  teamQuickJump: document.querySelector("#teamQuickJump"),
  gameSelect: document.querySelector("#gameSelect"),
  limitSelect: document.querySelector("#limitSelect"),
  opponentSelect: document.querySelector("#opponentSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  teamMetaText: document.querySelector("#teamMetaText"),
  teamSummaryWrap: document.querySelector("#teamSummaryWrap"),
  performanceMetaText: document.querySelector("#performanceMetaText"),
  performanceInsightsWrap: document.querySelector("#performanceInsightsWrap"),
  formTimelineMeta: document.querySelector("#formTimelineMeta"),
  formTimelineWrap: document.querySelector("#formTimelineWrap"),
  recentMatchesWrap: document.querySelector("#recentMatchesWrap"),
  upcomingMatchesWrap: document.querySelector("#upcomingMatchesWrap"),
  pastResultFilter: document.querySelector("#pastResultFilter"),
  pastSortFilter: document.querySelector("#pastSortFilter"),
  pastOpponentSearch: document.querySelector("#pastOpponentSearch"),
  pastTournamentFilter: document.querySelector("#pastTournamentFilter"),
  exportPastCsvButton: document.querySelector("#exportPastCsvButton"),
  pastMatchesMeta: document.querySelector("#pastMatchesMeta"),
  opponentBreakdownWrap: document.querySelector("#opponentBreakdownWrap"),
  headToHeadWrap: document.querySelector("#headToHeadWrap")
};

const state = {
  teamId: null,
  seedMatchId: null,
  seedGameNumber: null,
  teamNameHint: null,
  profile: null,
  pastTournamentSignature: null,
  pendingOpponentId: null,
  activeLoadRequestId: 0,
  mobilePanelCollapsedByKey: {},
  mobilePanelControlsBound: false
};

function canonicalTeamPath() {
  const params = new URLSearchParams();
  params.set("id", String(state.teamId || ""));
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  if (game) {
    params.set("game", game);
  }
  return `/team.html?${params.toString()}`;
}

function refreshTeamSeo(profile = null) {
  const game = normalizeGameKey(elements.gameSelect?.value || profile?.game || "");
  const teamName = String(profile?.name || state.teamNameHint || state.teamId || "Team").trim();
  const title = `${teamName}${game ? ` ${gameLabel(game)}` : ""} Team Profile | Pulseboard`;
  const description = profile
    ? `${teamName} recent series form, past matches, and upcoming schedule on Pulseboard.`
    : `Team profile and recent series context for ${teamName} on Pulseboard.`;
  const hasFaceting = Boolean(
    new URL(window.location.href).searchParams.get("opponent") ||
      new URL(window.location.href).searchParams.get("opponent_id")
  );
  const robotsBase = inferRobotsDirective({
    allowedQueryParams: ["id", "game", "team_name", "match", "limit"]
  });
  const indexDetailPages =
    window.PULSEBOARD_CONFIG?.indexDetailPages === true ||
    window.PULSEBOARD_INDEX_DETAIL_PAGES === true;
  const robots = !indexDetailPages || hasFaceting ? "noindex,follow" : robotsBase;

  applySeo({
    title,
    description,
    canonicalPath: canonicalTeamPath(),
    robots
  });

  const schedulePath = game
    ? `/schedule.html?title=${encodeURIComponent(game)}`
    : "/schedule.html";
  setJsonLd(
    "page-breadcrumb",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", path: "/index.html" },
      { name: "Schedule", path: schedulePath },
      { name: teamName, path: canonicalTeamPath() }
    ])
  );

  if (!profile) {
    setJsonLd("team-organization", null);
    setJsonLd("team-recent", null);
    return;
  }

  setJsonLd("team-organization", {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: teamName,
    url: toAbsoluteSiteUrl(canonicalTeamPath())
  });

  const recent = Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice(0, 8) : [];
  if (!recent.length) {
    setJsonLd("team-recent", null);
    return;
  }

  setJsonLd("team-recent", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${teamName} recent matches`,
    itemListElement: recent.map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteSiteUrl(`/match.html?id=${encodeURIComponent(String(row?.matchId || ""))}`),
      name: `${teamName} vs ${row?.opponentName || "Opponent"}`
    }))
  });
}

try {
  const raw = localStorage.getItem("pulseboard.team.mobilePanelCollapsed");
  const parsed = raw ? JSON.parse(raw) : null;
  if (parsed && typeof parsed === "object") {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        state.mobilePanelCollapsedByKey[key] = value;
      }
    }
  }
} catch {
  state.mobilePanelCollapsedByKey = {};
}

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
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
    const saved = localStorage.getItem("pulseboard.team.controlsCollapsed");
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
      localStorage.setItem("pulseboard.team.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function normalizePanelToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamPanelStorageKey(panelElement, headingTitle) {
  const normalizedHeading = normalizePanelToken(headingTitle) || "panel";
  return `team:${normalizedHeading}`;
}

function persistTeamMobilePanelState() {
  try {
    localStorage.setItem("pulseboard.team.mobilePanelCollapsed", JSON.stringify(state.mobilePanelCollapsedByKey));
  } catch {
    // Ignore storage failures and keep in-memory state.
  }
}

function applyTeamMobilePanelCollapseState() {
  const compact = isCompactViewport();
  const panels = Array.from(document.querySelectorAll(".team-page main section.panel:not(.controls)"));

  panels.forEach((panelElement, index) => {
    const sectionHead = panelElement.querySelector(".section-head");
    const heading = sectionHead?.querySelector("h2");
    if (!sectionHead || !heading) {
      return;
    }

    const headingTitle = String(heading.dataset.fullTitle || heading.textContent || "").trim();
    if (!heading.dataset.fullTitle) {
      heading.dataset.fullTitle = headingTitle;
    }

    const panelKey = teamPanelStorageKey(panelElement, headingTitle);
    panelElement.dataset.mobilePanelKey = panelKey;
    if (!panelElement.id) {
      panelElement.id = `team-panel-${normalizePanelToken(panelKey) || String(index + 1)}`;
    }

    let toggleButton = sectionHead.querySelector(".panel-section-toggle");
    if (!toggleButton) {
      toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "ghost panel-section-toggle";
      sectionHead.append(toggleButton);
    }

    if (!compact) {
      panelElement.classList.remove("mobile-collapsible", "mobile-panel-collapsed");
      toggleButton.hidden = true;
      toggleButton.disabled = true;
      toggleButton.removeAttribute("data-panel-key");
      toggleButton.removeAttribute("aria-controls");
      toggleButton.removeAttribute("aria-expanded");
      return;
    }

    panelElement.classList.add("mobile-collapsible");
    toggleButton.hidden = false;
    toggleButton.disabled = false;
    toggleButton.dataset.panelKey = panelKey;
    toggleButton.setAttribute("aria-controls", panelElement.id);

    const hasSaved = Object.prototype.hasOwnProperty.call(state.mobilePanelCollapsedByKey, panelKey);
    const collapsed = hasSaved
      ? Boolean(state.mobilePanelCollapsedByKey[panelKey])
      : headingTitle === "Head-To-Head" && Boolean(state.pendingOpponentId)
        ? false
        : !TEAM_MOBILE_PANELS_DEFAULT_OPEN.has(headingTitle);
    panelElement.classList.toggle("mobile-panel-collapsed", collapsed);
    toggleButton.textContent = collapsed ? "Show" : "Hide";
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
  });
}

function bindTeamMobilePanelControls() {
  if (state.mobilePanelControlsBound) {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const toggleButton = target.closest(".team-page .panel-section-toggle");
    if (!toggleButton || toggleButton.disabled || !isCompactViewport()) {
      return;
    }

    const panelElement = toggleButton.closest("section.panel");
    const panelKey = toggleButton.getAttribute("data-panel-key");
    if (!panelElement || !panelKey) {
      return;
    }

    const nextCollapsed = !panelElement.classList.contains("mobile-panel-collapsed");
    state.mobilePanelCollapsedByKey[panelKey] = nextCollapsed;
    persistTeamMobilePanelState();
    applyTeamMobilePanelCollapseState();
  });

  state.mobilePanelControlsBound = true;
}

function scrollToTeamTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const anchor = target.closest("section.panel") || target;
  const topOffset = isCompactViewport() ? 132 : 86;
  const top = Math.max(0, Math.round(anchor.getBoundingClientRect().top + window.scrollY - topOffset));
  window.scrollTo({ top, behavior: "smooth" });
}

function renderTeamQuickJump() {
  if (!elements.teamQuickJump) {
    return;
  }

  if (!isCompactViewport()) {
    elements.teamQuickJump.hidden = true;
    elements.teamQuickJump.innerHTML = "";
    return;
  }

  const visibleTargets = TEAM_MOBILE_JUMP_TARGETS.filter((item) => {
    const target = document.getElementById(item.id);
    if (!target) {
      return false;
    }
    const panel = target.closest("section.panel");
    if (!panel) {
      return false;
    }
    return !panel.hidden && !panel.classList.contains("hidden-panel");
  });

  if (!visibleTargets.length) {
    elements.teamQuickJump.hidden = true;
    elements.teamQuickJump.innerHTML = "";
    return;
  }

  elements.teamQuickJump.hidden = false;
  elements.teamQuickJump.innerHTML = visibleTargets
    .map((item) => `<button type="button" class="team-jump-chip" data-jump-target="${item.id}">${item.label}</button>`)
    .join("");
}

function bindTeamQuickJump() {
  if (!elements.teamQuickJump || elements.teamQuickJump.dataset.bound === "1") {
    return;
  }

  elements.teamQuickJump.dataset.bound = "1";
  elements.teamQuickJump.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-jump-target]");
    if (!button) {
      return;
    }
    const jumpTarget = button.getAttribute("data-jump-target");
    if (jumpTarget) {
      scrollToTeamTarget(jumpTarget);
    }
  });
}

function bindDesktopTeamQuickNav() {
  if (!elements.teamQuickNav || elements.teamQuickNav.dataset.bound === "1") {
    return;
  }

  elements.teamQuickNav.dataset.bound = "1";
  elements.teamQuickNav.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest("a[href^=\"#\"]");
    if (!link) {
      return;
    }
    event.preventDefault();
    const href = link.getAttribute("href") || "";
    const targetId = href.replace(/^#/, "");
    if (targetId) {
      scrollToTeamTarget(targetId);
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

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "n/a";
  }

  return `${num.toFixed(1)}%`;
}

function formatSignedNumber(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "n/a";
  }

  const rendered = digits > 0 ? num.toFixed(digits) : String(Math.round(num));
  return num > 0 ? `+${rendered}` : rendered;
}

function statusPillClass(status) {
  if (status === "live") return "live";
  if (status === "upcoming") return "upcoming";
  return "complete";
}

function setStatus(message, tone = "neutral") {
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function resultClass(result) {
  if (result === "win") return "win-left";
  if (result === "loss") return "win-right";
  return "even";
}

function updateNav(apiBase) {
  const liveUrl = new URL("./index.html", window.location.href);

  const scheduleUrl = new URL("./schedule.html", window.location.href);

  const followsUrl = new URL("./follows.html", window.location.href);
  const lolHubUrl = new URL("./lol.html", window.location.href);
  const dotaHubUrl = new URL("./dota2.html", window.location.href);
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  if (game) {
    liveUrl.searchParams.set("title", game);
    scheduleUrl.searchParams.set("title", game);
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

function buildBackLink(apiBase) {
  if (state.seedMatchId) {
    elements.backLink.href = buildMatchUrl({
      matchId: state.seedMatchId,
      gameNumber: state.seedGameNumber
    });
    elements.backLink.textContent = "Back to Match";
    return;
  }

  const scheduleUrl = new URL("./schedule.html", window.location.href);
  const game = normalizeGameKey(elements.gameSelect?.value || "");
  if (game) {
    scheduleUrl.searchParams.set("title", game);
  }
  elements.backLink.href = scheduleUrl.toString();
  elements.backLink.textContent = "Back to Schedule";
}

function resolveProfileOpponentName(profile, opponentId) {
  const normalizedOpponentId = String(opponentId || "").trim();
  if (!normalizedOpponentId) {
    return null;
  }

  if (String(profile?.headToHead?.opponentId || "").trim() === normalizedOpponentId) {
    return String(profile?.headToHead?.opponentName || "").trim() || null;
  }

  const buckets = [
    Array.isArray(profile?.recentMatches) ? profile.recentMatches : [],
    Array.isArray(profile?.upcomingMatches) ? profile.upcomingMatches : [],
    Array.isArray(profile?.opponentBreakdown) ? profile.opponentBreakdown : []
  ];

  for (const bucket of buckets) {
    const found = bucket.find((row) => String(row?.opponentId || "").trim() === normalizedOpponentId);
    if (found) {
      const label = String(found?.opponentName || "").trim();
      if (label) {
        return label;
      }
    }
  }

  return null;
}

function teamInitials(value) {
  const tokens = String(value || "")
    .trim()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  if (!tokens.length) {
    return "TM";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 3).toUpperCase();
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0])
    .join("")
    .toUpperCase();
}

function teamBadgeMarkup({
  game,
  teamId,
  teamName,
  code,
  className = ""
} = {}) {
  const label = String(teamName || "").trim() || "Team";
  const logo = resolveLocalTeamLogo({
    game,
    id: teamId,
    name: teamName
  });
  const resolvedCode = resolveLocalTeamCode({
    game,
    id: teamId,
    name: teamName,
    code
  });
  const classes = ["team-badge"];
  if (className) {
    classes.push(className);
  }
  if (logo) {
    classes.push("has-logo");
    return `<span class="${classes.join(" ")}"><img src="${logo}" alt="${escapeHtml(label)} logo" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="${classes.join(" ")}">${escapeHtml(resolvedCode || teamInitials(label))}</span>`;
}

function formatSeriesRecord(wins, losses, draws = 0) {
  return `${wins ?? 0}-${losses ?? 0}${draws ? `-${draws}` : ""}`;
}

function teamLogoAssetLabel(assetType) {
  const normalized = String(assetType || "").trim().toLowerCase();
  if (normalized === "generated") return "Generated logo";
  if (normalized === "manual") return "Manual logo";
  if (normalized === "fallback") return "Fallback badge";
  if (normalized === "static") return "Static logo";
  if (normalized === "missing") return "No logo";
  return "Logo";
}

function renderTeamContextCard(profile, apiBase) {
  const summary = profile.summary || {};
  const opponentId = String(state.pendingOpponentId || profile?.headToHead?.opponentId || "").trim();
  const opponentName = resolveProfileOpponentName(profile, opponentId);
  const game = normalizeGameKey(profile?.game || elements.gameSelect?.value || "");
  const logoMeta = resolveLocalTeamMeta({
    game,
    id: profile?.id || state.teamId,
    name: profile?.name || state.teamNameHint,
    code: profile?.code
  });
  const recentCount = Array.isArray(profile?.recentMatches) ? profile.recentMatches.length : 0;
  const upcomingRows = Array.isArray(profile?.upcomingMatches) ? profile.upcomingMatches.slice() : [];
  const nextMatch = upcomingRows
    .slice()
    .sort((left, right) => parseTimestamp(left?.startAt) - parseTimestamp(right?.startAt))[0] || null;
  const h2h = profile?.headToHead && opponentName ? profile.headToHead : null;
  const matchUrl = state.seedMatchId
    ? buildMatchUrl({
        matchId: state.seedMatchId,
        gameNumber: state.seedGameNumber
      })
    : null;
  const opponentUrl = opponentId
    ? teamDetailUrl({
        teamId: opponentId,
        teamName: opponentName,
        game,
        apiBase,
        matchId: state.seedMatchId,
        opponentId: state.teamId
      })
    : null;
  const heroTitle = profile.name || profile.id || "Team";
  const heroSubline = state.seedMatchId
    ? `Opened from ${state.seedGameNumber ? `Game ${state.seedGameNumber}` : "series"} context`
    : opponentName
      ? `Focused on the ${opponentName} matchup`
      : nextMatch
        ? `Next series ${relativeStartLabel(nextMatch.startAt)}`
        : "Team profile context";
  const pills = [
    game ? gameLabel(game) : null,
    state.seedGameNumber ? `Game ${state.seedGameNumber}` : null,
    opponentName ? `vs ${opponentName}` : null,
    upcomingRows.length ? `${upcomingRows.length} upcoming` : null,
    recentCount ? `${recentCount} recent` : null,
    nextMatch ? `Next ${relativeStartLabel(nextMatch.startAt)}` : null,
    h2h ? `H2H ${formatSeriesRecord(h2h.wins, h2h.losses, h2h.draws)}` : null
  ].filter(Boolean);
  const actions = [
    matchUrl ? `<a class="link-btn ghost" href="${matchUrl}">${state.seedGameNumber ? `Back to G${state.seedGameNumber}` : "Back to Match"}</a>` : "",
    opponentUrl ? `<a class="link-btn ghost" href="${opponentUrl}">Open Opponent</a>` : ""
  ]
    .filter(Boolean)
    .join("");

  const primaryStats = [
    { label: "Series", value: formatSeriesRecord(summary.wins, summary.losses, summary.draws) },
    { label: "Win", value: formatPercent(summary.seriesWinRatePct) },
    { label: "Streak", value: summary.streakLabel || "n/a" },
    { label: "Form", value: summary.formLast5 || "n/a" }
  ];

  if (!actions && !pills.length && !opponentName && !primaryStats.length) {
    return "";
  }

  return `
    <article class="team-summary-hero">
      <div class="team-summary-main">
        <div class="team-summary-identity">
          ${teamBadgeMarkup({
            game,
            teamId: profile?.id || state.teamId,
            teamName: heroTitle,
            code: profile?.code,
            className: "team-summary-badge"
          })}
          <div class="team-summary-copy">
            <div class="team-summary-kicker-row">
              ${game ? `<span class="team-summary-game-pill">${escapeHtml(gameLabel(game))}</span>` : ""}
              ${opponentName ? `<span class="team-summary-context-pill">Matchup</span>` : ""}
              ${
                logoMeta?.assetType
                  ? `<span class="team-summary-context-pill team-summary-logo-pill ${escapeHtml(logoMeta.assetType)}">${escapeHtml(teamLogoAssetLabel(logoMeta.assetType))}</span>`
                  : ""
              }
            </div>
            <p class="team-context-title">${escapeHtml(heroTitle)}</p>
            <p class="team-summary-subline">${escapeHtml(heroSubline)}</p>
          </div>
        </div>
        ${actions ? `<div class="team-summary-actions">${actions}</div>` : ""}
      </div>
      <div class="team-summary-primary">
        ${primaryStats
          .map(
            (row) => `
              <div class="team-summary-stat">
                <span class="team-summary-label">${escapeHtml(row.label)}</span>
                <strong class="team-summary-value">${escapeHtml(row.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      ${pills.length ? `<div class="team-summary-tags">${pills.map((pill) => `<span class="team-summary-tag">${escapeHtml(pill)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

function summaryMiniCard(label, value, note = null) {
  return `
    <article class="team-summary-mini">
      <p class="tempo-label">${escapeHtml(label)}</p>
      <p class="tempo-value">${escapeHtml(value)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function matchDetailUrl(matchId, apiBase) {
  return buildMatchUrl({ matchId });
}

function teamDetailUrl({
  teamId,
  teamName,
  game,
  apiBase,
  matchId = null,
  opponentId = null
}) {
  if (!teamId) {
    return null;
  }

  return buildTeamUrl({
    teamId,
    game,
    matchId,
    opponentId,
    teamName
  });
}

function seriesScoreLabel(row) {
  if (row?.scoreLabel) {
    return row.scoreLabel;
  }

  const own = Number(row?.ownScore);
  const opp = Number(row?.oppScore);
  if (Number.isFinite(own) && Number.isFinite(opp)) {
    return `${own}-${opp}`;
  }

  return "n/a";
}

function resultLabel(row) {
  const normalized = String(row?.result || "").toLowerCase();
  if (normalized === "win") return "W";
  if (normalized === "loss") return "L";
  if (normalized === "draw") return "D";
  return "n/a";
}

function parseTimestamp(iso) {
  const value = Date.parse(String(iso || ""));
  return Number.isFinite(value) ? value : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function relativeStartLabel(iso) {
  const ts = parseTimestamp(iso);
  if (!ts) {
    return "n/a";
  }

  const deltaMs = ts - Date.now();
  if (deltaMs <= 0) {
    return "started";
  }

  const totalMinutes = Math.max(1, Math.round(deltaMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) {
    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function safeFileToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensurePastTournamentOptions(rows = []) {
  if (!elements.pastTournamentFilter) {
    return;
  }

  const tournaments = Array.from(
    new Set(
      rows
        .map((row) => String(row?.tournament || "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
  const signature = tournaments.join("||");
  if (state.pastTournamentSignature === signature) {
    return;
  }

  state.pastTournamentSignature = signature;
  const previous = elements.pastTournamentFilter.value || "all";
  elements.pastTournamentFilter.innerHTML = [
    `<option value="all">All</option>`,
    ...tournaments.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
  ].join("");
  elements.pastTournamentFilter.value = tournaments.includes(previous) ? previous : "all";
}

function exportPastMatchesCsv(profile) {
  if (!profile) {
    return;
  }

  const { rows } = buildPastRows(profile);
  if (!rows.length) {
    setStatus("No past matches to export for current filters.", "error");
    return;
  }

  const header = ["Date (ISO)", "Date (Local)", "Opponent", "Result", "Score", "Tournament", "Match ID", "Opponent ID"];
  const body = rows.map((row) => [
    row.startAt || "",
    dateTimeLabel(row.startAt),
    row.opponentName || "Unknown",
    resultLabel(row),
    seriesScoreLabel(row),
    row.tournament || "Unknown",
    row.matchId || "",
    row.opponentId || ""
  ]);
  const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const teamToken = safeFileToken(profile.name || profile.id || "team");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  anchor.href = url;
  anchor.download = `${teamToken}-past-matches-${stamp}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${rows.length} past matches to CSV.`, "success");
}

function buildPastRows(profile) {
  const allRows = Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice() : [];
  const resultFilter = elements.pastResultFilter?.value || "all";
  const sortMode = elements.pastSortFilter?.value || "newest";
  const tournamentFilter = elements.pastTournamentFilter?.value || "all";
  const opponentSearch = String(elements.pastOpponentSearch?.value || "")
    .trim()
    .toLowerCase();

  let rows = allRows;
  if (resultFilter !== "all") {
    rows = rows.filter((row) => String(row?.result || "").toLowerCase() === resultFilter);
  }

  if (opponentSearch) {
    rows = rows.filter((row) => String(row?.opponentName || "").toLowerCase().includes(opponentSearch));
  }

  if (tournamentFilter !== "all") {
    rows = rows.filter((row) => String(row?.tournament || "") === tournamentFilter);
  }

  rows = rows
    .slice()
    .sort((left, right) =>
      sortMode === "oldest" ? parseTimestamp(left.startAt) - parseTimestamp(right.startAt) : parseTimestamp(right.startAt) - parseTimestamp(left.startAt)
    );

  return {
    rows,
    total: allRows.length
  };
}

function renderFormTimeline(profile) {
  const rows = Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice(0, 12) : [];
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  if (elements.formTimelineMeta) {
    elements.formTimelineMeta.textContent = rows.length
      ? `${rows.length} completed series in order`
      : "No completed series in the current window";
  }

  if (!elements.formTimelineWrap) {
    return;
  }

  if (!rows.length) {
    elements.formTimelineWrap.innerHTML = `<div class="empty">Form timeline appears once completed matches are available.</div>`;
    return;
  }

  const recentWindow = rows.slice(0, 5);
  const first = rows[0];
  const firstResult = String(first?.result || "").toLowerCase();
  let runCount = 0;
  for (const row of rows) {
    if (String(row?.result || "").toLowerCase() !== firstResult) {
      break;
    }
    runCount += 1;
  }
  const runLabel = first ? `${resultLabel(first)}${runCount}` : "n/a";
  const lastFiveResults = recentWindow.map((row) => resultLabel(row)).join("") || "n/a";
  const lastFiveWins = recentWindow.filter((row) => String(row?.result || "").toLowerCase() === "win").length;
  const lastFiveMapDiff = recentWindow.reduce(
    (sum, row) => sum + Number(row?.ownScore || 0) - Number(row?.oppScore || 0),
    0
  );
  const latestLine = first
    ? `${resultLabel(first)} ${seriesScoreLabel(first)} vs ${first.opponentName || "Unknown"} · ${dateTimeLabel(first.startAt)}`
    : "";

  elements.formTimelineWrap.innerHTML = `
    <div class="team-form-shell">
      <article class="team-form-hero">
        <div class="team-form-hero-copy">
          <p class="tempo-label">Form Read</p>
          <p class="team-form-hero-title">${escapeHtml(runLabel)} current run</p>
          <p class="meta-text">${escapeHtml(latestLine)}</p>
        </div>
        <div class="team-form-hero-badges">
          <span class="team-form-badge">Last 5 ${escapeHtml(lastFiveResults)}</span>
          <span class="team-form-badge">Wins ${lastFiveWins}/${Math.max(1, recentWindow.length)}</span>
          <span class="team-form-badge">Map diff ${escapeHtml(formatSignedNumber(lastFiveMapDiff))}</span>
        </div>
      </article>
      <div class="team-form-rail">
        ${rows
          .map((row) => {
            const tone = resultClass(row.result);
            return `
              <article class="team-form-stop ${tone}">
                <div class="team-form-stop-top">
                  <span class="team-form-stop-result ${tone}">${escapeHtml(resultLabel(row))}</span>
                  <span class="team-form-stop-score">${escapeHtml(seriesScoreLabel(row))}</span>
                </div>
                <p class="team-form-stop-opponent">${teamOpponentLabel(row, profile, apiBase)}</p>
                <p class="team-form-stop-meta">${escapeHtml(dateTimeLabel(row.startAt))}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function pastMatchRowMarkup(row, profile, apiBase) {
  const opponentUrl = teamDetailUrl({
    teamId: row.opponentId,
    teamName: row.opponentName,
    game: row.game || profile.game,
    apiBase,
    matchId: row.matchId,
    opponentId: state.teamId
  });
  const opponentLabel = opponentUrl
    ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
    : (row.opponentName || "Unknown");

  return `
    <tr>
      <td>${dateTimeLabel(row.startAt)}</td>
      <td>${opponentLabel}</td>
      <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
      <td>${seriesScoreLabel(row)}</td>
      <td>${row.tournament || "Unknown"}</td>
      <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
    </tr>
  `;
}

function teamOpponentLabel(row, profile, apiBase) {
  const opponentUrl = teamDetailUrl({
    teamId: row.opponentId,
    teamName: row.opponentName,
    game: row.game || profile.game,
    apiBase,
    matchId: row.matchId,
    opponentId: state.teamId
  });

  return opponentUrl
    ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
    : (row.opponentName || "Unknown");
}

function teamMatchDetailLink(row, apiBase, label = "Open Match") {
  if (!row?.matchId) {
    return `<span class="meta-text">Match link unavailable</span>`;
  }

  return `<a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">${label}</a>`;
}

function teamMatchCard(row, profile, apiBase, options = {}) {
  const mode = String(options.mode || "recent");
  const opponentLabel = teamOpponentLabel(row, profile, apiBase);
  const opponentBadge = teamBadgeMarkup({
    game: row.game || profile.game,
    teamId: row.opponentId,
    teamName: row.opponentName,
    code: row.opponentCode,
    className: "team-match-opponent-badge"
  });
  const result = resultLabel(row);
  const score = seriesScoreLabel(row);
  const relativeLabel = relativeStartLabel(row.startAt);
  const bestOf = Number(row?.bestOf || 0);
  const topChips = [];

  if (mode === "upcoming") {
    topChips.push(`<span class="pill ${statusPillClass(row.status)}">${escapeHtml(String(row.status || "upcoming"))}</span>`);
    topChips.push(`<span class="team-match-chip">${escapeHtml(relativeLabel)}</span>`);
    if (bestOf > 0) {
      topChips.push(`<span class="team-match-chip">BO${bestOf}</span>`);
    }
  } else {
    topChips.push(`<span class="series-h2h-result ${resultClass(row.result)}">${escapeHtml(result)}</span>`);
    topChips.push(`<span class="team-match-score-pill">${escapeHtml(score)}</span>`);
  }

  return `
    <article class="team-match-card ${mode}">
      <div class="team-match-card-top">
        <div class="team-match-chip-row">${topChips.join("")}</div>
        ${teamMatchDetailLink(row, apiBase, mode === "upcoming" ? "Open Match" : "Open")}
      </div>
      <div class="team-match-opponent-row">
        ${opponentBadge}
        <p class="team-match-opponent-line">${opponentLabel}</p>
      </div>
      <div class="team-match-meta">
        <span>${dateTimeLabel(row.startAt)}</span>
        <span>${row.tournament || "Unknown"}</span>
      </div>
    </article>
  `;
}

function insightCard(label, value, note = null) {
  return `
    <article class="team-analysis-metric">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderPerformanceInsights(profile) {
  const rows = Array.isArray(profile?.recentMatches) ? profile.recentMatches : [];
  if (!elements.performanceInsightsWrap) {
    return;
  }

  if (!rows.length) {
    if (elements.performanceMetaText) {
      elements.performanceMetaText.textContent = "No completed matches yet";
    }
    elements.performanceInsightsWrap.innerHTML = `<div class="empty">Performance insights appear once completed matches are available.</div>`;
    return;
  }

  const total = rows.length;
  const mapWins = rows.reduce((sum, row) => sum + Number(row.ownScore || 0), 0);
  const mapLosses = rows.reduce((sum, row) => sum + Number(row.oppScore || 0), 0);
  const avgMapsPerSeries = (mapWins + mapLosses) / Math.max(1, total);
  const avgMargin = rows.reduce((sum, row) => sum + (Number(row.ownScore || 0) - Number(row.oppScore || 0)), 0) / Math.max(1, total);
  const closeSeries = rows.filter((row) => Math.abs(Number(row.ownScore || 0) - Number(row.oppScore || 0)) <= 1).length;
  const deciders = rows.filter((row) => {
    const mapsPlayed = Number(row.ownScore || 0) + Number(row.oppScore || 0);
    const bestOf = Number(row.bestOf || 0);
    return bestOf > 1 && mapsPlayed >= bestOf;
  }).length;
  const cleanWins = rows.filter((row) => row.result === "win" && Number(row.oppScore || 0) === 0).length;
  const gotSwept = rows.filter((row) => row.result === "loss" && Number(row.ownScore || 0) === 0).length;
  const scorelineCounts = new Map();
  for (const row of rows) {
    const key = `${resultLabel(row)} ${seriesScoreLabel(row)}`;
    scorelineCounts.set(key, Number(scorelineCounts.get(key) || 0) + 1);
  }
  const topScorelines = Array.from(scorelineCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const closeSeriesRate = closeSeries / Math.max(1, total);
  const deciderRate = deciders / Math.max(1, total);
  const lastFiveResults = rows.slice(0, 5).map((row) => resultLabel(row)).join("") || "n/a";
  const mapDiff = mapWins - mapLosses;
  let headline = "Recent profile is balanced";
  if (cleanWins >= Math.max(2, Math.ceil(total * 0.35))) {
    headline = "Converts leads into clean series wins";
  } else if (deciderRate >= 0.45) {
    headline = "Recent sets often go the distance";
  } else if (closeSeriesRate >= 0.55) {
    headline = "Most recent series stay close";
  } else if (avgMargin >= 1) {
    headline = "Usually controls maps with room to spare";
  } else if (avgMargin <= -1) {
    headline = "Recent losses have come by margin";
  } else if (gotSwept >= Math.max(2, Math.ceil(total * 0.25))) {
    headline = "Recent floor has been shaky";
  }

  if (elements.performanceMetaText) {
    elements.performanceMetaText.textContent = `${rows.length} completed series in view`;
  }

  elements.performanceInsightsWrap.innerHTML = `
    <div class="team-analysis-shell">
      <article class="team-analysis-hero">
        <div class="team-analysis-copy">
          <p class="tempo-label">Team Read</p>
          <p class="team-analysis-title">${escapeHtml(headline)}</p>
          <p class="meta-text">Last 5 ${escapeHtml(lastFiveResults)} · Map diff ${escapeHtml(formatSignedNumber(mapDiff))}</p>
        </div>
        <div class="team-analysis-badges">
          <span class="team-analysis-badge">Deciders ${escapeHtml(formatPercent(deciderRate * 100))}</span>
          <span class="team-analysis-badge">Close ${escapeHtml(formatPercent(closeSeriesRate * 100))}</span>
          <span class="team-analysis-badge">Sweeps ${cleanWins}-${gotSwept}</span>
        </div>
      </article>
      <div class="team-analysis-grid">
        ${insightCard("Avg Maps", avgMapsPerSeries.toFixed(2), "How long recent sets run")}
        ${insightCard("Map Margin", formatSignedNumber(avgMargin, 2), "Average map differential per series")}
        ${insightCard("Clean Wins", String(cleanWins), "Series won without dropping a map")}
        ${insightCard("Swept", String(gotSwept), "Series lost without a map win")}
      </div>
      <article class="team-analysis-footer">
        <p class="tempo-label">Common Results</p>
        <div class="team-analysis-chip-row">
        ${
          topScorelines.length
            ? topScorelines
                .map(
                  ([label, count]) =>
                    `<span class="team-analysis-chip">${escapeHtml(label)} · ${count}</span>`
                )
                .join("")
            : `<span class="meta-text">No scoreline distribution available.</span>`
        }
        </div>
      </article>
    </div>
  `;
}

function renderSummary(profile) {
  const summary = profile.summary || {};
  const contextCard = renderTeamContextCard(profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
  const recentCount = Array.isArray(profile?.recentMatches) ? profile.recentMatches.length : 0;
  const upcomingRows = Array.isArray(profile?.upcomingMatches) ? profile.upcomingMatches.slice() : [];
  const nextMatch = upcomingRows
    .slice()
    .sort((left, right) => parseTimestamp(left?.startAt) - parseTimestamp(right?.startAt))[0] || null;
  const h2h = profile?.headToHead || null;
  const matchupLabel = h2h?.opponentName
    ? `${formatSeriesRecord(h2h.wins, h2h.losses, h2h.draws)} vs ${h2h.opponentName}`
    : `${recentCount} completed series`;
  const cards = [
    {
      label: "Map Record",
      value: `${summary.mapWins ?? 0}-${summary.mapLosses ?? 0}`,
      note: `${summary.wins ?? 0} series won`
    },
    {
      label: "Map Win Rate",
      value: formatPercent(summary.mapWinRatePct),
      note: "Across tracked completed maps"
    },
    {
      label: "Upcoming",
      value: String(upcomingRows.length),
      note: nextMatch
        ? `${nextMatch.opponentName || "Opponent"} · ${dateTimeLabel(nextMatch.startAt)}`
        : "No scheduled series"
    },
    {
      label: h2h?.opponentName ? "Matchup" : "Window",
      value: matchupLabel,
      note: h2h?.opponentName ? "Direct head-to-head context" : `Updated ${dateTimeLabel(profile.generatedAt)}`
    }
  ];

  if (elements.teamMetaText) {
    const metaBits = [`Updated ${dateTimeLabel(profile.generatedAt)}`, `${recentCount} completed`, `${upcomingRows.length} upcoming`];
    if (h2h?.opponentName) {
      metaBits.push(`Focused vs ${h2h.opponentName}`);
    }
    elements.teamMetaText.textContent = metaBits.join(" · ");
  }

  elements.teamSummaryWrap.innerHTML = `
    ${contextCard}
    <div class="team-summary-grid">
      ${cards.map((row) => summaryMiniCard(row.label, row.value, row.note)).join("")}
    </div>
  `;
}

function renderRecentMatches(profile, apiBase) {
  const rows = Array.isArray(profile.recentMatches) ? profile.recentMatches : [];
  if (!rows.length) {
    elements.recentMatchesWrap.innerHTML = `<div class="empty">No recent matches found for this team.</div>`;
    return;
  }

  if (isCompactViewport()) {
    elements.recentMatchesWrap.innerHTML = `
      <div class="team-match-list">
        ${rows.map((row) => teamMatchCard(row, profile, apiBase, { mode: "recent" })).join("")}
      </div>
    `;
    return;
  }

  elements.recentMatchesWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Score</th>
            <th>Opponent</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => {
                const opponentUrl = teamDetailUrl({
                  teamId: row.opponentId,
                  teamName: row.opponentName,
                  game: row.game || profile.game,
                  apiBase,
                  matchId: row.matchId,
                  opponentId: state.teamId
                });
                const opponentLabel = opponentUrl
                  ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
                  : (row.opponentName || "Unknown");
                return `
                <tr>
                  <td>${dateTimeLabel(row.startAt)}</td>
                  <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
                  <td>${seriesScoreLabel(row)}</td>
                  <td>${opponentLabel}</td>
                  <td>${row.tournament || "Unknown"}</td>
                  <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                </tr>
              `;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderUpcomingMatches(profile, apiBase) {
  const rows = Array.isArray(profile.upcomingMatches) ? profile.upcomingMatches : [];
  if (!rows.length) {
    elements.upcomingMatchesWrap.innerHTML = `<div class="empty">No upcoming matches on file.</div>`;
    return;
  }

  if (isCompactViewport()) {
    elements.upcomingMatchesWrap.innerHTML = `
      <div class="team-match-list">
        ${rows.map((row) => teamMatchCard(row, profile, apiBase, { mode: "upcoming" })).join("")}
      </div>
    `;
    return;
  }

  elements.upcomingMatchesWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Start</th>
            <th>Starts In</th>
            <th>Status</th>
            <th>Opponent</th>
            <th>Format</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const opponentUrl = teamDetailUrl({
                teamId: row.opponentId,
                teamName: row.opponentName,
                game: row.game || profile.game,
                apiBase,
                matchId: row.matchId,
                opponentId: state.teamId
              });
              const opponentLabel = opponentUrl
                ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
                : (row.opponentName || "Unknown");
              return `
                <tr>
                  <td>${dateTimeLabel(row.startAt)}</td>
                  <td>${relativeStartLabel(row.startAt)}</td>
                  <td><span class="pill ${statusPillClass(row.status)}">${row.status}</span></td>
                  <td>${opponentLabel}</td>
                  <td>BO${row.bestOf || 1}</td>
                  <td>${row.tournament || "Unknown"}</td>
                  <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPastMatches(profile, apiBase) {
  ensurePastTournamentOptions(Array.isArray(profile?.recentMatches) ? profile.recentMatches : []);
  const { rows, total } = buildPastRows(profile);
  if (elements.pastMatchesMeta) {
    elements.pastMatchesMeta.textContent = `Showing ${rows.length} of ${total} past matches`;
  }

  if (!total) {
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">No past matches found for this team.</div>`;
    return;
  }

  if (!rows.length) {
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">No matches match the selected filters.</div>`;
    return;
  }

  if (isCompactViewport()) {
    elements.opponentBreakdownWrap.innerHTML = `
      <div class="team-match-list">
        ${rows.map((row) => teamMatchCard(row, profile, apiBase, { mode: "past" })).join("")}
      </div>
    `;
    return;
  }

  elements.opponentBreakdownWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Result</th>
            <th>Score</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => pastMatchRowMarkup(row, profile, apiBase))
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildOpponentOptions(profile) {
  const table = new Map();
  const add = (id, name) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || normalizedId === String(state.teamId || "")) {
      return;
    }

    const current = table.get(normalizedId);
    const label = String(name || "").trim() || current?.name || `Team ${normalizedId}`;
    table.set(normalizedId, {
      id: normalizedId,
      name: label
    });
  };

  const recentRows = Array.isArray(profile?.recentMatches) ? profile.recentMatches : [];
  const upcomingRows = Array.isArray(profile?.upcomingMatches) ? profile.upcomingMatches : [];
  const breakdownRows = Array.isArray(profile?.opponentBreakdown) ? profile.opponentBreakdown : [];
  for (const row of recentRows) {
    add(row?.opponentId, row?.opponentName);
  }
  for (const row of upcomingRows) {
    add(row?.opponentId, row?.opponentName);
  }
  for (const row of breakdownRows) {
    add(row?.opponentId, row?.opponentName);
  }
  if (profile?.headToHead?.opponentId) {
    add(profile.headToHead.opponentId, profile.headToHead.opponentName);
  }

  return Array.from(table.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function syncOpponentSelect(profile) {
  if (!elements.opponentSelect) {
    return;
  }

  const currentValue = String(elements.opponentSelect.value || state.pendingOpponentId || "").trim();
  const options = buildOpponentOptions(profile);
  if (currentValue && !options.some((option) => option.id === currentValue)) {
    const fallbackName = profile?.headToHead?.opponentId === currentValue
      ? profile?.headToHead?.opponentName
      : null;
    options.unshift({
      id: currentValue,
      name: fallbackName || `Team ${currentValue}`
    });
  }

  const markup = [
    `<option value="">All opponents</option>`,
    ...options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name)}</option>`)
  ].join("");
  elements.opponentSelect.innerHTML = markup;

  const hasCurrent = currentValue && options.some((option) => option.id === currentValue);
  const selectedValue = hasCurrent ? currentValue : "";
  elements.opponentSelect.value = selectedValue;
  state.pendingOpponentId = selectedValue || null;
}

function renderHeadToHead(profile, apiBase) {
  const h2h = profile.headToHead;
  if (!h2h) {
    elements.headToHeadWrap.innerHTML = `<div class="empty">Select an opponent from Team Filters to load direct head-to-head history.</div>`;
    return;
  }

  const rows = Array.isArray(h2h.recentMatches) ? h2h.recentMatches.slice() : [];
  const ordered = rows.slice().sort((left, right) => parseTimestamp(right.startAt) - parseTimestamp(left.startAt));
  const mapWins = ordered.reduce((sum, row) => sum + Number(row?.ownScore || 0), 0);
  const mapLosses = ordered.reduce((sum, row) => sum + Number(row?.oppScore || 0), 0);
  const totalMaps = mapWins + mapLosses;
  const mapWinRate = totalMaps > 0 ? (mapWins / totalMaps) * 100 : null;
  const avgMapsPerSeries = ordered.length > 0 ? totalMaps / ordered.length : null;
  const recentMomentum = ordered
    .slice(0, 5)
    .map((row) => resultLabel(row))
    .join("");
  const lastMeeting = ordered[0] || null;
  const opponentUrl = teamDetailUrl({
    teamId: h2h.opponentId,
    teamName: h2h.opponentName,
    game: profile.game,
    apiBase,
    opponentId: state.teamId
  });
  const opponentBadge = teamBadgeMarkup({
    game: profile.game,
    teamId: h2h.opponentId,
    teamName: h2h.opponentName,
    code: h2h.opponentCode,
    className: "team-match-opponent-badge"
  });
  const opponentLabel = opponentUrl
    ? `<a class="team-link" href="${opponentUrl}">${h2h.opponentName || h2h.opponentId || "Unknown"}</a>`
    : (h2h.opponentName || h2h.opponentId || "Unknown");

  elements.headToHeadWrap.innerHTML = `
    <article class="upcoming-note">
      <div class="team-match-opponent-row">
        ${opponentBadge}
        <p class="meta-text">Opponent: ${opponentLabel}</p>
      </div>
      <p class="meta-text">Matches ${h2h.matches ?? 0} · W ${h2h.wins ?? 0} · L ${h2h.losses ?? 0} · D ${h2h.draws ?? 0}</p>
    </article>
    <div class="upcoming-grid">
      <article class="upcoming-card">
        <p class="tempo-label">Series Win Rate</p>
        <p class="tempo-value">${formatPercent(
          Number(h2h.matches || 0) > 0 ? (Number(h2h.wins || 0) / Number(h2h.matches || 0)) * 100 : null
        )}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Map Win Rate</p>
        <p class="tempo-value">${formatPercent(mapWinRate)}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Map Differential</p>
        <p class="tempo-value">${mapWins - mapLosses}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Avg Maps / Series</p>
        <p class="tempo-value">${avgMapsPerSeries === null ? "n/a" : avgMapsPerSeries.toFixed(2)}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Recent Momentum</p>
        <p class="tempo-value">${recentMomentum || "n/a"}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Last Meeting</p>
        <p class="tempo-value">${lastMeeting ? `${resultLabel(lastMeeting)} ${seriesScoreLabel(lastMeeting)}` : "n/a"}</p>
        <p class="meta-text">${lastMeeting ? dateTimeLabel(lastMeeting.startAt) : ""}</p>
      </article>
    </div>
    ${ordered.length
      ? isCompactViewport()
        ? `<div class="team-match-list">${ordered
            .map((row) => teamMatchCard(row, profile, apiBase, { mode: "h2h" }))
            .join("")}</div>`
        : `<div class="lane-table-wrap">
          <table class="lane-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Result</th>
                <th>Score</th>
                <th>Tournament</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${ordered
                .map(
                  (row) => `
                    <tr>
                      <td>${dateTimeLabel(row.startAt)}</td>
                      <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
                      <td>${seriesScoreLabel(row)}</td>
                      <td>${row.tournament || "Unknown"}</td>
                      <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      : `<div class="empty">No direct meetings found with this opponent.</div>`}
  `;
}

function buildTeamRequestUrl() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const url = new URL(`/v1/teams/${encodeURIComponent(state.teamId)}`, apiBase);
  const game = elements.gameSelect.value;
  const opponent = String(elements.opponentSelect?.value || "").trim();
  const limit = elements.limitSelect.value;

  if (game) url.searchParams.set("game", game);
  if (opponent) url.searchParams.set("opponent_id", opponent);
  if (limit) url.searchParams.set("limit", limit);
  if (state.seedMatchId) url.searchParams.set("seed_match_id", state.seedMatchId);
  if (state.teamNameHint) url.searchParams.set("team_name", state.teamNameHint);

  return url.toString();
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(payload?.error?.message || "API request failed.");
      error.statusCode = response.status;
      throw error;
    }

    return payload || { data: null };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Team profile request timed out.");
      timeoutError.code = "timeout";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function renderTeamLoadingState() {
  const loadingCard = `
    <article class="upcoming-card loading">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
    </article>
  `;
  elements.teamSummaryWrap.innerHTML = `<div class="upcoming-grid">${loadingCard.repeat(6)}</div>`;
  if (elements.performanceInsightsWrap) {
    elements.performanceInsightsWrap.innerHTML = `<div class="upcoming-grid">${loadingCard.repeat(4)}</div>`;
  }
  if (elements.formTimelineWrap) {
    elements.formTimelineWrap.innerHTML = `<div class="loading-grid">${loadingCard.repeat(3)}</div>`;
  }
  const loadingTable = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <tbody>
          <tr><td><div class="skeleton-line"></div></td></tr>
          <tr><td><div class="skeleton-line short"></div></td></tr>
          <tr><td><div class="skeleton-line"></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
  elements.recentMatchesWrap.innerHTML = loadingTable;
  elements.upcomingMatchesWrap.innerHTML = loadingTable;
  elements.opponentBreakdownWrap.innerHTML = loadingTable;
  elements.headToHeadWrap.innerHTML = `<div class="loading-grid">${loadingCard.repeat(2)}</div>`;
}

async function loadTeamProfile() {
  const requestId = ++state.activeLoadRequestId;
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  try {
    localStorage.setItem("pulseboard.apiBase", apiBase);
  } catch {
    // Ignore storage failures in private mode.
  }
  updateNav(apiBase);
  buildBackLink(apiBase);

  try {
    renderTeamLoadingState();
    setStatus("Loading team profile...", "loading");
    elements.teamMetaText.textContent = "Loading team profile...";
    const payload = await fetchJsonWithTimeout(buildTeamRequestUrl());
    if (requestId !== state.activeLoadRequestId) {
      return;
    }

    const profile = payload.data;
    state.profile = profile;
    elements.teamTitle.textContent = `${profile.name} · ${gameLabel(normalizeGameKey(profile.game || "lol"))}`;
    syncOpponentSelect(profile);
    renderSummary(profile);
    renderPerformanceInsights(profile);
    renderFormTimeline(profile);
    renderRecentMatches(profile, apiBase);
    renderUpcomingMatches(profile, apiBase);
    renderPastMatches(profile, apiBase);
    renderHeadToHead(profile, apiBase);
    refreshTeamSeo(profile);
    applyTeamMobilePanelCollapseState();
    renderTeamQuickJump();
    setStatus("Team profile synced.", "success");
  } catch (error) {
    if (requestId !== state.activeLoadRequestId) {
      return;
    }
    state.profile = null;
    state.pastTournamentSignature = null;
    setStatus(`Error: ${error.message}`, "error");
    elements.teamTitle.textContent = `Error loading team: ${error.message}`;
    elements.teamMetaText.textContent =
      error?.code === "timeout" ? "Team profile request timed out." : "";
    if (elements.performanceMetaText) {
      elements.performanceMetaText.textContent = "";
    }
    if (elements.formTimelineMeta) {
      elements.formTimelineMeta.textContent = "";
    }
    if (elements.pastMatchesMeta) {
      elements.pastMatchesMeta.textContent = "";
    }
    if (elements.pastTournamentFilter) {
      elements.pastTournamentFilter.innerHTML = `<option value="all">All</option>`;
      elements.pastTournamentFilter.value = "all";
    }
    elements.teamSummaryWrap.innerHTML = `<div class="empty">Unable to load team snapshot.</div>`;
    if (elements.performanceInsightsWrap) {
      elements.performanceInsightsWrap.innerHTML = `<div class="empty">Unable to load performance insights.</div>`;
    }
    if (elements.formTimelineWrap) {
      elements.formTimelineWrap.innerHTML = `<div class="empty">Unable to load form timeline.</div>`;
    }
    elements.recentMatchesWrap.innerHTML = `<div class="empty">Unable to load recent matches.</div>`;
    elements.upcomingMatchesWrap.innerHTML = `<div class="empty">Unable to load upcoming matches.</div>`;
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">Unable to load past matches.</div>`;
    elements.headToHeadWrap.innerHTML = `<div class="empty">Unable to load head-to-head data.</div>`;
    refreshTeamSeo(null);
    applyTeamMobilePanelCollapseState();
    renderTeamQuickJump();
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadTeamProfile);
  elements.saveButton.addEventListener("click", () => {
    const value = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    saveApiBase(value);
    setStatus("API base saved locally.", "success");
  });
  elements.gameSelect.addEventListener("change", loadTeamProfile);
  elements.limitSelect.addEventListener("change", loadTeamProfile);
  if (elements.opponentSelect) {
    elements.opponentSelect.addEventListener("change", () => {
      state.pendingOpponentId = String(elements.opponentSelect.value || "").trim() || null;
      loadTeamProfile();
    });
  }
  if (elements.pastResultFilter) {
    elements.pastResultFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastSortFilter) {
    elements.pastSortFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastOpponentSearch) {
    elements.pastOpponentSearch.addEventListener("input", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastTournamentFilter) {
    elements.pastTournamentFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.exportPastCsvButton) {
    elements.exportPastCsvButton.addEventListener("click", () => {
      exportPastMatchesCsv(state.profile);
    });
  }
}

function boot() {
  const route = parseTeamRoute();
  const teamId = route.id;
  if (!teamId) {
    elements.teamTitle.textContent = "Missing team id.";
    setStatus("Use /team/<team-id> or ?id=<team-id> in the URL.", "error");
    return;
  }

  state.teamId = teamId;
  state.seedMatchId = route.matchId;
  state.seedGameNumber = route.gameNumber;
  state.teamNameHint = route.teamName;

  const apiBase = route.api || readApiBase();
  elements.apiBaseInput.value = apiBase;

  const game = route.game;
  if (game) {
    elements.gameSelect.value = game;
  }

  const opponent = route.opponent;
  if (opponent) {
    state.pendingOpponentId = opponent;
    if (elements.opponentSelect) {
      elements.opponentSelect.innerHTML = [
        `<option value="">All opponents</option>`,
        `<option value="${escapeHtml(opponent)}">Team ${escapeHtml(opponent)}</option>`
      ].join("");
      elements.opponentSelect.value = opponent;
    }
  } else if (elements.opponentSelect) {
    elements.opponentSelect.value = "";
  }

  const limit = route.limit;
  if (limit && ["5", "10", "15", "20"].includes(limit)) {
    elements.limitSelect.value = limit;
  } else {
    elements.limitSelect.value = "5";
  }

  if (elements.pastResultFilter) {
    elements.pastResultFilter.value = "all";
  }
  if (elements.pastSortFilter) {
    elements.pastSortFilter.value = "newest";
  }
  if (elements.pastOpponentSearch) {
    elements.pastOpponentSearch.value = "";
  }
  if (elements.pastTournamentFilter) {
    elements.pastTournamentFilter.innerHTML = `<option value="all">All</option>`;
    elements.pastTournamentFilter.value = "all";
  }
  state.pastTournamentSignature = null;

  setupControlsPanel();
  bindTeamMobilePanelControls();
  bindTeamQuickJump();
  bindDesktopTeamQuickNav();
  applyTeamMobilePanelCollapseState();
  renderTeamQuickJump();
  refreshTeamSeo(null);
  installEvents();
  loadTeamProfile();
}

window.addEventListener("resize", () => {
  if (state.profile) {
    const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    renderSummary(state.profile);
    renderRecentMatches(state.profile, apiBase);
    renderUpcomingMatches(state.profile, apiBase);
    renderPastMatches(state.profile, apiBase);
    renderHeadToHead(state.profile, apiBase);
  }
  applyTeamMobilePanelCollapseState();
  renderTeamQuickJump();
});

boot();
