import { resolveInitialApiBase } from "./api-config.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const AUTO_REFRESH_MS = 15000;

const elements = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  gameSelect: document.querySelector("#gameSelect"),
  regionInput: document.querySelector("#regionInput"),
  dotaTiersInput: document.querySelector("#dotaTiersInput"),
  userIdInput: document.querySelector("#userIdInput"),
  followedOnlyInput: document.querySelector("#followedOnlyInput"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  metaText: document.querySelector("#metaText"),
  cardGrid: document.querySelector("#cardGrid")
};

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
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

function buildQuery({ game, region, dotaTiers, followedOnly, userId }) {
  const params = new URLSearchParams();
  if (game) params.set("game", game);
  if (region) params.set("region", region.trim().toLowerCase());
  if (dotaTiers) params.set("dota_tiers", dotaTiers.trim());
  if (followedOnly) params.set("followed_only", "true");
  if (userId) params.set("user_id", userId.trim());
  return params.toString();
}

function updateNav(apiBase) {
  if (!elements.scheduleNav || !elements.liveDeskNav || !elements.followsNav) {
    return;
  }

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

function renderCards(rows, apiBase) {
  if (!rows.length) {
    renderEmpty("No matches found for the selected filters.");
    return;
  }

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
      const link = new URL("./match.html", window.location.href);
      link.searchParams.set("id", match.id);
      link.searchParams.set("api", apiBase);
      const statusClass = statusPillClass(match.status);
      const statusLabel = String(match.status || "upcoming").toUpperCase();

      return `
        <a class="match-card" style="--delay:${index * 55}ms" href="${link.toString()}">
          <div class="match-card-topline">
            <span class="pill ${statusClass}">${statusLabel}</span>
            <span class="subline">${gameChipMarkup(match.game)} ${match.tournament || "Tournament"}</span>
          </div>
          <div class="match-card-scoreboard">
            <div class="team-line compact">
              <span class="team-name">${match.teams.left.name}</span>
              <strong>${match.seriesScore.left}</strong>
            </div>
            <div class="team-line compact">
              <span class="team-name">${match.teams.right.name}</span>
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
  updateNav(apiBase);

  try {
    renderLoadingCards();
    setStatus("Loading live matches...", "loading");
    const response = await fetch(requestUrl);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }

    renderCards(payload.data || [], apiBase);
    elements.metaText.textContent = `Showing ${payload?.meta?.count ?? 0} matches. Updated ${dateTimeLabel(payload?.meta?.generatedAt)}`;
    setStatus("Live desk synced.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
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
}

function boot() {
  const startupApiBase = readApiBase();
  elements.apiBaseInput.value = startupApiBase;
  updateNav(startupApiBase);
  elements.dotaTiersInput.value = "1,2,3,4";
  elements.userIdInput.value = "demo-user";
  installEvents();
  loadMatches();
  setInterval(loadMatches, AUTO_REFRESH_MS);
}

boot();
