import { resolveInitialApiBase } from "./api-config.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
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

function rowLink(id, apiBase) {
  const url = new URL("./match.html", window.location.href);
  url.searchParams.set("id", id);
  url.searchParams.set("api", apiBase);
  return url.toString();
}

function teamLink({
  teamId,
  teamName,
  label = null,
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

  return `<a class="team-link" href="${url.toString()}">${label || teamName || teamId}</a>`;
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

function renderTable(container, rows, apiBase, type) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty">No ${type} matches for current filters.</div>`;
    return;
  }

  const desktopBody = rows
    .map((row) => {
      const detailUrl = rowLink(row.id, apiBase);
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
        apiBase,
        matchId: row.id,
        opponentId: row.teams.right.id
      });
      const rightTeam = teamLink({
        teamId: row.teams.right.id,
        teamName: row.teams.right.name,
        label: rightShort,
        game: row.game,
        apiBase,
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
      const detailUrl = rowLink(row.id, apiBase);
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
  updateNav(apiBase);

  try {
    renderLoadingTable(elements.scheduleTableWrap);
    renderLoadingTable(elements.resultsTableWrap);
    setStatus("Loading schedule and results...", "loading");
    const [schedulePayload, resultsPayload] = await Promise.all([
      fetchCollection(apiBase, "/v1/schedule", query),
      fetchCollection(apiBase, "/v1/results", query)
    ]);

    renderTable(elements.scheduleTableWrap, schedulePayload.data || [], apiBase, "scheduled");
    renderTable(elements.resultsTableWrap, resultsPayload.data || [], apiBase, "result");

    elements.scheduleMeta.textContent = `Showing ${schedulePayload.meta.count} matches · Updated ${dateTimeCompact(schedulePayload.meta.generatedAt)}`;
    elements.resultsMeta.textContent = `Showing ${resultsPayload.meta.count} matches · Updated ${dateTimeCompact(resultsPayload.meta.generatedAt)}`;
    setStatus("Schedule and results synced.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
    elements.scheduleTableWrap.innerHTML = `<div class="empty">Unable to load schedule.</div>`;
    elements.resultsTableWrap.innerHTML = `<div class="empty">Unable to load results.</div>`;
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
