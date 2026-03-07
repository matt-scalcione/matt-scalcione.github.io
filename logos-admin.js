import { resolveInitialApiBase } from "./api-config.js";
import { buildTeamUrl } from "./routes.js";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  setJsonLd
} from "./seo.js";
import {
  classifyLocalTeamLogoPath,
  resolveLocalTeamMeta
} from "./team-logos.js";
import { TEAM_LOGO_MANIFEST } from "./team-logos.generated.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const COLLECTIONS = [
  { key: "lolLive", game: "lol", label: "LoL Live", endpoint: "/v1/live-matches?game=lol" },
  { key: "lolSchedule", game: "lol", label: "LoL Schedule", endpoint: "/v1/schedule?game=lol&days_forward=7&days_back=0" },
  { key: "lolResults", game: "lol", label: "LoL Results", endpoint: "/v1/results?game=lol&days_forward=1&days_back=7" },
  {
    key: "dotaLive",
    game: "dota2",
    label: "Dota Live",
    endpoint: "/v1/live-matches?game=dota2"
  },
  {
    key: "dotaSchedule",
    game: "dota2",
    label: "Dota Schedule",
    endpoint: "/v1/schedule?game=dota2&days_forward=7&days_back=0&dota_tiers=1,2,3,4"
  },
  {
    key: "dotaResults",
    game: "dota2",
    label: "Dota Results",
    endpoint: "/v1/results?game=dota2&days_forward=1&days_back=7&dota_tiers=1,2,3,4"
  }
];
const ASSET_LABELS = {
  generated: "Generated",
  manual: "Manual",
  fallback: "Fallback",
  static: "Static",
  missing: "Missing"
};
const elements = {
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  lolHubNav: document.querySelector("#lolHubNav"),
  dotaHubNav: document.querySelector("#dotaHubNav"),
  mobileLiveNav: document.querySelector("#mobileLiveNav"),
  mobileScheduleNav: document.querySelector("#mobileScheduleNav"),
  mobileFollowsNav: document.querySelector("#mobileFollowsNav"),
  controlsPanel: document.querySelector("#controlsPanel"),
  controlsToggle: document.querySelector("#controlsToggle"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  gameFilterSelect: document.querySelector("#gameFilterSelect"),
  assetFilterSelect: document.querySelector("#assetFilterSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  logoCurrentMeta: document.querySelector("#logoCurrentMeta"),
  logoCurrentSummary: document.querySelector("#logoCurrentSummary"),
  logoFallbackMeta: document.querySelector("#logoFallbackMeta"),
  logoFallbackQueue: document.querySelector("#logoFallbackQueue"),
  logoCollectionBreakdown: document.querySelector("#logoCollectionBreakdown"),
  logoManifestBreakdown: document.querySelector("#logoManifestBreakdown")
};
const state = {
  apiBase: DEFAULT_API_BASE,
  gameFilter: "",
  assetFilter: "",
  collections: {},
  currentTeams: [],
  collectionSummaries: [],
  manifestSummary: null
};

function isCompactViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
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

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
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
    const saved = localStorage.getItem("pulseboard.logoAdmin.controlsCollapsed");
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
      localStorage.setItem("pulseboard.logoAdmin.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  });
}

function updateNav(apiBase) {
  const liveUrl = new URL("./index.html", window.location.href);
  const scheduleUrl = new URL("./schedule.html", window.location.href);
  const followsUrl = new URL("./follows.html", window.location.href);
  const lolUrl = new URL("./lol.html", window.location.href);
  const dotaUrl = new URL("./dota2.html", window.location.href);

  for (const url of [liveUrl, scheduleUrl, followsUrl, lolUrl, dotaUrl]) {
    url.searchParams.set("api", apiBase);
  }

  if (elements.liveDeskNav) elements.liveDeskNav.href = liveUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = liveUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
}

function refreshSeo() {
  applySeo({
    title: "Pulseboard Logo Admin",
    description: "Internal view for current team logo coverage, fallback usage, and asset inventory on Pulseboard.",
    canonicalPath: "/logos.html",
    robots: "noindex,follow"
  });

  setJsonLd(
    "breadcrumbs",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", item: "/" },
      { name: "Logo Admin", item: "/logos.html" }
    ])
  );
  setJsonLd("page", null);
}

function normalizeCollectionRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

async function fetchCollection(apiBase, endpoint) {
  const response = await fetch(`${apiBase}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }
  return normalizeCollectionRows(await response.json());
}

function gameChip(game) {
  const normalized = String(game || "").toLowerCase();
  const label = normalized === "lol" ? "L" : "D";
  return `<span class="game-chip ${normalized === "lol" ? "lol" : "dota2"}" title="${normalized === "lol" ? "League of Legends" : "Dota 2"}">${label}</span>`;
}

function assetChip(assetType) {
  const normalized = String(assetType || "missing").toLowerCase();
  return `<span class="logo-asset-chip ${normalized}">${ASSET_LABELS[normalized] || normalized}</span>`;
}

function sourceSearchUrl(row) {
  const game = String(row?.game || "").toLowerCase();
  const name = encodeURIComponent(String(row?.name || "").trim());
  const base =
    game === "lol"
      ? "https://liquipedia.net/leagueoflegends/Special:Search"
      : "https://liquipedia.net/dota2/Special:Search";
  return `${base}?search=${name}`;
}

function shortSourceLabel(key) {
  if (key === "lolLive") return "LoL Live";
  if (key === "lolSchedule") return "LoL Schedule";
  if (key === "lolResults") return "LoL Results";
  if (key === "dotaLive") return "Dota Live";
  if (key === "dotaSchedule") return "Dota Schedule";
  if (key === "dotaResults") return "Dota Results";
  return key;
}

function badgeFallbackText(row) {
  const rawCode = String(row?.code || "").trim();
  if (rawCode) {
    return rawCode.slice(0, 4).toUpperCase();
  }
  const parts = String(row?.name || "")
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return "PB";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatRelativeSources(sourceCounts) {
  return Object.entries(sourceCounts || {})
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, value]) => `<span class="logo-source-chip">${shortSourceLabel(key)} · ${value}</span>`)
    .join("");
}

function summarizeCurrentTeams() {
  const filtered = state.currentTeams.filter((row) => {
    if (state.gameFilter && row.game !== state.gameFilter) {
      return false;
    }
    if (state.assetFilter && row.assetType !== state.assetFilter) {
      return false;
    }
    return true;
  });

  const counts = {
    total: filtered.length,
    real: 0,
    fallback: 0,
    missing: 0
  };
  for (const row of filtered) {
    if (row.assetType === "fallback") {
      counts.fallback += 1;
    } else if (row.assetType === "missing") {
      counts.missing += 1;
    } else {
      counts.real += 1;
    }
  }
  return {
    filtered,
    counts
  };
}

function buildManifestSummary() {
  const rows = Object.entries(TEAM_LOGO_MANIFEST?.byGameAndId || {}).map(([key, record]) => {
    const [game] = key.split(":");
    return {
      game,
      assetType: classifyLocalTeamLogoPath(record?.path || null)
    };
  });

  const byGame = {
    lol: { total: 0, generated: 0, manual: 0, fallback: 0, static: 0, missing: 0 },
    dota2: { total: 0, generated: 0, manual: 0, fallback: 0, static: 0, missing: 0 }
  };

  for (const row of rows) {
    const bucket = byGame[row.game] || (byGame[row.game] = { total: 0, generated: 0, manual: 0, fallback: 0, static: 0, missing: 0 });
    bucket.total += 1;
    bucket[row.assetType] = Number(bucket[row.assetType] || 0) + 1;
  }

  return byGame;
}

function collectTeamsFromRows(rows, collection) {
  const map = new Map();
  for (const row of rows) {
    for (const side of ["left", "right"]) {
      const team = row?.teams?.[side];
      if (!team?.name) {
        continue;
      }

      const normalizedName = String(team.name || "").trim();
      const key = `${collection.game}:${String(team.id || "").trim()}:${normalizedName.toLowerCase()}`;
      const meta = resolveLocalTeamMeta({
        game: collection.game,
        id: team.id,
        name: normalizedName,
        code: team.code
      });
      const existing =
        map.get(key) ||
        {
          game: collection.game,
          id: String(team.id || "").trim(),
          name: normalizedName,
          code: meta.code || team.code || null,
          logoUrl: meta.logoUrl || null,
          assetType: meta.assetType || "missing",
          appearances: 0,
          sourceCounts: {},
          tournaments: new Set()
        };

      existing.appearances += 1;
      existing.sourceCounts[collection.key] = Number(existing.sourceCounts[collection.key] || 0) + 1;
      if (row?.tournament) {
        existing.tournaments.add(String(row.tournament).trim());
      }
      map.set(key, existing);
    }
  }
  return [...map.values()].map((row) => ({
    ...row,
    tournaments: [...row.tournaments].slice(0, 3)
  }));
}

function mergeTeamEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = `${entry.game}:${entry.id}:${String(entry.name).trim().toLowerCase()}`;
    const current =
      map.get(key) ||
      {
        ...entry,
        appearances: 0,
        sourceCounts: {},
        tournaments: []
      };
    current.appearances += entry.appearances || 0;
    for (const [sourceKey, count] of Object.entries(entry.sourceCounts || {})) {
      current.sourceCounts[sourceKey] = Number(current.sourceCounts[sourceKey] || 0) + Number(count || 0);
    }
    current.tournaments = [...new Set([...current.tournaments, ...(entry.tournaments || [])])].slice(0, 3);
    map.set(key, current);
  }
  return [...map.values()];
}

function renderCurrentSummary() {
  const { counts } = summarizeCurrentTeams();
  const summaryCards = [
    {
      label: "Current Teams",
      value: counts.total,
      meta: "Unique teams in current live, schedule, and results payloads"
    },
    {
      label: "Real Logos",
      value: counts.real,
      meta: "Generated, manual, or static assets"
    },
    {
      label: "Fallbacks",
      value: counts.fallback,
      meta: "Teams still using local fallback badges"
    },
    {
      label: "Missing",
      value: counts.missing,
      meta: "Should stay at zero"
    }
  ];

  elements.logoCurrentSummary.innerHTML = summaryCards
    .map(
      (card) => `
        <article class="tempo-card">
          <p class="tempo-label">${card.label}</p>
          <p class="tempo-value">${card.value}</p>
          <p class="meta-text">${card.meta}</p>
        </article>
      `
    )
    .join("");
}

function renderFallbackQueue() {
  const { filtered } = summarizeCurrentTeams();
  const queue = filtered
    .filter((row) => row.assetType === "fallback" || row.assetType === "missing")
    .sort((left, right) => right.appearances - left.appearances || left.name.localeCompare(right.name));

  elements.logoFallbackMeta.textContent = queue.length
    ? `${queue.length} teams currently using fallback or missing assets`
    : "No fallback usage in the current filtered view.";

  if (!queue.length) {
    elements.logoFallbackQueue.innerHTML = `
      <div class="empty">
        <p class="empty-title">No fallback queue</p>
        <p>Current collections are fully covered for this filter.</p>
      </div>
    `;
    return;
  }

  elements.logoFallbackQueue.innerHTML = queue
    .map((row) => {
      const teamUrl = buildTeamUrl({
        teamId: row.id,
        game: row.game,
        teamName: row.name
      });
      const tournamentText = row.tournaments.length ? row.tournaments.join(" · ") : "No tournament context yet";
      return `
        <article class="logo-team-card">
          <div class="logo-team-topline">
            <div class="logo-team-markers">
              ${gameChip(row.game)}
              ${assetChip(row.assetType)}
            </div>
            <span class="logo-count-pill">${row.appearances} rows</span>
          </div>
          <div class="logo-team-main">
            ${
              row.logoUrl
                ? `<div class="team-badge-wrap">
                    <img class="team-badge" src="${row.logoUrl}" alt="${row.name} logo" loading="lazy" />
                  </div>`
                : `<div class="team-badge logo-missing-badge" aria-hidden="true">${badgeFallbackText(row)}</div>`
            }
            <div class="logo-team-copy">
              <strong>${row.name}</strong>
              <p class="meta-text">${row.code || "No code"} · ID ${row.id || "n/a"} · ${tournamentText}</p>
            </div>
          </div>
          <div class="logo-source-row">
            ${formatRelativeSources(row.sourceCounts)}
          </div>
          <div class="logo-team-actions">
            <a class="table-link" href="${teamUrl}">Open team</a>
            <a class="table-link" href="${sourceSearchUrl(row)}" target="_blank" rel="noreferrer">Search source</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCollectionBreakdown() {
  const cards = state.collectionSummaries
    .filter((row) => !state.gameFilter || row.game === state.gameFilter)
    .map((row) => `
      <article class="tempo-card">
        <p class="tempo-label">${row.label}</p>
        <p class="tempo-value">${row.total}</p>
        <div class="logo-breakdown-row">
          <span class="logo-mini-chip generated">Gen ${row.generated}</span>
          <span class="logo-mini-chip manual">Manual ${row.manual}</span>
          <span class="logo-mini-chip fallback">Fallback ${row.fallback}</span>
          <span class="logo-mini-chip missing">Missing ${row.missing}</span>
        </div>
      </article>
    `)
    .join("");

  elements.logoCollectionBreakdown.innerHTML =
    cards ||
    `
      <div class="empty">
        <p class="empty-title">No collection rows</p>
        <p>Nothing matched the current filters.</p>
      </div>
    `;
}

function renderManifestBreakdown() {
  const summary = state.manifestSummary;
  const games = state.gameFilter ? [state.gameFilter] : ["lol", "dota2"];
  const labels = {
    lol: "League of Legends",
    dota2: "Dota 2"
  };

  elements.logoManifestBreakdown.innerHTML = games
    .map((game) => {
      const row = summary[game] || { total: 0, generated: 0, manual: 0, fallback: 0, static: 0, missing: 0 };
      return `
        <article class="tempo-card">
          <p class="tempo-label">${labels[game]}</p>
          <p class="tempo-value">${row.total}</p>
          <div class="logo-breakdown-row">
            <span class="logo-mini-chip generated">Gen ${row.generated}</span>
            <span class="logo-mini-chip manual">Manual ${row.manual}</span>
            <span class="logo-mini-chip fallback">Fallback ${row.fallback}</span>
            <span class="logo-mini-chip static">Static ${row.static}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  const { filtered } = summarizeCurrentTeams();
  elements.logoCurrentMeta.textContent = `${filtered.length} unique teams in the current filtered view`;
  renderCurrentSummary();
  renderFallbackQueue();
  renderCollectionBreakdown();
  renderManifestBreakdown();
}

async function loadData() {
  const apiBase = elements.apiBaseInput?.value?.trim() || DEFAULT_API_BASE;
  state.apiBase = apiBase;
  updateNav(apiBase);
  setStatus("Loading logo coverage…", "loading");

  try {
    const results = await Promise.all(
      COLLECTIONS.map(async (collection) => ({
        ...collection,
        rows: await fetchCollection(apiBase, collection.endpoint)
      }))
    );

    state.collections = Object.fromEntries(results.map((row) => [row.key, row.rows]));
    state.currentTeams = mergeTeamEntries(results.flatMap((row) => collectTeamsFromRows(row.rows, row)));
    state.collectionSummaries = results.map((row) => {
      const teams = collectTeamsFromRows(row.rows, row);
      const summary = {
        key: row.key,
        label: row.label,
        game: row.game,
        total: teams.length,
        generated: 0,
        manual: 0,
        fallback: 0,
        static: 0,
        missing: 0
      };
      for (const team of teams) {
        summary[team.assetType] = Number(summary[team.assetType] || 0) + 1;
      }
      return summary;
    });
    state.manifestSummary = buildManifestSummary();
    renderAll();
    setStatus("Logo coverage updated.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Unable to load logo coverage.", "error");
    elements.logoCurrentMeta.textContent = "Unable to load coverage.";
  }
}

function bindEvents() {
  elements.refreshButton?.addEventListener("click", loadData);
  elements.saveButton?.addEventListener("click", () => {
    const apiBase = elements.apiBaseInput?.value?.trim() || DEFAULT_API_BASE;
    saveApiBase(apiBase);
    updateNav(apiBase);
    setStatus("API base saved.", "success");
  });
  elements.gameFilterSelect?.addEventListener("change", () => {
    state.gameFilter = elements.gameFilterSelect.value.trim();
    renderAll();
  });
  elements.assetFilterSelect?.addEventListener("change", () => {
    state.assetFilter = elements.assetFilterSelect.value.trim();
    renderAll();
  });
}

function init() {
  refreshSeo();
  elements.apiBaseInput.value = readApiBase();
  state.manifestSummary = buildManifestSummary();
  setupControlsPanel();
  bindEvents();
  updateNav(elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
  loadData();
}

init();
