import { resolveInitialApiBase } from "./api-config.js";
import { applySeo, inferRobotsDirective, setJsonLd } from "./seo.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const MOBILE_BREAKPOINT = 760;

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
  entityTypeSelect: document.querySelector("#entityTypeSelect"),
  entityIdInput: document.querySelector("#entityIdInput"),
  addFollowButton: document.querySelector("#addFollowButton"),
  followsMeta: document.querySelector("#followsMeta"),
  followsList: document.querySelector("#followsList"),
  followsSummaryHero: document.querySelector("#followsSummaryHero"),
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
  preferences: null
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

function isCompactViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function applyControlsCollapsed(collapsed) {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  elements.controlsPanel.classList.toggle("collapsed", collapsed);
  elements.controlsToggle.textContent = collapsed ? "Show Panel" : "Hide Panel";
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
  const liveUrl = new URL("./index.html", window.location.href);

  const scheduleUrl = new URL("./schedule.html", window.location.href);

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

function setStatus(message, tone = "neutral") {
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function renderSummaryHero() {
  if (!elements.followsSummaryHero) {
    return;
  }

  const { userId } = getContext();
  const rows = followsState.rows || [];
  const preferences = followsState.preferences;

  if (!userId) {
    elements.followsSummaryHero.innerHTML = `
      <div class="empty">
        <p class="empty-title">Follow Overview</p>
        <p class="meta-text">Add a user ID to load follows and notification preferences.</p>
      </div>
    `;
    return;
  }

  const teamCount = rows.filter((row) => row.entityType === "team").length;
  const playerCount = rows.filter((row) => row.entityType === "player").length;
  const tournamentCount = rows.filter((row) => row.entityType === "tournament").length;
  const enabledAlerts = preferences
    ? [
        preferences.webPush,
        preferences.emailDigest,
        preferences.swingAlerts,
        preferences.matchStart,
        preferences.matchFinal
      ].filter(Boolean).length
    : null;
  const distributionText = rows.length
    ? `${teamCount} teams · ${playerCount} players · ${tournamentCount} tournaments`
    : "No follows saved yet";
  const alertText =
    enabledAlerts === null
      ? "Loading alert settings"
      : `${enabledAlerts} alert ${enabledAlerts === 1 ? "setting" : "settings"} enabled`;

  elements.followsSummaryHero.innerHTML = `
    <div class="follow-summary-main">
      <div class="follow-summary-copy">
        <div class="follow-summary-kicker-row">
          <span class="follow-summary-chip follow-summary-user">User ${userId}</span>
          <span class="follow-summary-chip">${alertText}</span>
        </div>
        <h2 class="follow-summary-title">Follow Overview</h2>
        <p class="follow-summary-subline">${distributionText}</p>
      </div>
      <div class="follow-summary-stats">
        <article class="follow-summary-stat">
          <p class="follow-summary-label">Follows</p>
          <p class="follow-summary-value">${rows.length}</p>
        </article>
        <article class="follow-summary-stat">
          <p class="follow-summary-label">Teams</p>
          <p class="follow-summary-value">${teamCount}</p>
        </article>
        <article class="follow-summary-stat">
          <p class="follow-summary-label">Alerts</p>
          <p class="follow-summary-value">${enabledAlerts === null ? "..." : enabledAlerts}</p>
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
  return { apiBase, userId };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "API request failed.");
  }

  return payload;
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
      (row) => `
      <article class="follow-item">
        <div class="follow-item-head">
          <span class="follow-entity-chip">${row.entityType}</span>
          <p class="follow-entity-id">${row.entityId}</p>
          <p class="meta-text follow-created">Created ${new Date(row.createdAt).toLocaleString()}</p>
        </div>
        <button type="button" class="danger-btn" data-follow-id="${row.id}">Remove</button>
      </article>
    `
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

async function loadAll() {
  try {
    const { apiBase } = getContext();
    try {
      localStorage.setItem("pulseboard.apiBase", apiBase);
    } catch {
      // Ignore storage failures in private mode.
    }
    updateNav();
    setStatus("Loading follows and preferences...", "loading");
    await Promise.all([loadFollows(), loadPreferences()]);
    setStatus("Follows and preferences loaded.", "success");
  } catch (error) {
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
  elements.userIdInput.addEventListener("change", loadAll);
  elements.userIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
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
}

function boot() {
  const startupApiBase = readApiBase();
  elements.apiBaseInput.value = startupApiBase;
  elements.userIdInput.value = "demo-user";
  updateNav();
  refreshFollowsSeo();
  setupControlsPanel();
  setupFollowsViewSwitch();
  renderSummaryHero();
  installEvents();
  loadAll();
}

window.addEventListener("resize", () => {
  applyFollowsViewMode(followsViewMode);
});

boot();
