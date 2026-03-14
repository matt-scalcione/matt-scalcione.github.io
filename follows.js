import { resolveInitialApiBase } from "./api-config.js";
import { applyRouteContext, buildMatchUrl, buildTeamUrl } from "./routes.js?v=20260309c";
import { applySeo, inferRobotsDirective, setJsonLd } from "./seo.js";
import { productEmptyMarkup } from "./loading.js";
import { loadRuntimeStatusPanel } from "./runtime-status.js";
import { resolveWorkspaceUserId, saveWorkspaceUserId, workspaceUserLabel } from "./workspace-user.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_API_TIMEOUT_MS = 8000;
const MOBILE_BREAKPOINT = 760;
const PRODUCT_GUIDE_KEY = "pulseboard.productGuideDismissed.watchlist";
const FOLLOWS_JUMP_TARGETS = [
  { id: "alertsPanel", label: "Now" },
  { id: "outboxPanel", label: "Queue" },
  { id: "followsBlock", label: "Watchlist" },
  { id: "prefsBlock", label: "Rules" }
];

const elements = {
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
  userIdInput: document.querySelector("#userIdInput"),
  refreshButton: document.querySelector("#refreshButton"),
  saveApiButton: document.querySelector("#saveApiButton"),
  statusText: document.querySelector("#statusText"),
  heroContextLabel: document.querySelector("#heroContextLabel"),
  heroContextValue: document.querySelector("#heroContextValue"),
  heroContextCopy: document.querySelector("#heroContextCopy"),
  heroContextChips: document.querySelector("#heroContextChips"),
  heroActionRow: document.querySelector("#heroActionRow"),
  runtimeTrustPanel: document.querySelector("#runtimeTrustPanel"),
  quickJump: document.querySelector("#followsQuickJump"),
  productGuidePanel: document.querySelector("#productGuidePanel"),
  watchlistLensStrip: document.querySelector("#watchlistLensStrip"),
  entityTypeSelect: document.querySelector("#entityTypeSelect"),
  entityIdInput: document.querySelector("#entityIdInput"),
  addFollowButton: document.querySelector("#addFollowButton"),
  followsMeta: document.querySelector("#followsMeta"),
  followsList: document.querySelector("#followsList"),
  followsSummaryWrap: document.querySelector("#followsSummaryWrap"),
  followsSummaryHero: document.querySelector("#followsSummaryHero"),
  alertsMeta: document.querySelector("#alertsMeta"),
  alertsPreviewWrap: document.querySelector("#alertsPreviewWrap"),
  alertOutboxMeta: document.querySelector("#alertOutboxMeta"),
  alertOutboxWrap: document.querySelector("#alertOutboxWrap"),
  followsViewSwitch: document.querySelector("#followsViewSwitch"),
  followsViewButtons: Array.from(document.querySelectorAll("#followsViewSwitch [data-view]")),
  followsBlock: document.querySelector("#followsBlock"),
  prefsBlock: document.querySelector("#prefsBlock"),
  prefsSectionHead: document.querySelector("#prefsBlock .section-head"),
  webPushInput: document.querySelector("#webPushInput"),
  emailDigestInput: document.querySelector("#emailDigestInput"),
  swingAlertsInput: document.querySelector("#swingAlertsInput"),
  matchStartInput: document.querySelector("#matchStartInput"),
  matchFinalInput: document.querySelector("#matchFinalInput"),
  savePrefsButton: document.querySelector("#savePrefsButton")
};
let followsViewMode = "both";
const followsState = {
  rows: [],
  preferences: null,
  alertPreview: null,
  alertOutbox: null,
  activeLoadRequestId: 0
};

function refreshFollowsSeo() {
  const inferred = inferRobotsDirective({ allowedQueryParams: [] });
  applySeo({
    title: "Follows & Alerts | Pulseboard",
    description: "Manage followed teams and notification preferences on Pulseboard.",
    canonicalPath: "/follows.html",
    robots: inferred === "index,follow" ? "noindex,follow" : "noindex,nofollow"
  });
  setJsonLd("follows-itemlist", null);
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCompactViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function scrollToFollowsTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const topOffset = isCompactViewport() ? 124 : 88;
  const top = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - topOffset));
  window.scrollTo({ top, behavior: "smooth" });
}

function setFollowsQuickJumpActive(targetId) {
  if (!elements.quickJump) {
    return;
  }

  const activeTarget = String(targetId || "");
  for (const button of elements.quickJump.querySelectorAll("[data-jump-target]")) {
    const matches = button.getAttribute("data-jump-target") === activeTarget;
    button.classList.toggle("active", matches);
    if (matches) {
      button.setAttribute("aria-pressed", "true");
    } else {
      button.removeAttribute("aria-pressed");
    }
  }
}

function renderFollowsQuickJump() {
  if (!elements.quickJump) {
    return;
  }

  if (!isCompactViewport()) {
    elements.quickJump.hidden = true;
    elements.quickJump.innerHTML = "";
    return;
  }

  const visibleTargets = FOLLOWS_JUMP_TARGETS.filter((item) => {
    const target = document.getElementById(item.id);
    if (!target) {
      return false;
    }
    return !target.hidden && !target.classList.contains("hidden-panel");
  });

  if (!visibleTargets.length) {
    elements.quickJump.hidden = true;
    elements.quickJump.innerHTML = "";
    return;
  }

  elements.quickJump.hidden = false;
  elements.quickJump.innerHTML = visibleTargets
    .map(
      (item) =>
        `<button type="button" class="team-jump-chip" data-jump-target="${item.id}">${item.label}</button>`
    )
    .join("");
  setFollowsQuickJumpActive(visibleTargets[0]?.id || "");
}

function bindFollowsQuickJump() {
  if (!elements.quickJump || elements.quickJump.dataset.bound === "1") {
    return;
  }

  elements.quickJump.dataset.bound = "1";
  elements.quickJump.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-jump-target]");
    if (!button) {
      return;
    }
    const jumpTarget = button.getAttribute("data-jump-target") || "";
    if (!jumpTarget) {
      return;
    }
    setFollowsQuickJumpActive(jumpTarget);
    scrollToFollowsTarget(jumpTarget);
  });
}

function applyControlsCollapsed(collapsed) {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  elements.controlsPanel.classList.toggle("collapsed", collapsed);
  if (isCompactViewport()) {
    elements.controlsToggle.textContent = collapsed ? "Filters" : "Close";
  } else {
    elements.controlsToggle.textContent = collapsed ? "Show Panel" : "Hide Panel";
  }
  elements.controlsToggle.setAttribute("aria-expanded", String(!collapsed));
}

function setupControlsPanel() {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  let collapsed = isCompactViewport();
  try {
    const saved = localStorage.getItem("pulseboard.follows.controlsCollapsed");
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
      localStorage.setItem("pulseboard.follows.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function applyFollowsViewMode(mode) {
  const normalized =
    mode === "follows" || mode === "prefs" || mode === "both" ? mode : "both";
  followsViewMode = normalized;

  const compact = isCompactViewport();
  const showFollows = !compact || normalized === "both" || normalized === "follows";
  const showPrefs = !compact || normalized === "both" || normalized === "prefs";

  if (elements.followsBlock) {
    elements.followsBlock.hidden = !showFollows;
  }
  if (elements.prefsBlock) {
    elements.prefsBlock.hidden = !showPrefs;
  }
  if (elements.prefsSectionHead) {
    elements.prefsSectionHead.classList.toggle("top-space", showFollows && showPrefs);
  }

  for (const button of elements.followsViewButtons) {
    const active = button.getAttribute("data-view") === normalized;
    button.setAttribute("aria-pressed", String(active));
  }

  renderFollowsQuickJump();
}

function setupFollowsViewSwitch() {
  if (!elements.followsViewSwitch) {
    return;
  }

  try {
    const saved = localStorage.getItem("pulseboard.follows.mobileView");
    if (saved === "follows" || saved === "prefs" || saved === "both") {
      followsViewMode = saved;
    }
  } catch {
    followsViewMode = "both";
  }

  applyFollowsViewMode(followsViewMode);
  elements.followsViewSwitch.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-view]");
    if (!button) {
      return;
    }

    const next = button.getAttribute("data-view") || "both";
    applyFollowsViewMode(next);
    try {
      localStorage.setItem("pulseboard.follows.mobileView", followsViewMode);
    } catch {
      // Ignore storage failures in private mode.
    }
  });
}

function updateNav() {
  const { apiBase } = getContext();
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
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function alertTypeLabel(type) {
  if (type === "start") return "Start";
  if (type === "swing") return "Swing";
  if (type === "final") return "Final";
  return "Alert";
}

function alertToneClass(tone) {
  if (tone === "live") return "live";
  if (tone === "complete") return "complete";
  if (tone === "warning") return "upcoming";
  return "neutral";
}

function followEntityTypeLabel(type) {
  if (type === "team") return "Team";
  if (type === "player") return "Player";
  if (type === "tournament") return "Tournament";
  return "Entity";
}

function followGameLabel(game) {
  if (game === "lol") return "LoL";
  if (game === "dota2") return "Dota 2";
  return "";
}

function followSignalTone(state) {
  if (state === "live") return "live";
  if (state === "upcoming") return "upcoming";
  if (state === "recent") return "complete";
  return "neutral";
}

function deliveryStatusPill(status) {
  if (status === "delivered") return "live";
  if (status === "acknowledged") return "complete";
  if (status === "failed") return "upcoming";
  return "neutral";
}

function renderSummaryHero() {
  if (!elements.followsSummaryWrap) {
    return;
  }

  const { userId } = getContext();
  const rows = followsState.rows || [];
  const preferences = followsState.preferences;
  const previewCount = Number(followsState.alertPreview?.summary?.totalAlerts || 0);
  const pendingOutbox = Number(followsState.alertOutbox?.summary?.pending || 0);

  if (!userId) {
    elements.followsSummaryWrap.innerHTML = productEmptyMarkup({
      eyebrow: "Workspace locked",
      title: "Add a user ID to open the watchlist",
      body: "The watchlist, rules, and delivery queue are all scoped to a specific user profile.",
      tips: ["Use demo-user", "Then add a team follow", "Reload the page state"],
      compact: true
    });
    return;
  }

  const teamCount = rows.filter((row) => row.entityType === "team").length;
  const playerCount = rows.filter((row) => row.entityType === "player").length;
  const tournamentCount = rows.filter((row) => row.entityType === "tournament").length;
  const enabledAlerts = preferences
    ? ["webPush", "emailDigest", "swingAlerts", "matchStart", "matchFinal"].filter((key) => Boolean(preferences?.[key])).length
    : 0;

  if (elements.heroContextLabel && elements.heroContextValue && elements.heroContextCopy) {
    elements.heroContextLabel.textContent = "Workspace";
    elements.heroContextValue.textContent = workspaceUserLabel(userId);
    elements.heroContextCopy.textContent = rows.length
      ? `${rows.length} tracked entities, ${previewCount} alert candidates, ${pendingOutbox} queue items. Use this page to turn discovery into durable signal.`
      : "Start by following a team or tournament, then enable the alert rules that actually matter.";
    if (elements.heroContextChips) {
      elements.heroContextChips.innerHTML = `
        <span class="hero-chip">${rows.length} follows</span>
        <span class="hero-chip">${previewCount} alerts</span>
        <span class="hero-chip">${pendingOutbox} queued</span>
      `;
    }
  }

  renderHeroActions(previewCount);
  renderWatchlistLens(rows, enabledAlerts, previewCount, pendingOutbox);
  renderProductGuide(rows);

  elements.followsSummaryWrap.innerHTML = `
    <article class="overview-card">
      <p class="overview-label">Watchlist</p>
      <p class="overview-value">${rows.length}</p>
      <p class="overview-note">Tracked entities tied to the current user ID.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Teams</p>
      <p class="overview-value">${teamCount}</p>
      <p class="overview-note">Team follows currently configured.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Tournaments</p>
      <p class="overview-value">${tournamentCount}</p>
      <p class="overview-note">Tournament follows currently configured.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Rules On</p>
      <p class="overview-value">${enabledAlerts}</p>
      <p class="overview-note">Enabled alert categories for this account.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Attention Now</p>
      <p class="overview-value">${previewCount}</p>
      <p class="overview-note">Current alert candidates based on follows and rules.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Queue Pending</p>
      <p class="overview-value">${pendingOutbox}</p>
      <p class="overview-note">Outbox items not yet acknowledged.</p>
    </article>
    <article class="overview-featured static">
      <div class="overview-featured-top">
        <span class="pill live">Signal posture</span>
        <span class="overview-featured-meta">${escapeHtml(workspaceUserLabel(userId))}</span>
      </div>
      <p class="overview-featured-match">Keep the right entities in view and route alerts with less noise.</p>
      <div class="overview-inline-row">
        <span class="mini-chip">${teamCount} teams</span>
        <span class="mini-chip">${playerCount} players</span>
        <span class="mini-chip">${tournamentCount} tournaments</span>
      </div>
      <p class="overview-note">Use this page to control the watchlist, alert rules, and current delivery queue from one place.</p>
    </article>
  `;
}

function renderHeroActions(previewCount) {
  if (!elements.heroActionRow) {
    return;
  }

  const { apiBase } = getContext();
  const liveDeskHref = applyRouteContext(new URL("./index.html", window.location.href), { apiBase }).toString();
  const scheduleHref = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase }).toString();

  elements.heroActionRow.innerHTML = `
    <a class="link-btn" href="${previewCount ? "#alertsPreviewWrap" : liveDeskHref}">${previewCount ? "Review alerts" : "Open live desk"}</a>
    <a class="link-btn ghost" href="${scheduleHref}">Open schedule</a>
  `;
}

function renderWatchlistLens(rows, enabledAlerts, previewCount, pendingOutbox) {
  if (!elements.watchlistLensStrip) {
    return;
  }

  const { userId } = getContext();
  const pref = followsState.preferences || {};
  const chips = [
    `<span class="lens-chip lens-chip-primary">${userId ? escapeHtml(userId) : "No user"}</span>`,
    `<span class="lens-chip">${rows.length} follows</span>`,
    `<span class="lens-chip">${enabledAlerts} rules on</span>`
  ];

  if (pref.webPush) chips.push(`<span class="lens-chip">Web push</span>`);
  if (pref.emailDigest) chips.push(`<span class="lens-chip">Email digest</span>`);
  chips.push(`<span class="lens-chip">${previewCount} alerts</span>`);
  chips.push(`<span class="lens-chip">${pendingOutbox} queued</span>`);

  elements.watchlistLensStrip.innerHTML = `
    <div class="lens-strip-shell">
      <div>
        <p class="lens-kicker">Workspace lens</p>
        <p class="lens-copy">${userId ? "This workspace is scoped to one user profile and the active delivery rules below." : "Add a user ID to activate a real watchlist workspace."}</p>
      </div>
      <div class="lens-chip-row">${chips.join("")}</div>
    </div>
  `;
}

function renderProductGuide(rows) {
  if (!elements.productGuidePanel) {
    return;
  }

  if (guideDismissed()) {
    elements.productGuidePanel.classList.add("hidden-panel");
    elements.productGuidePanel.innerHTML = "";
    return;
  }

  elements.productGuidePanel.classList.remove("hidden-panel");
  elements.productGuidePanel.innerHTML = `
    <div class="guide-shell">
      <div class="guide-head">
        <div>
          <p class="guide-kicker">Quick start</p>
          <h2>Turn discovery into signal</h2>
          <p class="guide-copy">This page matters after you already know what deserves long-term attention. Save the right teams, enable only the right rules, then let the queue validate the setup.</p>
        </div>
        <button type="button" class="ghost guide-dismiss" data-guide-dismiss="true">Hide guide</button>
      </div>
      <div class="guide-step-grid">
        <article class="guide-step">
          <p class="guide-step-index">01</p>
          <h3>Discover first</h3>
          <p>Use Live Desk and Schedule to decide which teams or tournaments are worth following.</p>
        </article>
        <article class="guide-step">
          <p class="guide-step-index">02</p>
          <h3>Save entities</h3>
          <p>${rows.length ? `${rows.length} entity${rows.length === 1 ? "" : "ies"} already tracked.` : "Add a team or tournament so alerts have something real to monitor."}</p>
        </article>
        <article class="guide-step">
          <p class="guide-step-index">03</p>
          <h3>Validate delivery</h3>
          <p>Use Attention Now and Delivery Queue to make sure the rules are surfacing signal without noise.</p>
        </article>
      </div>
    </div>
  `;
}

function renderLoadingFollows() {
  followsState.rows = [];
  renderSummaryHero();
  elements.followsList.innerHTML = `
    <div class="loading-grid" aria-hidden="true">
      ${Array.from({ length: 4 })
        .map(
          () => `
            <article class="follow-item loading">
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function getContext() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const userId = elements.userIdInput.value.trim();
  saveWorkspaceUserId(userId);
  return { apiBase, userId };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Follows request timed out.");
      timeoutError.code = "timeout";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function renderFollows(rows) {
  followsState.rows = rows;
  renderSummaryHero();
  const teamCount = rows.filter((row) => row.entityType === "team").length;
  const playerCount = rows.filter((row) => row.entityType === "player").length;
  const tournamentCount = rows.filter((row) => row.entityType === "tournament").length;
  if (!rows.length) {
    elements.followsList.innerHTML = `
      <div class="empty">
        <p class="empty-title">No Follows Yet</p>
        <p class="meta-text">Use Add Follow to track teams, players, or tournaments.</p>
      </div>
    `;
    elements.followsMeta.textContent = "No follows saved yet.";
    return;
  }

  elements.followsList.innerHTML = rows
    .map(
      (row) => {
        const title = escapeHtml(row.displayName || row.entityId);
        const gameLabel = followGameLabel(row.game);
        const signalLabel = escapeHtml(row.signalLabel || "Watching");
        const signalDetail = escapeHtml(row.signalDetail || "Waiting for the next series.");
        const teamHref =
          row.entityType === "team"
            ? buildTeamUrl({
                teamId: row.entityId,
                game: row.game,
                matchId: row.liveMatchId || row.nextMatchId || row.recentMatchId || null,
                teamName: row.displayName || row.entityId
              })
            : "";
        const matchHref = buildMatchUrl({
          matchId: row.liveMatchId || row.nextMatchId || row.recentMatchId || null
        });
        const primaryHref = row.liveMatchId || row.nextMatchId || row.recentMatchId ? matchHref : teamHref;
        const primaryLabel =
          row.liveMatchId ? "Open live" : row.nextMatchId ? "Open next" : row.recentMatchId ? "Open latest" : "Open team";
        return `
      <article class="follow-item">
        <div class="follow-item-head">
          <div class="follow-item-main">
            <div class="follow-alert-top">
              <span class="follow-entity-chip">${followEntityTypeLabel(row.entityType)}</span>
              ${gameLabel ? `<span class="pill neutral">${escapeHtml(gameLabel)}</span>` : ""}
              <span class="pill ${followSignalTone(row.signalState)}">${signalLabel}</span>
            </div>
            <p class="follow-title"><strong>${title}</strong></p>
            <p class="meta-text">${signalDetail}</p>
            <p class="meta-text follow-created">Saved ${new Date(row.createdAt).toLocaleString()}${row.canonicalEntityId ? ` · ${escapeHtml(row.canonicalEntityId)}` : ""}</p>
          </div>
        </div>
        <div class="follow-actions">
          ${primaryHref ? `<a class="link-btn" href="${primaryHref}">${primaryLabel}</a>` : ""}
          ${teamHref && primaryHref !== teamHref ? `<a class="link-btn ghost" href="${teamHref}">Team</a>` : ""}
          <button type="button" class="danger-btn" data-follow-id="${row.id}">Remove</button>
        </div>
      </article>
    `;
      }
    )
    .join("");
  elements.followsMeta.textContent = `${rows.length} follows · ${teamCount} teams · ${playerCount} players · ${tournamentCount} tournaments`;
}

function renderPreferences(pref) {
  followsState.preferences = pref;
  renderSummaryHero();
  elements.webPushInput.checked = Boolean(pref.webPush);
  elements.emailDigestInput.checked = Boolean(pref.emailDigest);
  elements.swingAlertsInput.checked = Boolean(pref.swingAlerts);
  elements.matchStartInput.checked = Boolean(pref.matchStart);
  elements.matchFinalInput.checked = Boolean(pref.matchFinal);
}

function renderAlertPreview(payload) {
  followsState.alertPreview = payload || null;

  if (!elements.alertsPreviewWrap || !elements.alertsMeta) {
    renderSummaryHero();
    return;
  }

  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const summary = payload?.summary || {};
  const byType = Object.entries(summary.byType || {})
    .map(([type, count]) => `${alertTypeLabel(type)} ${count}`)
    .join(" · ");

  elements.alertsMeta.textContent = alerts.length
    ? `${alerts.length} current alert candidates${byType ? ` · ${byType}` : ""}`
    : "No alert candidates right now for the selected user.";

  if (!alerts.length) {
    elements.alertsPreviewWrap.innerHTML = productEmptyMarkup({
      eyebrow: "Attention now",
      title: "No active alert candidates",
      body: "Nothing in the current schedule is matching this watchlist and rule set right now.",
      tips: ["Follow more teams", "Enable more rules", "Check again near match start"],
      compact: true
    });
    renderSummaryHero();
    return;
  }

  elements.alertsPreviewWrap.innerHTML = alerts
    .map(
      (alert) => `
        <article class="follow-item follow-alert-item">
          <div class="follow-item-main">
            <div class="follow-alert-top">
              <span class="pill ${alertToneClass(alert.tone)}">${alertTypeLabel(alert.type)}</span>
              <span class="meta-text">${new Date(alert.occurredAt).toLocaleString()}</span>
            </div>
            <p class="follow-title"><strong>${escapeHtml(alert.title)}</strong></p>
            <p class="meta-text">${escapeHtml(alert.detail)}</p>
          </div>
          <div class="follow-actions">
            <a class="link-btn" href="${buildMatchUrl({ matchId: alert.matchId })}">Open</a>
          </div>
        </article>
      `
    )
    .join("");

  renderSummaryHero();
}

function renderAlertOutbox(payload) {
  followsState.alertOutbox = payload || null;

  if (!elements.alertOutboxWrap || !elements.alertOutboxMeta) {
    renderSummaryHero();
    return;
  }

  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const summary = payload?.summary || {};
  elements.alertOutboxMeta.textContent = alerts.length
    ? `${summary.total || alerts.length} queued · ${summary.pending || 0} pending · ${summary.acknowledged || 0} acknowledged`
    : "No alert events in the queue for this user.";

  if (!alerts.length) {
    elements.alertOutboxWrap.innerHTML = productEmptyMarkup({
      eyebrow: "Delivery queue",
      title: "No alert events are queued",
      body: "Once a watched team triggers a start, final, or swing event, it will appear here.",
      tips: ["Preview current alerts", "Enable match start", "Enable finals"],
      compact: true
    });
    renderSummaryHero();
    return;
  }

  elements.alertOutboxWrap.innerHTML = alerts
    .map(
      (alert) => `
        <article class="follow-item follow-alert-item">
          <div class="follow-item-main">
            <div class="follow-alert-top">
              <span class="pill ${alertToneClass(alert.tone)}">${alertTypeLabel(alert.type)}</span>
              <span class="pill ${deliveryStatusPill(alert.deliveryStatus)}">${escapeHtml(alert.deliveryStatus || "pending")}</span>
              <span class="meta-text">${new Date(alert.lastSeenAt || alert.occurredAt).toLocaleString()}</span>
            </div>
            <p class="follow-title"><strong>${escapeHtml(alert.title)}</strong></p>
            <p class="meta-text">${escapeHtml(alert.detail)}</p>
          </div>
          <div class="follow-actions">
            ${
              alert.deliveryStatus === "acknowledged"
                ? `<span class="meta-text">Acked</span>`
                : `<button type="button" class="ghost" data-alert-id="${escapeHtml(alert.id)}">Acknowledge</button>`
            }
          </div>
        </article>
      `
    )
    .join("");

  renderSummaryHero();
}

async function loadFollows() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    followsState.rows = [];
    renderSummaryHero();
    setStatus("User ID is required.", "error");
    elements.followsList.innerHTML = `<div class="empty">Add a user ID to load follows.</div>`;
    elements.followsMeta.textContent = "Add a user ID to load follows.";
    return;
  }

  renderLoadingFollows();
  const payload = await requestJson(
    `${apiBase}/v1/follows?user_id=${encodeURIComponent(userId)}`
  );
  renderFollows(payload.data || []);
}

async function loadPreferences() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    followsState.preferences = null;
    renderSummaryHero();
    return;
  }

  const payload = await requestJson(
    `${apiBase}/v1/notification-preferences?user_id=${encodeURIComponent(userId)}`
  );
  renderPreferences(payload.data);
}

async function loadAlertPreview() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    renderAlertPreview(null);
    return;
  }

  try {
    const payload = await requestJson(
      `${apiBase}/v1/alerts-preview?user_id=${encodeURIComponent(userId)}`
    );
    renderAlertPreview(payload.data || null);
  } catch (error) {
    if (elements.alertsMeta) {
      elements.alertsMeta.textContent = "Alert preview unavailable.";
    }
    if (elements.alertsPreviewWrap) {
      elements.alertsPreviewWrap.innerHTML = productEmptyMarkup({
        eyebrow: "Attention now",
        title: "Alert preview is unavailable",
        body: error.message || "The API could not build the current alert preview.",
        tips: ["Reload the page", "Check the API", "Try again shortly"],
        compact: true
      });
    }
    followsState.alertPreview = null;
    renderSummaryHero();
  }
}

async function loadAlertOutbox() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    renderAlertOutbox(null);
    return;
  }

  try {
    const payload = await requestJson(
      `${apiBase}/v1/alert-outbox?user_id=${encodeURIComponent(userId)}`
    );
    renderAlertOutbox(payload.data || null);
  } catch (error) {
    if (elements.alertOutboxMeta) {
      elements.alertOutboxMeta.textContent = "Alert queue unavailable.";
    }
    if (elements.alertOutboxWrap) {
      elements.alertOutboxWrap.innerHTML = productEmptyMarkup({
        eyebrow: "Delivery queue",
        title: "Alert queue is unavailable",
        body: error.message || "The API could not load the alert queue.",
        tips: ["Reload the page", "Check the API", "Try again shortly"],
        compact: true
      });
    }
    followsState.alertOutbox = null;
    renderSummaryHero();
  }
}

async function acknowledgeAlert(alertId) {
  const { apiBase, userId } = getContext();
  if (!userId || !alertId) {
    setStatus("User ID and alert ID are required.", "error");
    return;
  }

  try {
    setStatus("Acknowledging alert...", "loading");
    await requestJson(`${apiBase}/v1/alert-outbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        alertIds: [alertId]
      })
    });
    await loadAlertOutbox();
    setStatus("Alert acknowledged.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function loadAll() {
  const requestId = ++followsState.activeLoadRequestId;
  try {
    const { apiBase } = getContext();
    loadRuntimeStatusPanel(elements.runtimeTrustPanel, apiBase, {
      eyebrow: "Trust",
      title: "Alert runtime status"
    });
    try {
      localStorage.setItem("pulseboard.apiBase", apiBase);
    } catch {
      // Ignore storage failures in private mode.
    }
    updateNav();
    setStatus("Loading watchlist and rules...", "loading");
    if (elements.alertsMeta) {
      elements.alertsMeta.textContent = "Loading alert preview...";
    }
    if (elements.alertOutboxMeta) {
      elements.alertOutboxMeta.textContent = "Loading alert queue...";
    }
    const [followsResult, preferencesResult, previewResult, outboxResult] = await Promise.allSettled([
      loadFollows(),
      loadPreferences(),
      loadAlertPreview(),
      loadAlertOutbox()
    ]);

    if (requestId !== followsState.activeLoadRequestId) {
      return;
    }

    if (
      followsResult.status === "fulfilled" &&
      preferencesResult.status === "fulfilled" &&
      previewResult.status === "fulfilled" &&
      outboxResult.status === "fulfilled"
    ) {
      setStatus("Watchlist loaded.", "success");
      return;
    }

    if (
      followsResult.status === "fulfilled" ||
      preferencesResult.status === "fulfilled" ||
      previewResult.status === "fulfilled" ||
      outboxResult.status === "fulfilled"
    ) {
      setStatus("Partial load. One request was slow or unavailable.", "error");
      return;
    }

    throw followsResult.reason || preferencesResult.reason || previewResult.reason || outboxResult.reason || new Error("Unable to load watchlist.");
  } catch (error) {
    if (requestId !== followsState.activeLoadRequestId) {
      return;
    }
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function addFollow() {
  const { apiBase, userId } = getContext();
  const entityType = elements.entityTypeSelect.value;
  const entityId = elements.entityIdInput.value.trim();

  if (!userId || !entityId) {
    setStatus("User ID and Entity ID are required.", "error");
    return;
  }

  try {
    setStatus("Adding follow...", "loading");
    await requestJson(`${apiBase}/v1/follows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        entityType,
        entityId
      })
    });

    elements.entityIdInput.value = "";
    await loadFollows();
    setStatus("Follow added.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function removeFollow(followId) {
  const { apiBase, userId } = getContext();
  if (!userId) {
    setStatus("User ID is required.", "error");
    return;
  }

  try {
    setStatus("Removing follow...", "loading");
    await requestJson(
      `${apiBase}/v1/follows/${encodeURIComponent(followId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );

    await loadFollows();
    setStatus("Follow removed.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function savePreferences() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    setStatus("User ID is required.", "error");
    return;
  }

  try {
    setStatus("Saving preferences...", "loading");
    await requestJson(`${apiBase}/v1/notification-preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        webPush: elements.webPushInput.checked,
        emailDigest: elements.emailDigestInput.checked,
        swingAlerts: elements.swingAlertsInput.checked,
        matchStart: elements.matchStartInput.checked,
        matchFinal: elements.matchFinalInput.checked
      })
    });

    followsState.preferences = {
      webPush: elements.webPushInput.checked,
      emailDigest: elements.emailDigestInput.checked,
      swingAlerts: elements.swingAlertsInput.checked,
      matchStart: elements.matchStartInput.checked,
      matchFinal: elements.matchFinalInput.checked
    };
    renderSummaryHero();
    setStatus("Preferences saved.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadAll);
  elements.addFollowButton.addEventListener("click", addFollow);
  elements.savePrefsButton.addEventListener("click", savePreferences);
  elements.userIdInput.addEventListener("change", () => {
    saveWorkspaceUserId(elements.userIdInput.value);
    loadAll();
  });
  elements.userIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveWorkspaceUserId(elements.userIdInput.value);
      loadAll();
    }
  });

  elements.saveApiButton.addEventListener("click", () => {
    const { apiBase } = getContext();
    saveApiBase(apiBase);
    updateNav();
    setStatus("API base saved locally.", "success");
  });

  elements.followsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-follow-id]");
    if (!button) return;
    if (!window.confirm("Remove this follow?")) {
      return;
    }
    removeFollow(button.getAttribute("data-follow-id"));
  });

  if (elements.alertOutboxWrap) {
    elements.alertOutboxWrap.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-alert-id]");
      if (!button) {
        return;
      }
      acknowledgeAlert(button.getAttribute("data-alert-id"));
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
      renderProductGuide(followsState.rows || []);
    });
  }
}

function boot() {
  const startupApiBase = readApiBase();
  elements.apiBaseInput.value = startupApiBase;
  elements.userIdInput.value = resolveWorkspaceUserId({
    fallback: "demo-user"
  });
  updateNav();
  loadRuntimeStatusPanel(elements.runtimeTrustPanel, startupApiBase, {
    eyebrow: "Trust",
    title: "Alert runtime status"
  });
  refreshFollowsSeo();
  setupControlsPanel();
  setupFollowsViewSwitch();
  bindFollowsQuickJump();
  renderSummaryHero();
  renderFollowsQuickJump();
  installEvents();
  loadAll();
}

window.addEventListener("resize", () => {
  applyFollowsViewMode(followsViewMode);
  if (elements.controlsPanel) {
    applyControlsCollapsed(elements.controlsPanel.classList.contains("collapsed"));
  }
  renderFollowsQuickJump();
});

boot();
