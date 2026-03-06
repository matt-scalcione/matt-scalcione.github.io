import { resolveInitialApiBase } from "./api-config.js";

const DEFAULT_API_BASE = resolveInitialApiBase();

const elements = {
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  userIdInput: document.querySelector("#userIdInput"),
  refreshButton: document.querySelector("#refreshButton"),
  saveApiButton: document.querySelector("#saveApiButton"),
  statusText: document.querySelector("#statusText"),
  entityTypeSelect: document.querySelector("#entityTypeSelect"),
  entityIdInput: document.querySelector("#entityIdInput"),
  addFollowButton: document.querySelector("#addFollowButton"),
  followsMeta: document.querySelector("#followsMeta"),
  followsList: document.querySelector("#followsList"),
  webPushInput: document.querySelector("#webPushInput"),
  emailDigestInput: document.querySelector("#emailDigestInput"),
  swingAlertsInput: document.querySelector("#swingAlertsInput"),
  matchStartInput: document.querySelector("#matchStartInput"),
  matchFinalInput: document.querySelector("#matchFinalInput"),
  savePrefsButton: document.querySelector("#savePrefsButton")
};

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
}

function updateNav(apiBase) {
  const liveUrl = new URL("./index.html", window.location.href);
  liveUrl.searchParams.set("api", apiBase);
  elements.liveDeskNav.href = liveUrl.toString();

  const scheduleUrl = new URL("./schedule.html", window.location.href);
  scheduleUrl.searchParams.set("api", apiBase);
  elements.scheduleNav.href = scheduleUrl.toString();

  const followsUrl = new URL("./follows.html", window.location.href);
  followsUrl.searchParams.set("api", apiBase);
  elements.followsNav.href = followsUrl.toString();
}

function setStatus(message, tone = "neutral") {
  elements.statusText.textContent = message;
  elements.statusText.classList.remove("success", "error", "loading");
  if (tone !== "neutral") {
    elements.statusText.classList.add(tone);
  }
}

function renderLoadingFollows() {
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
  if (!rows.length) {
    elements.followsList.innerHTML = `
      <div class="empty">
        <p class="empty-title">No Follows Yet</p>
        <p class="meta-text">Use Add Follow to track teams, players, or tournaments.</p>
      </div>
    `;
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
}

function renderPreferences(pref) {
  elements.webPushInput.checked = Boolean(pref.webPush);
  elements.emailDigestInput.checked = Boolean(pref.emailDigest);
  elements.swingAlertsInput.checked = Boolean(pref.swingAlerts);
  elements.matchStartInput.checked = Boolean(pref.matchStart);
  elements.matchFinalInput.checked = Boolean(pref.matchFinal);
}

async function loadFollows() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    setStatus("User ID is required.", "error");
    elements.followsList.innerHTML = `<div class="empty">Add a user ID to load follows.</div>`;
    return;
  }

  renderLoadingFollows();
  const payload = await requestJson(
    `${apiBase}/v1/follows?user_id=${encodeURIComponent(userId)}`
  );
  renderFollows(payload.data || []);
  elements.followsMeta.textContent = `Showing ${payload.data?.length || 0} follows.`;
}

async function loadPreferences() {
  const { apiBase, userId } = getContext();
  if (!userId) {
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
    updateNav(apiBase);
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
    updateNav(apiBase);
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
  updateNav(startupApiBase);
  installEvents();
  loadAll();
}

boot();
