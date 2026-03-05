import { resolveInitialApiBase } from "./api-config.js";

const DEFAULT_API_BASE = resolveInitialApiBase();

const elements = {
  apiBaseInput: document.querySelector("#apiBaseInput"),
  gameSelect: document.querySelector("#gameSelect"),
  regionInput: document.querySelector("#regionInput"),
  dotaTiersInput: document.querySelector("#dotaTiersInput"),
  dateFromInput: document.querySelector("#dateFromInput"),
  dateToInput: document.querySelector("#dateToInput"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  scheduleMeta: document.querySelector("#scheduleMeta"),
  resultsMeta: document.querySelector("#resultsMeta"),
  scheduleTableWrap: document.querySelector("#scheduleTableWrap"),
  resultsTableWrap: document.querySelector("#resultsTableWrap")
};

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

function rowLink(id, apiBase) {
  const url = new URL("./match.html", window.location.href);
  url.searchParams.set("id", id);
  url.searchParams.set("api", apiBase);
  return url.toString();
}

function teamLink({
  teamId,
  teamName,
  game,
  apiBase,
  matchId = null,
  opponentId = null
}) {
  if (!teamId) {
    return teamName || "Unknown";
  }

  const url = new URL("./team.html", window.location.href);
  url.searchParams.set("id", teamId);
  url.searchParams.set("api", apiBase);
  if (game) {
    url.searchParams.set("game", game);
  }
  if (matchId) {
    url.searchParams.set("match", matchId);
  }
  if (opponentId) {
    url.searchParams.set("opponent", opponentId);
  }
  if (teamName) {
    url.searchParams.set("team_name", teamName);
  }

  return `<a class="team-link" href="${url.toString()}">${teamName || teamId}</a>`;
}

function updateNav(apiBase) {
  if (!elements.liveDeskNav || !elements.scheduleNav || !elements.followsNav) {
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

function renderTable(container, rows, apiBase, type) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty">No ${type} matches for current filters.</div>`;
    return;
  }

  const body = rows
    .map((row) => {
      const winner =
        row.winnerTeamId === row.teams.left.id
          ? row.teams.left.name
          : row.winnerTeamId === row.teams.right.id
            ? row.teams.right.name
            : "-";
      const leftTeam = teamLink({
        teamId: row.teams.left.id,
        teamName: row.teams.left.name,
        game: row.game,
        apiBase,
        matchId: row.id,
        opponentId: row.teams.right.id
      });
      const rightTeam = teamLink({
        teamId: row.teams.right.id,
        teamName: row.teams.right.name,
        game: row.game,
        apiBase,
        matchId: row.id,
        opponentId: row.teams.left.id
      });

      return `
        <tr>
          <td>${dateTimeLabel(row.startAt)}</td>
          <td>${row.game.toUpperCase()} / ${row.region.toUpperCase()}</td>
          <td>${leftTeam} vs ${rightTeam}</td>
          <td>${row.seriesScore.left}-${row.seriesScore.right}</td>
          <td>${winner}</td>
          <td><a class="table-link" href="${rowLink(row.id, apiBase)}">Open</a></td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Start</th>
          <th>Game / Region</th>
          <th>Match</th>
          <th>Score</th>
          <th>Winner</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
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
  updateNav(apiBase);

  try {
    elements.statusText.textContent = "Loading schedule and results...";
    const [schedulePayload, resultsPayload] = await Promise.all([
      fetchCollection(apiBase, "/v1/schedule", query),
      fetchCollection(apiBase, "/v1/results", query)
    ]);

    renderTable(elements.scheduleTableWrap, schedulePayload.data || [], apiBase, "scheduled");
    renderTable(elements.resultsTableWrap, resultsPayload.data || [], apiBase, "result");

    elements.scheduleMeta.textContent = `Showing ${schedulePayload.meta.count} matches.`;
    elements.resultsMeta.textContent = `Showing ${resultsPayload.meta.count} matches.`;
    elements.statusText.textContent = "Data synced.";
  } catch (error) {
    elements.statusText.textContent = `Error: ${error.message}`;
    elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
    elements.resultsTableWrap.innerHTML = `<div class="empty">Unable to load results.</div>`;
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadCollections);
  elements.saveButton.addEventListener("click", () => {
    const value = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    saveApiBase(value);
    elements.statusText.textContent = "API base saved locally.";
  });

  elements.gameSelect.addEventListener("change", loadCollections);
  elements.regionInput.addEventListener("change", loadCollections);
  elements.dotaTiersInput.addEventListener("change", loadCollections);
  elements.dateFromInput.addEventListener("change", loadCollections);
  elements.dateToInput.addEventListener("change", loadCollections);
}

function boot() {
  const apiBase = readApiBase();
  elements.apiBaseInput.value = apiBase;
  elements.dotaTiersInput.value = "1,2,3,4";
  updateNav(apiBase);

  const now = new Date();
  const start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 18 * 60 * 60 * 1000);
  elements.dateFromInput.value = toLocalInputValue(start);
  elements.dateToInput.value = toLocalInputValue(end);

  installEvents();
  loadCollections();
}

boot();
