import { resolveInitialApiBase } from "./api-config.js";
import { buildMatchUrl, buildTeamUrl, parseMatchRoute } from "./routes.js";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  gameLabel,
  inferRobotsDirective,
  normalizeGameKey as normalizeSeoGameKey,
  setJsonLd,
  toAbsoluteSiteUrl
} from "./seo.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_REFRESH_SECONDS = 15;
const LEAD_TREND_MIN_ABS_GOLD = 7000;
const LEAD_TREND_SCALE_HEADROOM = 1.15;
const MOBILE_BREAKPOINT = 760;
const TEAM_SHORT_NAMES = {
  "cloud9 kia": "C9",
  "cloud9": "C9",
  "team liquid honda": "Liquid",
  "team liquid": "Liquid",
  "gen.g esports": "Gen.G",
  "hanwha life esports": "HLE",
  "dplus kia": "DK",
  "kt rolster": "KT",
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
  "gaimin gladiators": "GG",
  "team spirit": "Spirit",
  "team falcons": "Falcons",
  "betboom team": "BetBoom",
  "tundra esports": "Tundra",
  "shopify rebellion": "SR",
  "aurora gaming": "Aurora",
  "xtreme gaming": "XG",
  "azure ray": "AR",
  "nigma galaxy": "Nigma",
  "virtus.pro": "VP",
  "team secret": "Secret",
  "evil geniuses": "EG",
  "talon esports": "Talon",
  "natus vincere": "NAVI"
};
const TEAM_HEADER_ABBREVIATIONS = {
  "cloud9 kia": "C9",
  "cloud9": "C9",
  "red canids kalunga": "RED",
  "red canids": "RED"
};
const TEAM_LOGO_BY_KEY = {
  "cloud9 kia": "./assets/team-logos/cloud9.png",
  "cloud9": "./assets/team-logos/cloud9.png",
  "red canids kalunga": "./assets/team-logos/red-canids.png",
  "red canids": "./assets/team-logos/red-canids.png"
};
const MOBILE_GAME_JUMP_TARGETS = [
  { id: "gameContextWrap", label: "Game" },
  { id: "selectedGameRecapWrap", label: "Recap" },
  { id: "playerTrackerWrap", label: "Players" },
  { id: "liveFeedList", label: "Feed" },
  { id: "leadTrendWrap", label: "Gold" },
  { id: "objectiveControlWrap", label: "Obj" }
];
const MOBILE_SERIES_JUMP_TARGETS = [
  { id: "gameContextWrap", label: "Series" },
  { id: "matchupConsoleWrap", label: "Matchup" },
  { id: "seriesLineupsWrap", label: "Lineups" },
  { id: "seriesProgressWrap", label: "Progress" },
  { id: "seriesMomentsList", label: "Highlights" }
];
const MOBILE_UPCOMING_JUMP_TARGETS = [
  { id: "gameContextWrap", label: "Overview" },
  { id: "upcomingEssentialsWrap", label: "Info" },
  { id: "upcomingFormWrap", label: "Form" },
  { id: "upcomingPredictionWrap", label: "Predict" },
  { id: "upcomingWatchWrap", label: "Watch" },
  { id: "upcomingH2hWrap", label: "H2H" }
];
const MOBILE_CORE_GAME_PANEL_TARGETS_BY_STATE = {
  inProgress: [
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "teamCompareWrap",
    "playerTrackerWrap",
    "liveFeedList",
    "leadTrendWrap",
    "objectiveControlWrap"
  ],
  completed: [
    "selectedGameRecapWrap",
    "playerTrackerWrap",
    "teamCompareWrap",
    "leadTrendWrap",
    "objectiveControlWrap",
    "performersWrap",
    "momentsList"
  ],
  unstarted: ["selectedGameRecapWrap", "gameCommandWrap"],
  unneeded: ["selectedGameRecapWrap", "gameCommandWrap"]
};
const MOBILE_SECTION_HEADINGS = {
  "Current State": { icon: "ST", short: "State" },
  "Series Overview": { icon: "SR", short: "Series" },
  "Game Explorer": { icon: "GX", short: "Games" },
  "Match Snapshot": { icon: "SN", short: "Snapshot" },
  "Matchup Console": { icon: "H2H", short: "Matchup" },
  "Series Lineups": { icon: "LU", short: "Lineups" },
  "Upcoming Essentials": { icon: "UP", short: "Upcoming" },
  "Watch Guide": { icon: "TV", short: "Watch" },
  "Team Form": { icon: "FM", short: "Form" },
  "Head-To-Head": { icon: "H2H", short: "H2H" },
  "Prediction Model": { icon: "PR", short: "Prediction" },
  "Game Command Center": { icon: "CC", short: "Command" },
  "Team Comparison": { icon: "TC", short: "Team Compare" },
  "Player Tracker": { icon: "PT", short: "Players" },
  "Live Event Feed": { icon: "FE", short: "Live Feed" },
  "Lead Trend": { icon: "LD", short: "Lead Trend" },
  "Objective Control": { icon: "OBJ", short: "Objective" },
  "Series Games": { icon: "SG", short: "Series Games" },
  "Series Comparison": { icon: "SC", short: "Series Stats" },
  "Selected Game Recap": { icon: "RC", short: "Game Recap" }
};
const MOBILE_MATCH_PANELS_ALWAYS_OPEN = new Set(["Current State", "Game Explorer"]);
const MOBILE_MATCH_PANELS_DEFAULT_OPEN = {
  series: new Set(["Matchup Console", "Series Lineups", "Series Progress", "Series Highlights"]),
  upcoming: new Set(["Upcoming Essentials", "Team Form", "Prediction Model", "Watch Guide"]),
  game: new Set(["Selected Game Recap", "Player Tracker", "Lead Trend", "Live Event Feed", "Objective Control"])
};
const LOL_CDN_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const LOL_CDN_CHAMPION_DATA = "https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json";
const LOL_CDN_CHAMPION_ICON = "https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png";
const DOTA_HERO_STATS_URL = "https://api.opendota.com/api/heroStats";
const DOTA_ICON_CDN_BASE = "https://cdn.cloudflare.steamstatic.com";
const MINIMAP_ASSETS = {
  lol: {
    background: "./assets/minimap/lol-map.png",
    tower: "./assets/minimap/lol-tower.png",
    inhibitor: "./assets/minimap/lol-inhibitor.png",
    core: "./assets/minimap/lol-nexus.png"
  },
  dota2: {
    background: "./assets/minimap/dota-map.webp",
    towerLeft: "./assets/minimap/dota-tower-radiant.png",
    towerRight: "./assets/minimap/dota-tower-dire.png",
    inhibitorLeft: "./assets/minimap/dota-rax-radiant.png",
    inhibitorRight: "./assets/minimap/dota-rax-dire.png",
    coreLeft: "./assets/minimap/dota-fort-radiant.png",
    coreRight: "./assets/minimap/dota-fort-dire.png"
  }
};
const LOL_TOWER_TOTAL = 11;
const LOL_INHIBITOR_TOTAL = 3;
const DOTA_TOWER_TOTAL = 11;
const DOTA_INHIBITOR_TOTAL = 6;
const LOL_LEFT_TOWER_LAYOUT = [
  { id: "nexus_a", x: 15.5, y: 86.5 },
  { id: "nexus_b", x: 20.5, y: 81.2 },
  { id: "top_t3", x: 30.2, y: 42.1 },
  { id: "mid_t3", x: 42.2, y: 49.2 },
  { id: "bot_t3", x: 59.4, y: 68.1 },
  { id: "top_t2", x: 24.8, y: 52.1 },
  { id: "mid_t2", x: 37.8, y: 58.8 },
  { id: "bot_t2", x: 50.7, y: 75.1 },
  { id: "top_t1", x: 18.3, y: 63.2 },
  { id: "mid_t1", x: 30.1, y: 69.3 },
  { id: "bot_t1", x: 39.8, y: 84.1 }
];
const LOL_LEFT_INHIBITOR_LAYOUT = [
  { id: "top_inhib", x: 26.3, y: 38.9 },
  { id: "mid_inhib", x: 42.4, y: 49.8 },
  { id: "bot_inhib", x: 57.2, y: 69.6 }
];
const DOTA_LEFT_TOWER_LAYOUT = [
  { id: "t4br", x: 12, y: 82 },
  { id: "t4tr", x: 8, y: 79 },
  { id: "t3br", x: 23, y: 83.5 },
  { id: "t3mr", x: 18, y: 71 },
  { id: "t3tr", x: 7, y: 68 },
  { id: "t2br", x: 46, y: 85 },
  { id: "t2mr", x: 27, y: 63 },
  { id: "t2tr", x: 8, y: 51 },
  { id: "t1br", x: 78, y: 83 },
  { id: "t1mr", x: 38, y: 54 },
  { id: "t1tr", x: 8, y: 35 }
];
const DOTA_RIGHT_TOWER_LAYOUT = [
  { id: "t4bd", x: 84, y: 16 },
  { id: "t4td", x: 81, y: 13 },
  { id: "t3bd", x: 86, y: 28 },
  { id: "t3md", x: 73, y: 24 },
  { id: "t3td", x: 70, y: 11 },
  { id: "t2bd", x: 86, y: 45 },
  { id: "t2md", x: 63, y: 34 },
  { id: "t2td", x: 44, y: 10 },
  { id: "t1bd", x: 86, y: 60 },
  { id: "t1md", x: 53, y: 44 },
  { id: "t1td", x: 15, y: 10 }
];
const DOTA_LEFT_INHIBITOR_LAYOUT = [
  { id: "bmbr", x: 20, y: 84.5 },
  { id: "brbr", x: 20, y: 80.5 },
  { id: "bmmr", x: 18, y: 73 },
  { id: "brmr", x: 15, y: 70.5 },
  { id: "bmtr", x: 9.5, y: 70.5 },
  { id: "brtr", x: 5.5, y: 70.5 }
];
const DOTA_RIGHT_INHIBITOR_LAYOUT = [
  { id: "bmbd", x: 88.5, y: 24 },
  { id: "brbd", x: 84.5, y: 24 },
  { id: "bmmd", x: 77.5, y: 22 },
  { id: "brmd", x: 74.5, y: 19.5 },
  { id: "bmtd", x: 74, y: 12 },
  { id: "brtd", x: 74, y: 8 }
];
const DOTA_CORE_LAYOUT = {
  left: { x: 5, y: 83 },
  right: { x: 84, y: 9 }
};

const elements = {
  matchTitle: document.querySelector("#matchTitle"),
  backLink: document.querySelector("#backLink"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  lolHubNav: document.querySelector("#lolHubNav"),
  dotaHubNav: document.querySelector("#dotaHubNav"),
  mobileLiveNav: document.querySelector("#mobileLiveNav"),
  mobileScheduleNav: document.querySelector("#mobileScheduleNav"),
  mobileFollowsNav: document.querySelector("#mobileFollowsNav"),
  freshnessText: document.querySelector("#freshnessText"),
  scoreboard: document.querySelector("#scoreboard"),
  streamStatusWrap: document.querySelector("#streamStatusWrap"),
  seriesHeaderSubhead: document.querySelector("#seriesHeaderSubhead"),
  seriesHeaderWrap: document.querySelector("#seriesHeaderWrap"),
  gameNavWrap: document.querySelector("#gameNavWrap"),
  gameContextWrap: document.querySelector("#gameContextWrap"),
  mobileModeToolbar: document.querySelector("#mobileModeToolbar"),
  mobileGameToolbar: document.querySelector("#mobileGameToolbar"),
  gameCommandWrap: document.querySelector("#gameCommandWrap"),
  teamCompareWrap: document.querySelector("#teamCompareWrap"),
  playerTrackerWrap: document.querySelector("#playerTrackerWrap"),
  trackerSort: document.querySelector("#trackerSort"),
  liveFeedList: document.querySelector("#liveFeedList"),
  combatBurstsList: document.querySelector("#combatBurstsList"),
  goldMilestonesList: document.querySelector("#goldMilestonesList"),
  liveAlertsList: document.querySelector("#liveAlertsList"),
  feedTypeFilter: document.querySelector("#feedTypeFilter"),
  feedTeamFilter: document.querySelector("#feedTeamFilter"),
  feedImportanceFilter: document.querySelector("#feedImportanceFilter"),
  feedWindowFilter: document.querySelector("#feedWindowFilter"),
  statusSummary: document.querySelector("#statusSummary"),
  matchupMetaText: document.querySelector("#matchupMetaText"),
  matchupH2hLimit: document.querySelector("#matchupH2hLimit"),
  matchupConsoleWrap: document.querySelector("#matchupConsoleWrap"),
  seriesLineupsWrap: document.querySelector("#seriesLineupsWrap"),
  upcomingEssentialsWrap: document.querySelector("#upcomingEssentialsWrap"),
  upcomingWatchWrap: document.querySelector("#upcomingWatchWrap"),
  upcomingFormWrap: document.querySelector("#upcomingFormWrap"),
  upcomingH2hWrap: document.querySelector("#upcomingH2hWrap"),
  upcomingPredictionWrap: document.querySelector("#upcomingPredictionWrap"),
  dataConfidenceWrap: document.querySelector("#dataConfidenceWrap"),
  pulseCard: document.querySelector("#pulseCard"),
  edgeMeterWrap: document.querySelector("#edgeMeterWrap"),
  tempoSnapshotWrap: document.querySelector("#tempoSnapshotWrap"),
  tacticalChecklistWrap: document.querySelector("#tacticalChecklistWrap"),
  storylinesList: document.querySelector("#storylinesList"),
  seriesProgressWrap: document.querySelector("#seriesProgressWrap"),
  seriesMomentsList: document.querySelector("#seriesMomentsList"),
  leadTrendWrap: document.querySelector("#leadTrendWrap"),
  objectiveControlWrap: document.querySelector("#objectiveControlWrap"),
  objectiveBreakdownWrap: document.querySelector("#objectiveBreakdownWrap"),
  draftBoardWrap: document.querySelector("#draftBoardWrap"),
  draftDeltaWrap: document.querySelector("#draftDeltaWrap"),
  economyBoardWrap: document.querySelector("#economyBoardWrap"),
  laneMatchupsWrap: document.querySelector("#laneMatchupsWrap"),
  objectiveRunsWrap: document.querySelector("#objectiveRunsWrap"),
  seriesGamesWrap: document.querySelector("#seriesGamesWrap"),
  seriesCompareWrap: document.querySelector("#seriesCompareWrap"),
  seriesPlayerTrendsWrap: document.querySelector("#seriesPlayerTrendsWrap"),
  selectedGameRecapWrap: document.querySelector("#selectedGameRecapWrap"),
  preMatchPlanner: document.querySelector("#preMatchPlanner"),
  performersWrap: document.querySelector("#performersWrap"),
  liveTickerList: document.querySelector("#liveTickerList"),
  objectiveTimelineList: document.querySelector("#objectiveTimelineList"),
  objectiveForecastWrap: document.querySelector("#objectiveForecastWrap"),
  deltaWindowText: document.querySelector("#deltaWindowText"),
  playerDeltaWrap: document.querySelector("#playerDeltaWrap"),
  roleDeltaWrap: document.querySelector("#roleDeltaWrap"),
  momentsList: document.querySelector("#momentsList"),
  timelineList: document.querySelector("#timelineList"),
  gamePanels: Array.from(document.querySelectorAll("section[data-scope=\"game\"]")),
  upcomingPanels: Array.from(document.querySelectorAll("section[data-scope=\"upcoming\"]")),
  seriesPanels: Array.from(document.querySelectorAll("section[data-scope=\"series\"]"))
};

let refreshTimer = null;
let respawnTicker = null;
const uiState = {
  match: null,
  apiBase: DEFAULT_API_BASE,
  requestedGameNumber: null,
  requestedGameFallback: null,
  activeGameNumber: null,
  viewMode: "series",
  feedType: "all",
  feedTeam: "all",
  feedImportance: "all",
  feedWindowMinutes: null,
  trackerSort: "role",
  matchupH2hLimit: 5,
  matchup: {
    key: null,
    loading: false,
    error: null,
    leftProfile: null,
    rightProfile: null
  },
  matchupRequestToken: 0,
  stream: {
    key: null,
    source: "polling",
    connected: false,
    reconnectAttempt: 0,
    lastSnapshotAt: null,
    lastErrorAt: null,
    eventSource: null,
    reconnectTimer: null
  },
  mobileAdvancedExpanded: false,
  mobilePanelCollapsedByKey: {},
  mobilePanelControlsBound: false,
  controlsBound: false,
  leadTrendScaleByContext: {},
  mapPulseByContext: {},
  storyFocusEventId: null,
  storyInteractionsBound: false
};
const heroIconCatalog = {
  lol: {
    status: "idle",
    version: null,
    map: new Map(),
    promise: null
  },
  dota2: {
    status: "idle",
    map: new Map(),
    promise: null
  }
};

try {
  uiState.mobileAdvancedExpanded = localStorage.getItem("pulseboard.mobileAdvancedExpanded") === "1";
} catch {
  uiState.mobileAdvancedExpanded = false;
}

try {
  const raw = localStorage.getItem("pulseboard.match.mobilePanelCollapsed");
  const parsed = raw ? JSON.parse(raw) : null;
  if (parsed && typeof parsed === "object") {
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        uiState.mobilePanelCollapsedByKey[key] = value;
      }
    }
  }
} catch {
  uiState.mobilePanelCollapsedByKey = {};
}

function clearRefreshTimer() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

function clearRespawnTicker() {
  clearInterval(respawnTicker);
  respawnTicker = null;
}

function scheduleRefresh(seconds = DEFAULT_REFRESH_SECONDS) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(8, Number(seconds)) : DEFAULT_REFRESH_SECONDS;
  clearRefreshTimer();
  refreshTimer = setTimeout(loadMatch, safeSeconds * 1000);
}

function isCompactUI() {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function normalizePanelToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchPanelStorageKey(panelElement, headingTitle) {
  const scope = String(panelElement?.getAttribute("data-scope") || "base").trim();
  const normalizedHeading = normalizePanelToken(headingTitle) || "panel";
  return `${scope}:${normalizedHeading}`;
}

function persistMatchMobilePanelState() {
  try {
    localStorage.setItem("pulseboard.match.mobilePanelCollapsed", JSON.stringify(uiState.mobilePanelCollapsedByKey));
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

function shouldMatchPanelBeOpenByDefault(headingTitle, match) {
  if (MOBILE_MATCH_PANELS_ALWAYS_OPEN.has(headingTitle)) {
    return true;
  }

  const mode = uiState.viewMode === "game" ? "game" : match?.status === "upcoming" ? "upcoming" : "series";
  return MOBILE_MATCH_PANELS_DEFAULT_OPEN[mode]?.has(headingTitle) || false;
}

function applyMatchMobilePanelCollapseState(match = uiState.match) {
  const compact = isCompactUI();
  const panels = Array.from(document.querySelectorAll(".match-page main section.panel"));

  panels.forEach((panelElement, index) => {
    const sectionHead = panelElement.querySelector(".section-head");
    const heading = sectionHead?.querySelector("h2");
    if (!sectionHead || !heading) {
      return;
    }

    const headingTitle = String(heading.dataset.fullTitle || heading.textContent || "").trim();
    const panelKey = matchPanelStorageKey(panelElement, headingTitle);
    panelElement.dataset.mobilePanelKey = panelKey;
    if (!panelElement.id) {
      panelElement.id = `match-panel-${normalizePanelToken(panelKey) || String(index + 1)}`;
    }

    let toggleButton = sectionHead.querySelector(".panel-section-toggle");
    if (!toggleButton) {
      toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "ghost panel-section-toggle";
      sectionHead.append(toggleButton);
    }

    const hiddenByScope = panelElement.classList.contains("hidden-panel");
    const hiddenAsAdvanced =
      panelElement.classList.contains("mobile-advanced-collapsed") ||
      panelElement.classList.contains("mobile-advanced-panel") ||
      panelElement.classList.contains("mobile-core-panel");
    const shouldHideControl = !compact || hiddenByScope || (uiState.viewMode === "game" && hiddenAsAdvanced);
    if (shouldHideControl) {
      panelElement.classList.remove("mobile-collapsible", "mobile-panel-collapsed");
      toggleButton.hidden = true;
      toggleButton.disabled = true;
      toggleButton.classList.remove("locked");
      toggleButton.removeAttribute("data-panel-key");
      toggleButton.removeAttribute("aria-controls");
      toggleButton.removeAttribute("aria-expanded");
      return;
    }

    panelElement.classList.add("mobile-collapsible");
    toggleButton.hidden = false;
    toggleButton.disabled = false;
    toggleButton.setAttribute("aria-controls", panelElement.id);
    toggleButton.dataset.panelKey = panelKey;

    const lockedOpen = MOBILE_MATCH_PANELS_ALWAYS_OPEN.has(headingTitle);
    if (lockedOpen) {
      panelElement.classList.remove("mobile-panel-collapsed");
      toggleButton.textContent = "Pinned";
      toggleButton.setAttribute("aria-expanded", "true");
      toggleButton.disabled = true;
      toggleButton.classList.add("locked");
      return;
    }

    const hasSaved = Object.prototype.hasOwnProperty.call(uiState.mobilePanelCollapsedByKey, panelKey);
    const collapsed = hasSaved
      ? Boolean(uiState.mobilePanelCollapsedByKey[panelKey])
      : !shouldMatchPanelBeOpenByDefault(headingTitle, match);
    panelElement.classList.toggle("mobile-panel-collapsed", collapsed);
    toggleButton.textContent = collapsed ? "Show" : "Hide";
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.classList.remove("locked");
  });
}

function bindMatchMobilePanelControls() {
  if (uiState.mobilePanelControlsBound) {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const toggleButton = target.closest(".match-page .panel-section-toggle");
    if (!toggleButton || toggleButton.disabled || !isCompactUI()) {
      return;
    }

    const panelElement = toggleButton.closest("section.panel");
    const panelKey = toggleButton.getAttribute("data-panel-key");
    if (!panelElement || !panelKey) {
      return;
    }

    const nextCollapsed = !panelElement.classList.contains("mobile-panel-collapsed");
    uiState.mobilePanelCollapsedByKey[panelKey] = nextCollapsed;
    persistMatchMobilePanelState();
    applyMatchMobilePanelCollapseState(uiState.match);
  });

  uiState.mobilePanelControlsBound = true;
}

function normalizeTeamKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeGameKey(game) {
  const normalized = String(game || "").toLowerCase();
  if (normalized === "dota" || normalized === "dota2") {
    return "dota2";
  }
  return "lol";
}

function trackerHeroName(row) {
  const hero = String(row?.champion || row?.hero || row?.heroName || row?.character || "").trim();
  return hero || "Unknown";
}

function roleMeta(role, gameKey = "lol") {
  const value = String(role || "").toLowerCase().trim();
  const compactValue = value.replace(/[^a-z0-9]+/g, "");
  const dotaMode = gameKey === "dota2";

  if (!value) {
    return { key: "unknown", label: "Unknown", short: "UNK", icon: "?" };
  }

  if (value === "top") return { key: "top", label: "Top", short: "TOP", icon: "▲" };
  if (value === "jungle" || value === "jg") return { key: "jungle", label: "Jungle", short: "JG", icon: "◆" };
  if (value === "mid" || value === "middle") return { key: "mid", label: "Mid", short: "MID", icon: "◇" };
  if (value === "bottom" || value === "bot" || value === "adc") return { key: "bot", label: "Bottom", short: "BOT", icon: "▼" };
  if (value === "support" || value === "sup") return { key: "support", label: "Support", short: "SUP", icon: "✚" };

  if (dotaMode && (compactValue === "carry" || compactValue === "position1" || compactValue === "pos1")) {
    return { key: "pos1", label: "Position 1", short: "P1", icon: "1" };
  }
  if (dotaMode && (compactValue === "midlane" || compactValue === "position2" || compactValue === "pos2")) {
    return { key: "pos2", label: "Position 2", short: "P2", icon: "2" };
  }
  if (dotaMode && (compactValue === "offlane" || compactValue === "position3" || compactValue === "pos3")) {
    return { key: "pos3", label: "Position 3", short: "P3", icon: "3" };
  }
  if (
    dotaMode &&
    (compactValue === "softsupport" || compactValue === "roamer" || compactValue === "position4" || compactValue === "pos4")
  ) {
    return { key: "pos4", label: "Position 4", short: "P4", icon: "4" };
  }
  if (
    dotaMode &&
    (compactValue === "hardsupport" ||
      compactValue === "fullsupport" ||
      compactValue === "position5" ||
      compactValue === "pos5")
  ) {
    return { key: "pos5", label: "Position 5", short: "P5", icon: "5" };
  }

  return { key: "unknown", label: String(role || "Unknown").toUpperCase(), short: String(role || "UNK").toUpperCase(), icon: "?" };
}

function roleIconMarkup(role, gameKey = "lol", withText = true) {
  const meta = roleMeta(role, gameKey);
  return `
    <span class="tracker-role-inline">
      <span class="tracker-role-icon role-${meta.key}" title="${meta.label}">${meta.icon}</span>
      ${withText ? `<span class="tracker-role-text">${meta.short}</span>` : ""}
    </span>
  `;
}

function trackerAvatarFallback(text) {
  const cleaned = String(text || "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim();
  if (!cleaned) {
    return "?";
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return cleaned.replace(/\s+/g, "").slice(0, 2).toUpperCase();
}

function toAbsoluteAssetUrl(path) {
  if (!path) {
    return null;
  }

  if (String(path).startsWith("http://") || String(path).startsWith("https://")) {
    return String(path);
  }

  try {
    return new URL(path, window.location.href).toString();
  } catch {
    return String(path);
  }
}

async function loadLolHeroCatalog() {
  if (heroIconCatalog.lol.status === "ready") {
    return;
  }
  if (heroIconCatalog.lol.promise) {
    return heroIconCatalog.lol.promise;
  }

  heroIconCatalog.lol.status = "loading";
  heroIconCatalog.lol.promise = (async () => {
    const versionsResponse = await fetch(LOL_CDN_VERSIONS_URL);
    if (!versionsResponse.ok) {
      throw new Error("Failed to fetch LoL versions");
    }
    const versions = await versionsResponse.json();
    const version = Array.isArray(versions) && versions.length ? String(versions[0]) : "latest";

    const championDataUrl = LOL_CDN_CHAMPION_DATA.replace("{version}", encodeURIComponent(version));
    const championResponse = await fetch(championDataUrl);
    if (!championResponse.ok) {
      throw new Error("Failed to fetch LoL champion data");
    }

    const payload = await championResponse.json();
    const rows = Object.values(payload?.data || {});
    const map = new Map();
    for (const row of rows) {
      const id = String(row?.id || "").trim();
      const name = String(row?.name || "").trim();
      if (id) {
        map.set(normalizeLookupKey(id), id);
      }
      if (name) {
        map.set(normalizeLookupKey(name), id || name);
      }
    }

    heroIconCatalog.lol.map = map;
    heroIconCatalog.lol.version = version;
    heroIconCatalog.lol.status = "ready";
  })()
    .catch(() => {
      heroIconCatalog.lol.status = "error";
    })
    .finally(() => {
      heroIconCatalog.lol.promise = null;
    });

  return heroIconCatalog.lol.promise;
}

async function loadDotaHeroCatalog() {
  if (heroIconCatalog.dota2.status === "ready") {
    return;
  }
  if (heroIconCatalog.dota2.promise) {
    return heroIconCatalog.dota2.promise;
  }

  heroIconCatalog.dota2.status = "loading";
  heroIconCatalog.dota2.promise = (async () => {
    const response = await fetch(DOTA_HERO_STATS_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch Dota hero data");
    }

    const rows = await response.json();
    const map = new Map();
    for (const row of rows) {
      const iconPath = String(row?.icon || row?.img || "").trim();
      if (!iconPath) {
        continue;
      }

      const iconUrl = toAbsoluteAssetUrl(
        iconPath.startsWith("http://") || iconPath.startsWith("https://") ? iconPath : `${DOTA_ICON_CDN_BASE}${iconPath}`
      );
      if (!iconUrl) {
        continue;
      }

      const localized = String(row?.localized_name || "").trim();
      const engineName = String(row?.name || "").trim();
      const engineSlug = engineName.replace(/^npc_dota_hero_/, "").replace(/_/g, " ");
      const keyCandidates = [localized, engineName, engineSlug];
      for (const candidate of keyCandidates) {
        const key = normalizeLookupKey(candidate);
        if (key) {
          map.set(key, iconUrl);
        }
      }
    }

    heroIconCatalog.dota2.map = map;
    heroIconCatalog.dota2.status = "ready";
  })()
    .catch(() => {
      heroIconCatalog.dota2.status = "error";
    })
    .finally(() => {
      heroIconCatalog.dota2.promise = null;
    });

  return heroIconCatalog.dota2.promise;
}

function scheduleHeroIconCatalogLoad(match) {
  const gameKey = normalizeGameKey(match?.game);
  if (gameKey === "lol") {
    if (heroIconCatalog.lol.status === "idle") {
      loadLolHeroCatalog().then(() => {
        if (uiState.match?.id === match?.id) {
          renderPlayerTracker(uiState.match);
          renderLeadTrend(uiState.match);
        }
      });
    }
    return;
  }

  if (heroIconCatalog.dota2.status === "idle") {
    loadDotaHeroCatalog().then(() => {
      if (uiState.match?.id === match?.id) {
        renderPlayerTracker(uiState.match);
        renderLeadTrend(uiState.match);
      }
    });
  }
}

function lolHeroIconUrl(heroName) {
  const catalog = heroIconCatalog.lol;
  if (catalog.status !== "ready" || !catalog.version) {
    return null;
  }

  const normalized = normalizeLookupKey(heroName);
  const championId = catalog.map.get(normalized);
  if (!championId) {
    return null;
  }

  return LOL_CDN_CHAMPION_ICON.replace("{version}", encodeURIComponent(catalog.version)).replace(
    "{id}",
    encodeURIComponent(championId)
  );
}

function dotaHeroIconUrl(heroName) {
  const catalog = heroIconCatalog.dota2;
  if (catalog.status !== "ready") {
    return null;
  }

  return catalog.map.get(normalizeLookupKey(heroName)) || null;
}

function heroIconUrlForRow(match, row) {
  const heroName = trackerHeroName(row);
  const gameKey = normalizeGameKey(match?.game);
  if (gameKey === "dota2") {
    return dotaHeroIconUrl(heroName);
  }

  return lolHeroIconUrl(heroName);
}

function heroIconMarkup(match, row) {
  const heroName = trackerHeroName(row);
  const iconUrl = heroIconUrlForRow(match, row);
  if (iconUrl) {
    return `<span class="tracker-hero-icon"><img src="${iconUrl}" alt="${heroName} icon" loading="lazy" decoding="async" /></span>`;
  }

  return `<span class="tracker-hero-icon fallback">${trackerAvatarFallback(heroName)}</span>`;
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

function displayTeamName(name) {
  return isCompactUI() ? shortTeamName(name) : String(name || "Unknown");
}

function scoreboardTeamName(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return "TBD";
  }

  return TEAM_HEADER_ABBREVIATIONS[normalizeTeamKey(raw)] || shortTeamName(raw);
}

function trackerTeamTag(name) {
  const short = scoreboardTeamName(name);
  if (short.length <= 4) {
    return short.toUpperCase();
  }

  const tokens = short
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length >= 2) {
    const acronym = tokens
      .map((token) => token[0])
      .join("")
      .toUpperCase();
    if (acronym.length >= 2) {
      return acronym.slice(0, 4);
    }
  }

  const compact = short.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
  return compact.slice(0, 4) || short.slice(0, 4).toUpperCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayPlayerHandle(name, teamName) {
  const raw = String(name || "").trim();
  if (!raw) {
    return "Player";
  }

  const candidates = new Set();
  const addCandidate = (value) => {
    const normalized = String(value || "").trim();
    if (normalized && normalized.length >= 2) {
      candidates.add(normalized);
    }
  };

  addCandidate(teamName);
  addCandidate(shortTeamName(teamName));
  addCandidate(scoreboardTeamName(teamName));
  addCandidate(trackerTeamTag(teamName));

  for (const candidate of candidates) {
    const escaped = escapeRegex(candidate);
    const regex = new RegExp(`^\\[?${escaped}\\]?[\\s._-]+`, "i");
    if (!regex.test(raw)) {
      continue;
    }

    const stripped = raw.replace(regex, "").trim();
    if (stripped.length >= 2) {
      return stripped;
    }
  }

  return raw;
}

function compactStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "live") return "LIVE";
  if (normalized === "completed") return "FINAL";
  if (normalized === "upcoming") return "UPCOMING";
  return normalized.toUpperCase() || "UNKNOWN";
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

function applyMobileSectionHeadings() {
  if (elements.backLink) {
    elements.backLink.textContent = isCompactUI() ? "Back" : "Back to Live Desk";
  }

  const headings = Array.from(document.querySelectorAll(".match-page .section-head h2"));
  for (const heading of headings) {
    const full = heading.dataset.fullTitle || heading.textContent.trim();
    if (!heading.dataset.fullTitle) {
      heading.dataset.fullTitle = full;
    }

    const mapping = MOBILE_SECTION_HEADINGS[full];
    if (isCompactUI() && mapping) {
      heading.innerHTML = `<span class="section-mini-icon" aria-hidden="true">${mapping.icon}</span>${mapping.short}`;
      heading.classList.add("mobile-short");
    } else {
      heading.textContent = full;
      heading.classList.remove("mobile-short");
    }
  }
}

function panelForTargetId(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return null;
  }

  return target.closest("section.panel");
}

function scrollToTargetId(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const anchor = target.closest("section.panel") || target;
  const topOffset = isCompactUI() ? 136 : 92;
  const top = Math.max(0, Math.round(anchor.getBoundingClientRect().top + window.scrollY - topOffset));
  window.scrollTo({ top, behavior: "smooth" });
}

function bindMobileJumpContainer(container, { allowAdvanced = false } = {}) {
  if (!container || container.dataset.bound === "1") {
    return;
  }

  container.dataset.bound = "1";
  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const jumpButton = target.closest("[data-jump-target]");
    if (jumpButton) {
      const jumpTarget = jumpButton.getAttribute("data-jump-target");
      if (jumpTarget) {
        scrollToTargetId(jumpTarget);
      }
      return;
    }

    if (!allowAdvanced || !target.closest("[data-advanced-toggle]")) {
      return;
    }

    uiState.mobileAdvancedExpanded = !uiState.mobileAdvancedExpanded;
    try {
      localStorage.setItem("pulseboard.mobileAdvancedExpanded", uiState.mobileAdvancedExpanded ? "1" : "0");
    } catch {
      // Ignore storage failures and keep current in-memory preference.
    }

    if (uiState.match) {
      applyMobileGameEnhancements(uiState.match);
    }
  });
}

function mobileJumpTargetsForCurrentMode(match) {
  if (uiState.viewMode === "game") {
    return MOBILE_GAME_JUMP_TARGETS;
  }

  if (match?.status === "upcoming") {
    return MOBILE_UPCOMING_JUMP_TARGETS;
  }

  return MOBILE_SERIES_JUMP_TARGETS;
}

function renderMobileModeToolbar(match) {
  if (!elements.mobileModeToolbar) {
    return;
  }

  if (!isCompactUI() || uiState.viewMode === "game") {
    elements.mobileModeToolbar.hidden = true;
    elements.mobileModeToolbar.innerHTML = "";
    return;
  }

  const jumpButtons = mobileJumpTargetsForCurrentMode(match)
    .filter((item) => {
      const panel = panelForTargetId(item.id);
      return panel && !panel.classList.contains("hidden-panel");
    })
    .map((item) => `<button type="button" class="mobile-mode-chip" data-jump-target="${item.id}">${item.label}</button>`)
    .join("");

  if (!jumpButtons) {
    elements.mobileModeToolbar.hidden = true;
    elements.mobileModeToolbar.innerHTML = "";
    return;
  }

  elements.mobileModeToolbar.hidden = false;
  elements.mobileModeToolbar.innerHTML = `<div class="mobile-mode-row">${jumpButtons}</div>`;
}

function renderMobileGameToolbar({ compactGameMode, advancedVisibleCount }) {
  if (!elements.mobileGameToolbar) {
    return;
  }

  if (!compactGameMode) {
    elements.mobileGameToolbar.hidden = true;
    elements.mobileGameToolbar.innerHTML = "";
    return;
  }

  const jumpButtons = MOBILE_GAME_JUMP_TARGETS
    .filter((item) => {
      const panel = panelForTargetId(item.id);
      if (!panel) {
        return false;
      }
      return !panel.classList.contains("hidden-panel");
    })
    .map((item) => `<button type="button" class="mobile-jump-chip" data-jump-target="${item.id}">${item.label}</button>`)
    .join("");

  const advancedButton =
    advancedVisibleCount > 0
      ? `<button type="button" class="mobile-advanced-toggle${uiState.mobileAdvancedExpanded ? " open" : ""}" data-advanced-toggle="1">${uiState.mobileAdvancedExpanded ? "Hide extra panels" : `More stats (${advancedVisibleCount})`}</button>`
      : "";

  if (!jumpButtons && !advancedButton) {
    elements.mobileGameToolbar.hidden = true;
    elements.mobileGameToolbar.innerHTML = "";
    return;
  }

  elements.mobileGameToolbar.hidden = false;
  elements.mobileGameToolbar.innerHTML = `
    ${jumpButtons ? `<div class="mobile-jump-row">${jumpButtons}</div>` : ""}
    ${advancedButton}
  `;
}

function mobileCorePanelTargetIds(match) {
  const selectedState = String(match?.selectedGame?.state || "inProgress");
  const mapped = MOBILE_CORE_GAME_PANEL_TARGETS_BY_STATE[selectedState];
  if (Array.isArray(mapped) && mapped.length) {
    return mapped;
  }

  return MOBILE_CORE_GAME_PANEL_TARGETS_BY_STATE.inProgress;
}

function applyMobileGameEnhancements(match) {
  const selectedState = String(match?.selectedGame?.state || "");
  const compactGameMode = isCompactUI() && uiState.viewMode === "game";
  document.body.classList.toggle("mobile-game-mode", compactGameMode);
  document.body.classList.toggle("mobile-game-live", compactGameMode && selectedState === "inProgress");
  document.body.classList.toggle("mobile-game-complete", compactGameMode && selectedState === "completed");
  document.body.classList.toggle(
    "mobile-game-upcoming",
    compactGameMode && (selectedState === "unstarted" || selectedState === "unneeded")
  );
  bindMobileJumpContainer(elements.mobileGameToolbar, { allowAdvanced: true });
  bindMobileJumpContainer(elements.mobileModeToolbar);

  const corePanels = new Set(
    mobileCorePanelTargetIds(match)
      .map((targetId) => panelForTargetId(targetId))
      .filter(Boolean)
  );

  let advancedVisibleCount = 0;
  for (const panel of elements.gamePanels) {
    const isCore = corePanels.has(panel);
    panel.classList.toggle("mobile-core-panel", isCore);
    panel.classList.toggle("mobile-advanced-panel", !isCore);
    panel.classList.toggle("mobile-advanced-collapsed", compactGameMode && !uiState.mobileAdvancedExpanded && !isCore);
    if (!isCore && !panel.classList.contains("hidden-panel")) {
      advancedVisibleCount += 1;
    }
  }

  renderMobileGameToolbar({
    compactGameMode,
    advancedVisibleCount
  });
  renderMobileModeToolbar(match);
}

function dateTimeLabel(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return String(iso || "");
    }

    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return String(iso || "");
  }
}

function signed(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) {
    return "0";
  }

  return `${num > 0 ? "+" : ""}${num}`;
}

function shortDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) {
    return "0m";
  }

  const day = Math.floor(total / 86400);
  const hour = Math.floor((total % 86400) / 3600);
  const minute = Math.floor((total % 3600) / 60);

  if (day > 0) {
    return `${day}d ${hour}h`;
  }

  if (hour > 0) {
    return `${hour}h ${minute}m`;
  }

  return `${Math.max(1, minute)}m`;
}

function parseIsoTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGameClock(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function resolveFeedTimelineAnchor(match, rows) {
  const selectedStart = parseIsoTimestamp(match?.selectedGame?.startedAt);
  if (selectedStart !== null) {
    return { startTs: selectedStart, estimated: false };
  }

  const selectedNumber = Number(match?.selectedGame?.number || 0);
  const selectedSeriesGame = Array.isArray(match?.seriesGames)
    ? match.seriesGames.find((row) => Number(row?.number || 0) === selectedNumber)
    : null;
  const selectedSeriesStart = parseIsoTimestamp(selectedSeriesGame?.startedAt);
  if (selectedSeriesStart !== null) {
    return { startTs: selectedSeriesStart, estimated: true };
  }

  const updatedTs = parseIsoTimestamp(match?.playerEconomy?.updatedAt);
  const elapsedSeconds = Number(match?.playerEconomy?.elapsedSeconds || 0);
  if (updatedTs !== null && Number.isFinite(elapsedSeconds) && elapsedSeconds > 0) {
    return {
      startTs: updatedTs - Math.round(elapsedSeconds * 1000),
      estimated: true
    };
  }

  const eventTimes = rows
    .map((row) => parseIsoTimestamp(row?.at))
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (eventTimes.length > 0) {
    return { startTs: eventTimes[0], estimated: true };
  }

  return { startTs: null, estimated: true };
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }

  return num.toLocaleString();
}

function winnerTeamName(match) {
  if (!match?.teams?.left || !match?.teams?.right) {
    return null;
  }

  if (match.winnerTeamId === match.teams.left.id) {
    return match.teams.left.name;
  }

  if (match.winnerTeamId === match.teams.right.id) {
    return match.teams.right.name;
  }

  if (match.status === "completed") {
    if (match.seriesScore.left > match.seriesScore.right) {
      return match.teams.left.name;
    }

    if (match.seriesScore.right > match.seriesScore.left) {
      return match.teams.right.name;
    }
  }

  return null;
}

function teamBadgeText(name) {
  const short = shortTeamName(name)
    .replace(/[^A-Za-z0-9\s.]/g, " ")
    .trim();
  if (!short) {
    return "?";
  }

  const words = short
    .split(/[\s.]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const letters = short.replace(/[^A-Za-z0-9]/g, "");
  if (!letters) {
    return "?";
  }

  return letters.slice(0, Math.min(3, letters.length)).toUpperCase();
}

function teamLogoUrl(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return null;
  }

  return TEAM_LOGO_BY_KEY[normalizeTeamKey(raw)] || null;
}

function teamBadgeMarkup(name) {
  const logo = teamLogoUrl(name);
  if (logo) {
    const label = scoreboardTeamName(name);
    return `<span class="team-badge has-logo"><img src="${logo}" alt="${label} logo" loading="lazy" decoding="async" /></span>`;
  }

  return `<span class="team-badge">${teamBadgeText(name)}</span>`;
}

function selectedGameScoreContext(match) {
  const selected = match?.selectedGame;
  if (!selected || uiState.viewMode !== "game") {
    return null;
  }

  const selectedNumber = Number(selected?.number || 0);
  const seriesGame = Array.isArray(match?.seriesGames)
    ? match.seriesGames.find((row) => Number(row?.number || 0) === selectedNumber)
    : null;

  const leftKillsRaw = Number(selected?.snapshot?.left?.kills);
  const rightKillsRaw = Number(selected?.snapshot?.right?.kills);
  const fallbackLeftKills = Number(match?.teams?.left?.kills);
  const fallbackRightKills = Number(match?.teams?.right?.kills);
  const leftKills = Number.isFinite(leftKillsRaw)
    ? leftKillsRaw
    : Number.isFinite(fallbackLeftKills)
      ? fallbackLeftKills
      : null;
  const rightKills = Number.isFinite(rightKillsRaw)
    ? rightKillsRaw
    : Number.isFinite(fallbackRightKills)
      ? fallbackRightKills
      : null;

  let leftSide = String(seriesGame?.sideInfo?.leftSide || "").toUpperCase();
  let rightSide = String(seriesGame?.sideInfo?.rightSide || "").toUpperCase();
  if ((!leftSide || !rightSide) && Array.isArray(selected?.sideSummary)) {
    const [leftSummary, rightSummary] = selected.sideSummary;
    const leftMatch = String(leftSummary || "").match(/\b(BLUE|RED)\b/i);
    const rightMatch = String(rightSummary || "").match(/\b(BLUE|RED)\b/i);
    if (leftMatch) {
      leftSide = leftMatch[1].toUpperCase();
    }
    if (rightMatch) {
      rightSide = rightMatch[1].toUpperCase();
    }
  }

  if (!leftSide) {
    leftSide = "SIDE";
  }
  if (!rightSide) {
    rightSide = "SIDE";
  }

  return {
    number: selectedNumber > 0 ? selectedNumber : null,
    state: String(selected?.state || "unstarted"),
    leftKills,
    rightKills,
    leftSide,
    rightSide
  };
}

function renderScoreboard(match) {
  const compact = isCompactUI();
  const winner = winnerTeamName(match);
  const winnerLabel = winner ? scoreboardTeamName(winner) : null;
  const seriesSubline = compact
    ? compactStatusLabel(match.status)
    : `${compactStatusLabel(match.status)}${winnerLabel ? ` · ${winnerLabel}` : ""}`;
  const leftRawName = String(match?.teams?.left?.name || "Unknown");
  const rightRawName = String(match?.teams?.right?.name || "Unknown");
  const leftDisplayName = scoreboardTeamName(leftRawName);
  const rightDisplayName = scoreboardTeamName(rightRawName);
  const selectedGameNumber = contextGameNumber();
  const leftTeamUrl = teamDetailUrl(match.teams.left.id, match.game, uiState.apiBase, {
    matchId: match.id,
    gameNumber: selectedGameNumber,
    opponentId: match.teams.right.id,
    teamName: leftRawName
  });
  const rightTeamUrl = teamDetailUrl(match.teams.right.id, match.game, uiState.apiBase, {
    matchId: match.id,
    gameNumber: selectedGameNumber,
    opponentId: match.teams.left.id,
    teamName: rightRawName
  });
  const gameContext = selectedGameScoreContext(match);
  const gameStatus = gameContext?.state ? stateLabel(gameContext.state) : "";

  elements.scoreboard.innerHTML = `
    <article class="score-strip series-strip">
      <a class="score-team left" href="${leftTeamUrl}" aria-label="Open ${leftRawName} team page">
        ${teamBadgeMarkup(leftRawName)}
        <span class="score-team-name">${leftDisplayName}</span>
      </a>
      <div class="score-center">
        <p class="score-center-label">${compact ? "Series" : "Series Score"}</p>
        <p class="score-center-main">${match.seriesScore.left}<span class="score-divider">-</span>${match.seriesScore.right}</p>
        <p class="score-center-sub">${seriesSubline}</p>
      </div>
      <a class="score-team right" href="${rightTeamUrl}" aria-label="Open ${rightRawName} team page">
        ${teamBadgeMarkup(rightRawName)}
        <span class="score-team-name">${rightDisplayName}</span>
      </a>
    </article>
    ${gameContext
      ? `
    <article class="score-strip game-strip ${gameContext.state === "inProgress" ? "live" : gameContext.state === "completed" ? "complete" : "upcoming"}">
      <a class="score-team left" href="${leftTeamUrl}" aria-label="Open ${leftRawName} team page">
        ${teamBadgeMarkup(leftRawName)}
        <span class="score-team-side ${gameContext.leftSide === "BLUE" ? "blue" : gameContext.leftSide === "RED" ? "red" : ""}">${gameContext.leftSide}</span>
        <span class="score-team-name">${leftDisplayName}</span>
      </a>
      <div class="score-center game-center">
        <p class="score-center-label">${gameContext.number ? (compact ? `G${gameContext.number}` : `Game ${gameContext.number}`) : compact ? "Game" : "Selected Game"}${gameStatus ? ` · ${gameStatus}` : ""}</p>
        <p class="score-center-main">${Number.isFinite(gameContext.leftKills) ? gameContext.leftKills : "—"}<span class="score-divider">-</span>${Number.isFinite(gameContext.rightKills) ? gameContext.rightKills : "—"}</p>
        <p class="score-center-sub">${compact ? "Kills" : "Kills this game"}</p>
      </div>
      <a class="score-team right" href="${rightTeamUrl}" aria-label="Open ${rightRawName} team page">
        ${teamBadgeMarkup(rightRawName)}
        <span class="score-team-side ${gameContext.rightSide === "BLUE" ? "blue" : gameContext.rightSide === "RED" ? "red" : ""}">${gameContext.rightSide}</span>
        <span class="score-team-name">${rightDisplayName}</span>
      </a>
    </article>
    `
      : ""}
  `;
}

function streamKeyForMatch({ matchId, apiBase, gameNumber }) {
  const normalizedGame = Number.isInteger(gameNumber) ? String(gameNumber) : "auto";
  return `${apiBase}::${matchId}::${normalizedGame}`;
}

function closeMatchStream() {
  if (uiState.stream.eventSource) {
    uiState.stream.eventSource.close();
    uiState.stream.eventSource = null;
  }

  if (uiState.stream.reconnectTimer) {
    clearTimeout(uiState.stream.reconnectTimer);
    uiState.stream.reconnectTimer = null;
  }
}

function streamBadge(status) {
  if (status === "connected") return "connected";
  if (status === "reconnecting") return "reconnecting";
  return "polling";
}

function streamStatusText(match) {
  const compact = isCompactUI();
  const refreshSeconds = Number(match?.refreshAfterSeconds || DEFAULT_REFRESH_SECONDS);
  if (uiState.stream.source === "sse") {
    if (uiState.stream.connected) {
      return compact ? "Live stream" : "Realtime stream connected";
    }

    if (uiState.stream.eventSource && uiState.stream.reconnectAttempt === 0) {
      return compact ? "Connecting stream" : "Realtime stream connecting";
    }

    if (uiState.stream.reconnectAttempt > 0) {
      return compact
        ? `Reconnecting (${uiState.stream.reconnectAttempt})`
        : `Realtime stream reconnecting (attempt ${uiState.stream.reconnectAttempt})`;
    }

    return compact ? "Stream unavailable" : "Realtime stream unavailable";
  }

  return compact ? `Refresh ${refreshSeconds}s` : `Polling every ${refreshSeconds}s`;
}

function streamStatusDetail() {
  const compact = isCompactUI();
  const updatedAt = Number(uiState.stream.lastSnapshotAt || 0);
  if (!updatedAt) {
    return compact ? "Waiting..." : "Waiting for snapshot...";
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  return compact ? `${ageSeconds}s ago` : `Last snapshot ${ageSeconds}s ago`;
}

function renderStreamStatus(match) {
  if (!elements.streamStatusWrap) {
    return;
  }

  const compact = isCompactUI();
  const lastErrorAt = Number(uiState.stream.lastErrorAt || 0);
  const errorSeconds = lastErrorAt ? Math.max(0, Math.round((Date.now() - lastErrorAt) / 1000)) : null;
  const badge = streamBadge(uiState.stream.connected ? "connected" : uiState.stream.source === "sse" ? "reconnecting" : "polling");
  const errorText = lastErrorAt
    ? compact
      ? ` · Err ${errorSeconds}s`
      : ` · Last stream error ${dateTimeLabel(lastErrorAt)}`
    : "";
  elements.streamStatusWrap.innerHTML = `
    <article class="stream-card ${badge}">
      <p class="stream-title">${streamStatusText(match)}</p>
      <p class="meta-text">${streamStatusDetail()}${errorText}</p>
    </article>
  `;
}

function parseRequestedGameNumber(raw) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    return null;
  }

  return parsed;
}

function firstInProgressGameNumber(match) {
  const seriesGames = Array.isArray(match?.seriesGames) ? match.seriesGames : [];
  const liveSeriesGame = seriesGames.find((game) => game?.state === "inProgress");
  const liveSeriesNumber = Number(liveSeriesGame?.number);
  if (Number.isInteger(liveSeriesNumber) && liveSeriesNumber > 0) {
    return liveSeriesNumber;
  }

  const availableGames = Array.isArray(match?.gameNavigation?.availableGames) ? match.gameNavigation.availableGames : [];
  const liveAvailableGame = availableGames.find((game) => game?.state === "inProgress");
  const liveAvailableNumber = Number(liveAvailableGame?.number);
  if (Number.isInteger(liveAvailableNumber) && liveAvailableNumber > 0) {
    return liveAvailableNumber;
  }

  return null;
}

function resolveMatchFocus(match) {
  const status = String(match?.status || "unknown");
  const requested = uiState.requestedGameNumber;
  const selectedFromNav = Number(match?.gameNavigation?.selectedGameNumber);
  const selectedFromPayload = Number(match?.selectedGame?.number);

  if (status === "upcoming") {
    return {
      viewMode: "series",
      activeGameNumber: null
    };
  }

  if (Number.isInteger(requested)) {
    const activeGameNumber =
      (Number.isInteger(selectedFromNav) && selectedFromNav > 0 && selectedFromNav) ||
      (Number.isInteger(selectedFromPayload) && selectedFromPayload > 0 && selectedFromPayload) ||
      requested;
    return {
      viewMode: "game",
      activeGameNumber
    };
  }

  return {
    viewMode: "series",
    activeGameNumber: null
  };
}

function contextGameNumber() {
  if (uiState.viewMode !== "game") {
    return null;
  }

  const active = Number(uiState.activeGameNumber);
  return Number.isInteger(active) && active > 0 ? active : null;
}

function isLoopbackHost(host) {
  const normalized = String(host || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function normalizeApiBase(base) {
  const raw = String(base || "").trim();
  const fallback = DEFAULT_API_BASE;
  const candidate = raw || fallback;

  try {
    const parsed = new URL(candidate);
    const pageHost = String(window.location.hostname || "").trim();
    if (isLoopbackHost(parsed.hostname) && isLoopbackHost(pageHost) && parsed.hostname !== pageHost) {
      parsed.hostname = pageHost;
    }
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function detailUrlForGame(matchId, _apiBase, gameNumber = null) {
  return buildMatchUrl({
    matchId,
    gameNumber
  });
}

function teamDetailUrl(
  teamId,
  game,
  _apiBase,
  { matchId = null, gameNumber = null, opponentId = null, teamName = null } = {}
) {
  return buildTeamUrl({
    teamId,
    game,
    matchId,
    gameNumber,
    opponentId,
    teamName
  });
}

function canonicalMatchPath(matchId, gameNumber = null) {
  const params = new URLSearchParams();
  if (matchId) {
    params.set("id", String(matchId));
  }
  if (Number.isInteger(gameNumber) && gameNumber > 0) {
    params.set("game", String(gameNumber));
  }
  const query = params.toString();
  return `/match.html${query ? `?${query}` : ""}`;
}

function eventStatusForMatch(match) {
  const status = String(match?.status || "").toLowerCase();
  if (status === "live") {
    return "https://schema.org/EventInProgress";
  }
  if (status === "completed") {
    return "https://schema.org/EventCompleted";
  }
  return "https://schema.org/EventScheduled";
}

function refreshMatchSeo(match = null) {
  const pageUrl = new URL(window.location.href);
  const route = parseMatchRoute(pageUrl.toString());
  const matchId = String(match?.id || route.id || "").trim();
  const requestedGame = Number.isInteger(route.gameNumber) ? route.gameNumber : parseRequestedGameNumber(pageUrl.searchParams.get("game"));
  const selectedGame = contextGameNumber();
  const gameNumber = Number.isInteger(selectedGame) ? selectedGame : requestedGame;
  const seoGameKey = normalizeSeoGameKey(match?.game || pageUrl.searchParams.get("title") || pageUrl.searchParams.get("game"));
  const gameName = gameLabel(seoGameKey || "esports");
  const leftName = String(match?.teams?.left?.name || "Team A").trim();
  const rightName = String(match?.teams?.right?.name || "Team B").trim();
  const matchup = `${leftName} vs ${rightName}`;

  let pageTitle = "Match Detail | Pulseboard";
  let description = "Series context, live map stats, and outcomes for esports matches on Pulseboard.";
  if (matchId && !match) {
    pageTitle = `Match ${matchId} | Pulseboard`;
  }

  if (match) {
    const status = String(match.status || "").toLowerCase();
    const tournament = String(match.tournament || "Tournament").trim();
    const bestOf = Number(match.bestOf || 1);
    if (Number.isInteger(gameNumber) && gameNumber > 0 && uiState.viewMode === "game") {
      const selectedState = String(match?.selectedGame?.state || status);
      const stateLabel = selectedState === "inProgress" ? "Live" : selectedState === "completed" ? "Final" : "Preview";
      pageTitle = `${matchup} Game ${gameNumber} ${stateLabel} | Pulseboard`;
      description = `${stateLabel} game ${gameNumber} tracker for ${matchup} at ${tournament}: player stats, objective control, and lead trend.`;
    } else if (status === "live") {
      pageTitle = `${matchup} Live Series | Pulseboard`;
      description = `Live ${gameName} series tracking for ${matchup} at ${tournament}, including current map context and series score.`;
    } else if (status === "completed") {
      pageTitle = `${matchup} Final Result | Pulseboard`;
      description = `Final ${gameName} series result for ${matchup} at ${tournament} with map-by-map recap and team comparison.`;
    } else {
      pageTitle = `${matchup} Match Preview | Pulseboard`;
      description = `Upcoming ${gameName} series preview for ${matchup} at ${tournament}, including form, head-to-head, and kickoff timing.`;
    }

    if (bestOf > 1) {
      description = `${description} Format: Best of ${bestOf}.`;
    }
  }

  const allowedQueryParams = Number.isInteger(gameNumber) && gameNumber > 0 && uiState.viewMode === "game" ? ["id", "game"] : ["id"];
  const canonicalPath = canonicalMatchPath(matchId, allowedQueryParams.includes("game") ? gameNumber : null);
  const indexDetailPages =
    window.PULSEBOARD_CONFIG?.indexDetailPages === true ||
    window.PULSEBOARD_INDEX_DETAIL_PAGES === true;
  let robots = indexDetailPages ? inferRobotsDirective({ allowedQueryParams }) : "noindex,follow";
  if (!matchId) {
    robots = "noindex,nofollow";
  }

  applySeo({
    title: pageTitle,
    description,
    canonicalPath,
    robots,
    ogType: "article"
  });

  const schedulePath = seoGameKey
    ? `/schedule.html?title=${encodeURIComponent(seoGameKey)}`
    : "/schedule.html";
  const crumbItems = [
    { name: "Pulseboard", path: "/index.html" },
    { name: "Schedule", path: schedulePath }
  ];
  if (matchId) {
    crumbItems.push({
      name: matchup,
      path: canonicalMatchPath(matchId, null)
    });
  }
  if (Number.isInteger(gameNumber) && gameNumber > 0 && uiState.viewMode === "game" && matchId) {
    crumbItems.push({
      name: `Game ${gameNumber}`,
      path: canonicalMatchPath(matchId, gameNumber)
    });
  }
  setJsonLd("page-breadcrumb", buildBreadcrumbJsonLd(crumbItems));

  if (!match) {
    setJsonLd("match-event", null);
    setJsonLd("match-games", null);
    return;
  }

  const startDate = String(match.startAt || "").trim();
  const selectedGameState = String(match?.selectedGame?.state || "").toLowerCase();
  const eventUrl = toAbsoluteSiteUrl(canonicalMatchPath(match.id, Number.isInteger(gameNumber) && gameNumber > 0 ? gameNumber : null));
  const eventName =
    Number.isInteger(gameNumber) && gameNumber > 0 && uiState.viewMode === "game"
      ? `${matchup} - Game ${gameNumber}`
      : matchup;
  const eventDescription =
    Number.isInteger(gameNumber) && gameNumber > 0 && uiState.viewMode === "game"
      ? `Map ${gameNumber} ${selectedGameState === "inprogress" ? "live" : selectedGameState || "status"} details for ${matchup}.`
      : `${gameName} series between ${matchup}.`;

  setJsonLd("match-event", {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: eventName,
    sport: gameName,
    description: eventDescription,
    eventStatus: eventStatusForMatch(match),
    startDate: startDate || undefined,
    location: {
      "@type": "Place",
      name: String(match.tournament || "Esports Tournament")
    },
    competitor: [
      {
        "@type": "SportsTeam",
        name: leftName
      },
      {
        "@type": "SportsTeam",
        name: rightName
      }
    ],
    url: eventUrl
  });

  const games = Array.isArray(match?.seriesGames) ? match.seriesGames : [];
  if (!games.length) {
    setJsonLd("match-games", null);
    return;
  }

  setJsonLd("match-games", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${matchup} games`,
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `Game ${game?.number || index + 1} ${String(game?.state || "").toLowerCase() || ""}`.trim(),
      url: toAbsoluteSiteUrl(canonicalMatchPath(match.id, Number(game?.number || index + 1)))
    }))
  });
}

function normalizeMatchupLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    return 5;
  }

  if ([3, 5, 10, 15, 20].includes(parsed)) {
    return parsed;
  }

  return 5;
}

function setMatchupLimitInUrl(limit) {
  const normalized = normalizeMatchupLimit(limit);
  const url = new URL(window.location.href);
  if (normalized === 5) {
    url.searchParams.delete("h2h_limit");
  } else {
    url.searchParams.set("h2h_limit", String(normalized));
  }
  window.history.replaceState({}, "", url.toString());
}

function resetMatchupState() {
  uiState.matchup = {
    key: null,
    loading: false,
    error: null,
    leftProfile: null,
    rightProfile: null
  };
}

function formatRatePct(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "n/a";
  }

  return `${num.toFixed(1)}%`;
}

function formMomentumScore(formLabel) {
  const tokens = String(formLabel || "")
    .toUpperCase()
    .split("");
  let score = 0;
  for (const token of tokens) {
    if (token === "W") score += 1;
    if (token === "L") score -= 1;
  }
  return score;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function matchupEdgeModel(leftProfile, rightProfile, fallbackLeftName, fallbackRightName) {
  const leftSummary = leftProfile?.summary || {};
  const rightSummary = rightProfile?.summary || {};
  const leftName = leftProfile?.name || fallbackLeftName || "Left Team";
  const rightName = rightProfile?.name || fallbackRightName || "Right Team";
  const leftSeries = Number(leftSummary.seriesWinRatePct || 0);
  const rightSeries = Number(rightSummary.seriesWinRatePct || 0);
  const leftMap = Number(leftSummary.mapWinRatePct || 0);
  const rightMap = Number(rightSummary.mapWinRatePct || 0);
  const leftForm = formMomentumScore(leftSummary.formLast5);
  const rightForm = formMomentumScore(rightSummary.formLast5);

  const raw = 50 + (leftSeries - rightSeries) * 0.32 + (leftMap - rightMap) * 0.18 + (leftForm - rightForm) * 2.1;
  const leftEdgePct = clampValue(raw, 8, 92);
  const rightEdgePct = 100 - leftEdgePct;

  const drivers = [];
  if (Math.abs(leftSeries - rightSeries) >= 8) {
    drivers.push(
      leftSeries > rightSeries
        ? `${leftName} has stronger recent series conversion.`
        : `${rightName} has stronger recent series conversion.`
    );
  }
  if (Math.abs(leftMap - rightMap) >= 6) {
    drivers.push(
      leftMap > rightMap
        ? `${leftName} shows better map-level consistency.`
        : `${rightName} shows better map-level consistency.`
    );
  }
  if (Math.abs(leftForm - rightForm) >= 2) {
    drivers.push(
      leftForm > rightForm
        ? `${leftName} has stronger recent momentum.`
        : `${rightName} has stronger recent momentum.`
    );
  }
  if (!drivers.length) {
    drivers.push("Both teams are close on recent form and conversion rates.");
  }

  const favoriteName = leftEdgePct >= rightEdgePct ? leftName : rightName;
  const confidence = Math.abs(leftEdgePct - rightEdgePct) >= 18 ? "high" : Math.abs(leftEdgePct - rightEdgePct) >= 9 ? "medium" : "low";

  return {
    leftEdgePct,
    rightEdgePct,
    favoriteName,
    confidence,
    drivers
  };
}

async function fetchTeamProfileForMatchup({
  teamId,
  teamName,
  opponentId,
  game,
  matchId,
  apiBase,
  limit
}) {
  const requestUrl = new URL(`/v1/teams/${encodeURIComponent(teamId)}`, apiBase);
  requestUrl.searchParams.set("game", String(game || "lol"));
  requestUrl.searchParams.set("limit", String(normalizeMatchupLimit(limit)));
  if (opponentId) {
    requestUrl.searchParams.set("opponent_id", String(opponentId));
  }
  if (matchId) {
    requestUrl.searchParams.set("seed_match_id", String(matchId));
  }
  if (teamName) {
    requestUrl.searchParams.set("team_name", String(teamName));
  }

  const response = await fetch(requestUrl.toString());
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Unable to load team profile for ${teamName || teamId}.`);
  }

  return payload?.data || null;
}

function matchupRequestKey(match, apiBase) {
  return [
    apiBase,
    match?.id || "match",
    match?.game || "game",
    match?.teams?.left?.id || "left",
    match?.teams?.right?.id || "right",
    String(uiState.matchupH2hLimit)
  ].join("::");
}

async function ensureMatchupData(match, apiBase) {
  if (!match?.teams?.left?.id || !match?.teams?.right?.id) {
    resetMatchupState();
    renderMatchupConsole(match);
    return;
  }

  const key = matchupRequestKey(match, apiBase);
  if (uiState.matchup.loading && uiState.matchup.key === key) {
    return;
  }
  if (uiState.matchup.key === key && (uiState.matchup.leftProfile || uiState.matchup.error)) {
    return;
  }

  const token = uiState.matchupRequestToken + 1;
  uiState.matchupRequestToken = token;
  uiState.matchup = {
    key,
    loading: true,
    error: null,
    leftProfile: null,
    rightProfile: null
  };
  renderMatchupConsole(match);

  try {
    const [leftProfile, rightProfile] = await Promise.all([
      fetchTeamProfileForMatchup({
        teamId: match.teams.left.id,
        teamName: match.teams.left.name,
        opponentId: match.teams.right.id,
        game: match.game,
        matchId: match.id,
        apiBase,
        limit: uiState.matchupH2hLimit
      }),
      fetchTeamProfileForMatchup({
        teamId: match.teams.right.id,
        teamName: match.teams.right.name,
        opponentId: match.teams.left.id,
        game: match.game,
        matchId: match.id,
        apiBase,
        limit: uiState.matchupH2hLimit
      })
    ]);

    if (token !== uiState.matchupRequestToken) {
      return;
    }

    uiState.matchup = {
      key,
      loading: false,
      error: null,
      leftProfile,
      rightProfile
    };
    renderMatchupConsole(uiState.match || match);
  } catch (error) {
    if (token !== uiState.matchupRequestToken) {
      return;
    }

    uiState.matchup = {
      key,
      loading: false,
      error: error?.message || "Unable to load matchup data.",
      leftProfile: null,
      rightProfile: null
    };
    renderMatchupConsole(uiState.match || match);
  }
}

function seriesRecordLabel(summary = {}) {
  const wins = Number(summary.wins || 0);
  const losses = Number(summary.losses || 0);
  const draws = Number(summary.draws || 0);
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

function renderMatchupTeamCard({ teamName, teamId, opponentId, profile, match, toneClass }) {
  const selectedGameNumber = contextGameNumber() || 0;
  const teamUrl = teamDetailUrl(teamId, match?.game, uiState.apiBase, {
    matchId: match?.id || null,
    gameNumber: Number.isInteger(selectedGameNumber) && selectedGameNumber > 0 ? selectedGameNumber : null,
    opponentId,
    teamName
  });
  const heading = teamUrl ? `<a class="team-link" href="${teamUrl}">${teamName}</a>` : teamName;
  const summary = profile?.summary || {};

  return `
    <article class="form-card ${toneClass}">
      <h3>${heading}</h3>
      <p class="meta-text">Series ${seriesRecordLabel(summary)} · WR ${formatRatePct(summary.seriesWinRatePct)}</p>
      <p class="meta-text">Maps ${summary.mapWins ?? 0}-${summary.mapLosses ?? 0} · WR ${formatRatePct(summary.mapWinRatePct)}</p>
      <p class="meta-text">Form ${summary.formLast5 || "n/a"} · Streak ${summary.streakLabel || "n/a"}</p>
    </article>
  `;
}

function winnerLabelForH2hRow(row, match) {
  const result = String(row?.result || "").toLowerCase();
  if (result === "win") return match?.teams?.left?.name || "Left Team";
  if (result === "loss") return match?.teams?.right?.name || "Right Team";
  if (result === "draw") return "Draw";
  return "n/a";
}

function h2hResultClass(result) {
  const normalized = String(result || "").toLowerCase();
  if (normalized === "win") return "win-left";
  if (normalized === "loss") return "win-right";
  return "even";
}

function h2hResultLabel(result) {
  const normalized = String(result || "").toLowerCase();
  if (normalized === "win") return "W";
  if (normalized === "loss") return "L";
  if (normalized === "draw") return "D";
  return "n/a";
}

function renderMatchupConsole(match) {
  if (!elements.matchupConsoleWrap || !elements.matchupMetaText) {
    return;
  }

  if (!match?.teams?.left || !match?.teams?.right) {
    elements.matchupMetaText.textContent = "Matchup console unavailable.";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Load a valid match to view head-to-head and matchup compare.</div>`;
    return;
  }

  const leftName = match?.teams?.left?.name || "Left Team";
  const rightName = match?.teams?.right?.name || "Right Team";
  const matchupState = uiState.matchup;
  const expectedKey = matchupRequestKey(match, uiState.apiBase);

  if (matchupState.key && matchupState.key !== expectedKey && !matchupState.loading) {
    elements.matchupMetaText.textContent = "Loading matchup compare...";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Loading team profile and head-to-head data.</div>`;
    return;
  }

  if (matchupState.loading) {
    elements.matchupMetaText.textContent = "Loading matchup compare...";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Loading team profile and head-to-head data.</div>`;
    return;
  }

  if (matchupState.error) {
    elements.matchupMetaText.textContent = "Matchup compare unavailable.";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Unable to load matchup data: ${matchupState.error}</div>`;
    return;
  }

  const leftProfile = matchupState.leftProfile;
  const rightProfile = matchupState.rightProfile;
  if (!leftProfile || !rightProfile) {
    elements.matchupMetaText.textContent = "Matchup compare waiting for data.";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Waiting for matchup dataset.</div>`;
    return;
  }

  const edge = matchupEdgeModel(leftProfile, rightProfile, leftName, rightName);
  const compact = isCompactUI();
  const h2h = leftProfile?.headToHead || null;
  const h2hRows = Array.isArray(h2h?.recentMatches) ? h2h.recentMatches : [];
  const leftWins = Number(h2h?.wins || 0);
  const rightWins = Number(h2h?.losses || 0);
  const draws = Number(h2h?.draws || 0);
  const total = Number(h2h?.matches || h2hRows.length || 0);

  elements.matchupMetaText.textContent = `Model favorite: ${edge.favoriteName} · Confidence ${edge.confidence.toUpperCase()} · H2H sample ${total}`;

  const h2hTable = h2hRows.length
    ? compact
      ? `
        <div class="series-h2h-list">
          ${h2hRows
            .map((row) => `
              <article class="series-h2h-item">
                <div class="series-h2h-top">
                  <p class="series-h2h-date">${dateTimeCompact(row.startAt)}</p>
                  <span class="series-h2h-result ${h2hResultClass(row.result)}">${h2hResultLabel(row.result)}</span>
                </div>
                <p class="meta-text">${winnerLabelForH2hRow(row, match)}${row.scoreLabel ? ` · ${row.scoreLabel}` : ""}</p>
                <p class="meta-text">${row.tournament || "Unknown tournament"}</p>
                ${row.matchId ? `<a class="table-link" href="${detailUrlForGame(row.matchId, uiState.apiBase)}">Open match</a>` : ""}
              </article>
            `)
            .join("")}
        </div>
      `
      : `
        <div class="lane-table-wrap">
          <table class="lane-table upcoming-h2h-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Winner</th>
                <th>Result (${leftName})</th>
                <th>Score</th>
                <th>Tournament</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${h2hRows
                .map((row) => `
                  <tr>
                    <td>${dateTimeLabel(row.startAt)}</td>
                    <td>${winnerLabelForH2hRow(row, match)}</td>
                    <td class="${h2hResultClass(row.result)}">${h2hResultLabel(row.result)}</td>
                    <td>${row.scoreLabel || "n/a"}</td>
                    <td>${row.tournament || "Unknown"}</td>
                    <td>${row.matchId ? `<a class="table-link" href="${detailUrlForGame(row.matchId, uiState.apiBase)}">Open</a>` : `<span class="meta-text">-</span>`}</td>
                  </tr>
                `)
                .join("")}
            </tbody>
          </table>
        </div>
      `
    : `<div class="empty">No direct meetings found in the selected sample window.</div>`;

  elements.matchupConsoleWrap.innerHTML = `
    <div class="matchup-grid">
      ${renderMatchupTeamCard({
        teamName: leftName,
        teamId: match?.teams?.left?.id,
        opponentId: match?.teams?.right?.id,
        profile: leftProfile,
        match,
        toneClass: "left"
      })}
      <article class="prediction-card">
        <div class="edge-head">
          <p class="meta-text">${leftName}</p>
          <p class="meta-text">${rightName}</p>
        </div>
        <div class="edge-bars">
          <div class="edge-side left" style="width:${edge.leftEdgePct.toFixed(1)}%"></div>
          <div class="edge-side right" style="width:${edge.rightEdgePct.toFixed(1)}%"></div>
        </div>
        <div class="edge-head">
          <p class="edge-score">${edge.leftEdgePct.toFixed(1)}%</p>
          <p class="edge-score">${edge.rightEdgePct.toFixed(1)}%</p>
        </div>
        <p class="meta-text">H2H: ${leftWins}-${rightWins}${draws ? `-${draws}` : ""} (${total} meetings)</p>
        <ul class="confidence-notes">${edge.drivers.map((driver) => `<li>${driver}</li>`).join("")}</ul>
      </article>
      ${renderMatchupTeamCard({
        teamName: rightName,
        teamId: match?.teams?.right?.id,
        opponentId: match?.teams?.left?.id,
        profile: rightProfile,
        match,
        toneClass: "right"
      })}
    </div>
    ${h2hTable}
  `;
}

function renderSeriesHeader(match) {
  const header = match.seriesHeader;
  if (!header) {
    elements.seriesHeaderSubhead.textContent = "";
    elements.seriesHeaderWrap.innerHTML = `<div class="empty">Series overview unavailable.</div>`;
    return;
  }

  elements.seriesHeaderSubhead.textContent = header.subhead || "";
  elements.seriesHeaderWrap.innerHTML = `
    <article class="series-header-card">
      <p class="series-headline">${header.headline || "Series in progress"}</p>
      ${header.winnerName ? `<p class="meta-text strong">Winner: ${header.winnerName}</p>` : ""}
    </article>
  `;
}

function gameNavPillClass(state, selected) {
  const base =
    state === "completed" ? "complete" : state === "inProgress" ? "live" : state === "unneeded" ? "skip" : "upcoming";
  return `${base}${selected ? " selected" : ""}`;
}

function seriesInfoCard(label, value, note = null) {
  return `
    <article class="upcoming-card series-info-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderGameExplorer(match, apiBase) {
  const nav = match.gameNavigation;
  const selected = match.selectedGame;
  const isGameMode = uiState.viewMode === "game";
  const compact = isCompactUI();
  const activeGameNumber = contextGameNumber();

  if (!nav || !Array.isArray(nav.availableGames) || !nav.availableGames.length) {
    elements.gameNavWrap.innerHTML = `<div class="empty">No per-game navigation available for this match.</div>`;
    elements.gameContextWrap.innerHTML = "";
    return;
  }

  const availableGames = Array.isArray(nav.availableGames) ? nav.availableGames : [];
  const playedOrLiveGames = availableGames.filter((game) => game?.state === "completed" || game?.state === "inProgress");
  const seriesHref = detailUrlForGame(match.id, apiBase, null);
  const seriesPill = `<a class="game-pill complete${!isGameMode ? " selected" : ""}" href="${seriesHref}">${compact ? "S" : "Series"}</a>`;
  const liveGameNumber = firstInProgressGameNumber(match);
  const currentLiveCallout = !isGameMode && match.status === "live" && Number.isInteger(liveGameNumber)
    ? `<article class="live-now-banner"><p class="meta-text strong">${compact ? `LIVE NOW · G${liveGameNumber}` : `Current game live now: Game ${liveGameNumber}`}</p><a class="link-btn" href="${detailUrlForGame(match.id, apiBase, liveGameNumber)}">${compact ? `Open G${liveGameNumber}` : `Open Live Game ${liveGameNumber}`}</a></article>`
    : "";
  const navPills = [
    ...(isGameMode ? [seriesPill] : []),
    ...playedOrLiveGames.map((game) => {
      const href = detailUrlForGame(match.id, apiBase, game.number);
      const selectedGamePill = isGameMode && activeGameNumber === game.number;
      const isCurrentLiveGame =
        match.status === "live" &&
        Number.isInteger(liveGameNumber) &&
        liveGameNumber === game.number;
      const liveLabel = compact
        ? isCurrentLiveGame
          ? `G${game.number} ●`
          : `G${game.number}`
        : isCurrentLiveGame
          ? `Game ${game.number} · LIVE`
          : `Game ${game.number}`;
      return `<a class="game-pill ${gameNavPillClass(game.state, selectedGamePill)}${isCurrentLiveGame ? " current-live" : ""}" href="${href}">${liveLabel}</a>`;
    })
  ].join("");

  const navActions = [];
  if (isGameMode && Number.isInteger(nav.previousGameNumber)) {
    navActions.push(`<a class="link-btn ghost" href="${detailUrlForGame(match.id, apiBase, nav.previousGameNumber)}">${compact ? `← G${nav.previousGameNumber}` : "Previous Game"}</a>`);
  }
  if (isGameMode && Number.isInteger(nav.nextGameNumber)) {
    navActions.push(`<a class="link-btn ghost" href="${detailUrlForGame(match.id, apiBase, nav.nextGameNumber)}">${compact ? `G${nav.nextGameNumber} →` : "Next Game"}</a>`);
  }
  if (!isGameMode && match.status === "live" && Number.isInteger(liveGameNumber)) {
    navActions.push(`<a class="link-btn ghost" href="${detailUrlForGame(match.id, apiBase, liveGameNumber)}">${compact ? `Open G${liveGameNumber}` : `Open Live Game ${liveGameNumber}`}</a>`);
  }

  elements.gameNavWrap.innerHTML = `
    ${navActions.length ? `<div class="game-nav-head"><div class="game-nav-links">${navActions.join("")}</div></div>` : ""}
    ${currentLiveCallout}
    ${Number.isInteger(uiState.requestedGameFallback) ? `<p class="meta-text">Requested Game ${uiState.requestedGameFallback} could not be loaded.</p>` : ""}
    ${nav.requestedMissing ? `<p class="meta-text">Requested Game ${nav.requestedGameNumber} not found.</p>` : ""}
    ${navPills ? `<div class="game-pill-row">${navPills}</div>` : ""}
  `;

  if (elements.feedTeamFilter) {
    const leftOption = elements.feedTeamFilter.querySelector("option[value='left']");
    const rightOption = elements.feedTeamFilter.querySelector("option[value='right']");
    if (leftOption) {
      leftOption.textContent = displayTeamName(match.teams.left.name);
    }
    if (rightOption) {
      rightOption.textContent = displayTeamName(match.teams.right.name);
    }
  }

  if (!isGameMode) {
    const winner = winnerTeamName(match);
    const bestOf = Number(match?.bestOf || 1);
    const startTs = Date.parse(String(match?.startAt || ""));
    const kickoffDate = Number.isFinite(startTs)
      ? new Date(startTs).toLocaleDateString(undefined, { month: "short", day: "numeric", year: compact ? undefined : "numeric" })
      : "TBD";
    const kickoffTime = Number.isFinite(startTs)
      ? new Date(startTs).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : "TBD";
    const tournamentName = match.tournament || "Tournament TBD";
    const matchupLabel = `${displayTeamName(match.teams.left.name)} vs ${displayTeamName(match.teams.right.name)}`;
    const projectionCountdown = Number(match?.seriesProjection?.countdownSeconds);
    const fallbackCountdown = Number.isFinite(startTs) ? Math.max(0, Math.round((startTs - Date.now()) / 1000)) : null;
    const countdown = Number.isFinite(projectionCountdown) ? projectionCountdown : fallbackCountdown;
    const liveSeriesGame = (Array.isArray(match.seriesGames) ? match.seriesGames : []).find((game) => game.state === "inProgress");
    const completedMaps = playedOrLiveGames.filter((game) => game.state === "completed").length;
    const formatLabel = `Best of ${bestOf}`;

    if (match.status === "upcoming") {
      elements.gameContextWrap.innerHTML = `
        <article class="game-context-card none series-context-card">
          <div class="game-context-top">
            <p class="game-context-title">Upcoming Series</p>
          </div>
          <div class="series-context-grid">
            ${seriesInfoCard("Date", kickoffDate)}
            ${seriesInfoCard("Time", kickoffTime)}
            ${seriesInfoCard("Matchup", matchupLabel)}
            ${seriesInfoCard("Format", formatLabel)}
            ${seriesInfoCard("Tournament", tournamentName)}
            ${seriesInfoCard("Countdown", countdown !== null ? shortDuration(Math.max(0, countdown)) : "TBD")}
            ${seriesInfoCard("Patch", match.patch || "unknown")}
            ${seriesInfoCard("Region", String(match.region || "global").toUpperCase())}
          </div>
        </article>
      `;
      return;
    }

    if (match.status === "completed") {
      elements.gameContextWrap.innerHTML = `
        <article class="game-context-card none series-context-card">
          <div class="game-context-top">
            <p class="game-context-title">Series Result</p>
          </div>
          <div class="series-context-grid">
            ${seriesInfoCard("Final", `${match.seriesScore.left} - ${match.seriesScore.right}`)}
            ${seriesInfoCard("Winner", winner ? displayTeamName(winner) : "TBD")}
            ${seriesInfoCard("Matchup", matchupLabel)}
            ${seriesInfoCard("Format", formatLabel)}
            ${seriesInfoCard("Tournament", tournamentName)}
            ${seriesInfoCard("Maps Played", String(completedMaps))}
            ${seriesInfoCard("Kickoff", `${kickoffDate} · ${kickoffTime}`)}
            ${seriesInfoCard("Patch", match.patch || "unknown")}
          </div>
        </article>
      `;
      return;
    }

    elements.gameContextWrap.innerHTML = `
      <article class="game-context-card none series-context-card">
        <div class="game-context-top">
          <p class="game-context-title">Series In Progress</p>
        </div>
        <div class="series-context-grid">
          ${seriesInfoCard("Current Game", Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber}` : "Live")}
          ${seriesInfoCard("Series Score", `${match.seriesScore.left} - ${match.seriesScore.right}`)}
          ${seriesInfoCard("Matchup", matchupLabel)}
          ${seriesInfoCard("Format", formatLabel)}
          ${seriesInfoCard("Tournament", tournamentName)}
          ${seriesInfoCard("Maps Completed", String(completedMaps))}
          ${seriesInfoCard("Kickoff", `${kickoffDate} · ${kickoffTime}`)}
          ${seriesInfoCard("Patch", match.patch || "unknown")}
          ${Number.isFinite(Number(match?.momentum?.goldLead))
            ? seriesInfoCard("Gold Lead", signed(match.momentum.goldLead))
            : ""}
          ${Number.isFinite(Number(match?.momentum?.killDiff))
            ? seriesInfoCard("Kill Diff", signed(match.momentum.killDiff))
            : ""}
          ${liveSeriesGame?.startedAt
            ? seriesInfoCard("Current Map Start", compact ? dateTimeCompact(liveSeriesGame.startedAt) : dateTimeLabel(liveSeriesGame.startedAt))
            : ""}
        </div>
      </article>
    `;
    return;
  }

  if (!selected) {
    elements.gameContextWrap.innerHTML = `<div class="empty">Choose a game to load context.</div>`;
    return;
  }

  const sideSummary = Array.isArray(selected.sideSummary) ? selected.sideSummary : [];
  const tips = Array.isArray(selected.tips) ? selected.tips : [];
  const watchOptions = Array.isArray(selected.watchOptions) ? selected.watchOptions : [];
  const compactStateSummary = compact && selected.state !== "inProgress";
  const telemetryCountsLine = `Ticker ${selected.telemetryCounts?.tickerEvents || 0} · Objective ${selected.telemetryCounts?.objectiveEvents || 0} · Bursts ${selected.telemetryCounts?.combatBursts || 0} · Milestones ${selected.telemetryCounts?.goldMilestones || 0}`;

  elements.gameContextWrap.innerHTML = `
    <article class="game-context-card ${selected.telemetryStatus || "none"}">
      <div class="game-context-top">
        <p class="game-context-title">Game ${selected.number} · ${String(selected.state || "unstarted").toUpperCase()}</p>
        <span class="pill ${selected.state === "inProgress" ? "live" : selected.state === "completed" ? "complete" : selected.state === "unneeded" ? "skip" : "upcoming"}">${selected.telemetryStatus || "none"} telemetry</span>
      </div>
      <p class="meta-text">${selected.label || "No game label."}</p>
      ${selected.startedAt ? `<p class="meta-text">Started: ${dateTimeLabel(selected.startedAt)}</p>` : ""}
      ${sideSummary.length ? `<p class="meta-text">${sideSummary.join(" · ")}</p>` : ""}
      ${compactStateSummary ? "" : `<p class="meta-text">${telemetryCountsLine}</p>`}
      ${selected.watchUrl ? `<a class="table-link" href="${selected.watchUrl}" target="_blank" rel="noreferrer">${compactStateSummary ? "Watch" : "Primary VOD"}</a>` : `<span class="meta-text">${compactStateSummary ? "No watch link." : "No primary VOD link."}</span>`}
      ${watchOptions.length
        ? `<div class="vod-options">${watchOptions
            .map((option) => `<a class="vod-link" href="${option.watchUrl}" target="_blank" rel="noreferrer">${compactStateSummary ? option.shortLabel || option.label : option.label}</a>`)
            .join("")}</div>`
        : ""}
      ${compactStateSummary ? "" : tips.length ? `<ul class="confidence-notes">${tips.map((tip) => `<li>${tip}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function setPanelVisibility(panelElement, visible) {
  if (!panelElement) {
    return;
  }

  panelElement.classList.toggle("hidden-panel", !visible);
}

function applyGamePanelVisibility(match) {
  const isGameMode = uiState.viewMode === "game";
  if (!isGameMode) {
    for (const panel of elements.gamePanels) {
      setPanelVisibility(panel, false);
    }
    return;
  }

  const selected = match.selectedGame;
  const telemetryStatus = selected?.telemetryStatus || "none";
  const selectedState = selected?.state || "unstarted";
  const hasRichTelemetry = telemetryStatus === "rich";

  for (const panel of elements.gamePanels) {
    setPanelVisibility(panel, true);
  }

  const telemetryPanels = [
    elements.dataConfidenceWrap,
    elements.pulseCard,
    elements.edgeMeterWrap,
    elements.tempoSnapshotWrap,
    elements.tacticalChecklistWrap,
    elements.storylinesList,
    elements.leadTrendWrap,
    elements.objectiveControlWrap,
    elements.objectiveBreakdownWrap,
    elements.draftBoardWrap,
    elements.draftDeltaWrap,
    elements.economyBoardWrap,
    elements.laneMatchupsWrap,
    elements.objectiveRunsWrap,
    elements.roleDeltaWrap,
    elements.performersWrap,
    elements.liveTickerList,
    elements.objectiveTimelineList,
    elements.objectiveForecastWrap,
    elements.playerDeltaWrap,
    elements.momentsList,
    elements.teamCompareWrap,
    elements.playerTrackerWrap,
    elements.liveFeedList,
    elements.combatBurstsList,
    elements.goldMilestonesList,
    elements.liveAlertsList
  ]
    .map((element) => element?.closest("section.panel"))
    .filter(Boolean);

  if (selectedState === "unstarted") {
    for (const panel of telemetryPanels) {
      setPanelVisibility(panel, false);
    }
    return;
  }

  if (!hasRichTelemetry) {
    for (const panel of telemetryPanels) {
      setPanelVisibility(panel, false);
    }
  }
}

function applySeriesPanelVisibility() {
  const showSeriesPanels = uiState.viewMode === "series";
  for (const panel of elements.seriesPanels) {
    setPanelVisibility(panel, showSeriesPanels);
  }
}

function applyUpcomingPanelVisibility(match) {
  const isUpcoming = match?.status === "upcoming";
  for (const panel of elements.upcomingPanels) {
    setPanelVisibility(panel, isUpcoming);
  }
}

function commandCard(label, value, hint) {
  return `
    <article class="command-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${hint ? `<p class="meta-text">${hint}</p>` : ""}
    </article>
  `;
}

function renderGameCommandCenter(match) {
  const selected = match.selectedGame;
  if (!selected) {
    elements.gameCommandWrap.innerHTML = `<div class="empty">Game command metrics unavailable.</div>`;
    return;
  }

  const leftName = match.teams?.left?.name || "Left Team";
  const rightName = match.teams?.right?.name || "Right Team";
  const elapsedSeconds = Number(match?.playerEconomy?.elapsedSeconds || 0);
  const elapsedMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
  const leftKills = Number(selected?.snapshot?.left?.kills || 0);
  const rightKills = Number(selected?.snapshot?.right?.kills || 0);
  const totalKills = leftKills + rightKills;
  const killPace = elapsedMinutes > 0 ? `${((totalKills / elapsedMinutes) * 10).toFixed(2)} / 10m` : "n/a";
  const objectiveEvents = Number(selected?.telemetryCounts?.objectiveEvents || 0);
  const tickerEvents = Number(selected?.telemetryCounts?.tickerEvents || 0);
  const bursts = Number(selected?.telemetryCounts?.combatBursts || 0);
  const milestones = Number(selected?.telemetryCounts?.goldMilestones || 0);
  const refreshSeconds = Number(match?.refreshAfterSeconds || DEFAULT_REFRESH_SECONDS);

  elements.gameCommandWrap.innerHTML = [
    commandCard("Selected Map", `Game ${selected.number}`, selected.label),
    commandCard("Game State", String(selected.state || "unstarted").toUpperCase(), `${selected.telemetryStatus || "none"} telemetry`),
    commandCard("Live Clock", elapsedSeconds > 0 ? shortDuration(elapsedSeconds) : "n/a", "Derived from player economy window"),
    commandCard("Kill Pace", killPace, `${leftName} ${leftKills} · ${rightKills} ${rightName}`),
    commandCard("Event Throughput", `${tickerEvents} ticker · ${objectiveEvents} objective`, "Higher values indicate frequent map swings"),
    commandCard("Burst Windows", `${bursts} detected`, "Multi-kill combat windows from frame deltas"),
    commandCard("Gold Milestones", `${milestones} reached`, "Team economy thresholds crossed in this map"),
    commandCard("Refresh Cadence", `Every ${refreshSeconds}s`, "Auto-refresh remains active while this tab is open")
  ].join("");
}

function toMetricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMetricValue(metric, value) {
  if (value === null) {
    return "n/a";
  }

  if (metric === "gold") {
    return formatNumber(value);
  }

  return String(Math.round(value));
}

function renderTeamComparison(match) {
  const selected = match.selectedGame;
  const snapshot = selected?.snapshot;
  if (!snapshot) {
    elements.teamCompareWrap.innerHTML = `<div class="empty">Team comparison unavailable for this game.</div>`;
    return;
  }

  const rows = [
    { key: "gold", label: "Gold" },
    { key: "kills", label: "Kills" },
    { key: "towers", label: "Towers" },
    { key: "dragons", label: "Dragons" },
    { key: "barons", label: "Barons" },
    { key: "inhibitors", label: "Inhibitors" }
  ]
    .map((metric) => {
      const left = toMetricNumber(snapshot.left?.[metric.key]);
      const right = toMetricNumber(snapshot.right?.[metric.key]);
      if (left === null && right === null) {
        return null;
      }

      const diff = left !== null && right !== null ? left - right : null;
      return {
        ...metric,
        left,
        right,
        diff
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    elements.teamCompareWrap.innerHTML = `<div class="empty">Not enough team metrics to compare this map.</div>`;
    return;
  }

  elements.teamCompareWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table compare-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>${match.teams.left.name}</th>
            <th>Diff</th>
            <th>${match.teams.right.name}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const diff = row.diff === null ? "n/a" : signed(Math.round(row.diff));
              const diffClass = row.diff === null ? "" : row.diff > 0 ? "win-left" : row.diff < 0 ? "win-right" : "even";
              return `
                <tr>
                  <td>${row.label}</td>
                  <td>${formatMetricValue(row.key, row.left)}</td>
                  <td class="${diffClass}">${diff}</td>
                  <td>${formatMetricValue(row.key, row.right)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function trackerRoleOrder(role) {
  const value = normalizeLookupKey(role);
  if (value === "top") return 1;
  if (value === "jungle" || value === "jg") return 2;
  if (value === "mid" || value === "middle") return 3;
  if (value === "bottom" || value === "adc" || value === "bot") return 4;
  if (value === "support" || value === "sup") return 5;
  if (value === "carry" || value === "position1" || value === "pos1") return 1;
  if (value === "position2" || value === "pos2") return 2;
  if (value === "offlane" || value === "position3" || value === "pos3") return 3;
  if (value === "softsupport" || value === "roamer" || value === "position4" || value === "pos4") return 4;
  if (value === "hardsupport" || value === "fullsupport" || value === "position5" || value === "pos5") return 5;
  return 99;
}

function toPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "n/a";
  }

  return `${num.toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function healthPctForRow(row) {
  const pctFromPayload = Number(row?.healthPct);
  if (Number.isFinite(pctFromPayload)) {
    return clamp(pctFromPayload, 0, 100);
  }

  const current = Number(row?.currentHealth);
  const max = Number(row?.maxHealth);
  if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
    return clamp((current / max) * 100, 0, 100);
  }

  return null;
}

function healthLabelForRow(row, isLiveMap, isDead) {
  if (!isLiveMap) {
    return "N/A";
  }

  if (isDead) {
    return "0 HP";
  }

  const current = Number(row?.currentHealth);
  const max = Number(row?.maxHealth);
  if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
    return `${formatNumber(Math.round(current))} / ${formatNumber(Math.round(max))}`;
  }

  return "n/a";
}

function healthToneClass(pct, isDead) {
  if (isDead) return "dead";
  if (!Number.isFinite(pct)) return "unknown";
  if (pct <= 25) return "critical";
  if (pct <= 55) return "warn";
  return "good";
}

function parseFlexibleTimestampMs(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const directNumber = Number(value);
  if (Number.isFinite(directNumber)) {
    if (directNumber > 1e12) {
      return directNumber;
    }
    if (directNumber > 1e9) {
      return directNumber * 1000;
    }
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function respawnSecondsForRow(row) {
  const candidates = [row?.respawnSeconds, row?.respawnTimerSeconds, row?.respawnTimer];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function respawnTargetMsForRow(row, nowMs = Date.now()) {
  const fromPayload = parseFlexibleTimestampMs(row?.respawnAt);
  const respawnSeconds = respawnSecondsForRow(row);

  if (fromPayload !== null) {
    if (Number.isFinite(respawnSeconds) && respawnSeconds > 0 && fromPayload < nowMs - 1200) {
      return nowMs + Math.round(respawnSeconds * 1000);
    }
    return fromPayload;
  }

  if (Number.isFinite(respawnSeconds)) {
    return nowMs + Math.round(respawnSeconds * 1000);
  }

  return null;
}

function formatRespawnLabel(row, isDead, nowMs = Date.now(), targetMs = null) {
  if (!isDead) {
    return "Alive";
  }

  const resolvedTargetMs = Number.isFinite(targetMs) ? targetMs : respawnTargetMsForRow(row, nowMs);
  if (Number.isFinite(resolvedTargetMs)) {
    const secondsLeft = Math.max(0, Math.round((resolvedTargetMs - nowMs) / 1000));
    return `${secondsLeft}s${row?.respawnEstimated ? " est" : ""}`;
  }

  const respawnSeconds = respawnSecondsForRow(row);
  if (Number.isFinite(respawnSeconds)) {
    return `${Math.max(0, Math.round(respawnSeconds))}s${row?.respawnEstimated ? " est" : ""}`;
  }

  const deadForSeconds = Number(row?.deadForSeconds);
  if (Number.isFinite(deadForSeconds) && deadForSeconds >= 0) {
    return `Dead ${Math.round(deadForSeconds)}s`;
  }

  return "n/a";
}

function tickRespawnCountdownCells() {
  const cells = Array.from(document.querySelectorAll("[data-respawn-at]"));
  if (!cells.length) {
    clearRespawnTicker();
    return;
  }

  const now = Date.now();
  for (const cell of cells) {
    const respawnAt = Number(cell.getAttribute("data-respawn-at"));
    if (!Number.isFinite(respawnAt)) {
      continue;
    }

    const secondsLeft = Math.max(0, Math.round((respawnAt - now) / 1000));
    const estimated = cell.getAttribute("data-respawn-est") === "1";
    const prefix = cell.getAttribute("data-respawn-prefix") || "";
    cell.textContent = `${prefix}${secondsLeft}s${estimated ? " est" : ""}`;
    cell.classList.toggle("respawn-ready", secondsLeft <= 0);
  }
}

function startRespawnTicker() {
  clearRespawnTicker();
  const hasRespawnCells = document.querySelector("[data-respawn-at]");
  if (!hasRespawnCells) {
    return;
  }

  tickRespawnCountdownCells();
  respawnTicker = setInterval(tickRespawnCountdownCells, 1000);
}

function renderPlayerTracker(match) {
  const economy = match.playerEconomy;
  if (!economy || (!Array.isArray(economy.left) && !Array.isArray(economy.right))) {
    clearRespawnTicker();
    elements.playerTrackerWrap.innerHTML = `<div class="empty">Player tracker appears once economy telemetry is available.</div>`;
    return;
  }

  const gameKey = normalizeGameKey(match?.game);
  scheduleHeroIconCatalogLoad(match);
  const leftRows = Array.isArray(economy.left) ? economy.left : [];
  const rightRows = Array.isArray(economy.right) ? economy.right : [];
  const isLiveMap = String(match?.selectedGame?.state || "") === "inProgress";
  const teamKills = {
    left: Number(match?.selectedGame?.snapshot?.left?.kills || match?.teams?.left?.kills || 0),
    right: Number(match?.selectedGame?.snapshot?.right?.kills || match?.teams?.right?.kills || 0)
  };
  const teamGold = {
    left: Number(match?.teamEconomyTotals?.left?.totalGold || 0),
    right: Number(match?.teamEconomyTotals?.right?.totalGold || 0)
  };

  const deltaByKey = new Map(
    (match?.playerDeltaPanel?.players || []).map((player) => [
      `${player.team}::${String(player.name || "").toLowerCase()}`,
      Number(player?.delta?.goldEarned || 0)
    ])
  );
  const impactByKey = new Map(
    (match?.topPerformers || []).map((player) => [
      `${player.team}::${String(player.name || "").toLowerCase()}`,
      Number(player?.impactScore || 0)
    ])
  );

  const rows = [...leftRows.map((row) => ({ ...row, team: "left" })), ...rightRows.map((row) => ({ ...row, team: "right" }))]
    .map((row) => {
      const key = `${row.team}::${String(row.name || "").toLowerCase()}`;
      const kp =
        teamKills[row.team] > 0 ? ((Number(row.kills || 0) + Number(row.assists || 0)) / teamKills[row.team]) * 100 : null;
      const goldShare = teamGold[row.team] > 0 ? (Number(row.goldEarned || 0) / teamGold[row.team]) * 100 : null;

      return {
        ...row,
        kp,
        goldShare,
        deltaGold: deltaByKey.get(key),
        impact: impactByKey.get(key)
      };
    });

  const teamOrder = (team) => (team === "left" ? 0 : 1);
  const sortMode = uiState.trackerSort || "role";
  rows.sort((a, b) => {
    if (sortMode === "gold") {
      const delta = Number(b.goldEarned || 0) - Number(a.goldEarned || 0);
      if (delta !== 0) return delta;
      return teamOrder(a.team) - teamOrder(b.team);
    }

    if (sortMode === "kp") {
      const leftValue = Number.isFinite(a.kp) ? a.kp : -1;
      const rightValue = Number.isFinite(b.kp) ? b.kp : -1;
      const delta = rightValue - leftValue;
      if (delta !== 0) return delta;
      return teamOrder(a.team) - teamOrder(b.team);
    }

    if (sortMode === "impact") {
      const leftValue = Number.isFinite(a.impact) ? a.impact : -1;
      const rightValue = Number.isFinite(b.impact) ? b.impact : -1;
      const delta = rightValue - leftValue;
      if (delta !== 0) return delta;
      return teamOrder(a.team) - teamOrder(b.team);
    }

    if (a.team !== b.team) {
      return teamOrder(a.team) - teamOrder(b.team);
    }

    const roleDelta = trackerRoleOrder(a.role) - trackerRoleOrder(b.role);
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return Number(b.goldEarned || 0) - Number(a.goldEarned || 0);
  });
  const renderNowMs = Date.now();

  if (isCompactUI()) {
    elements.playerTrackerWrap.innerHTML = `
      <div class="lane-table-wrap tracker-mobile-wrap">
        <table class="lane-table tracker-table tracker-table-mobile">
          <thead>
            <tr>
              <th>Tm</th>
              <th>Player</th>
              <th>HP</th>
              <th>NW</th>
              <th>KDA</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const teamName = row.team === "left" ? match.teams.left.name : match.teams.right.name;
                const teamShort = trackerTeamTag(teamName);
                const teamClass = row.team === "left" ? "win-left" : "win-right";
                const playerName = displayPlayerHandle(row.name, teamName);
                const isDead = isLiveMap && (row.isDead === true || row.isDead === "true");
                const hpPct = healthPctForRow(row);
                const hpTone = healthToneClass(hpPct, isDead);
                const hpWidth = Number.isFinite(hpPct) ? hpPct.toFixed(1) : "0.0";
                const hpLabel = healthLabelForRow(row, isLiveMap, isDead);
                const hpCompactLabel = isLiveMap ? (Number.isFinite(hpPct) ? `${Math.round(hpPct)}%` : "n/a") : "N/A";
                const respawnAtTs = isDead ? respawnTargetMsForRow(row, renderNowMs) : null;
                const respawnLabel = isLiveMap && isDead ? formatRespawnLabel(row, isDead, renderNowMs, respawnAtTs) : "";
                const respawnAttrs = Number.isFinite(respawnAtTs)
                  ? ` data-respawn-at="${Math.round(respawnAtTs)}" data-respawn-est="${row?.respawnEstimated ? "1" : "0"}" data-respawn-prefix="☠ "`
                  : "";
                const respawnOverlay = isDead
                  ? `<span class="tracker-respawn-overlay tracker-respawn dead"${respawnAttrs}>☠ ${respawnLabel}</span>`
                  : "";

                return `
                  <tr class="${isDead ? "tracker-row-dead" : ""}">
                    <td class="${teamClass}">${teamShort}</td>
                    <td class="tracker-player-cell">
                      <div class="tracker-player-inline">
                        ${heroIconMarkup(match, row)}
                        ${roleIconMarkup(row.role, gameKey, false)}
                        <div class="tracker-player-inline-meta">
                          <span class="tracker-player-inline-name" title="${playerName}">${playerName}</span>
                        </div>
                      </div>
                      ${respawnOverlay}
                    </td>
                    <td>
                      <div class="tracker-hp-cell compact">
                        <div class="hp-track ${hpTone}">
                          <div class="hp-fill ${hpTone}" style="width:${hpWidth}%"></div>
                        </div>
                        <span class="tracker-hp-label compact" title="${hpLabel}">${hpCompactLabel}</span>
                      </div>
                    </td>
                    <td>${formatNumber(row.goldEarned || 0)}</td>
                    <td>${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    startRespawnTicker();
    return;
  }

  elements.playerTrackerWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table tracker-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Player</th>
            <th>Role</th>
            <th>Hero</th>
            <th>HP</th>
            <th>Status</th>
            <th>Respawn</th>
            <th>KDA</th>
            <th>CS</th>
            <th>Net Worth</th>
            <th>GPM</th>
            <th>KP</th>
            <th>Gold Share</th>
            <th>Items</th>
            <th>Δ Gold</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const teamName = row.team === "left" ? match.teams.left.name : match.teams.right.name;
              const teamClass = row.team === "left" ? "win-left" : "win-right";
              const playerName = displayPlayerHandle(row.name, teamName);
              const heroName = trackerHeroName(row);
              const deltaLabel = Number.isFinite(row.deltaGold) ? signed(Math.round(row.deltaGold)) : "n/a";
              const impactLabel = Number.isFinite(row.impact) ? row.impact.toFixed(1) : "n/a";
              const isDead = isLiveMap && (row.isDead === true || row.isDead === "true");
              const hpPct = healthPctForRow(row);
              const hpTone = healthToneClass(hpPct, isDead);
              const hpWidth = Number.isFinite(hpPct) ? hpPct.toFixed(1) : "0.0";
              const hpLabel = healthLabelForRow(row, isLiveMap, isDead);
              const statusLabel = isLiveMap ? (isDead ? "DEAD \u2620" : "ALIVE") : "N/A";
              const statusClass = isLiveMap ? (isDead ? "dead" : "alive") : "neutral";
              const respawnAtTs = isDead ? respawnTargetMsForRow(row, renderNowMs) : null;
              const respawnLabel = isLiveMap ? formatRespawnLabel(row, isDead, renderNowMs, respawnAtTs) : "N/A";
              const respawnAttrs = Number.isFinite(respawnAtTs)
                ? ` data-respawn-at="${Math.round(respawnAtTs)}" data-respawn-est="${row?.respawnEstimated ? "1" : "0"}" data-respawn-prefix="☠ "`
                : "";

              return `
                <tr class="${isDead ? "tracker-row-dead" : ""}">
                  <td class="${teamClass}">${teamName}</td>
                  <td>${playerName}</td>
                  <td>${roleIconMarkup(row.role, gameKey, true)}</td>
                  <td>
                    <div class="tracker-player-inline">
                      ${heroIconMarkup(match, row)}
                      <span class="tracker-player-inline-hero">${heroName}</span>
                    </div>
                  </td>
                  <td>
                    <div class="tracker-hp-cell">
                      <div class="hp-track ${hpTone}">
                        <div class="hp-fill ${hpTone}" style="width:${hpWidth}%"></div>
                      </div>
                      <span class="tracker-hp-label">${hpLabel}</span>
                    </div>
                  </td>
                  <td><span class="tracker-status-badge ${statusClass}">${statusLabel}</span></td>
                  <td class="tracker-respawn ${statusClass}"${respawnAttrs}>${respawnLabel}</td>
                  <td>${row.kills || 0}/${row.deaths || 0}/${row.assists || 0}</td>
                  <td>${row.cs ?? "n/a"}</td>
                  <td>${formatNumber(row.goldEarned || 0)}</td>
                  <td>${formatNumber(row.gpm || 0)}</td>
                  <td>${toPercent(row.kp)}</td>
                  <td>${toPercent(row.goldShare)}</td>
                  <td>${row.itemCount ?? "n/a"}</td>
                  <td>${deltaLabel}</td>
                  <td>${impactLabel}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  startRespawnTicker();
}

function feedBucketForTickerType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "kills") return "combat";
  if (normalized === "player_kill") return "combat";
  if (normalized === "player_death") return "combat";
  if (normalized === "gold_swing") return "swing";
  if (normalized === "player_gold_spike") return "swing";
  if (normalized === "item_spike") return "swing";
  if (normalized === "level_spike") return "moment";
  if (normalized === "tower" || normalized === "dragon" || normalized === "baron" || normalized === "inhibitor") {
    return "objective";
  }
  return "moment";
}

function importanceRank(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 1;
}

function feedBucketLabel(bucket) {
  const normalized = String(bucket || "").toLowerCase();
  if (normalized === "combat") return "Combat";
  if (normalized === "objective") return "Objective";
  if (normalized === "swing") return "Swing";
  if (normalized === "moment") return "Moment";
  return "Event";
}

function feedRowContentFingerprint(row) {
  const title = String(row?.title || "").trim().toLowerCase();
  const team = String(row?.team || "none").trim().toLowerCase();
  const parsedAt = Date.parse(String(row?.at || ""));
  const atKey = Number.isFinite(parsedAt)
    ? String(Math.floor(parsedAt / 1000))
    : String(row?.at || "").trim();

  return `${team}|${title}|${atKey}`;
}

function buildFeedEventId(row, index = 0) {
  const rowId = String(row?.id || "").trim();
  if (rowId) {
    return `id:${rowId}`;
  }

  const fingerprint = feedRowContentFingerprint(row);
  if (fingerprint) {
    return `fp:${fingerprint}`;
  }

  return `row:${index}`;
}

function encodeStoryEventId(value) {
  return encodeURIComponent(String(value || ""));
}

function decodeStoryEventId(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function dedupeUnifiedFeedRows(rows) {
  const deduped = [];
  const seenIds = new Set();
  const seenContent = new Set();

  for (const row of rows) {
    const rowId = String(row?.id || "").trim();
    const contentFingerprint = feedRowContentFingerprint(row);
    if (rowId && seenIds.has(rowId)) {
      continue;
    }

    if (contentFingerprint && seenContent.has(contentFingerprint)) {
      if (rowId) {
        seenIds.add(rowId);
      }
      continue;
    }

    if (rowId) {
      seenIds.add(rowId);
    }
    if (contentFingerprint) {
      seenContent.add(contentFingerprint);
    }
    deduped.push(row);
  }

  return deduped;
}

function buildUnifiedFeed(match) {
  const tickerRows = Array.isArray(match.liveTicker)
    ? match.liveTicker.map((row) => ({
        id: row.id,
        at: row.occurredAt,
        bucket: feedBucketForTickerType(row.type),
        title: row.title,
        summary: row.summary,
        importance: String(row.importance || row.type || "low").toLowerCase(),
        team: row.team || null
      }))
    : [];

  const objectiveRows = Array.isArray(match.objectiveTimeline)
    ? match.objectiveTimeline.map((row) => ({
        id: row.id,
        at: row.at,
        bucket: "objective",
        title: row.label,
        summary: "Objective timeline event.",
        importance: String(row.type || "medium").toLowerCase(),
        team: row.team || null
      }))
    : [];

  const momentRows = Array.isArray(match.keyMoments)
    ? match.keyMoments.map((row) => ({
        id: row.id,
        at: row.occurredAt,
        bucket: "moment",
        title: row.title,
        summary: row.summary,
        importance: String(row.importance || "medium").toLowerCase(),
        team: row.team || null
      }))
    : [];

  const burstRows = Array.isArray(match.combatBursts)
    ? match.combatBursts.map((row) => ({
        id: row.id,
        at: row.occurredAt,
        bucket: "combat",
        title: row.title || "Combat burst",
        summary: row.summary || "Multi-kill combat window detected.",
        importance: String(row.importance || "medium").toLowerCase(),
        team: row.winnerSide || null
      }))
    : [];

  const milestoneRows = Array.isArray(match.goldMilestones)
    ? match.goldMilestones.map((row) => ({
        id: row.id,
        at: row.occurredAt,
        bucket: "swing",
        title: row.title || "Gold milestone",
        summary: row.summary || "Team crossed an economy threshold.",
        importance: String(row.importance || "medium").toLowerCase(),
        team: row.team || null
      }))
    : [];

  const combined = [...tickerRows, ...objectiveRows, ...momentRows, ...burstRows, ...milestoneRows]
    .filter((row) => row.at && row.title)
    .sort((left, right) => Date.parse(String(right.at || "")) - Date.parse(String(left.at || "")));

  return dedupeUnifiedFeedRows(combined)
    .slice(0, 60)
    .map((row, index) => ({
      ...row,
      eventId: buildFeedEventId(row, index)
    }));
}

function feedRowsWithGameClock(match, rows) {
  const timelineAnchor = resolveFeedTimelineAnchor(match, rows);
  const mappedRows = rows.map((row, index) => {
    const eventTs = parseIsoTimestamp(row.at);
    const gameClockSeconds =
      timelineAnchor.startTs !== null && eventTs !== null
        ? Math.max(0, Math.round((eventTs - timelineAnchor.startTs) / 1000))
        : null;
    return {
      ...row,
      eventId: row.eventId || buildFeedEventId(row, index),
      eventTs,
      gameClockSeconds
    };
  });

  return {
    timelineAnchor,
    rows: mappedRows
  };
}

function feedLeadSeriesRows(match) {
  return (Array.isArray(match?.goldLeadSeries) ? match.goldLeadSeries : [])
    .map((row) => ({
      at: parseIsoTimestamp(row?.at),
      lead: Number(row?.lead || 0)
    }))
    .filter((row) => Number.isFinite(row.at) && Number.isFinite(row.lead))
    .sort((left, right) => left.at - right.at);
}

function feedLeadDescriptor(match, leadValue) {
  if (!Number.isFinite(leadValue) || leadValue === 0) {
    return {
      label: "Even",
      tone: "even"
    };
  }

  const leftShort = scoreboardTeamName(match?.teams?.left?.name);
  const rightShort = scoreboardTeamName(match?.teams?.right?.name);
  const leader = leadValue > 0 ? leftShort : rightShort;
  return {
    label: `${leader} +${compactGold(Math.abs(leadValue))}`,
    tone: leadValue > 0 ? "left" : "right"
  };
}

function ensureStoryFocus(rows) {
  if (!rows.length) {
    uiState.storyFocusEventId = null;
    return null;
  }

  const byId = new Set(rows.map((row) => String(row.eventId || "")).filter(Boolean));
  if (uiState.storyFocusEventId && byId.has(uiState.storyFocusEventId)) {
    return uiState.storyFocusEventId;
  }

  const fallback = String(rows[0].eventId || "");
  uiState.storyFocusEventId = fallback || null;
  return uiState.storyFocusEventId;
}

function setStoryFocusEvent(eventId, options = {}) {
  const normalized = String(eventId || "").trim();
  if (!normalized || normalized === uiState.storyFocusEventId) {
    return;
  }

  uiState.storyFocusEventId = normalized;
  if (uiState.match) {
    renderLeadTrend(uiState.match);
    renderUnifiedLiveFeed(uiState.match);
    if (options.scrollFeed) {
      requestAnimationFrame(() => {
        const activeRow = elements.liveFeedList?.querySelector(".live-feed-item.active");
        if (activeRow instanceof Element) {
          activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    }
  }
}

function renderUnifiedLiveFeed(match) {
  const rows = buildUnifiedFeed(match);
  const nowMs = Date.now();
  const windowMinutes = Number.isFinite(uiState.feedWindowMinutes) ? uiState.feedWindowMinutes : null;
  const filtered = rows.filter((row) => {
    if (uiState.feedType !== "all" && row.bucket !== uiState.feedType) {
      return false;
    }

    if (uiState.feedTeam !== "all" && row.team !== uiState.feedTeam) {
      return false;
    }

    if (uiState.feedImportance !== "all" && importanceRank(row.importance) < importanceRank(uiState.feedImportance)) {
      return false;
    }

    if (windowMinutes !== null) {
      const eventTs = Date.parse(String(row.at || ""));
      if (Number.isFinite(eventTs)) {
        const ageMs = nowMs - eventTs;
        if (ageMs > windowMinutes * 60 * 1000) {
          return false;
        }
      }
    }

    return true;
  });

  if (!filtered.length) {
    uiState.storyFocusEventId = null;
    elements.liveFeedList.innerHTML = `<li>No events match the current feed filters.</li>`;
    return;
  }

  const { timelineAnchor, rows: anchoredRows } = feedRowsWithGameClock(match, filtered);
  const leadRows = feedLeadSeriesRows(match);
  const rowsWithLead = anchoredRows.map((row) => {
    const leadAtEvent = Number.isFinite(row.eventTs) && leadRows.length ? leadValueAtTimestamp(leadRows, row.eventTs) : null;
    const leadDescriptor = feedLeadDescriptor(match, leadAtEvent);
    return {
      ...row,
      leadAtEvent,
      leadDescriptor
    };
  });
  const activeEventId = ensureStoryFocus(rowsWithLead);

  elements.liveFeedList.innerHTML = rowsWithLead
    .map(
      (row) => `
      <li class="live-feed-item ${row.team === "left" ? "team-left" : row.team === "right" ? "team-right" : "team-neutral"}${
        activeEventId && row.eventId === activeEventId ? " active" : ""
      }" data-story-event-id="${encodeStoryEventId(row.eventId)}" tabindex="0" role="button" aria-label="Jump to event in trend">
        <div class="live-feed-row">
          <span class="feed-game-time">${row.gameClockSeconds === null ? "--:--" : `${timelineAnchor.estimated ? "~" : ""}${formatGameClock(row.gameClockSeconds)}`}</span>
          <div class="live-feed-main">
            <p class="live-feed-title">
              <span class="feed-bucket-tag">${feedBucketLabel(row.bucket)}</span>
              <span>${row.title}</span>
            </p>
            <p class="live-feed-meta">${dateTimeCompact(row.at)}${
              row.team
                ? ` · ${row.team === "left" ? displayTeamName(match.teams.left.name) : displayTeamName(match.teams.right.name)}`
                : ""
            } · <span class="feed-lead-tag ${row.leadDescriptor.tone}">${row.leadDescriptor.label}</span></p>
          </div>
        </div>
      </li>
    `
    )
    .join("");
}

function bindFeedControls() {
  if (uiState.controlsBound) {
    return;
  }

  if (elements.feedTypeFilter) {
    elements.feedTypeFilter.value = uiState.feedType;
    elements.feedTypeFilter.addEventListener("change", () => {
      uiState.feedType = elements.feedTypeFilter.value || "all";
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.feedTeamFilter) {
    elements.feedTeamFilter.value = uiState.feedTeam;
    elements.feedTeamFilter.addEventListener("change", () => {
      uiState.feedTeam = elements.feedTeamFilter.value || "all";
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.feedImportanceFilter) {
    elements.feedImportanceFilter.value = uiState.feedImportance;
    elements.feedImportanceFilter.addEventListener("change", () => {
      uiState.feedImportance = elements.feedImportanceFilter.value || "all";
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.feedWindowFilter) {
    elements.feedWindowFilter.value = uiState.feedWindowMinutes === null ? "all" : String(uiState.feedWindowMinutes);
    elements.feedWindowFilter.addEventListener("change", () => {
      const raw = elements.feedWindowFilter.value;
      if (raw === "all") {
        uiState.feedWindowMinutes = null;
      } else {
        const parsed = Number.parseInt(raw, 10);
        uiState.feedWindowMinutes = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      }

      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.trackerSort) {
    elements.trackerSort.value = uiState.trackerSort;
    elements.trackerSort.addEventListener("change", () => {
      uiState.trackerSort = elements.trackerSort.value || "role";
      if (uiState.match) {
        renderPlayerTracker(uiState.match);
      }
    });
  }

  if (elements.matchupH2hLimit) {
    elements.matchupH2hLimit.value = String(uiState.matchupH2hLimit);
    elements.matchupH2hLimit.addEventListener("change", () => {
      uiState.matchupH2hLimit = normalizeMatchupLimit(elements.matchupH2hLimit.value);
      elements.matchupH2hLimit.value = String(uiState.matchupH2hLimit);
      setMatchupLimitInUrl(uiState.matchupH2hLimit);
      resetMatchupState();
      if (uiState.match) {
        renderMatchupConsole(uiState.match);
        ensureMatchupData(uiState.match, uiState.apiBase);
      }
    });
  }

  const storyInteractionHandler = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const trigger = target.closest("[data-story-event-id]");
    if (!trigger) {
      return;
    }

    const encodedEventId = trigger.getAttribute("data-story-event-id");
    const eventId = decodeStoryEventId(encodedEventId);
    if (!eventId) {
      return;
    }

    const scrollFeed = Boolean(trigger.closest("#leadTrendWrap"));
    setStoryFocusEvent(eventId, { scrollFeed });
  };

  const storyKeyboardHandler = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const trigger = target.closest("[data-story-event-id]");
    if (!trigger) {
      return;
    }

    event.preventDefault();
    const encodedEventId = trigger.getAttribute("data-story-event-id");
    const eventId = decodeStoryEventId(encodedEventId);
    if (!eventId) {
      return;
    }

    const scrollFeed = Boolean(trigger.closest("#leadTrendWrap"));
    setStoryFocusEvent(eventId, { scrollFeed });
  };

  if (!uiState.storyInteractionsBound) {
    if (elements.liveFeedList) {
      elements.liveFeedList.addEventListener("click", storyInteractionHandler);
      elements.liveFeedList.addEventListener("keydown", storyKeyboardHandler);
    }
    if (elements.leadTrendWrap) {
      elements.leadTrendWrap.addEventListener("click", storyInteractionHandler);
      elements.leadTrendWrap.addEventListener("keydown", storyKeyboardHandler);
    }
    uiState.storyInteractionsBound = true;
  }

  uiState.controlsBound = true;
}

function snapshotItem(label, value, tone = "neutral") {
  return `
    <article class="snapshot-item ${tone}">
      <p class="snapshot-label">${label}</p>
      <p class="snapshot-value">${value}</p>
    </article>
  `;
}

function renderStatusSummary(match) {
  const compact = isCompactUI();
  const labelFor = (full, short) => (compact ? short : full);
  const items = [];
  const bestOf = Number(match?.bestOf || match?.seriesProgress?.bestOf || 1);
  const projectionCountdown = Number(match?.seriesProjection?.countdownSeconds);
  const selectedGameNumber = contextGameNumber();
  const fallbackCountdown = Number.isFinite(Date.parse(match.startAt))
    ? Math.max(0, Math.round((Date.parse(match.startAt) - Date.now()) / 1000))
    : null;
  const countdown = Number.isFinite(projectionCountdown) ? projectionCountdown : fallbackCountdown;
  const refreshAfter = Number(match?.refreshAfterSeconds || DEFAULT_REFRESH_SECONDS);

  items.push(snapshotItem(labelFor("Status", "State"), String(match.status || "unknown").toUpperCase(), match.status === "live" ? "good" : "neutral"));
  items.push(snapshotItem(labelFor("Format", "BO"), `BO${bestOf}`));
  items.push(snapshotItem("Patch", match.patch || "unknown"));
  items.push(snapshotItem(labelFor("Refresh", "Sync"), compact ? `${refreshAfter}s` : `Every ${refreshAfter}s`));
  if (uiState.viewMode === "series") {
    items.push(snapshotItem("View", compact ? "S" : "Series"));
  } else if (Number.isInteger(selectedGameNumber) && selectedGameNumber > 0) {
    items.push(snapshotItem(labelFor("Focused Game", "Game"), compact ? `G${selectedGameNumber}` : `Game ${selectedGameNumber}`));
  }

  if (match.status === "upcoming") {
    const startLabel = match.startAt ? (compact ? dateTimeCompact(match.startAt) : dateTimeLabel(match.startAt)) : "TBD";
    items.push(snapshotItem(labelFor("Starts", "Kickoff"), startLabel, "warn"));
    items.push(snapshotItem("Countdown", countdown !== null ? shortDuration(countdown) : "TBD", "warn"));
  } else if (match.status === "live") {
    const liveGame = (match.seriesGames || []).find((game) => game.state === "inProgress");
    const gameLabel = liveGame ? (compact ? `G${liveGame.number}` : `Game ${liveGame.number}`) : "Game in progress";
    items.push(snapshotItem(labelFor("Current Game", "Live"), gameLabel, "good"));

    if (match.momentum) {
      items.push(snapshotItem("Gold Lead", signed(match.momentum.goldLead), "good"));
      items.push(snapshotItem("Kill Diff", signed(match.momentum.killDiff)));
      items.push(snapshotItem("Tower Diff", signed(match.momentum.towerDiff)));
      items.push(snapshotItem("Lead Shift", signed(match.momentum.goldLeadDeltaWindow)));
    }
  } else if (match.status === "completed") {
    const winner = winnerTeamName(match);
    items.push(snapshotItem(labelFor("Final", "Score"), `${match.seriesScore.left} : ${match.seriesScore.right}`));
    items.push(snapshotItem("Winner", winner ? displayTeamName(winner) : "TBD", "good"));
  }

  elements.statusSummary.innerHTML = items.join("");
}

function upcomingIntel(match) {
  return match?.preMatchInsights || null;
}

function upcomingCard(label, value, note = null) {
  return `
    <article class="upcoming-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderUpcomingEssentials(match) {
  if (match.status !== "upcoming") {
    elements.upcomingEssentialsWrap.innerHTML = `<div class="empty">Upcoming essentials appear for scheduled matches.</div>`;
    return;
  }

  const compact = isCompactUI();
  const intel = upcomingIntel(match);
  const essentials = intel?.essentials || {};
  const scheduledAt = essentials.scheduledAt || match.startAt;
  const countdownSeconds = Number.isFinite(essentials.countdownSeconds)
    ? essentials.countdownSeconds
    : Number.isFinite(match?.seriesProjection?.countdownSeconds)
      ? match.seriesProjection.countdownSeconds
      : null;
  const estimatedEndAt = essentials.estimatedEndAt || match?.seriesProjection?.estimatedEndAt || null;
  const cards = [
    upcomingCard("Kickoff", scheduledAt ? (compact ? dateTimeCompact(scheduledAt) : dateTimeLabel(scheduledAt)) : "TBD"),
    upcomingCard("Countdown", countdownSeconds !== null ? shortDuration(Math.max(0, countdownSeconds)) : "TBD"),
    upcomingCard(compact ? "BO" : "Format", `BO${match.bestOf || 1}`),
    upcomingCard("Tournament", match.tournament || "Unknown"),
    upcomingCard("Patch", match.patch || "unknown")
  ];

  if (estimatedEndAt) {
    cards.push(upcomingCard(compact ? "End ETA" : "Estimated End", compact ? dateTimeCompact(estimatedEndAt) : dateTimeLabel(estimatedEndAt)));
  }

  if (!compact) {
    cards.push(upcomingCard("Region", String(match.region || "global").toUpperCase()));
  }

  elements.upcomingEssentialsWrap.innerHTML = `
    <div class="upcoming-grid">${cards.join("")}</div>
    <article class="upcoming-note">
      <p class="meta-text">${displayTeamName(match.teams.left.name)} vs ${displayTeamName(match.teams.right.name)}</p>
      <p class="meta-text">${compact ? "Map" : "Selected map"}: ${compact ? `G${match?.selectedGame?.number || 1}` : `Game ${match?.selectedGame?.number || 1}`}</p>
    </article>
  `;
}

function renderUpcomingWatchGuide(match) {
  if (match.status !== "upcoming") {
    elements.upcomingWatchWrap.innerHTML = `<div class="empty">Watch guide appears for scheduled matches.</div>`;
    return;
  }

  const intel = upcomingIntel(match);
  const options = Array.isArray(intel?.watchOptions) ? intel.watchOptions : [];
  if (!options.length) {
    elements.upcomingWatchWrap.innerHTML = `
      <div class="empty">
        Broadcast links not published yet. Check official channels closer to match start.
      </div>
    `;
    return;
  }

  elements.upcomingWatchWrap.innerHTML = options
    .map(
      (option) => `
      <article class="watch-row">
        <a class="table-link" href="${option.url}" target="_blank" rel="noreferrer">${option.label || "Watch"}</a>
        ${option.note ? `<p class="meta-text">${option.note}</p>` : ""}
      </article>
    `
    )
    .join("");
}

function formatRecentFormRow(row, apiBase) {
  if (!row) {
    return `<li class="meta-text">No recent result.</li>`;
  }

  const resultClass = row.result === "win" ? "win-left" : row.result === "loss" ? "win-right" : "even";
  const detailLink = row.id
    ? `<a class="table-link" href="${detailUrlForGame(row.id, apiBase)}">Open</a>`
    : `<span class="meta-text">-</span>`;
  return `
    <li>
      <span class="${resultClass}">${String(row.result || "unknown").toUpperCase()}</span>
      <span>${row.scoreLabel || "n/a"}</span>
      <span>${row.opponentName || "Unknown"}</span>
      <span>${dateTimeLabel(row.startAt)}</span>
      <span>${detailLink}</span>
    </li>
  `;
}

function renderTeamFormCard({ teamName, teamId, opponentId, profile, toneClass, match }) {
  const selectedGameNumber = contextGameNumber();
  const teamLink = teamId
    ? teamDetailUrl(teamId, match?.game, uiState.apiBase, {
        matchId: match?.id || null,
        gameNumber: selectedGameNumber,
        opponentId,
        teamName
      })
    : null;
  const headerText = teamLink ? `<a class="team-link" href="${teamLink}">${teamName}</a>` : teamName;

  if (!profile) {
    return `
      <article class="form-card ${toneClass}">
        <h3>${headerText}</h3>
        <p class="meta-text">No recent form data available.</p>
      </article>
    `;
  }

  const recentRows = Array.isArray(profile.recentMatches) ? profile.recentMatches.slice(0, 5) : [];
  return `
    <article class="form-card ${toneClass}">
      <h3>${headerText}</h3>
      <p class="meta-text">Series: ${profile.wins ?? 0}-${profile.losses ?? 0} · Win Rate ${Number(profile.seriesWinRatePct || 0).toFixed(1)}%</p>
      <p class="meta-text">Maps: ${profile.gameWins ?? 0}-${profile.gameLosses ?? 0} · Win Rate ${Number(profile.gameWinRatePct || 0).toFixed(1)}%</p>
      <p class="meta-text">Streak: ${profile.streakLabel || "n/a"} · Recent Form ${profile.formLabel || "n/a"}</p>
      <ul class="mini-list form-list">
        ${recentRows.length ? recentRows.map((row) => formatRecentFormRow(row, uiState.apiBase)).join("") : `<li class="meta-text">No recent matches.</li>`}
      </ul>
    </article>
  `;
}

function renderUpcomingForm(match) {
  if (match.status !== "upcoming") {
    elements.upcomingFormWrap.innerHTML = `<div class="empty">Team form appears for scheduled matches.</div>`;
    return;
  }

  const intel = upcomingIntel(match);
  const teamForm = intel?.teamForm || {};
  elements.upcomingFormWrap.innerHTML = `
    ${renderTeamFormCard({
      teamName: match.teams.left.name,
      teamId: match.teams.left.id,
      opponentId: match.teams.right.id,
      profile: teamForm.left,
      toneClass: "left",
      match
    })}
    ${renderTeamFormCard({
      teamName: match.teams.right.name,
      teamId: match.teams.right.id,
      opponentId: match.teams.left.id,
      profile: teamForm.right,
      toneClass: "right",
      match
    })}
  `;
}

function renderUpcomingHeadToHead(match) {
  if (match.status !== "upcoming") {
    elements.upcomingH2hWrap.innerHTML = `<div class="empty">Head-to-head appears for scheduled matches.</div>`;
    return;
  }

  const intel = upcomingIntel(match);
  const h2h = intel?.headToHead;
  if (!h2h || !Array.isArray(h2h.lastMeetings) || !h2h.lastMeetings.length) {
    elements.upcomingH2hWrap.innerHTML = `<div class="empty">No recent direct meetings found.</div>`;
    return;
  }

  const rows = h2h.lastMeetings
    .map(
      (row) => `
        <tr>
          <td>${dateTimeLabel(row.startAt)}</td>
          <td>${row.winnerName || "TBD"}</td>
          <td>${row.scoreLabel || "n/a"}</td>
          <td>${row.tournament || "Unknown"}</td>
        </tr>
      `
    )
    .join("");

  elements.upcomingH2hWrap.innerHTML = `
    <article class="upcoming-note">
      <p class="meta-text">Meetings: ${h2h.total || 0} · ${match.teams.left.name} wins ${h2h.leftWins || 0} · ${match.teams.right.name} wins ${h2h.rightWins || 0}</p>
    </article>
    <div class="lane-table-wrap">
      <table class="lane-table upcoming-h2h-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Winner</th>
            <th>Score</th>
            <th>Tournament</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderUpcomingPrediction(match) {
  if (match.status !== "upcoming") {
    elements.upcomingPredictionWrap.innerHTML = `<div class="empty">Prediction model appears for scheduled matches.</div>`;
    return;
  }

  const intel = upcomingIntel(match);
  const prediction = intel?.prediction;
  if (!prediction) {
    elements.upcomingPredictionWrap.innerHTML = `<div class="empty">Prediction model needs more recent data.</div>`;
    return;
  }

  const leftPct = Math.max(0, Math.min(100, Number(prediction.leftWinPct || 0)));
  const rightPct = Math.max(0, Math.min(100, Number(prediction.rightWinPct || 0)));
  const drivers = Array.isArray(prediction.drivers) ? prediction.drivers : [];

  elements.upcomingPredictionWrap.innerHTML = `
    <article class="prediction-card">
      <div class="edge-head">
        <p class="meta-text">${match.teams.left.name}</p>
        <p class="meta-text">${match.teams.right.name}</p>
      </div>
      <div class="edge-bars">
        <div class="edge-side left" style="width:${leftPct}%"></div>
        <div class="edge-side right" style="width:${rightPct}%"></div>
      </div>
      <div class="edge-head">
        <p class="edge-score">${leftPct.toFixed(1)}%</p>
        <p class="edge-score">${rightPct.toFixed(1)}%</p>
      </div>
      <p class="meta-text">Favorite: ${prediction.favoriteTeamName || "Even"} · Confidence ${String(prediction.confidence || "low").toUpperCase()}</p>
      <p class="meta-text">Model: ${prediction.modelVersion || "heuristic-v1"} (form + map-rate + H2H + streak)</p>
      ${drivers.length ? `<ul class="confidence-notes">${drivers.map((driver) => `<li>${driver}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function renderDataConfidence(match) {
  const confidence = match.dataConfidence;
  if (!confidence) {
    elements.dataConfidenceWrap.innerHTML = `<div class="empty">Confidence metrics unavailable.</div>`;
    return;
  }

  const notes = Array.isArray(confidence.notes) ? confidence.notes : [];

  elements.dataConfidenceWrap.innerHTML = `
    <article class="confidence-card ${confidence.grade || "medium"}">
      <p class="confidence-title">Coverage ${String(confidence.grade || "medium").toUpperCase()}</p>
      <p class="confidence-score">Score ${formatNumber(confidence.score)} / 100</p>
      <p class="meta-text">Telemetry: ${confidence.telemetry || "unknown"}</p>
      ${notes.length ? `<ul class="confidence-notes">${notes.map((note) => `<li>${note}</li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function renderPulseCard(match) {
  const pulse = match.pulseCard;
  if (!pulse) {
    elements.pulseCard.innerHTML = `<div class="empty">No pulse signal available.</div>`;
    return;
  }

  elements.pulseCard.innerHTML = `
    <article class="pulse ${pulse.tone || "neutral"}">
      <p class="pulse-title">${pulse.title || "Match Pulse"}</p>
      <p class="pulse-body">${pulse.summary || "Signal unavailable."}</p>
    </article>
  `;
}

function renderEdgeMeter(match) {
  const edge = match.edgeMeter;
  if (!edge?.left || !edge?.right) {
    elements.edgeMeterWrap.innerHTML = `<div class="empty">Edge signal unavailable.</div>`;
    return;
  }

  const leftScore = Math.max(0, Math.min(100, Number(edge.left.score || 0)));
  const rightScore = Math.max(0, Math.min(100, Number(edge.right.score || 0)));
  const total = Math.max(1, leftScore + rightScore);
  const leftWidth = (leftScore / total) * 100;
  const rightWidth = (rightScore / total) * 100;
  const leftDrivers = Array.isArray(edge.left.drivers) ? edge.left.drivers : [];
  const rightDrivers = Array.isArray(edge.right.drivers) ? edge.right.drivers : [];

  elements.edgeMeterWrap.innerHTML = `
    <article class="edge-card">
      <div class="edge-head">
        <p class="meta-text">${edge.left.team}</p>
        <p class="meta-text">${edge.right.team}</p>
      </div>
      <div class="edge-bars">
        <div class="edge-side left" style="width:${leftWidth}%"></div>
        <div class="edge-side right" style="width:${rightWidth}%"></div>
      </div>
      <div class="edge-head">
        <p class="edge-score">${leftScore}</p>
        <p class="edge-score">${rightScore}</p>
      </div>
      <p class="meta-text">${edge.verdict || "Pressure balance is even."}</p>
      <div class="edge-drivers">
        <p class="meta-text">${leftDrivers.length ? `${edge.left.team}: ${leftDrivers.join(" · ")}` : `${edge.left.team}: no clear edge driver`}</p>
        <p class="meta-text">${rightDrivers.length ? `${edge.right.team}: ${rightDrivers.join(" · ")}` : `${edge.right.team}: no clear edge driver`}</p>
      </div>
    </article>
  `;
}

function tempoCard(label, value, subtext) {
  return `
    <article class="tempo-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${subtext ? `<p class="meta-text">${subtext}</p>` : ""}
    </article>
  `;
}

function renderTempoSnapshot(match) {
  const tempo = match.tempoSnapshot;
  if (!tempo) {
    elements.tempoSnapshotWrap.innerHTML = `<div class="empty">Tempo profile unavailable.</div>`;
    return;
  }

  const cards = [];
  cards.push(tempoCard("Completed Games", String(tempo.completedGames ?? 0), "Series pace baseline"));
  cards.push(
    tempoCard(
      "Avg Game Length",
      Number.isFinite(tempo.averageDurationMinutes) ? `${tempo.averageDurationMinutes.toFixed(1)}m` : "n/a",
      Number.isFinite(tempo.shortestDurationMinutes) && Number.isFinite(tempo.longestDurationMinutes)
        ? `Low ${tempo.shortestDurationMinutes.toFixed(1)}m · High ${tempo.longestDurationMinutes.toFixed(1)}m`
        : "Waiting for completed VOD duration data"
    )
  );
  cards.push(
    tempoCard(
      "Current Game",
      Number.isFinite(tempo.currentGameMinutes) ? `${tempo.currentGameMinutes.toFixed(1)}m` : "n/a",
      "Live elapsed from frame window"
    )
  );
  cards.push(
    tempoCard(
      "Objective Pace",
      Number.isFinite(tempo.objectivePer10Minutes) ? `${tempo.objectivePer10Minutes.toFixed(2)} / 10m` : "n/a",
      `${tempo.objectiveEvents || 0} tracked objective events`
    )
  );

  elements.tempoSnapshotWrap.innerHTML = cards.join("");
}

function checklistClass(tone) {
  if (tone === "good") return "good";
  if (tone === "warn") return "warn";
  return "neutral";
}

function renderTacticalChecklist(match) {
  const rows = Array.isArray(match.tacticalChecklist) ? match.tacticalChecklist : [];
  if (!rows.length) {
    elements.tacticalChecklistWrap.innerHTML = `<div class="empty">No tactical notes generated for this state.</div>`;
    return;
  }

  elements.tacticalChecklistWrap.innerHTML = rows
    .map(
      (row) => `
      <article class="check-item ${checklistClass(row.tone)}">
        <p class="check-title">${row.title || "Signal"}</p>
        <p class="meta-text">${row.detail || "No details provided."}</p>
      </article>
    `
    )
    .join("");
}

function renderStorylines(match) {
  const rows = Array.isArray(match.storylines) ? match.storylines : [];
  if (!rows.length) {
    elements.storylinesList.innerHTML = "<li>No storyline signals yet.</li>";
    return;
  }

  elements.storylinesList.innerHTML = rows.map((row) => `<li>${row}</li>`).join("");
}

function renderSeriesProgress(match) {
  const progress = match.seriesProgress;
  if (!progress) {
    elements.seriesProgressWrap.innerHTML = `<div class="empty">No series progress available.</div>`;
    return;
  }

  const leftPct = Math.min(100, (progress.leftWins / Math.max(1, progress.winsNeeded)) * 100);
  const rightPct = Math.min(100, (progress.rightWins / Math.max(1, progress.winsNeeded)) * 100);

  elements.seriesProgressWrap.innerHTML = `
    <article class="progress-card">
      <p class="meta-text">First to ${progress.winsNeeded} wins</p>
      <p class="progress-score">${match.teams.left.name} ${progress.leftWins} - ${progress.rightWins} ${match.teams.right.name}</p>
      <div class="progress-split">
        <div class="bar left" style="width:${leftPct}%"></div>
        <div class="bar right" style="width:${rightPct}%"></div>
      </div>
      <p class="meta-text">Completed ${progress.completedGames} · Live ${progress.inProgressGames} · Skipped ${progress.skippedGames}</p>
      <p class="meta-text">${match.teams.left.name} needs ${progress.leftToWin} · ${match.teams.right.name} needs ${progress.rightToWin}</p>
    </article>
  `;
}

function sparklinePoints(values) {
  if (!values.length) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = ((max - value) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function compactGold(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }

  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }

  if (abs >= 1000) {
    return `${(num / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }

  return String(Math.round(num));
}

function shortTimeLabel(iso) {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return "n/a";
    }

    return parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "n/a";
  }
}

function mapPulseContextKey(match) {
  const matchId = String(match?.id || "match");
  const selectedNumber = Number(match?.selectedGame?.number || 0);
  return `${matchId}::${selectedNumber > 0 ? selectedNumber : "series"}`;
}

function resolveBurstSignalTeam(match) {
  const bursts = Array.isArray(match?.combatBursts) ? match.combatBursts : [];
  for (const row of bursts) {
    const team = String(row?.team || "").toLowerCase();
    if (team === "left" || team === "right") {
      return team;
    }
  }

  const leftName = String(match?.teams?.left?.name || "").toLowerCase();
  const rightName = String(match?.teams?.right?.name || "").toLowerCase();
  for (const row of bursts) {
    const title = String(row?.title || "").toLowerCase();
    if (leftName && title.includes(leftName)) {
      return "left";
    }
    if (rightName && title.includes(rightName)) {
      return "right";
    }
  }

  return null;
}

function updateMapPulseState(match) {
  const selected = match?.selectedGame;
  if (!selected) {
    return null;
  }

  const key = mapPulseContextKey(match);
  const previous = uiState.mapPulseByContext[key] || {};
  const now = Date.now();
  const state = {
    leftKills: Number(selected?.snapshot?.left?.kills),
    rightKills: Number(selected?.snapshot?.right?.kills),
    expiresAt: Number(previous.expiresAt || 0),
    team: previous.team || null
  };

  if (String(selected.state || "") === "inProgress") {
    const leftValid = Number.isFinite(state.leftKills);
    const rightValid = Number.isFinite(state.rightKills);
    const prevLeftValid = Number.isFinite(previous.leftKills);
    const prevRightValid = Number.isFinite(previous.rightKills);
    if (leftValid && rightValid && prevLeftValid && prevRightValid) {
      const deltaLeft = state.leftKills - Number(previous.leftKills);
      const deltaRight = state.rightKills - Number(previous.rightKills);
      if (deltaLeft > 0 || deltaRight > 0) {
        state.team = deltaLeft > deltaRight ? "left" : deltaRight > deltaLeft ? "right" : "both";
        state.expiresAt = now + 60_000;
      }
    }

    if (state.expiresAt <= now) {
      const leftDeaths = Array.isArray(match?.playerEconomy?.left)
        ? match.playerEconomy.left.filter((row) => Boolean(row?.isDead)).length
        : 0;
      const rightDeaths = Array.isArray(match?.playerEconomy?.right)
        ? match.playerEconomy.right.filter((row) => Boolean(row?.isDead)).length
        : 0;
      if (leftDeaths + rightDeaths >= 2) {
        state.team = leftDeaths > rightDeaths ? "left" : rightDeaths > leftDeaths ? "right" : "both";
        state.expiresAt = now + 40_000;
      } else {
        const burstTeam = resolveBurstSignalTeam(match);
        if (burstTeam) {
          state.team = burstTeam;
          state.expiresAt = now + 30_000;
        }
      }
    }
  } else {
    state.expiresAt = 0;
    state.team = null;
  }

  uiState.mapPulseByContext[key] = state;
  if (state.expiresAt > now && state.team) {
    return {
      team: state.team,
      expiresAt: state.expiresAt
    };
  }

  return null;
}

function objectiveEtaLabel(row) {
  if (!row) {
    return "n/a";
  }

  const eta = Number(row?.etaSeconds);
  if (row?.state === "available" || (Number.isFinite(eta) && eta <= 0)) {
    return "Up";
  }
  if (Number.isFinite(eta) && eta > 0) {
    return shortDuration(eta);
  }
  return "Soon";
}

function objectiveMarkerRows(match) {
  const forecastRows = Array.isArray(match?.objectiveForecast) ? match.objectiveForecast : [];
  const forecastByType = new Map();
  for (const row of forecastRows) {
    const type = String(row?.type || row?.id || "").toLowerCase();
    if (type && !forecastByType.has(type)) {
      forecastByType.set(type, row);
    }
  }

  const timelineRows = Array.isArray(match?.objectiveTimeline) ? match.objectiveTimeline : [];
  const ownershipByType = new Map();
  for (const row of timelineRows) {
    const type = String(row?.type || row?.objective || "").toLowerCase();
    const team = String(row?.team || "").toLowerCase();
    if (!type || (team !== "left" && team !== "right")) {
      continue;
    }
    if (!ownershipByType.has(type)) {
      ownershipByType.set(type, team);
    }
  }

  const catalog = [
    { id: "baron", name: "Baron", short: "B", x: 28, y: 24 },
    { id: "dragon", name: "Dragon", short: "D", x: 73, y: 75 },
    { id: "herald", name: "Herald", short: "H", x: 24, y: 32 }
  ];

  return catalog.map((item) => {
    const forecast = forecastByType.get(item.id) || null;
    const ownerTeam = ownershipByType.get(item.id) || null;
    const state = forecast?.state === "available" ? "available" : forecast ? "countdown" : ownerTeam ? "captured" : "unknown";
    return {
      ...item,
      state,
      ownerTeam,
      etaLabel: objectiveEtaLabel(forecast),
      note: String(forecast?.note || "")
    };
  });
}

function readNumericField(row, keys) {
  for (const key of keys) {
    const direct = Number(row?.[key]);
    if (Number.isFinite(direct)) {
      return direct;
    }
  }

  const nestedX = Number(row?.position?.x);
  const nestedY = Number(row?.position?.y);
  if (keys.includes("x") && Number.isFinite(nestedX)) {
    return nestedX;
  }
  if (keys.includes("y") && Number.isFinite(nestedY)) {
    return nestedY;
  }

  return null;
}

function normalizeMapAxis(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  if (num >= 0 && num <= 1) {
    return num * 100;
  }
  if (num >= 0 && num <= 100) {
    return num;
  }
  if (num >= -9000 && num <= 9000) {
    return ((num + 9000) / 18000) * 100;
  }
  if (num >= 0 && num <= 20000) {
    return (num / 15000) * 100;
  }

  return null;
}

function clampMapAxis(value) {
  return Math.max(3, Math.min(97, Number(value)));
}

function mirrorMapPoint(point) {
  return {
    x: 100 - Number(point.x),
    y: 100 - Number(point.y)
  };
}

function boundedCount(value, max) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Math.min(max, Math.round(count)));
}

function readMetricCount(source, keys) {
  for (const key of keys) {
    const count = Number(source?.[key]);
    if (Number.isFinite(count)) {
      return Math.max(0, Math.round(count));
    }
  }
  return null;
}

function sideObjectiveCount(match, side, keys) {
  const snapshot = match?.selectedGame?.snapshot?.[side];
  const team = match?.teams?.[side];
  const fromSnapshot = readMetricCount(snapshot, keys);
  if (fromSnapshot !== null) {
    return fromSnapshot;
  }
  const fromTeam = readMetricCount(team, keys);
  if (fromTeam !== null) {
    return fromTeam;
  }
  return 0;
}

function resolveMapPoint(row) {
  const rawX = readNumericField(row, ["x", "positionX", "posX", "worldX", "locationX", "mapX"]);
  const rawY = readNumericField(row, ["y", "positionY", "posY", "worldY", "locationY", "mapY"]);
  const normalizedX = normalizeMapAxis(rawX);
  const normalizedY = normalizeMapAxis(rawY);
  if (normalizedX === null || normalizedY === null) {
    return null;
  }

  return {
    x: clampMapAxis(normalizedX),
    y: clampMapAxis(normalizedY)
  };
}

function buildLolStructureMarkers(match) {
  const leftSecuredTowers = sideObjectiveCount(match, "left", ["towers", "turrets", "towerKills"]);
  const rightSecuredTowers = sideObjectiveCount(match, "right", ["towers", "turrets", "towerKills"]);
  const leftSecuredInhibitors = sideObjectiveCount(match, "left", ["inhibitors", "inhibitorKills"]);
  const rightSecuredInhibitors = sideObjectiveCount(match, "right", ["inhibitors", "inhibitorKills"]);

  const leftAliveTowers = boundedCount(LOL_TOWER_TOTAL - rightSecuredTowers, LOL_TOWER_TOTAL);
  const rightAliveTowers = boundedCount(LOL_TOWER_TOTAL - leftSecuredTowers, LOL_TOWER_TOTAL);
  const leftAliveInhibitors = boundedCount(LOL_INHIBITOR_TOTAL - rightSecuredInhibitors, LOL_INHIBITOR_TOTAL);
  const rightAliveInhibitors = boundedCount(LOL_INHIBITOR_TOTAL - leftSecuredInhibitors, LOL_INHIBITOR_TOTAL);

  const markers = [];
  LOL_LEFT_TOWER_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `lol_tower_left_${point.id}`,
      team: "left",
      type: "tower",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.lol.tower,
      alive: index < leftAliveTowers
    });
  });

  LOL_LEFT_TOWER_LAYOUT.forEach((point, index) => {
    const mirrored = mirrorMapPoint(point);
    markers.push({
      key: `lol_tower_right_${point.id}`,
      team: "right",
      type: "tower",
      x: mirrored.x,
      y: mirrored.y,
      icon: MINIMAP_ASSETS.lol.tower,
      alive: index < rightAliveTowers
    });
  });

  LOL_LEFT_INHIBITOR_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `lol_inhib_left_${point.id}`,
      team: "left",
      type: "inhibitor",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.lol.inhibitor,
      alive: index < leftAliveInhibitors
    });
  });

  LOL_LEFT_INHIBITOR_LAYOUT.forEach((point, index) => {
    const mirrored = mirrorMapPoint(point);
    markers.push({
      key: `lol_inhib_right_${point.id}`,
      team: "right",
      type: "inhibitor",
      x: mirrored.x,
      y: mirrored.y,
      icon: MINIMAP_ASSETS.lol.inhibitor,
      alive: index < rightAliveInhibitors
    });
  });

  const leftCoreAlive = rightSecuredTowers < LOL_TOWER_TOTAL;
  const rightCoreAlive = leftSecuredTowers < LOL_TOWER_TOTAL;
  markers.push({
    key: "lol_core_left",
    team: "left",
    type: "core",
    x: 11.6,
    y: 89.6,
    icon: MINIMAP_ASSETS.lol.core,
    alive: leftCoreAlive
  });
  markers.push({
    key: "lol_core_right",
    team: "right",
    type: "core",
    x: 88.4,
    y: 10.4,
    icon: MINIMAP_ASSETS.lol.core,
    alive: rightCoreAlive
  });

  return {
    background: MINIMAP_ASSETS.lol.background,
    markers,
    summary: {
      towerTotal: LOL_TOWER_TOTAL,
      inhibitorTotal: LOL_INHIBITOR_TOTAL,
      inhibitorLabel: "Inhib",
      leftTowers: leftAliveTowers,
      rightTowers: rightAliveTowers,
      leftInhibitors: leftAliveInhibitors,
      rightInhibitors: rightAliveInhibitors
    }
  };
}

function buildDotaStructureMarkers(match) {
  const leftSecuredTowers = sideObjectiveCount(match, "left", ["towers", "turrets", "towerKills"]);
  const rightSecuredTowers = sideObjectiveCount(match, "right", ["towers", "turrets", "towerKills"]);
  const leftSecuredInhibitors = sideObjectiveCount(match, "left", ["barracks", "rax", "racks", "inhibitors"]);
  const rightSecuredInhibitors = sideObjectiveCount(match, "right", ["barracks", "rax", "racks", "inhibitors"]);

  const leftAliveTowers = boundedCount(DOTA_TOWER_TOTAL - rightSecuredTowers, DOTA_TOWER_TOTAL);
  const rightAliveTowers = boundedCount(DOTA_TOWER_TOTAL - leftSecuredTowers, DOTA_TOWER_TOTAL);
  const leftAliveInhibitors = boundedCount(DOTA_INHIBITOR_TOTAL - rightSecuredInhibitors, DOTA_INHIBITOR_TOTAL);
  const rightAliveInhibitors = boundedCount(DOTA_INHIBITOR_TOTAL - leftSecuredInhibitors, DOTA_INHIBITOR_TOTAL);

  const markers = [];
  DOTA_LEFT_TOWER_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `dota_tower_left_${point.id}`,
      team: "left",
      type: "tower",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.dota2.towerLeft,
      alive: index < leftAliveTowers
    });
  });
  DOTA_RIGHT_TOWER_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `dota_tower_right_${point.id}`,
      team: "right",
      type: "tower",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.dota2.towerRight,
      alive: index < rightAliveTowers
    });
  });

  DOTA_LEFT_INHIBITOR_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `dota_rax_left_${point.id}`,
      team: "left",
      type: "inhibitor",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.dota2.inhibitorLeft,
      alive: index < leftAliveInhibitors
    });
  });
  DOTA_RIGHT_INHIBITOR_LAYOUT.forEach((point, index) => {
    markers.push({
      key: `dota_rax_right_${point.id}`,
      team: "right",
      type: "inhibitor",
      x: point.x,
      y: point.y,
      icon: MINIMAP_ASSETS.dota2.inhibitorRight,
      alive: index < rightAliveInhibitors
    });
  });

  const leftCoreAlive = rightSecuredTowers < DOTA_TOWER_TOTAL;
  const rightCoreAlive = leftSecuredTowers < DOTA_TOWER_TOTAL;
  markers.push({
    key: "dota_core_left",
    team: "left",
    type: "core",
    x: DOTA_CORE_LAYOUT.left.x,
    y: DOTA_CORE_LAYOUT.left.y,
    icon: MINIMAP_ASSETS.dota2.coreLeft,
    alive: leftCoreAlive
  });
  markers.push({
    key: "dota_core_right",
    team: "right",
    type: "core",
    x: DOTA_CORE_LAYOUT.right.x,
    y: DOTA_CORE_LAYOUT.right.y,
    icon: MINIMAP_ASSETS.dota2.coreRight,
    alive: rightCoreAlive
  });

  return {
    background: MINIMAP_ASSETS.dota2.background,
    markers,
    summary: {
      towerTotal: DOTA_TOWER_TOTAL,
      inhibitorTotal: DOTA_INHIBITOR_TOTAL,
      inhibitorLabel: "Rax",
      leftTowers: leftAliveTowers,
      rightTowers: rightAliveTowers,
      leftInhibitors: leftAliveInhibitors,
      rightInhibitors: rightAliveInhibitors
    }
  };
}

function buildStructureLayer(match) {
  const gameKey = normalizeGameKey(match?.game);
  if (gameKey === "dota2") {
    return buildDotaStructureMarkers(match);
  }

  return buildLolStructureMarkers(match);
}

function buildMiniMap(match) {
  const economy = match?.playerEconomy || null;
  const leftRows = Array.isArray(economy?.left) ? economy.left : [];
  const rightRows = Array.isArray(economy?.right) ? economy.right : [];
  const rows = [
    ...leftRows.map((row) => ({ ...row, _teamSide: "left" })),
    ...rightRows.map((row) => ({ ...row, _teamSide: "right" }))
  ];

  const resolved = rows.map((row) => ({
    row,
    team: row._teamSide,
    point: resolveMapPoint(row)
  }));
  const exactRows = resolved.filter((entry) => entry.point !== null);
  const exactForAllPlayers = rows.length > 0 && exactRows.length === rows.length;

  const points = exactForAllPlayers
    ? exactRows.map((entry) => ({
        x: entry.point.x,
        y: entry.point.y,
        team: entry.team,
        dead: Boolean(entry.row?.isDead),
        row: entry.row
      }))
    : [];

  return {
    mode: exactForAllPlayers ? "exact" : rows.length ? "no_exact" : "none",
    totalPlayers: rows.length,
    exactPlayers: exactRows.length,
    points,
    gameKey: normalizeGameKey(match?.game),
    structures: buildStructureLayer(match)
  };
}

function renderMiniMap(match, options = {}) {
  const miniMap = buildMiniMap(match);
  const structures = miniMap.structures;
  const focusedEvent = options?.focusedEvent || null;
  const timelineAnchor = options?.timelineAnchor || { estimated: true };
  const dynamicPulse = updateMapPulseState(match);
  const focusedTeam = focusedEvent?.team === "left" || focusedEvent?.team === "right" ? focusedEvent.team : null;
  const pulse = focusedTeam ? { team: focusedTeam, expiresAt: Date.now() + 20_000 } : dynamicPulse;
  const now = Date.now();
  const pulseSecondsLeft = pulse ? Math.max(1, Math.ceil((pulse.expiresAt - now) / 1000)) : 0;
  const objectiveMarkers = objectiveMarkerRows(match);
  const leftName = displayTeamName(match?.teams?.left?.name);
  const rightName = displayTeamName(match?.teams?.right?.name);
  const structureNodes = structures.markers
    .map(
      (marker) => `
      <span class="minimap-structure ${marker.team} ${marker.type} ${marker.alive ? "alive" : "destroyed"}" style="left:${marker.x.toFixed(2)}%;top:${marker.y.toFixed(2)}%;">
        <img src="${marker.icon}" alt="" loading="lazy" decoding="async" />
      </span>
    `
    )
    .join("");
  const playerNodes = miniMap.points
    .map((point) => {
      const heroName = trackerHeroName(point.row);
      const heroIconUrl = heroIconUrlForRow(match, point.row);
      return `
      <span class="minimap-player ${point.team}${point.dead ? " dead" : ""}${pulse && (pulse.team === "both" || pulse.team === point.team) ? " pulse" : ""}" style="left:${point.x.toFixed(2)}%;top:${point.y.toFixed(2)}%;">
        ${
          heroIconUrl
            ? `<img src="${heroIconUrl}" alt="${heroName}" loading="lazy" decoding="async" />`
            : `<span class="minimap-player-fallback">${trackerAvatarFallback(heroName)}</span>`
        }
      </span>
    `;
    })
    .join("");
  const modeText =
    miniMap.mode === "exact"
      ? "Exact player coordinates are live."
      : miniMap.mode === "no_exact"
        ? "Player icons hidden until exact coordinates are available."
        : "No player telemetry for this game yet.";
  const pulseText = pulse
    ? `Fight pulse: ${pulse.team === "both" ? "both teams" : pulse.team === "left" ? leftName : rightName} · ${pulseSecondsLeft}s`
    : "No active fight pulse";
  const focusedClock = focusedEvent?.gameClockSeconds === null || focusedEvent?.gameClockSeconds === undefined
    ? "--:--"
    : `${timelineAnchor.estimated ? "~" : ""}${formatGameClock(focusedEvent.gameClockSeconds)}`;
  const focusedTeamLabel = focusedEvent?.team
    ? focusedEvent.team === "left"
      ? leftName
      : focusedEvent.team === "right"
        ? rightName
        : "Neutral"
    : "Neutral";
  const focusedNote = focusedEvent
    ? `${focusedClock} · ${feedBucketLabel(focusedEvent.bucket)} · ${focusedTeamLabel}`
    : null;
  const summary = structures.summary;
  const structureSummary = `${leftName} T ${summary.leftTowers}/${summary.towerTotal} · ${rightName} T ${summary.rightTowers}/${summary.towerTotal} · ${leftName} ${summary.inhibitorLabel} ${summary.leftInhibitors}/${summary.inhibitorTotal} · ${rightName} ${summary.inhibitorLabel} ${summary.rightInhibitors}/${summary.inhibitorTotal}`;
  const objectiveChips =
    miniMap.gameKey === "lol"
      ? `
      <div class="minimap-objectives">
        ${objectiveMarkers
          .map(
            (marker) => `
          <span class="objective-chip ${marker.state}${marker.ownerTeam ? ` owned-${marker.ownerTeam}` : ""}">
            <span class="objective-chip-key">${marker.short}</span>
            <span class="objective-chip-meta">${marker.etaLabel}</span>
          </span>
        `
          )
          .join("")}
      </div>
    `
      : "";

  return `
    <section class="minimap-card${pulse ? ` fight-${pulse.team}` : ""}">
      <p class="minimap-title">Map View</p>
      <div class="minimap-stage ${miniMap.gameKey}">
        <img src="${structures.background}" class="minimap-image" alt="${miniMap.gameKey === "dota2" ? "Dota 2 minimap" : "League of Legends minimap"}" loading="lazy" decoding="async" />
        <div class="minimap-overlay minimap-structures-layer">${structureNodes}</div>
        <div class="minimap-overlay minimap-players-layer">${playerNodes}</div>
      </div>
      <div class="minimap-legend">
        <span class="minimap-chip left">${leftName}</span>
        <span class="minimap-chip right">${rightName}</span>
      </div>
      ${objectiveChips}
      <p class="minimap-note">${structureSummary}</p>
      <p class="minimap-note">${modeText} · ${pulseText}</p>
      ${focusedNote ? `<p class="minimap-note minimap-focus-note">Focused event: ${focusedNote}</p>` : ""}
    </section>
  `;
}

function trendLeadCallout(match, lead) {
  if (!Number.isFinite(lead) || lead === 0) {
    return {
      tone: "even",
      headline: "Gold is even",
      detail: `${match.teams.left.name} and ${match.teams.right.name} are tied on gold right now.`
    };
  }

  const leftLeading = lead > 0;
  const teamName = leftLeading ? match.teams.left.name : match.teams.right.name;
  const amount = formatNumber(Math.abs(Math.round(lead)));
  return {
    tone: leftLeading ? "left" : "right",
    headline: `${teamName} lead by ${amount} gold`,
    detail: leftLeading
      ? `Above zero line means ${match.teams.left.name} are ahead.`
      : `Below zero line means ${match.teams.right.name} are ahead.`
  };
}

function buildLeadTrendChart(series, options = {}) {
  const rows = series
    .map((row) => ({
      at: Date.parse(String(row?.at || "")),
      lead: Number(row?.lead || 0)
    }))
    .filter((row) => Number.isFinite(row.at) && Number.isFinite(row.lead))
    .sort((left, right) => left.at - right.at);

  if (!rows.length) {
    return null;
  }

  const roundLeadScale = (value) => {
    const safe = Math.max(1000, Number(value) || 0);
    if (safe <= 6000) {
      return Math.ceil(safe / 1000) * 1000;
    }
    if (safe <= 20000) {
      return Math.ceil(safe / 2500) * 2500;
    }
    return Math.ceil(safe / 5000) * 5000;
  };

  const chart = {
    left: 4,
    right: 96,
    top: 8,
    bottom: 86
  };
  const lockedAbsLead = Number(options.lockedAbsLead || 0);
  const rawMinLead = Math.min(0, ...rows.map((row) => row.lead));
  const rawMaxLead = Math.max(0, ...rows.map((row) => row.lead));
  const peakAbsLead = Math.max(Math.abs(rawMinLead), Math.abs(rawMaxLead));
  const computedAbsLead = roundLeadScale(Math.max(LEAD_TREND_MIN_ABS_GOLD, peakAbsLead * LEAD_TREND_SCALE_HEADROOM));
  const lockCeilingAbsLead = roundLeadScale(Math.max(LEAD_TREND_MIN_ABS_GOLD, peakAbsLead * (LEAD_TREND_SCALE_HEADROOM + 0.25)));
  const displayAbsLead = Math.max(computedAbsLead, Math.min(lockedAbsLead, lockCeilingAbsLead));
  const minLead = -displayAbsLead;
  const maxLead = displayAbsLead;
  const leadRange = Math.max(1, maxLead - minLead);
  const minAt = rows[0].at;
  const maxAt = rows[rows.length - 1].at;
  const timeRange = Math.max(1, maxAt - minAt);
  const mapX = (at) => chart.left + ((at - minAt) / timeRange) * (chart.right - chart.left);
  const mapY = (lead) => chart.top + ((maxLead - lead) / leadRange) * (chart.bottom - chart.top);
  const clampY = (value) => Math.max(chart.top, Math.min(chart.bottom, value));
  const zeroY = clampY(mapY(0));
  const points = rows.map((row) => ({
    x: mapX(row.at),
    y: mapY(row.lead),
    lead: row.lead,
    at: row.at
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = points.length
    ? `M${points[0].x.toFixed(2)},${zeroY.toFixed(2)} ` +
      points.map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ") +
      ` L${points[points.length - 1].x.toFixed(2)},${zeroY.toFixed(2)} Z`
    : "";

  const gridValuesRaw = [maxLead, maxLead * 0.5, 0, minLead * 0.5, minLead];
  const seen = new Set();
  const gridRows = gridValuesRaw
    .map((value) => Number(value.toFixed(2)))
    .filter((value) => {
      const key = String(value);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((value) => ({
      value,
      y: clampY(mapY(value))
    }));

  return {
    rows,
    points,
    linePath,
    areaPath,
    zeroY,
    minAt,
    maxAt,
    rawMinLead,
    rawMaxLead,
    minLead,
    maxLead,
    leadRange,
    timeRange,
    displayAbsLead,
    gridRows,
    chartBounds: chart
  };
}

function leadValueAtTimestamp(rows, timestamp) {
  if (!Array.isArray(rows) || !rows.length || !Number.isFinite(timestamp)) {
    return 0;
  }

  if (timestamp <= rows[0].at) {
    return Number(rows[0].lead || 0);
  }
  if (timestamp >= rows[rows.length - 1].at) {
    return Number(rows[rows.length - 1].lead || 0);
  }

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const next = rows[index];
    if (timestamp > next.at) {
      continue;
    }

    const segment = Math.max(1, next.at - previous.at);
    const ratio = Math.max(0, Math.min(1, (timestamp - previous.at) / segment));
    return previous.lead + (next.lead - previous.lead) * ratio;
  }

  return Number(rows[rows.length - 1].lead || 0);
}

function chartXForTimestamp(chart, timestamp) {
  const { chartBounds } = chart;
  const clamped = Math.max(chart.minAt, Math.min(chart.maxAt, timestamp));
  const ratio = chart.timeRange > 0 ? (clamped - chart.minAt) / chart.timeRange : 0;
  return chartBounds.left + ratio * (chartBounds.right - chartBounds.left);
}

function chartYForLead(chart, lead) {
  const { chartBounds } = chart;
  const ratio = chart.leadRange > 0 ? (chart.maxLead - lead) / chart.leadRange : 0.5;
  return Math.max(chartBounds.top, Math.min(chartBounds.bottom, chartBounds.top + ratio * (chartBounds.bottom - chartBounds.top)));
}

function buildTrendStory(match, chart) {
  const feedRows = buildUnifiedFeed(match);
  if (!feedRows.length) {
    return {
      timelineAnchor: { startTs: null, estimated: true },
      markers: [],
      latestRows: [],
      activeRow: null
    };
  }

  const { timelineAnchor, rows } = feedRowsWithGameClock(match, feedRows);
  const chronologicalRows = rows
    .filter((row) => Number.isFinite(row.eventTs))
    .sort((left, right) => left.eventTs - right.eventTs);
  if (!chronologicalRows.length) {
    return {
      timelineAnchor,
      markers: [],
      latestRows: [],
      activeRow: null
    };
  }

  const latestFirst = [...chronologicalRows].sort((left, right) => right.eventTs - left.eventTs);
  const activeId = ensureStoryFocus(latestFirst);
  const activeRow = latestFirst.find((row) => row.eventId === activeId) || latestFirst[0];
  const markerRows = chronologicalRows.slice(Math.max(0, chronologicalRows.length - 14));
  const markers = markerRows.map((row) => {
    const interpolatedLead = leadValueAtTimestamp(chart.rows, row.eventTs);
    return {
      ...row,
      chartX: chartXForTimestamp(chart, row.eventTs),
      chartY: chartYForLead(chart, interpolatedLead)
    };
  });

  return {
    timelineAnchor,
    markers,
    latestRows: latestFirst.slice(0, 8),
    activeRow
  };
}

function renderLeadTrend(match) {
  const leftTeamLabel = displayTeamName(match.teams.left.name);
  const rightTeamLabel = displayTeamName(match.teams.right.name);
  const series = Array.isArray(match.goldLeadSeries) ? match.goldLeadSeries : [];
  const trend = match.leadTrend;
  if (!series.length || !trend) {
    elements.leadTrendWrap.innerHTML = `<div class="empty">Lead trend appears once enough frames are tracked.</div>`;
    return;
  }

  const selectedGameNumber = contextGameNumber();
  const trendScaleKey = `${String(match?.id || "match")}::${Number.isInteger(selectedGameNumber) ? selectedGameNumber : "series"}`;
  const previousAbsScale = Number(uiState.leadTrendScaleByContext[trendScaleKey] || 0);
  const chart = buildLeadTrendChart(series, { lockedAbsLead: previousAbsScale });
  if (!chart) {
    elements.leadTrendWrap.innerHTML = `<div class="empty">Lead trend appears once enough frames are tracked.</div>`;
    return;
  }
  uiState.leadTrendScaleByContext[trendScaleKey] = chart.displayAbsLead;

  const leadCallout = trendLeadCallout(match, Number(trend.finalLead || 0));
  const coverageSeconds = Math.max(0, Math.round((chart.maxAt - chart.minAt) / 1000));
  const coverageLabel = coverageSeconds > 0 ? shortDuration(coverageSeconds) : "<1m";
  const leftPeakLead = Math.max(0, Math.round(chart.rawMaxLead));
  const rightPeakLead = Math.max(0, Math.round(Math.abs(chart.rawMinLead)));
  const finalPoint = chart.points[chart.points.length - 1];
  const finalToneClass = leadCallout.tone === "left" ? "left" : leadCallout.tone === "right" ? "right" : "even";
  const zeroLineLabel = `0 (${leftTeamLabel} above · ${rightTeamLabel} below)`;
  const currentLead = Number(trend.finalLead || 0);
  const currentLeadLabel =
    !Number.isFinite(currentLead) || currentLead === 0
      ? "0"
      : `${currentLead > 0 ? "+" : "-"}${compactGold(Math.abs(currentLead))}`;
  const currentLabelX = Math.max(
    chart.chartBounds.left + 1.4,
    Math.min(chart.chartBounds.right - 12, finalPoint.x + 1.2)
  );
  const currentLabelY = Math.max(
    chart.chartBounds.top + 2.2,
    Math.min(chart.chartBounds.bottom - 1.3, finalPoint.y - 1.2)
  );
  const limitedWindowNote =
    match.status === "live" && coverageSeconds < 120
      ? "Live feed currently exposes a short window; timeline will expand as additional frames are collected."
      : null;
  const trendStory = buildTrendStory(match, chart);
  const activeStory = trendStory.activeRow;
  const miniMapMarkup = renderMiniMap(match, { focusedEvent: activeStory, timelineAnchor: trendStory.timelineAnchor });
  const activeStoryTeam = activeStory?.team === "left" ? displayTeamName(match.teams.left.name) : activeStory?.team === "right" ? displayTeamName(match.teams.right.name) : "Neutral";
  const activeStoryClock = activeStory?.gameClockSeconds === null || activeStory?.gameClockSeconds === undefined
    ? "--:--"
    : `${trendStory.timelineAnchor.estimated ? "~" : ""}${formatGameClock(activeStory.gameClockSeconds)}`;
  const activeStoryLead = Number.isFinite(activeStory?.eventTs) ? leadValueAtTimestamp(chart.rows, Number(activeStory.eventTs)) : null;
  const activeStoryLeadLabel =
    !Number.isFinite(activeStoryLead) || activeStoryLead === 0
      ? "Lead: even"
      : `Lead: ${activeStoryLead > 0 ? `${leftTeamLabel} +` : `${rightTeamLabel} +`}${compactGold(Math.abs(activeStoryLead))}`;
  const activeStoryTone = activeStoryLead > 0 ? "left" : activeStoryLead < 0 ? "right" : "neutral";
  const trendMarkerMarkup = trendStory.markers
    .map((row) => {
      const tone = row.team === "left" ? "left" : row.team === "right" ? "right" : "neutral";
      const isActive = Boolean(activeStory?.eventId) && row.eventId === activeStory.eventId;
      return `<circle cx="${row.chartX.toFixed(2)}" cy="${row.chartY.toFixed(2)}" r="${isActive ? "1.18" : "0.86"}" class="trend-event-marker ${tone} ${row.bucket}${isActive ? " active" : ""}" data-story-event-id="${encodeStoryEventId(row.eventId)}" tabindex="0"></circle>`;
    })
    .join("");
  const trendStoryListMarkup = trendStory.latestRows
    .map((row) => {
      const tone = row.team === "left" ? "left" : row.team === "right" ? "right" : "neutral";
      const isActive = Boolean(activeStory?.eventId) && row.eventId === activeStory.eventId;
      const teamLabel = row.team
        ? row.team === "left"
          ? displayTeamName(match.teams.left.name)
          : displayTeamName(match.teams.right.name)
        : "Neutral";
      const clockLabel = row.gameClockSeconds === null ? "--:--" : `${trendStory.timelineAnchor.estimated ? "~" : ""}${formatGameClock(row.gameClockSeconds)}`;
      return `
        <li>
          <button type="button" class="trend-story-item ${tone}${isActive ? " active" : ""}" data-story-event-id="${encodeStoryEventId(row.eventId)}">
            <span class="trend-story-clock">${clockLabel}</span>
            <span class="trend-story-pill">${feedBucketLabel(row.bucket)}</span>
            <span class="trend-story-text">${row.title}</span>
            <span class="trend-story-team">${teamLabel}</span>
          </button>
        </li>
      `;
    })
    .join("");
  const trendStoryMarkup = trendStory.latestRows.length
    ? `
      <section class="trend-storyboard">
        <article class="trend-story-current ${activeStoryTone}">
          <p class="trend-story-kicker">Live Story</p>
          <p class="trend-story-headline">${activeStory?.title || "No event selected"}</p>
          <p class="trend-story-meta">${activeStoryClock} · ${activeStoryTeam} · ${activeStory ? feedBucketLabel(activeStory.bucket) : "Event"} · ${activeStoryLeadLabel}</p>
        </article>
        <ul class="trend-story-list">${trendStoryListMarkup}</ul>
      </section>
    `
    : `<p class="meta-text">No timeline events yet for this map.</p>`;

  elements.leadTrendWrap.innerHTML = `
    <article class="trend-card">
      <p class="trend-headline ${finalToneClass}">${leadCallout.headline}</p>
      <p class="meta-text">${leadCallout.detail}</p>
      <div class="trend-legend">
        <span class="chip left">${leftTeamLabel} Advantage</span>
        <span class="chip right">${rightTeamLabel} Advantage</span>
      </div>
      <div class="trend-split">
        ${miniMapMarkup}
        <section class="trend-chart-panel">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="trend-chart" aria-label="Gold lead trend over time">
            <rect x="${chart.chartBounds.left}" y="${chart.chartBounds.top}" width="${chart.chartBounds.right - chart.chartBounds.left}" height="${Math.max(0, chart.zeroY - chart.chartBounds.top)}" class="trend-zone-left"></rect>
            <rect x="${chart.chartBounds.left}" y="${chart.zeroY}" width="${chart.chartBounds.right - chart.chartBounds.left}" height="${Math.max(0, chart.chartBounds.bottom - chart.zeroY)}" class="trend-zone-right"></rect>
            ${chart.gridRows
              .map((row) => `<line x1="${chart.chartBounds.left}" x2="${chart.chartBounds.right}" y1="${row.y.toFixed(2)}" y2="${row.y.toFixed(2)}" class="trend-grid"></line>`)
              .join("")}
            ${chart.gridRows
              .map((row) => `<text x="${(chart.chartBounds.left + 0.7).toFixed(2)}" y="${(row.y - 0.8).toFixed(2)}" class="trend-grid-label">${row.value === 0 ? "0" : `${row.value > 0 ? "+" : "-"}${compactGold(Math.abs(row.value))}`}</text>`)
              .join("")}
            <line x1="${chart.chartBounds.left}" x2="${chart.chartBounds.right}" y1="${chart.zeroY.toFixed(2)}" y2="${chart.zeroY.toFixed(2)}" class="trend-zero"></line>
            <line x1="${finalPoint.x.toFixed(2)}" x2="${finalPoint.x.toFixed(2)}" y1="${chart.zeroY.toFixed(2)}" y2="${finalPoint.y.toFixed(2)}" class="trend-current-guide ${finalToneClass}"></line>
            <path d="${chart.areaPath}" class="trend-area"></path>
            <path d="${chart.linePath}" class="trend-line"></path>
            ${trendMarkerMarkup}
            <circle cx="${finalPoint.x.toFixed(2)}" cy="${finalPoint.y.toFixed(2)}" r="1.2" class="trend-dot ${finalToneClass}"></circle>
            <text x="${currentLabelX.toFixed(2)}" y="${currentLabelY.toFixed(2)}" class="trend-current-label ${finalToneClass}">${currentLeadLabel}</text>
          </svg>
          <div class="trend-axis">
            <span>${shortTimeLabel(new Date(chart.minAt).toISOString())}</span>
            <span>${coverageLabel} full-game timeline · ${chart.rows.length} samples</span>
            <span>${shortTimeLabel(new Date(chart.maxAt).toISOString())}</span>
          </div>
        </section>
      </div>
      ${trendStoryMarkup}
      <div class="trend-stats">
        <p class="meta-text">Peak ${leftTeamLabel}: +${compactGold(leftPeakLead)} · Peak ${rightTeamLabel}: +${compactGold(rightPeakLead)}</p>
        <p class="meta-text">Fixed scale: ±${compactGold(chart.displayAbsLead)} around center 0</p>
        <p class="meta-text">Largest swing: ${formatNumber(Math.abs(Math.round(trend.largestSwing || 0)))} gold</p>
        <p class="meta-text">${zeroLineLabel}</p>
        ${limitedWindowNote ? `<p class="meta-text">${limitedWindowNote}</p>` : ""}
      </div>
    </article>
  `;
}

function renderObjectiveControl(match) {
  const control = match.objectiveControl;
  if (!control) {
    elements.objectiveControlWrap.innerHTML = `<div class="empty">Objective control data unavailable.</div>`;
    return;
  }

  const leftPct = Math.max(0, Math.min(100, Number(control.left?.controlPct || 0)));
  const rightPct = Math.max(0, Math.min(100, Number(control.right?.controlPct || 0)));

  elements.objectiveControlWrap.innerHTML = `
    <article class="control-card">
      <div class="control-bar">
        <div class="left" style="width:${leftPct}%"></div>
        <div class="right" style="width:${rightPct}%"></div>
      </div>
      <p class="meta-text">${match.teams.left.name} ${leftPct.toFixed(1)}% · ${rightPct.toFixed(1)}% ${match.teams.right.name}</p>
      <div class="control-rows">
        <p class="meta-text">Towers ${control.left.towers} - ${control.right.towers}</p>
        <p class="meta-text">Dragons ${control.left.dragons} - ${control.right.dragons}</p>
        <p class="meta-text">Barons ${control.left.barons} - ${control.right.barons}</p>
        <p class="meta-text">Inhibitors ${control.left.inhibitors} - ${control.right.inhibitors}</p>
      </div>
    </article>
  `;
}

function renderObjectiveBreakdown(match) {
  const breakdown = match.objectiveBreakdown;
  if (!breakdown?.left || !breakdown?.right) {
    elements.objectiveBreakdownWrap.innerHTML = `<div class="empty">Objective-type totals unavailable.</div>`;
    return;
  }

  const renderSide = (teamName, sideRows) => `
    <article class="objective-side">
      <h3>${teamName}</h3>
      <p class="meta-text">Total ${sideRows.total || 0}</p>
      <div class="objective-stats">
        <p><span>Dragons</span><span>${sideRows.dragon || 0}</span></p>
        <p><span>Barons</span><span>${sideRows.baron || 0}</span></p>
        <p><span>Towers</span><span>${sideRows.tower || 0}</span></p>
        <p><span>Inhibitors</span><span>${sideRows.inhibitor || 0}</span></p>
        ${(sideRows.other || 0) > 0 ? `<p><span>Other</span><span>${sideRows.other}</span></p>` : ""}
      </div>
    </article>
  `;

  elements.objectiveBreakdownWrap.innerHTML = `
    ${renderSide(match.teams.left.name, breakdown.left)}
    ${renderSide(match.teams.right.name, breakdown.right)}
  `;
}

function renderDraftTeam(title, rows) {
  return `
    <section class="draft-team">
      <h3>${title}</h3>
      ${rows.length
        ? rows
            .map(
              (row) => `
                <article class="draft-row">
                  <p>${String(row.role || "flex").toUpperCase()}</p>
                  <p>${row.champion || "Unknown"}</p>
                  <p class="meta-text">${row.name || "Player"}</p>
                </article>
              `
            )
            .join("")
        : `<div class="empty">No draft rows.</div>`}
    </section>
  `;
}

function normalizeLineupRows(rows = []) {
  return rows
    .map((row) => ({
      role: String(row?.role || "flex").toLowerCase(),
      champion:
        row?.champion ||
        (Array.isArray(row?.champions) && row.champions.length ? row.champions[0] : "Unknown"),
      name: row?.name || row?.player || "Player"
    }))
    .filter((row) => row.name || row.champion)
    .sort((left, right) => {
      const roleDelta = trackerRoleOrder(left.role) - trackerRoleOrder(right.role);
      if (roleDelta !== 0) {
        return roleDelta;
      }
      return String(left.name).localeCompare(String(right.name));
    });
}

function lineupRowsFromSeriesTrends(seriesPlayerTrends = [], teamSide = "left") {
  const rows = Array.isArray(seriesPlayerTrends) ? seriesPlayerTrends : [];
  const candidates = rows
    .filter((row) => row?.team === teamSide)
    .map((row) => ({
      role: String(row?.role || "flex").toLowerCase(),
      champion: Array.isArray(row?.champions) && row.champions.length ? row.champions[0] : "Unknown",
      name: row?.name || "Player",
      mapsPlayed: Number(row?.mapsPlayed || 0)
    }));

  const byRole = new Map();
  for (const row of candidates) {
    const key = row.role;
    const existing = byRole.get(key);
    if (!existing || row.mapsPlayed > existing.mapsPlayed) {
      byRole.set(key, row);
    }
  }

  return normalizeLineupRows(Array.from(byRole.values()));
}

function resolveSeriesLineup(match, teamSide = "left") {
  const draftRows = Array.isArray(match?.teamDraft?.[teamSide]) ? match.teamDraft[teamSide] : [];
  if (draftRows.length) {
    return {
      rows: normalizeLineupRows(draftRows),
      source: "Latest draft metadata"
    };
  }

  const economyRows = Array.isArray(match?.playerEconomy?.[teamSide]) ? match.playerEconomy[teamSide] : [];
  if (economyRows.length) {
    return {
      rows: normalizeLineupRows(economyRows),
      source: "Latest live player telemetry"
    };
  }

  const trendRows = lineupRowsFromSeriesTrends(match?.seriesPlayerTrends, teamSide);
  if (trendRows.length) {
    return {
      rows: trendRows,
      source: "Series player trend sample"
    };
  }

  return {
    rows: [],
    source: "Unavailable"
  };
}

function renderSeriesLineups(match) {
  if (!elements.seriesLineupsWrap) {
    return;
  }

  const left = resolveSeriesLineup(match, "left");
  const right = resolveSeriesLineup(match, "right");
  if (!left.rows.length && !right.rows.length) {
    elements.seriesLineupsWrap.innerHTML = `<div class="empty">Lineup data appears once draft/player metadata is available.</div>`;
    return;
  }

  const sources = Array.from(
    new Set([left.source, right.source].filter((value) => value && value !== "Unavailable"))
  );
  const sourceText = sources.length ? sources.join(" · ") : "Unavailable";

  elements.seriesLineupsWrap.innerHTML = `
    ${renderDraftTeam(`${match.teams.left.name} Lineup`, left.rows)}
    ${renderDraftTeam(`${match.teams.right.name} Lineup`, right.rows)}
    <article class="recap-note">
      <p class="meta-text">Lineup Source: ${sourceText}</p>
      <p class="meta-text">Series tab highlights team context; open a game tab for map-specific live stats.</p>
    </article>
  `;
}

function renderDraftBoard(match) {
  const draft = match.teamDraft;
  if (!draft) {
    elements.draftBoardWrap.innerHTML = `<div class="empty">Draft data appears once game metadata is available.</div>`;
    return;
  }

  elements.draftBoardWrap.innerHTML = `
    ${renderDraftTeam(match.teams.left.name, draft.left || [])}
    ${renderDraftTeam(match.teams.right.name, draft.right || [])}
  `;
}

function renderEconomyTeam(title, rows) {
  return `
    <section class="economy-team">
      <h3>${title}</h3>
      ${rows.length
        ? rows
            .map(
              (row) => `
                <article class="economy-row">
                  <p class="name">${row.name} · ${row.champion}</p>
                  <p class="meta-text">${String(row.role || "flex").toUpperCase()} · KDA ${row.kills}/${row.deaths}/${row.assists} · CS ${row.cs}</p>
                  <p class="meta-text">Gold ${formatNumber(row.goldEarned)} · GPM ${formatNumber(row.gpm)} · Items ${row.itemCount}</p>
                </article>
              `
            )
            .join("")
        : `<div class="empty">No player rows.</div>`}
    </section>
  `;
}

function renderEconomyBoard(match) {
  const economy = match.playerEconomy;
  const totals = match.teamEconomyTotals;
  if (!economy) {
    elements.economyBoardWrap.innerHTML = `<div class="empty">Economy board available during active/recent games.</div>`;
    return;
  }

  elements.economyBoardWrap.innerHTML = `
    ${totals ? `<article class="totals-strip">
      <p class="meta-text">${match.teams.left.name}: Gold ${formatNumber(totals.left.totalGold)} · Avg GPM ${formatNumber(totals.left.avgGpm)}</p>
      <p class="meta-text">${match.teams.right.name}: Gold ${formatNumber(totals.right.totalGold)} · Avg GPM ${formatNumber(totals.right.avgGpm)}</p>
    </article>` : ""}
    ${renderEconomyTeam(match.teams.left.name, economy.left || [])}
    ${renderEconomyTeam(match.teams.right.name, economy.right || [])}
    <p class="meta-text">Window ${shortDuration(economy.elapsedSeconds)} · Updated ${dateTimeLabel(economy.updatedAt)}</p>
  `;
}

function renderLaneMatchups(match) {
  const rows = Array.isArray(match.laneMatchups) ? match.laneMatchups : [];
  if (!rows.length) {
    elements.laneMatchupsWrap.innerHTML = `<div class="empty">Lane matchup data requires draft + economy feeds.</div>`;
    return;
  }

  elements.laneMatchupsWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>${match.teams.left.name}</th>
            <th>Gold Diff</th>
            <th>${match.teams.right.name}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${String(row.role || "flex").toUpperCase()}</td>
                  <td>${row.left.player} · ${row.left.champion}<br /><span class="meta-text">${row.left.kda || "n/a"} · CS ${row.left.cs ?? "n/a"} · ${row.left.gold ? formatNumber(row.left.gold) : "n/a"}</span></td>
                  <td>${signed(row.goldDiff)}</td>
                  <td>${row.right.player} · ${row.right.champion}<br /><span class="meta-text">${row.right.kda || "n/a"} · CS ${row.right.cs ?? "n/a"} · ${row.right.gold ? formatNumber(row.right.gold) : "n/a"}</span></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderObjectiveRuns(match) {
  const runs = Array.isArray(match.objectiveRuns) ? match.objectiveRuns : [];
  if (!runs.length) {
    elements.objectiveRunsWrap.innerHTML = `<div class="empty">No streaks detected in objective flow yet.</div>`;
    return;
  }

  elements.objectiveRunsWrap.innerHTML = runs
    .map(
      (run) => `
      <article class="run-card ${run.team === "right" ? "right" : "left"}">
        <p class="run-title">${run.teamName} · ${run.count} objective${run.count === 1 ? "" : "s"}</p>
        <p class="meta-text">${(run.types || []).join(", ")}</p>
        <p class="meta-text">${dateTimeLabel(run.startedAt)} to ${dateTimeLabel(run.endedAt)}</p>
      </article>
    `
    )
    .join("");
}

function stateClass(state) {
  if (state === "completed") return "complete";
  if (state === "inProgress") return "live";
  if (state === "unneeded") return "skip";
  return "upcoming";
}

function stateLabel(state) {
  if (state === "inProgress") return "LIVE";
  if (state === "completed") return "COMPLETED";
  if (state === "unneeded") return "SKIPPED";
  return "UPCOMING";
}

function seriesGameStatusNote(game, match) {
  const state = String(game?.state || "unstarted");
  const winner = resolveSeriesGameWinnerName(game, match);
  if (state === "inProgress") {
    return "Map currently live.";
  }
  if (state === "completed") {
    return winner ? `Winner: ${scoreboardTeamName(winner)}` : "Completed.";
  }
  if (state === "unneeded") {
    return "Not played.";
  }
  return "Waiting for kickoff.";
}

function renderSeriesGames(match, apiBase) {
  const compact = isCompactUI();
  const games = Array.isArray(match.seriesGames) ? match.seriesGames : [];
  if (!games.length) {
    elements.seriesGamesWrap.innerHTML = `<div class="empty">No game breakdown available.</div>`;
    return;
  }

  const completedCount = games.filter((game) => game?.state === "completed").length;
  const liveGame = games.find((game) => game?.state === "inProgress") || null;
  const skippedCount = games.filter((game) => game?.state === "unneeded").length;
  const upcomingCount = games.filter((game) => game?.state === "unstarted").length;
  const focusedGame = games.find((game) => game?.selected) || null;
  const leftTag = scoreboardTeamName(match?.teams?.left?.name);
  const rightTag = scoreboardTeamName(match?.teams?.right?.name);
  const leftSeriesScore = Number(match?.seriesScore?.left || 0);
  const rightSeriesScore = Number(match?.seriesScore?.right || 0);
  const summaryChips = [
    `Completed ${completedCount}/${games.length}`,
    `Live ${liveGame ? `G${liveGame.number}` : "None"}`,
    `Upcoming ${upcomingCount}`
  ];
  if (skippedCount > 0) {
    summaryChips.push(`Skipped ${skippedCount}`);
  }
  if (focusedGame) {
    summaryChips.push(`Focused G${focusedGame.number}`);
  }

  const cards = games
    .map((game) => {
      const options = Array.isArray(game.watchOptions) ? game.watchOptions : [];
      const openGameHref = detailUrlForGame(match.id, apiBase, game.number);
      const sideInfo = game?.sideInfo || {};
      const leftSide = String(sideInfo.leftSide || "").toLowerCase();
      const rightSide = String(sideInfo.rightSide || "").toLowerCase();
      const leftSideLabel = leftSide ? leftSide.toUpperCase() : "TBD";
      const rightSideLabel = rightSide ? rightSide.toUpperCase() : "TBD";
      const leftSideTone = leftSide === "blue" ? "blue" : leftSide === "red" ? "red" : "neutral";
      const rightSideTone = rightSide === "red" ? "red" : rightSide === "blue" ? "blue" : "neutral";
      const winnerName = resolveSeriesGameWinnerName(game, match);
      const startedLabel = game.startedAt ? (compact ? dateTimeCompact(game.startedAt) : dateTimeLabel(game.startedAt)) : "TBD";
      const durationLabel = durationLabelFromMinutes(game.durationMinutes);
      const statusNote = seriesGameStatusNote(game, match);
      const labelText = String(game.label || "").trim();
      const labelNormalized = labelText.toLowerCase();
      const showLabel =
        labelText &&
        labelNormalized !== "completed game." &&
        labelNormalized !== "completed game" &&
        labelNormalized !== "upcoming game." &&
        labelNormalized !== "upcoming game" &&
        labelNormalized !== "live game." &&
        labelNormalized !== "live game";
      const openAction = game.selected
        ? `<span class="series-game-focused">${compact ? "Viewing" : "Viewing this game"}</span>`
        : `<a class="series-game-open" href="${openGameHref}">${compact ? `Open G${game.number}` : `Open Game ${game.number}`}</a>`;
      const vodAction = game.watchUrl
        ? `<a class="series-game-vod" href="${game.watchUrl}" target="_blank" rel="noreferrer">${compact ? "VOD" : "Watch VOD"}</a>`
        : `<span class="series-game-vod disabled">No VOD</span>`;

      return `
        <article class="series-game-card ${game.selected ? "selected" : ""} state-${stateClass(game.state)}">
          <div class="series-game-head">
            <p class="series-game-title">${compact ? `G${game.number}` : `Game ${game.number}`}</p>
            <span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span>
          </div>
          <p class="series-game-status">${statusNote}</p>
          ${showLabel ? `<p class="meta-text">${labelText}</p>` : ""}
          ${winnerName ? `<p class="series-game-winner">Winner ${scoreboardTeamName(winnerName)}</p>` : ""}
          <div class="series-game-meta-grid">
            <article class="series-game-meta-cell">
              <p class="meta-text">Start</p>
              <p class="series-game-meta-value">${startedLabel}</p>
            </article>
            <article class="series-game-meta-cell">
              <p class="meta-text">Duration</p>
              <p class="series-game-meta-value">${durationLabel}</p>
            </article>
          </div>
          <div class="series-game-sides">
            <span class="series-side-chip ${leftSideTone}">${leftTag} ${leftSideLabel}</span>
            <span class="series-side-chip ${rightSideTone}">${rightTag} ${rightSideLabel}</span>
          </div>
          <div class="series-game-actions">
            ${openAction}
            ${vodAction}
          </div>
          ${options.length
            ? `<div class="series-game-options">${options
                .map((opt) => `<a class="series-game-option" href="${opt.watchUrl}" target="_blank" rel="noreferrer">${opt.shortLabel || opt.label}</a>`)
                .join("")}</div>`
            : ""}
        </article>
      `;
    })
    .join("");

  elements.seriesGamesWrap.innerHTML = `
    <article class="series-games-overview">
      <p class="series-games-scoreline">${leftTag} ${leftSeriesScore} - ${rightSeriesScore} ${rightTag}</p>
      <div class="series-games-summary-chips">
        ${summaryChips.map((chip) => `<span class="series-summary-chip">${chip}</span>`).join("")}
      </div>
    </article>
    <div class="series-games-grid">${cards}</div>
  `;
}

function durationLabelFromMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return "n/a";
  }

  const totalSeconds = Math.round(value * 60);
  return shortDuration(totalSeconds);
}

function resolveSeriesGameWinnerName(game, match) {
  if (!game || game.state !== "completed") {
    return null;
  }

  if (game.winnerTeamId === match?.teams?.left?.id) {
    return match.teams.left.name;
  }

  if (game.winnerTeamId === match?.teams?.right?.id) {
    return match.teams.right.name;
  }

  return null;
}

function sideSummaryFromSeriesGame(game, match) {
  const sideInfo = game?.sideInfo || {};
  if (!sideInfo.leftSide || !sideInfo.rightSide) {
    return "n/a";
  }

  return `${displayTeamName(match.teams.left.name)} ${String(sideInfo.leftSide).toUpperCase()} · ${displayTeamName(match.teams.right.name)} ${String(sideInfo.rightSide).toUpperCase()}`;
}

function renderSeriesComparison(match, apiBase) {
  const compact = isCompactUI();
  const games = Array.isArray(match.seriesGames) ? match.seriesGames : [];
  if (!games.length) {
    elements.seriesCompareWrap.innerHTML = `<div class="empty">Series comparison appears once game breakdown is available.</div>`;
    return;
  }

  const completedGames = games.filter((game) => game.state === "completed");
  const durations = completedGames
    .map((game) => Number(game.durationMinutes))
    .filter((value) => Number.isFinite(value) && value > 0);
  const leftWins = completedGames.filter((game) => game.winnerTeamId === match.teams.left.id).length;
  const rightWins = completedGames.filter((game) => game.winnerTeamId === match.teams.right.id).length;
  const avgDuration = durations.length
    ? durationLabelFromMinutes(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : "n/a";
  const fastest = durations.length ? durationLabelFromMinutes(Math.min(...durations)) : "n/a";
  const slowest = durations.length ? durationLabelFromMinutes(Math.max(...durations)) : "n/a";

  const summaryCards = [
    { label: compact ? "Maps" : "Completed Maps", value: String(completedGames.length) },
    { label: compact ? `${displayTeamName(match.teams.left.name)} W` : `${displayTeamName(match.teams.left.name)} Wins`, value: String(leftWins) },
    { label: compact ? `${displayTeamName(match.teams.right.name)} W` : `${displayTeamName(match.teams.right.name)} Wins`, value: String(rightWins) },
    { label: compact ? "Avg Len" : "Avg Map Length", value: avgDuration },
    { label: compact ? "Fastest" : "Fastest Map", value: fastest },
    { label: compact ? "Slowest" : "Slowest Map", value: slowest }
  ];

  const rows = games
    .map((game) => {
      const openHref = detailUrlForGame(match.id, apiBase, game.number);
      const winner = resolveSeriesGameWinnerName(game, match);
      const winnerText =
        (winner ? displayTeamName(winner) : null) ||
        (game.state === "inProgress"
          ? "Live"
          : game.state === "unneeded"
            ? "Not played"
            : "TBD");
      const durationText = durationLabelFromMinutes(game.durationMinutes);
      const sideText = sideSummaryFromSeriesGame(game, match);
      const watchLink = game.watchUrl
        ? `<a class="table-link" href="${game.watchUrl}" target="_blank" rel="noreferrer">VOD</a>`
        : `<span class="meta-text">n/a</span>`;
      const openText = game.selected
        ? `<span class="meta-text strong">Focused</span>`
        : `<a class="table-link" href="${openHref}">Open</a>`;

      if (compact) {
        return `
          <article class="series-compare-item ${game.selected ? "selected" : ""}">
            <div class="series-compare-item-top">
              <p class="series-compare-game">G${game.number}</p>
              <span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span>
            </div>
            <p class="meta-text"><strong>Winner:</strong> ${winnerText}</p>
            <p class="meta-text"><strong>Duration:</strong> ${durationText}</p>
            <p class="meta-text"><strong>Sides:</strong> ${sideText}</p>
            <div class="series-compare-links">
              ${game.watchUrl ? `<a class="table-link" href="${game.watchUrl}" target="_blank" rel="noreferrer">VOD</a>` : `<span class="meta-text">No VOD</span>`}
              ${game.selected ? `<span class="meta-text strong">Focused</span>` : `<a class="table-link" href="${openHref}">Open</a>`}
            </div>
          </article>
        `;
      }

      return `
        <tr>
          <td>Game ${game.number}</td>
          <td><span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span></td>
          <td>${winnerText}</td>
          <td>${durationText}</td>
          <td>${sideText}</td>
          <td>${watchLink}</td>
          <td>${openText}</td>
        </tr>
      `;
    })
    .join("");

  elements.seriesCompareWrap.innerHTML = `
    <div class="series-compare-summary">
      ${summaryCards
        .map(
          (card) => `
            <article class="series-compare-card">
              <p class="tempo-label">${card.label}</p>
              <p class="tempo-value">${card.value}</p>
            </article>
          `
        )
        .join("")}
    </div>
    ${compact
      ? `<div class="series-compare-list">${rows}</div>`
      : `
        <div class="lane-table-wrap">
          <table class="lane-table series-compare-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>State</th>
                <th>Winner</th>
                <th>Duration</th>
                <th>Sides</th>
                <th>VOD</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `}
  `;
}

function selectedGameWinnerName(match, selectedSeriesGame, selectedGame) {
  if (selectedSeriesGame?.winnerTeamId === match.teams.left.id) {
    return match.teams.left.name;
  }

  if (selectedSeriesGame?.winnerTeamId === match.teams.right.id) {
    return match.teams.right.name;
  }

  if (selectedGame?.state !== "completed") {
    return selectedGame?.state === "inProgress" ? "Live" : "TBD";
  }

  const leftKills = Number(selectedGame?.snapshot?.left?.kills);
  const rightKills = Number(selectedGame?.snapshot?.right?.kills);
  if (Number.isFinite(leftKills) && Number.isFinite(rightKills)) {
    if (leftKills > rightKills) return match.teams.left.name;
    if (rightKills > leftKills) return match.teams.right.name;
  }

  return "TBD";
}

function selectedGameEstimatedStart(match, gameNumber) {
  const projections = Array.isArray(match?.seriesProjection?.games) ? match.seriesProjection.games : [];
  const found = projections.find((row) => Number(row.number) === Number(gameNumber));
  return found?.estimatedStartAt || null;
}

function recapCard(label, value, note = null) {
  return `
    <article class="recap-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderSelectedGameRecap(match) {
  const selectedGame = match.selectedGame;
  if (!selectedGame) {
    elements.selectedGameRecapWrap.innerHTML = `<div class="empty">Select a game to load map-level recap.</div>`;
    return;
  }

  const selectedSeriesGame = (Array.isArray(match.seriesGames) ? match.seriesGames : []).find((game) => game.selected) || null;
  const winnerName = selectedGameWinnerName(match, selectedSeriesGame, selectedGame);
  const duration = durationLabelFromMinutes(selectedSeriesGame?.durationMinutes);
  const sideSummary = Array.isArray(selectedGame.sideSummary) ? selectedGame.sideSummary : [];
  const cards = [
    recapCard("Map", `Game ${selectedGame.number}`),
    recapCard("State", stateLabel(selectedGame.state)),
    recapCard("Winner", winnerName || "TBD"),
    recapCard("Duration", duration),
    recapCard("Telemetry", String(selectedGame.telemetryStatus || "none").toUpperCase())
  ];

  if (selectedGame.state === "unstarted") {
    const estimatedStart = selectedGameEstimatedStart(match, selectedGame.number);
    if (estimatedStart) {
      cards.push(recapCard("Estimated Start", dateTimeLabel(estimatedStart)));
    }

    elements.selectedGameRecapWrap.innerHTML = `
      <div class="recap-grid">${cards.join("")}</div>
      <article class="recap-note">
        <p class="meta-text">${sideSummary.length ? sideSummary.join(" · ") : "Side assignment not available yet."}</p>
      </article>
    `;
    return;
  }

  const snapshot = selectedGame.snapshot || {};
  const left = snapshot.left || {};
  const right = snapshot.right || {};
  const killDiff = Number(left.kills || 0) - Number(right.kills || 0);
  const towerDiff = Number(left.towers || 0) - Number(right.towers || 0);
  const dragonDiff = Number(left.dragons || 0) - Number(right.dragons || 0);
  const baronDiff = Number(left.barons || 0) - Number(right.barons || 0);
  const inhibDiff = Number(left.inhibitors || 0) - Number(right.inhibitors || 0);
  const leftGold = Number(left.gold);
  const rightGold = Number(right.gold);
  const hasGold = Number.isFinite(leftGold) && Number.isFinite(rightGold);
  const goldDiff = hasGold ? leftGold - rightGold : null;

  cards.push(recapCard("Kills", `${left.kills ?? 0} : ${right.kills ?? 0}`, `Diff ${signed(killDiff)}`));
  cards.push(recapCard("Towers", `${left.towers ?? 0} : ${right.towers ?? 0}`, `Diff ${signed(towerDiff)}`));
  cards.push(recapCard("Dragons", `${left.dragons ?? 0} : ${right.dragons ?? 0}`, `Diff ${signed(dragonDiff)}`));
  cards.push(recapCard("Barons", `${left.barons ?? 0} : ${right.barons ?? 0}`, `Diff ${signed(baronDiff)}`));
  cards.push(recapCard("Inhibitors", `${left.inhibitors ?? 0} : ${right.inhibitors ?? 0}`, `Diff ${signed(inhibDiff)}`));
  cards.push(recapCard("Gold", hasGold ? `${formatNumber(leftGold)} : ${formatNumber(rightGold)}` : "n/a", hasGold ? `Diff ${signed(Math.round(goldDiff))}` : "No gold totals"));

  const topRows = Array.isArray(match.topPerformers) ? match.topPerformers.slice(0, 3) : [];
  const performerText = topRows.length
    ? topRows.map((player) => `${player.name} (${player.kills}/${player.deaths}/${player.assists})`).join(" · ")
    : "No top performer snapshot for this map.";
  const tips = Array.isArray(selectedGame.tips) ? selectedGame.tips : [];

  elements.selectedGameRecapWrap.innerHTML = `
    <div class="recap-grid">${cards.join("")}</div>
    <article class="recap-note">
      <p class="meta-text">${sideSummary.length ? sideSummary.join(" · ") : "Side assignment not available."}</p>
      <p class="meta-text">${performerText}</p>
      ${tips.length ? `<p class="meta-text">${tips.join(" · ")}</p>` : ""}
    </article>
  `;
}

function renderDraftDelta(match) {
  const delta = match.draftDelta;
  if (!delta || !Array.isArray(delta.rows) || !delta.rows.length) {
    elements.draftDeltaWrap.innerHTML = `<div class="empty">Draft delta appears when at least two completed drafts are available.</div>`;
    return;
  }

  const leftName = match.teams.left.name;
  const rightName = match.teams.right.name;
  const rows = delta.rows
    .map((row) => {
      const leftChange = row.leftChanged ? "changed" : "same";
      const rightChange = row.rightChanged ? "changed" : "same";
      return `
        <tr>
          <td>${String(row.role || "flex").toUpperCase()}</td>
          <td>${row.leftReferenceChampion || "n/a"} → ${row.leftSelectedChampion || "n/a"}</td>
          <td class="${row.leftChanged ? "win-left" : "even"}">${leftChange}</td>
          <td>${row.rightReferenceChampion || "n/a"} → ${row.rightSelectedChampion || "n/a"}</td>
          <td class="${row.rightChanged ? "win-right" : "even"}">${rightChange}</td>
        </tr>
      `;
    })
    .join("");

  elements.draftDeltaWrap.innerHTML = `
    <article class="draft-delta-summary">
      <p class="meta-text">Game ${delta.selectedGameNumber} vs Game ${delta.referenceGameNumber}</p>
      <p class="meta-text">${leftName} changes: ${delta.leftChanges} · ${rightName} changes: ${delta.rightChanges} · Total: ${delta.totalChanges}</p>
    </article>
    <div class="lane-table-wrap">
      <table class="lane-table draft-delta-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>${leftName}</th>
            <th>${leftName} Change</th>
            <th>${rightName}</th>
            <th>${rightName} Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function trendSparkline(points = []) {
  const values = points
    .map((point) => Number(point?.gpm))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length < 2) {
    return `<span class="meta-text">Need 2+ maps</span>`;
  }

  const pointsValue = sparklinePoints(values);
  return `
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="trend-mini" aria-label="Player trend sparkline">
      <polyline points="${pointsValue}" class="trend-mini-line"></polyline>
    </svg>
  `;
}

function renderSeriesPlayerTrends(match) {
  const compact = isCompactUI();
  const rows = Array.isArray(match.seriesPlayerTrends) ? match.seriesPlayerTrends : [];
  if (!rows.length) {
    elements.seriesPlayerTrendsWrap.innerHTML = `<div class="empty">Cross-map player trends appear when multiple map snapshots are available.</div>`;
    return;
  }

  const topRows = rows.slice(0, compact ? 12 : 16);
  const tableRows = topRows
    .map((row) => {
      const teamName = row.team === "right" ? match.teams.right.name : match.teams.left.name;
      const winRate = Number.isFinite(row.winRatePct) ? `${row.winRatePct.toFixed(1)}%` : "n/a";
      const kda = Number.isFinite(row.avgKda) ? row.avgKda.toFixed(2) : "n/a";
      const avgGold = Number.isFinite(row.avgGold) ? formatNumber(Math.round(row.avgGold)) : "n/a";
      const avgGpm = Number.isFinite(row.avgGpm) ? formatNumber(Math.round(row.avgGpm)) : "n/a";
      const avgKp = Number.isFinite(row.avgKillParticipationPct) ? `${row.avgKillParticipationPct.toFixed(1)}%` : "n/a";
      const champions = Array.isArray(row.champions) ? row.champions.slice(0, 3).join(", ") : "n/a";

      return `
        <tr>
          <td>${row.name}</td>
          <td>${teamName}</td>
          <td>${String(row.role || "flex").toUpperCase()}</td>
          <td>${row.mapsPlayed}</td>
          <td>${row.mapWins}</td>
          <td>${winRate}</td>
          <td>${kda}</td>
          <td>${avgKp}</td>
          <td>${avgGold}</td>
          <td>${avgGpm}</td>
          <td>${champions}</td>
          <td>${trendSparkline(row.mapPoints || [])}</td>
        </tr>
      `;
    })
    .join("");

  if (compact) {
    const trendCards = topRows
      .map((row) => {
        const teamName = row.team === "right" ? match.teams.right.name : match.teams.left.name;
        const teamDisplay = displayTeamName(teamName);
        const winRate = Number.isFinite(row.winRatePct) ? `${row.winRatePct.toFixed(1)}%` : "n/a";
        const kda = Number.isFinite(row.avgKda) ? row.avgKda.toFixed(2) : "n/a";
        const avgGpm = Number.isFinite(row.avgGpm) ? formatNumber(Math.round(row.avgGpm)) : "n/a";
        const avgKp = Number.isFinite(row.avgKillParticipationPct) ? `${row.avgKillParticipationPct.toFixed(1)}%` : "n/a";
        const champions = Array.isArray(row.champions) ? row.champions.slice(0, 2).join(", ") : "n/a";

        return `
          <article class="series-trend-card ${row.team === "right" ? "right" : "left"}">
            <div class="series-trend-head">
              <p class="series-trend-player">${row.name}</p>
              <span class="series-trend-role">${String(row.role || "flex").toUpperCase()}</span>
            </div>
            <p class="meta-text">${teamDisplay} · Maps ${row.mapsPlayed} · Wins ${row.mapWins}</p>
            <div class="series-trend-metrics">
              <span>WR ${winRate}</span>
              <span>KDA ${kda}</span>
              <span>KP ${avgKp}</span>
              <span>GPM ${avgGpm}</span>
            </div>
            <p class="meta-text">Picks: ${champions}</p>
            <div class="series-trend-spark">${trendSparkline(row.mapPoints || [])}</div>
          </article>
        `;
      })
      .join("");

    elements.seriesPlayerTrendsWrap.innerHTML = `<div class="series-trend-cards">${trendCards}</div>`;
    return;
  }

  elements.seriesPlayerTrendsWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table trends-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>Role</th>
            <th>Maps</th>
            <th>Wins</th>
            <th>Win%</th>
            <th>Avg KDA</th>
            <th>Avg KP</th>
            <th>Avg Gold</th>
            <th>Avg GPM</th>
            <th>Champions</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

function renderPreMatchPlanner(match) {
  if (match.status !== "upcoming") {
    elements.preMatchPlanner.innerHTML = `<div class="empty">Pre-match planner appears only for upcoming series.</div>`;
    return;
  }

  const games = Array.isArray(match?.seriesProjection?.games) ? match.seriesProjection.games : [];
  if (!games.length) {
    elements.preMatchPlanner.innerHTML = `<div class="empty">No schedule projection available.</div>`;
    return;
  }

  const rows = games
    .map((row) => `<li><span>Game ${row.number}</span><span>${dateTimeLabel(row.estimatedStartAt)}</span></li>`)
    .join("");

  elements.preMatchPlanner.innerHTML = `
    <ul class="planner-rows">${rows}</ul>
    <p class="meta-text">Estimate uses ~45 minute games with ~8 minute breaks.</p>
  `;
}

function teamNameBySide(match, side) {
  if (side === "right") return match.teams.right.name;
  return match.teams.left.name;
}

function renderTopPerformers(match) {
  const rows = Array.isArray(match.topPerformers) ? match.topPerformers : [];
  if (!rows.length) {
    elements.performersWrap.innerHTML = `<div class="empty">No player performance snapshot yet.</div>`;
    return;
  }

  elements.performersWrap.innerHTML = rows
    .map(
      (player) => `
      <article class="performer-row">
        <p class="performer-name">${player.name} · ${player.champion || "Unknown"}</p>
        <p class="meta-text">${teamNameBySide(match, player.team)} · ${String(player.role || "flex").toUpperCase()}</p>
        <p class="meta-text">KDA ${player.kills}/${player.deaths}/${player.assists} · CS ${player.cs} · Gold ${formatNumber(player.goldEarned)}</p>
        <p class="meta-text">KP ${typeof player.killParticipationPct === "number" ? `${player.killParticipationPct.toFixed(1)}%` : "n/a"} · Score ${typeof player.impactScore === "number" ? player.impactScore.toFixed(1) : "n/a"}</p>
      </article>
    `
    )
    .join("");
}

function renderLiveTicker(rows, status) {
  if (!rows.length) {
    elements.liveTickerList.innerHTML =
      status === "live"
        ? "<li>Waiting for ticker events from live frames...</li>"
        : "<li>Live ticker appears during active games.</li>";
    return;
  }

  elements.liveTickerList.innerHTML = rows
    .map(
      (row) => `
      <li>
        <div class="moment-head">
          <strong>${row.title}</strong>
          <span class="importance">${row.importance || row.type || "info"}</span>
        </div>
        <p class="meta-text">${row.summary || "Live-derived update."}</p>
        <p class="meta-text">${dateTimeLabel(row.occurredAt)}</p>
      </li>
    `
    )
    .join("");
}

function renderCombatBursts(rows, match) {
  if (!rows.length) {
    elements.combatBurstsList.innerHTML =
      match.status === "live"
        ? "<li>Waiting for combat burst windows from kill deltas...</li>"
        : "<li>Combat bursts appear when multi-kill windows are detected.</li>";
    return;
  }

  elements.combatBurstsList.innerHTML = rows
    .map(
      (row) => `
      <li>
        <div class="moment-head">
          <strong>${row.title || "Combat burst"}</strong>
          <span class="importance">${String(row.importance || "medium").toUpperCase()}</span>
        </div>
        <p class="meta-text">${row.summary || "Burst event from kill deltas."}</p>
        <p class="meta-text">${dateTimeLabel(row.occurredAt)}${row.winnerTeamName ? ` · Winner: ${row.winnerTeamName}` : ""}</p>
      </li>
    `
    )
    .join("");
}

function renderGoldMilestones(rows, match) {
  if (!rows.length) {
    elements.goldMilestonesList.innerHTML =
      match.status === "live"
        ? "<li>Gold milestones appear as team economy thresholds are crossed.</li>"
        : "<li>No gold milestone telemetry for this game.</li>";
    return;
  }

  elements.goldMilestonesList.innerHTML = rows
    .map(
      (row) => `
      <li>
        <div class="moment-head">
          <strong>${row.title || "Gold milestone"}</strong>
          <span class="importance">${String(row.importance || "medium").toUpperCase()}</span>
        </div>
        <p class="meta-text">${row.summary || "Team crossed a major gold threshold."}</p>
        <p class="meta-text">${dateTimeLabel(row.occurredAt)}${row.teamName ? ` · ${row.teamName}` : ""}</p>
      </li>
    `
    )
    .join("");
}

function buildLiveAlerts(match) {
  const alerts = [];
  const selected = match.selectedGame;
  const leftName = match.teams?.left?.name || "Left Team";
  const rightName = match.teams?.right?.name || "Right Team";
  const leftSnapshot = selected?.snapshot?.left || {};
  const rightSnapshot = selected?.snapshot?.right || {};
  const leftGold = Number(leftSnapshot.gold || 0);
  const rightGold = Number(rightSnapshot.gold || 0);
  const goldDiff = leftGold - rightGold;

  if (Math.abs(goldDiff) >= 5000) {
    alerts.push({
      id: "gold-gap",
      importance: "high",
      title: "Large Gold Gap",
      summary: `${goldDiff > 0 ? leftName : rightName} leads by ${formatNumber(Math.abs(goldDiff))} gold.`
    });
  }

  const towerDiff = Number(leftSnapshot.towers || 0) - Number(rightSnapshot.towers || 0);
  if (Math.abs(towerDiff) >= 4) {
    alerts.push({
      id: "tower-gap",
      importance: "high",
      title: "Tower Pressure",
      summary: `${towerDiff > 0 ? leftName : rightName} is up ${Math.abs(towerDiff)} towers.`
    });
  }

  const objectiveDelta = (Number(leftSnapshot.dragons || 0) + Number(leftSnapshot.barons || 0)) -
    (Number(rightSnapshot.dragons || 0) + Number(rightSnapshot.barons || 0));
  if (Math.abs(objectiveDelta) >= 2) {
    alerts.push({
      id: "objective-gap",
      importance: "medium",
      title: "Objective Advantage",
      summary: `${objectiveDelta > 0 ? leftName : rightName} has objective control momentum.`
    });
  }

  const recentBursts = Array.isArray(match.combatBursts) ? match.combatBursts.slice(0, 3) : [];
  if (recentBursts.some((row) => Number(row.totalKills || 0) >= 4)) {
    alerts.push({
      id: "burst-risk",
      importance: "critical",
      title: "High Volatility Fight Windows",
      summary: "Recent 4+ kill bursts detected. Fight outcomes may flip map pressure rapidly."
    });
  }

  if (!alerts.length) {
    alerts.push({
      id: "stable",
      importance: "low",
      title: "Stable State",
      summary: "No major pressure alerts right now. Track next objective spawn and side setup."
    });
  }

  return alerts.slice(0, 5);
}

function renderLiveAlerts(match) {
  const alerts = buildLiveAlerts(match);
  elements.liveAlertsList.innerHTML = alerts
    .map(
      (alert) => `
      <li>
        <div class="moment-head">
          <strong>${alert.title}</strong>
          <span class="importance">${String(alert.importance || "low").toUpperCase()}</span>
        </div>
        <p class="meta-text">${alert.summary}</p>
      </li>
    `
    )
    .join("");
}

function renderObjectiveTimeline(rows, status) {
  if (!rows.length) {
    elements.objectiveTimelineList.innerHTML =
      status === "live"
        ? "<li>No objective changes in this frame window yet.</li>"
        : "<li>Objective timeline appears during active games.</li>";
    return;
  }

  elements.objectiveTimelineList.innerHTML = rows
    .map((row) => `<li><span>${dateTimeLabel(row.at)}</span><span>${row.label}</span></li>`)
    .join("");
}

function etaLabel(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  if (value <= 0) {
    return "Now";
  }

  return shortDuration(value);
}

function renderObjectiveForecast(match) {
  const rows = Array.isArray(match.objectiveForecast) ? match.objectiveForecast : [];
  const selectedState = match?.selectedGame?.state;
  if (!rows.length) {
    if (match.status === "live" && selectedState === "inProgress") {
      elements.objectiveForecastWrap.innerHTML = `<div class="empty">Forecast appears once objective cadence is detected.</div>`;
    } else if (selectedState === "completed") {
      elements.objectiveForecastWrap.innerHTML = `<div class="empty">Map is complete. No upcoming objective windows.</div>`;
    } else {
      elements.objectiveForecastWrap.innerHTML = `<div class="empty">Objective forecast is available for live maps.</div>`;
    }
    return;
  }

  elements.objectiveForecastWrap.innerHTML = rows
    .map(
      (row) => `
      <article class="forecast-card ${row.state === "available" ? "available" : "countdown"}">
        <p class="forecast-title">${row.label || "Objective Window"}</p>
        <p class="forecast-eta">${etaLabel(row.etaSeconds)}</p>
        <p class="meta-text">Expected ${dateTimeLabel(row.nextAt)}</p>
        ${row.note ? `<p class="meta-text">${row.note}</p>` : ""}
        <p class="meta-text">Confidence: ${String(row.confidence || "estimated").toUpperCase()}</p>
      </article>
    `
    )
    .join("");
}

function roleDiffClass(diff) {
  const value = Number(diff);
  if (!Number.isFinite(value) || value === 0) return "even";
  return value > 0 ? "win-left" : "win-right";
}

function roleTrendSparkline(trend = []) {
  const values = trend
    .map((row) => Number(row?.diff))
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    return `<span class="meta-text">n/a</span>`;
  }

  const points = sparklinePoints(values);
  return `
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="trend-mini" aria-label="Role trend sparkline">
      <polyline points="${points}" class="trend-mini-line"></polyline>
    </svg>
  `;
}

function renderRoleMatchupDeltas(match) {
  const rows = Array.isArray(match.roleMatchupDeltas) ? match.roleMatchupDeltas : [];
  if (!rows.length) {
    elements.roleDeltaWrap.innerHTML = `<div class="empty">Role deltas appear when multiple game economies are available.</div>`;
    return;
  }

  const renderedRows = rows
    .map((row) => {
      const selectedDiff = Number.isFinite(row.selectedDiff) ? signed(Math.round(row.selectedDiff)) : "n/a";
      const avgDiff = Number.isFinite(row.avgDiff) ? signed(Math.round(row.avgDiff)) : "n/a";
      const leadConversion = Number.isFinite(row.leadConversionPct) ? `${row.leadConversionPct.toFixed(1)}%` : "n/a";
      const selectedClass = roleDiffClass(row.selectedDiff);
      const avgClass = roleDiffClass(row.avgDiff);
      return `
        <tr>
          <td>${String(row.role || "flex").toUpperCase()}</td>
          <td class="${selectedClass}">${selectedDiff}</td>
          <td class="${avgClass}">${avgDiff}</td>
          <td>${leadConversion}</td>
          <td>${row.leftLeadMaps ?? 0}</td>
          <td>${row.rightLeadMaps ?? 0}</td>
          <td>${row.evenMaps ?? 0}</td>
          <td>${roleTrendSparkline(row.trend || [])}</td>
        </tr>
      `;
    })
    .join("");

  elements.roleDeltaWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table role-delta-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Selected Diff</th>
            <th>Avg Diff</th>
            <th>Lead Conversion</th>
            <th>${match.teams.left.name} Lead Maps</th>
            <th>${match.teams.right.name} Lead Maps</th>
            <th>Even Maps</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>${renderedRows}</tbody>
      </table>
    </div>
  `;
}

function kdaLabel(now) {
  return `${now.kills}/${now.deaths}/${now.assists}`;
}

function renderPlayerDeltaPanel(panel, match) {
  if (!panel || !Array.isArray(panel.players) || !panel.players.length) {
    elements.deltaWindowText.textContent =
      match.status === "live" ? "Collecting enough frames for deltas..." : "Recent deltas unavailable.";
    elements.playerDeltaWrap.innerHTML = `<div class="empty">No recent player deltas available.</div>`;
    return;
  }

  const windowSeconds = Number(panel.windowSeconds || 0);
  const windowLabel = windowSeconds < 60 ? `${windowSeconds}s` : shortDuration(windowSeconds);
  elements.deltaWindowText.textContent = `Last ${windowLabel} · Updated ${dateTimeLabel(panel.updatedAt)}`;

  const leftPlayers = panel.players.filter((player) => player.team === "left");
  const rightPlayers = panel.players.filter((player) => player.team === "right");

  const renderTeam = (title, rows) => `
    <section class="delta-team">
      <h3>${title}</h3>
      ${rows.length
        ? rows
            .map(
              (player) => `
                <article class="delta-player">
                  <p class="delta-name">${player.name}</p>
                  <p class="delta-sub">${String(player.role || "flex").toUpperCase()} · ${player.champion || "Unknown"}</p>
                  <p class="delta-now">Now: KDA ${kdaLabel(player.now)} · L${player.now.level} · CS ${player.now.cs}</p>
                  <p class="delta-now">Gold ${formatNumber(player.now.goldEarned)} · Items ${player.now.itemCount}</p>
                  <p class="delta-shift">
                    Δ K ${signed(player.delta.kills)} · D ${signed(player.delta.deaths)} · A ${signed(player.delta.assists)} ·
                    CS ${signed(player.delta.cs)} · Gold ${signed(player.delta.goldEarned)} · Lvl ${signed(player.delta.level)} · Items ${signed(player.delta.itemCount)}
                  </p>
                </article>
              `
            )
            .join("")
        : `<div class="empty">No player deltas.</div>`}
    </section>
  `;

  elements.playerDeltaWrap.innerHTML = `
    ${renderTeam(match.teams.left.name, leftPlayers)}
    ${renderTeam(match.teams.right.name, rightPlayers)}
  `;
}

function renderMoments(rows) {
  if (!rows.length) {
    elements.momentsList.innerHTML = "<li>No key moments yet.</li>";
    return;
  }

  elements.momentsList.innerHTML = rows
    .map(
      (moment) => `
      <li>
        <div class="moment-head">
          <strong>${moment.title}</strong>
          <span class="importance">${moment.importance}</span>
        </div>
        <p class="meta-text">${moment.summary}</p>
        <p class="meta-text">${dateTimeLabel(moment.occurredAt)}</p>
      </li>
    `
    )
    .join("");
}

function renderSeriesMoments(rows) {
  if (!rows.length) {
    elements.seriesMomentsList.innerHTML = "<li>No series-wide moments yet.</li>";
    return;
  }

  elements.seriesMomentsList.innerHTML = rows
    .map(
      (moment) => `
      <li>
        <div class="moment-head">
          <strong>${moment.gameNumber ? `Game ${moment.gameNumber} · ` : ""}${moment.title}</strong>
          <span class="importance">${moment.importance || "info"}</span>
        </div>
        <p class="meta-text">${moment.summary || "Series moment."}</p>
        <p class="meta-text">${dateTimeLabel(moment.occurredAt)}</p>
      </li>
    `
    )
    .join("");
}

function renderTimeline(rows) {
  if (!rows.length) {
    elements.timelineList.innerHTML = "<li>No timeline events yet.</li>";
    return;
  }

  elements.timelineList.innerHTML = rows
    .map((row) => {
      const label = row.watchUrl
        ? `<a class="table-link" href="${row.watchUrl}" target="_blank" rel="noreferrer">${row.label}</a>`
        : row.label;
      return `<li><span>${dateTimeLabel(row.at)}</span><span>${label}</span></li>`;
    })
    .join("");
}

function applyNavigationLinks(_apiBase) {
  const backUrl = new URL("./index.html", window.location.href);
  const matchGame = normalizeSeoGameKey(uiState.match?.game);
  if (matchGame) {
    backUrl.searchParams.set("title", matchGame);
  }
  elements.backLink.href = backUrl.toString();

  const scheduleUrl = new URL("./schedule.html", window.location.href);
  if (matchGame) {
    scheduleUrl.searchParams.set("title", matchGame);
  }

  const followsUrl = new URL("./follows.html", window.location.href);
  const lolHubUrl = new URL("./lol.html", window.location.href);
  const dotaHubUrl = new URL("./dota2.html", window.location.href);

  if (elements.liveDeskNav) elements.liveDeskNav.href = backUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = backUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolHubUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaHubUrl.toString();
}

async function fetchMatchSnapshot({ matchId, requestedGameNumber, apiBase }) {
  const detailUrl = new URL(`/v1/matches/${encodeURIComponent(matchId)}`, apiBase);
  if (Number.isInteger(requestedGameNumber)) {
    detailUrl.searchParams.set("game", String(requestedGameNumber));
  }

  const response = await fetch(detailUrl.toString());
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "API request failed.");
  }

  return payload.data;
}

function renderMatchPayload(match, apiBase, source = "polling") {
  applyMobileSectionHeadings();

  if (uiState.match?.id && uiState.match.id !== match.id) {
    uiState.leadTrendScaleByContext = {};
    uiState.mapPulseByContext = {};
  }

  uiState.match = match;
  uiState.stream.lastSnapshotAt = Date.now();
  const focus = resolveMatchFocus(match);
  uiState.viewMode = focus.viewMode;
  uiState.activeGameNumber = focus.activeGameNumber;

  if (source === "sse") {
    uiState.stream.source = "sse";
    uiState.stream.connected = true;
  } else if (!uiState.stream.eventSource) {
    uiState.stream.source = "polling";
    uiState.stream.connected = false;
  }

  const focusedLabel = Number.isInteger(uiState.activeGameNumber) && uiState.viewMode === "game"
    ? ` · ${isCompactUI() ? `G${uiState.activeGameNumber}` : `Game ${uiState.activeGameNumber}`}`
    : "";
  elements.matchTitle.textContent = `${displayTeamName(match.teams.left.name)} vs ${displayTeamName(match.teams.right.name)} · ${match.tournament}${focusedLabel}`;
  elements.freshnessText.textContent = isCompactUI()
    ? `${String(match.freshness.source || "polling").toUpperCase()} · ${String(match.freshness.status || "syncing").toUpperCase()} · ${dateTimeCompact(match.freshness.updatedAt)}`
    : `Source: ${match.freshness.source} · ${match.freshness.status} · Updated ${dateTimeLabel(match.freshness.updatedAt)}`;
  applyNavigationLinks(apiBase);
  refreshMatchSeo(match);

  renderScoreboard(match);
  renderStreamStatus(match);
  renderSeriesHeader(match);
  renderGameExplorer(match, apiBase);
  renderStatusSummary(match);
  renderMatchupConsole(match);
  renderSeriesLineups(match);
  ensureMatchupData(match, apiBase);
  renderUpcomingEssentials(match);
  renderUpcomingWatchGuide(match);
  renderUpcomingForm(match);
  renderUpcomingHeadToHead(match);
  renderUpcomingPrediction(match);
  renderGameCommandCenter(match);
  renderTeamComparison(match);
  renderPlayerTracker(match);
  renderUnifiedLiveFeed(match);
  renderLiveAlerts(match);
  renderDataConfidence(match);
  renderPulseCard(match);
  renderEdgeMeter(match);
  renderTempoSnapshot(match);
  renderTacticalChecklist(match);
  renderStorylines(match);
  renderSeriesProgress(match);
  renderSeriesMoments(match.seriesMoments || []);
  renderLeadTrend(match);
  renderObjectiveControl(match);
  renderObjectiveBreakdown(match);
  renderDraftBoard(match);
  renderDraftDelta(match);
  renderEconomyBoard(match);
  renderLaneMatchups(match);
  renderRoleMatchupDeltas(match);
  renderObjectiveRuns(match);
  renderSeriesGames(match, apiBase);
  renderSeriesComparison(match, apiBase);
  renderSeriesPlayerTrends(match);
  renderSelectedGameRecap(match);
  renderPreMatchPlanner(match);
  renderTopPerformers(match);
  renderLiveTicker(match.liveTicker || [], match.status);
  renderCombatBursts(match.combatBursts || [], match);
  renderGoldMilestones(match.goldMilestones || [], match);
  renderObjectiveTimeline(match.objectiveTimeline || [], match.status);
  renderObjectiveForecast(match);
  renderPlayerDeltaPanel(match.playerDeltaPanel, match);
  renderMoments(match.keyMoments || []);
  renderTimeline(match.timeline || []);
  applyGamePanelVisibility(match);
  applySeriesPanelVisibility();
  applyUpcomingPanelVisibility(match);
  applyMobileGameEnhancements(match);
  applyMatchMobilePanelCollapseState(match);

  if (uiState.stream.connected) {
    clearRefreshTimer();
  } else {
    scheduleRefresh(match.refreshAfterSeconds || DEFAULT_REFRESH_SECONDS);
  }
}

function startMatchStream({ matchId, requestedGameNumber, apiBase }) {
  if (typeof window.EventSource !== "function") {
    uiState.stream.source = "polling";
    uiState.stream.connected = false;
    renderStreamStatus(uiState.match);
    return false;
  }

  const key = streamKeyForMatch({
    matchId,
    apiBase,
    gameNumber: requestedGameNumber
  });
  if (uiState.stream.key === key && uiState.stream.eventSource) {
    return true;
  }

  closeMatchStream();
  uiState.stream.key = key;
  uiState.stream.source = "sse";
  uiState.stream.connected = false;
  renderStreamStatus(uiState.match);

  const streamUrl = new URL(`/v1/stream/matches/${encodeURIComponent(matchId)}`, apiBase);
  if (Number.isInteger(requestedGameNumber)) {
    streamUrl.searchParams.set("game", String(requestedGameNumber));
  }

  const source = new EventSource(streamUrl.toString());
  uiState.stream.eventSource = source;

  source.addEventListener("open", () => {
    if (uiState.stream.eventSource !== source) {
      return;
    }

    uiState.stream.connected = true;
    uiState.stream.reconnectAttempt = 0;
    uiState.stream.lastErrorAt = null;
    clearRefreshTimer();
    renderStreamStatus(uiState.match);
  });

  source.addEventListener("match", (event) => {
    if (uiState.stream.eventSource !== source) {
      return;
    }

    try {
      const payload = JSON.parse(event.data);
      if (payload?.data) {
        renderMatchPayload(payload.data, apiBase, "sse");
      }
    } catch {
      // Ignore malformed stream packet and wait for next event.
    }
  });

  source.addEventListener("notice", (event) => {
    if (uiState.stream.eventSource !== source) {
      return;
    }

    try {
      const payload = JSON.parse(event.data);
      if (payload?.code === "not_found") {
        elements.matchTitle.textContent = `Error loading match: ${payload.message}`;
      }
    } catch {
      // Keep stream alive even if notice payload parse fails.
    }
  });

  source.onerror = () => {
    if (uiState.stream.eventSource !== source) {
      return;
    }

    source.close();
    uiState.stream.eventSource = null;
    uiState.stream.connected = false;
    uiState.stream.lastErrorAt = Date.now();
    uiState.stream.reconnectAttempt += 1;
    renderStreamStatus(uiState.match);

    scheduleRefresh(8);
    if (!uiState.stream.reconnectTimer) {
      const delayMs = Math.min(12000, 3000 + uiState.stream.reconnectAttempt * 1000);
      uiState.stream.reconnectTimer = setTimeout(() => {
        uiState.stream.reconnectTimer = null;
        startMatchStream({ matchId, requestedGameNumber, apiBase });
      }, delayMs);
    }
  };

  return true;
}

async function loadMatch() {
  const url = new URL(window.location.href);
  const route = parseMatchRoute(url.toString());
  const matchId = route.id;
  const requestedGameNumber = Number.isInteger(route.gameNumber)
    ? route.gameNumber
    : parseRequestedGameNumber(url.searchParams.get("game"));
  const requestedH2hLimit = normalizeMatchupLimit(url.searchParams.get("h2h_limit"));
  const apiBase = normalizeApiBase(url.searchParams.get("api") || localStorage.getItem("pulseboard.apiBase") || DEFAULT_API_BASE);
  const streamEnabled = url.searchParams.get("stream") !== "0";

  uiState.requestedGameNumber = requestedGameNumber;
  uiState.requestedGameFallback = null;

  if (requestedH2hLimit !== uiState.matchupH2hLimit) {
    uiState.matchupH2hLimit = requestedH2hLimit;
    resetMatchupState();
  }

  uiState.apiBase = apiBase;
  localStorage.setItem("pulseboard.apiBase", apiBase);
  if (elements.matchupH2hLimit) {
    elements.matchupH2hLimit.value = String(uiState.matchupH2hLimit);
  }
  bindFeedControls();
  applyNavigationLinks(apiBase);
  refreshMatchSeo(null);

  if (!matchId) {
    closeMatchStream();
    uiState.stream.source = "polling";
    uiState.stream.connected = false;
    uiState.viewMode = "series";
    uiState.activeGameNumber = null;
    resetMatchupState();
    elements.matchTitle.textContent = "Missing match id. Use /match/<match-id> or ?id=<match-id>.";
    refreshMatchSeo(null);
    renderStreamStatus(null);
    renderMatchupConsole(null);
    scheduleRefresh(DEFAULT_REFRESH_SECONDS);
    return;
  }

  try {
    let effectiveRequestedGameNumber = requestedGameNumber;
    let match = null;
    try {
      match = await fetchMatchSnapshot({
        matchId,
        requestedGameNumber,
        apiBase
      });
    } catch (primaryError) {
      if (!Number.isInteger(requestedGameNumber)) {
        throw primaryError;
      }

      match = await fetchMatchSnapshot({
        matchId,
        requestedGameNumber: null,
        apiBase
      });
      effectiveRequestedGameNumber = null;
      uiState.requestedGameFallback = requestedGameNumber;
    }

    uiState.requestedGameNumber = effectiveRequestedGameNumber;
    renderMatchPayload(match, apiBase, "polling");

    if (streamEnabled) {
      startMatchStream({
        matchId,
        requestedGameNumber: effectiveRequestedGameNumber,
        apiBase
      });
    } else {
      closeMatchStream();
      uiState.stream.source = "polling";
      uiState.stream.connected = false;
      uiState.stream.key = null;
      renderStreamStatus(match);
    }
  } catch (error) {
    uiState.match = null;
    uiState.stream.lastErrorAt = Date.now();
    uiState.viewMode = "series";
    uiState.activeGameNumber = null;
    resetMatchupState();
    elements.matchTitle.textContent = `Error loading match: ${error.message}`;
    refreshMatchSeo(null);
    renderStreamStatus(null);
    renderMatchupConsole(null);
    scheduleRefresh(DEFAULT_REFRESH_SECONDS);
  }
}

window.addEventListener("beforeunload", () => {
  closeMatchStream();
  clearRespawnTicker();
});

window.addEventListener("resize", () => {
  applyMobileSectionHeadings();
  if (uiState.match) {
    applyMobileGameEnhancements(uiState.match);
    applyMatchMobilePanelCollapseState(uiState.match);
  } else {
    applyMatchMobilePanelCollapseState(null);
  }
});

applyMobileSectionHeadings();
bindMatchMobilePanelControls();
applyMatchMobilePanelCollapseState(null);
loadMatch();
