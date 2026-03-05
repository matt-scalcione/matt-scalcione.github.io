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
    elements.followsList.innerHTML = `<div class="empty">No follows yet.</div>`;
    return;
  }

  elements.followsList.innerHTML = rows
    .map(
      (row) => `
      <article class="follow-item">
        <div>
          <p><strong>${row.entityType}</strong>: ${row.entityId}</p>
          <p class="meta-text">Created ${new Date(row.createdAt).toLocaleString()}</p>
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
    elements.statusText.textContent = "User ID is required.";
    elements.followsList.innerHTML = `<div class="empty">Add a user ID to load follows.</div>`;
    return;
  }

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
    elements.statusText.textContent = "Loading follows and preferences...";
    await Promise.all([loadFollows(), loadPreferences()]);
    elements.statusText.textContent = "Loaded.";
  } catch (error) {
    elements.statusText.textContent = `Error: ${error.message}`;
  }
}

async function addFollow() {
  const { apiBase, userId } = getContext();
  const entityType = elements.entityTypeSelect.value;
  const entityId = elements.entityIdInput.value.trim();

  if (!userId || !entityId) {
    elements.statusText.textContent = "User ID and Entity ID are required.";
    return;
  }

  try {
    elements.statusText.textContent = "Adding follow...";
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
    elements.statusText.textContent = "Follow added.";
  } catch (error) {
    elements.statusText.textContent = `Error: ${error.message}`;
  }
}

async function removeFollow(followId) {
  const { apiBase, userId } = getContext();
  if (!userId) {
    elements.statusText.textContent = "User ID is required.";
    return;
  }

  try {
    elements.statusText.textContent = "Removing follow...";
    await requestJson(
      `${apiBase}/v1/follows/${encodeURIComponent(followId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );

    await loadFollows();
    elements.statusText.textContent = "Follow removed.";
  } catch (error) {
    elements.statusText.textContent = `Error: ${error.message}`;
  }
}

async function savePreferences() {
  const { apiBase, userId } = getContext();
  if (!userId) {
    elements.statusText.textContent = "User ID is required.";
    return;
  }

  try {
    elements.statusText.textContent = "Saving preferences...";
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

    elements.statusText.textContent = "Preferences saved.";
  } catch (error) {
    elements.statusText.textContent = `Error: ${error.message}`;
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadAll);
  elements.addFollowButton.addEventListener("click", addFollow);
  elements.savePrefsButton.addEventListener("click", savePreferences);

  elements.saveApiButton.addEventListener("click", () => {
    const { apiBase } = getContext();
    saveApiBase(apiBase);
    updateNav(apiBase);
    elements.statusText.textContent = "API base saved locally.";
  });

  elements.followsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-follow-id]");
    if (!button) return;
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
