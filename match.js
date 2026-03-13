import { resolveInitialApiBase } from "./api-config.js";
import { applyRouteContext, buildMatchUrl, buildTeamUrl, parseMatchRoute } from "./routes.js?v=20260309c";
import { buildRowDataProvenance, buildRowQualityNotice } from "./data-provenance.js?v=20260310a";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  gameLabel,
  inferRobotsDirective,
  normalizeGameKey as normalizeSeoGameKey,
  setJsonLd,
  toAbsoluteSiteUrl
} from "./seo.js";
import { DOTA_HERO_MANIFEST, resolveLocalDotaHeroMeta } from "./dota-heroes.js";
import { resolveLocalTeamCode, resolveLocalTeamLogo, resolveLocalTeamMeta } from "./team-logos.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_REFRESH_SECONDS = 15;
const DEFAULT_API_TIMEOUT_MS = 8000;
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
  { id: "gameOverviewDeskWrap", label: "Overview" },
  { id: "gameCommandWrap", label: "Desk" },
  { id: "playerTrackerWrap", label: "Players" },
  { id: "liveFeedList", label: "Feed" },
  { id: "teamCompareWrap", label: "Stats" }
];
const MOBILE_SERIES_JUMP_TARGETS = [
  { id: "seriesOverviewWrap", label: "Overview" },
  { id: "gameContextWrap", label: "Games" },
  { id: "matchupConsoleWrap", label: "Stats" },
  { id: "seriesLineupsWrap", label: "Lineups" },
  { id: "upcomingFormWrap", label: "Past" }
];
const MOBILE_LIVE_SERIES_JUMP_TARGETS = [
  { id: "seriesOverviewWrap", label: "Overview" },
  { id: "gameContextWrap", label: "Games" },
  { id: "matchupConsoleWrap", label: "Stats" },
  { id: "seriesLineupsWrap", label: "Lineups" },
  { id: "upcomingFormWrap", label: "Past" }
];
const MOBILE_COMPLETED_SERIES_JUMP_TARGETS = [
  { id: "seriesOverviewWrap", label: "Overview" },
  { id: "gameContextWrap", label: "Games" },
  { id: "matchupConsoleWrap", label: "Stats" },
  { id: "seriesLineupsWrap", label: "Lineups" },
  { id: "upcomingFormWrap", label: "Past" }
];
const MOBILE_UPCOMING_JUMP_TARGETS = [
  { id: "gameContextWrap", label: "Overview" },
  { id: "upcomingWatchWrap", label: "Watch" },
  { id: "upcomingPredictionWrap", label: "Predict" },
  { id: "matchupConsoleWrap", label: "Stats" },
  { id: "seriesLineupsWrap", label: "Lineups" },
  { id: "upcomingFormWrap", label: "Past" }
];
const MOBILE_CORE_GAME_PANEL_TARGETS_BY_STATE = {
  inProgress: [
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "playerTrackerWrap",
    "liveFeedList",
    "teamCompareWrap",
    "pulseCard"
  ],
  completed: [
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "playerTrackerWrap",
    "liveFeedList",
    "teamCompareWrap"
  ],
  unstarted: ["selectedGameRecapWrap", "gameCommandWrap"],
  unneeded: ["selectedGameRecapWrap", "gameCommandWrap"]
};
const MOBILE_SECTION_HEADINGS = {
  "Series Command": { icon: "ST", short: "State" },
  "Series Read": { icon: "SR", short: "Series" },
  "Games": { icon: "GX", short: "Games" },
  "Current State": { icon: "ST", short: "State" },
  "Series Overview": { icon: "SR", short: "Series" },
  "Game Explorer": { icon: "GX", short: "Games" },
  "Match Snapshot": { icon: "SN", short: "Snapshot" },
  "Statistics": { icon: "ST", short: "Stats" },
  "Lineups": { icon: "LU", short: "Lineups" },
  "Progress": { icon: "PG", short: "Progress" },
  "Highlights": { icon: "HL", short: "Highlights" },
  "Overview": { icon: "UP", short: "Overview" },
  "Watch": { icon: "TV", short: "Watch" },
  "Recent Form": { icon: "FM", short: "Form" },
  "Past Matches": { icon: "FM", short: "Past" },
  "Head-to-Head": { icon: "H2H", short: "H2H" },
  "Prediction": { icon: "PR", short: "Prediction" },
  "Pre-Match Planner": { icon: "PM", short: "Planner" },
  "Series Story": { icon: "SR", short: "Story" },
  "Series Desk": { icon: "SD", short: "Desk" },
  "Desk Notes": { icon: "NT", short: "Notes" },
  "Game Overview": { icon: "RC", short: "Overview" },
  "Final Game": { icon: "RC", short: "Final" },
  "Live Snapshot": { icon: "CC", short: "Snapshot" },
  "Map Desk": { icon: "CC", short: "Desk" },
  "Map Command": { icon: "CC", short: "Snapshot" },
  "Game Command Center": { icon: "CC", short: "Snapshot" },
  "Team Stats": { icon: "TC", short: "Stats" },
  "Team Comparison": { icon: "TC", short: "Stats" },
  "Players": { icon: "PT", short: "Players" },
  "Player Board": { icon: "PT", short: "Players" },
  "Player Tracker": { icon: "PT", short: "Players" },
  "Player Box Score": { icon: "PT", short: "Players" },
  "Map Overview": { icon: "RC", short: "Overview" },
  "Final Map": { icon: "RC", short: "Overview" },
  "Live Feed": { icon: "FE", short: "Live Feed" },
  "Map Feed": { icon: "FE", short: "Feed" },
  "Game Story": { icon: "GS", short: "Story" },
  "Lead Trend": { icon: "LD", short: "Lead Trend" },
  "Key Story": { icon: "NOW", short: "Story" },
  "What Matters Now": { icon: "NOW", short: "Story" },
  "Alerts": { icon: "AL", short: "Alerts" },
  "Risk Watch": { icon: "AL", short: "Alerts" },
  "Live Alerts": { icon: "AL", short: "Alerts" },
  "Map Alerts": { icon: "AL", short: "Alerts" },
  "Signal Log": { icon: "SG", short: "Signals" },
  "Signals": { icon: "SG", short: "Signals" },
  "Economy Milestones": { icon: "EC", short: "Economy" },
  "Objective Control": { icon: "OBJ", short: "Objective" },
  "Coverage": { icon: "CF", short: "Coverage" },
  "Analysis": { icon: "AD", short: "Analysis" },
  "Analyst Desk": { icon: "AD", short: "Analysis" },
  "Pace": { icon: "PC", short: "Pace" },
  "Keys to Win": { icon: "KW", short: "Keys" },
  "Economy": { icon: "EC", short: "Economy" },
  "Game Results": { icon: "SG", short: "Games" },
  "Results Table": { icon: "SC", short: "Results" },
  "Player Trends": { icon: "TR", short: "Trends" },
  "Selected Game Recap": { icon: "RC", short: "Overview" },
  "Final Recap": { icon: "RC", short: "Overview" },
  "Closing Stats": { icon: "ST", short: "Stats" },
  "Performance Leaders": { icon: "PL", short: "Leaders" },
  "Objective Forecast": { icon: "OF", short: "Forecast" },
  "Objective Breakdown": { icon: "OB", short: "Breakdown" },
  "Objective Runs": { icon: "OR", short: "Runs" },
  "Draft Board": { icon: "DB", short: "Draft" },
  "Draft Delta": { icon: "DD", short: "Draft" },
  "Lane Matchups": { icon: "LN", short: "Lanes" },
  "Role Delta": { icon: "RD", short: "Roles" },
  "Role Matchup Deltas": { icon: "RD", short: "Roles" },
  "Key Moments": { icon: "KM", short: "Moments" },
  "Player Delta": { icon: "PD", short: "Delta" },
  "Player Delta Panel": { icon: "PD", short: "Delta" },
  "Timeline": { icon: "TL", short: "Timeline" }
};
const MOBILE_MATCH_PANELS_ALWAYS_OPEN = new Set(["Series Command", "Current State"]);
const MOBILE_MATCH_PANELS_DEFAULT_OPEN = {
  seriesLive: new Set(["Overview", "Games", "Game Results", "Statistics"]),
  seriesCompleted: new Set(["Overview", "Games", "Game Results", "Statistics"]),
  series: new Set(["Overview", "Games", "Statistics"]),
  upcoming: new Set(["Overview", "Games", "Watch", "Prediction"]),
  game: new Set(["Games", "Game Overview", "Final Game", "Map Overview", "Final Map", "Selected Game Recap", "Map Desk", "Live Snapshot", "Players", "Live Feed", "Map Feed"])
};
const MOBILE_PANEL_ORDER_BY_MODE = {
  seriesLive: [
    "seriesOverviewWrap",
    "gameExplorerPanel",
    "seriesGamesWrap",
    "matchupConsoleWrap",
    "seriesLineupsWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap",
    "seriesCompareWrap",
    "seriesProgressWrap",
    "seriesMomentsList",
    "seriesPlayerTrendsWrap"
  ],
  seriesCompleted: [
    "seriesOverviewWrap",
    "gameExplorerPanel",
    "seriesGamesWrap",
    "matchupConsoleWrap",
    "seriesLineupsWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap",
    "seriesCompareWrap",
    "seriesPlayerTrendsWrap",
    "seriesMomentsList"
  ],
  series: [
    "seriesOverviewWrap",
    "gameExplorerPanel",
    "matchupConsoleWrap",
    "seriesLineupsWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap",
    "seriesGamesWrap",
    "seriesProgressWrap"
  ],
  upcoming: [
    "seriesOverviewWrap",
    "gameExplorerPanel",
    "upcomingEssentialsWrap",
    "upcomingWatchWrap",
    "upcomingPredictionWrap",
    "preMatchPlanner",
    "matchupConsoleWrap",
    "seriesLineupsWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap"
  ],
  gameLive: [
    "gameExplorerPanel",
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "playerTrackerWrap",
    "liveFeedList",
    "teamCompareWrap",
    "pulseCard",
    "liveAlertsList",
    "matchupConsoleWrap",
    "seriesGamesWrap",
    "seriesProgressWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap"
  ],
  gameCompleted: [
    "gameExplorerPanel",
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "teamCompareWrap",
    "playerTrackerWrap",
    "pulseCard",
    "seriesGamesWrap",
    "seriesCompareWrap",
    "matchupConsoleWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap"
  ],
  gameUpcoming: [
    "gameExplorerPanel",
    "selectedGameRecapWrap",
    "gameCommandWrap",
    "matchupConsoleWrap",
    "seriesLineupsWrap",
    "upcomingFormWrap",
    "upcomingH2hWrap"
  ]
};
const MATCH_PANEL_GROUP_BY_TARGET_ID = {
  gameExplorerPanel: "rail",
  seriesOverviewWrap: "overview",
  seriesHeaderWrap: "overview",
  statusSummary: "overview",
  upcomingEssentialsWrap: "overview",
  upcomingWatchWrap: "overview",
  upcomingPredictionWrap: "overview",
  preMatchPlanner: "overview",
  seriesProgressWrap: "games",
  selectedGameRecapWrap: "overview",
  gameCommandWrap: "overview",
  teamCompareWrap: "stats",
  pulseCard: "overview",
  seriesLineupsWrap: "lineups",
  draftBoardWrap: "lineups",
  playerTrackerPanel: "players",
  playerTrackerWrap: "players",
  performersWrap: "players",
  playerDeltaWrap: "players",
  matchupConsoleWrap: "stats",
  dataConfidenceWrap: "stats",
  edgeMeterWrap: "stats",
  tempoSnapshotWrap: "stats",
  tacticalChecklistWrap: "stats",
  objectiveControlWrap: "stats",
  objectiveBreakdownWrap: "stats",
  draftDeltaWrap: "stats",
  economyBoardWrap: "stats",
  laneMatchupsWrap: "stats",
  roleDeltaWrap: "stats",
  objectiveRunsWrap: "stats",
  seriesGamesWrap: "games",
  seriesCompareWrap: "games",
  seriesMomentsList: "games",
  liveFeedPanel: "feed",
  liveAlertsList: "feed",
  storylinesList: "feed",
  liveTickerList: "feed",
  objectiveTimelineList: "timeline",
  objectiveForecastWrap: "timeline",
  combatBurstsList: "timeline",
  goldMilestonesList: "timeline",
  momentsList: "timeline",
  timelineList: "games",
  upcomingFormWrap: "history",
  upcomingH2hWrap: "history",
  seriesPlayerTrendsWrap: "stats"
};
const MATCH_PAGE_LAYOUTS = {
  upcoming: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "lineups", label: "Lineups", groups: ["lineups"] },
      { id: "stats", label: "Statistics", groups: ["stats"] },
      { id: "history", label: "History", groups: ["history"] }
    ]
  },
  series: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "lineups", label: "Lineups", groups: ["lineups"] },
      { id: "stats", label: "Statistics", groups: ["stats"] },
      { id: "games", label: "Games", groups: ["games"] },
      { id: "history", label: "History", groups: ["history"] }
    ]
  },
  seriesLive: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "lineups", label: "Lineups", groups: ["lineups"] },
      { id: "stats", label: "Statistics", groups: ["stats"] },
      { id: "games", label: "Games", groups: ["games"] },
      { id: "history", label: "History", groups: ["history"] }
    ]
  },
  seriesCompleted: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "lineups", label: "Lineups", groups: ["lineups"] },
      { id: "stats", label: "Statistics", groups: ["stats"] },
      { id: "games", label: "Games", groups: ["games"] },
      { id: "history", label: "History", groups: ["history"] }
    ]
  },
  gameLive: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "players", label: "Players", groups: ["players"] },
      { id: "feed", label: "Feed", groups: ["feed"] },
      { id: "stats", label: "Stats", groups: ["stats"] },
      { id: "timeline", label: "Timeline", groups: ["timeline"] }
    ]
  },
  gameCompleted: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "players", label: "Players", groups: ["players"] },
      { id: "feed", label: "Feed", groups: ["feed"] },
      { id: "stats", label: "Stats", groups: ["stats"] },
      { id: "timeline", label: "Timeline", groups: ["timeline"] }
    ]
  },
  gameUpcoming: {
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", groups: ["overview"] },
      { id: "lineups", label: "Lineups", groups: ["lineups"] },
      { id: "stats", label: "Stats", groups: ["stats"] },
      { id: "history", label: "History", groups: ["history"] }
    ]
  }
};
const LOL_CDN_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const LOL_CDN_CHAMPION_DATA = "https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json";
const LOL_CDN_CHAMPION_ICON = "https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png";
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
  matchHeroKicker: document.querySelector("#matchHeroKicker"),
  matchHeroMeta: document.querySelector("#matchHeroMeta"),
  matchHeroChips: document.querySelector("#matchHeroChips"),
  matchHeroFocus: document.querySelector("#matchHeroFocus"),
  matchHeroCopy: document.querySelector("#matchHeroCopy"),
  brandHomeLink: document.querySelector("#brandHomeLink"),
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
  matchDetailRail: document.querySelector("#matchDetailRail"),
  matchDetailContent: document.querySelector("#matchDetailContent"),
  matchTopTabs: document.querySelector("#matchTopTabs"),
  matchContentGroups: document.querySelector("#matchContentGroups"),
  seriesOverviewWrap: document.querySelector("#seriesOverviewWrap"),
  seriesStatsSummaryWrap: document.querySelector("#seriesStatsSummaryWrap"),
  seriesHeaderSubhead: document.querySelector("#seriesHeaderSubhead"),
  seriesHeaderWrap: document.querySelector("#seriesHeaderWrap"),
  gameNavWrap: document.querySelector("#gameNavWrap"),
  gameContextWrap: document.querySelector("#gameContextWrap"),
  matchQuickNav: document.querySelector("#matchQuickNav"),
  mobileModeToolbar: document.querySelector("#mobileModeToolbar"),
  mobileGameToolbar: document.querySelector("#mobileGameToolbar"),
  gameOverviewDeskWrap: document.querySelector("#gameOverviewDeskWrap"),
  gameCommandWrap: document.querySelector("#gameCommandWrap"),
  gamePlayerSummaryWrap: document.querySelector("#gamePlayerSummaryWrap"),
  gameFeedDeskWrap: document.querySelector("#gameFeedDeskWrap"),
  teamCompareWrap: document.querySelector("#teamCompareWrap"),
  playerTrackerWrap: document.querySelector("#playerTrackerWrap"),
  trackerSort: document.querySelector("#trackerSort"),
  trackerSortButtons: Array.from(document.querySelectorAll("#trackerSortButtons [data-sort]")),
  liveSummaryWrap: document.querySelector("#liveSummaryWrap"),
  liveFeedPanel: document.querySelector("#liveFeedPanel"),
  feedAlertsCluster: document.querySelector("#feedAlertsCluster"),
  feedTickerCluster: document.querySelector("#feedTickerCluster"),
  feedStoryCluster: document.querySelector("#feedStoryCluster"),
  liveAlertsDeskWrap: document.querySelector("#liveAlertsDeskWrap"),
  feedControlsToggle: document.querySelector("#feedControlsToggle"),
  feedControlsWrap: document.querySelector("#feedControlsWrap"),
  feedResetFilter: document.querySelector("#feedResetFilter"),
  liveFeedList: document.querySelector("#liveFeedList"),
  combatBurstsList: document.querySelector("#combatBurstsList"),
  goldMilestonesList: document.querySelector("#goldMilestonesList"),
  liveAlertsList: document.querySelector("#liveAlertsList"),
  gameObjectiveTimelinePanel: document.querySelector("#gameObjectiveTimelinePanel"),
  objectiveTimelineDeskWrap: document.querySelector("#objectiveTimelineDeskWrap"),
  timelineSignalsCluster: document.querySelector("#timelineSignalsCluster"),
  timelineMilestonesCluster: document.querySelector("#timelineMilestonesCluster"),
  timelineForecastCluster: document.querySelector("#timelineForecastCluster"),
  timelineMomentsCluster: document.querySelector("#timelineMomentsCluster"),
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
  seriesGamesSummaryWrap: document.querySelector("#seriesGamesSummaryWrap"),
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
  matchContentGroupWrappers: Array.from(document.querySelectorAll(".match-content-group")),
  gamePanels: Array.from(document.querySelectorAll("section[data-scope=\"game\"]")),
  upcomingPanels: Array.from(document.querySelectorAll("section[data-scope=\"upcoming\"]")),
  seriesPanels: Array.from(document.querySelectorAll("section[data-scope=\"series\"]"))
};

let refreshTimer = null;
let respawnTicker = null;
const uiState = {
  match: null,
  apiBase: DEFAULT_API_BASE,
  activeLoadRequestId: 0,
  requestedGameNumber: null,
  requestedGameFallback: null,
  activeGameNumber: null,
  viewMode: "series",
  feedControlsExpanded: false,
  feedType: "all",
  feedTeam: "all",
  feedImportance: "all",
  feedWindowMinutes: null,
  trackerSort: "role",
  matchupH2hLimit: 5,
  activeLayoutTabByMode: {},
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
  mobileAdvancedExpandedGame: false,
  mobileAdvancedExpandedSeries: false,
  mobilePanelCollapsedByKey: {},
  mobilePanelControlsBound: false,
  controlsBound: false,
  leadTrendScaleByContext: {},
  mapPulseByContext: {},
  storyFocusEventId: null,
  storyFocusUserSet: false,
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
  const legacyExpanded = localStorage.getItem("pulseboard.mobileAdvancedExpanded") === "1";
  uiState.mobileAdvancedExpandedGame = localStorage.getItem("pulseboard.mobileAdvancedExpanded.game") === "1" || legacyExpanded;
  uiState.mobileAdvancedExpandedSeries = localStorage.getItem("pulseboard.mobileAdvancedExpanded.series") === "1";
} catch {
  uiState.mobileAdvancedExpandedGame = false;
  uiState.mobileAdvancedExpandedSeries = false;
}

try {
  uiState.feedControlsExpanded = localStorage.getItem("pulseboard.feedControlsExpanded") === "1";
} catch {
  uiState.feedControlsExpanded = false;
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

function mobileAdvancedMode() {
  return uiState.viewMode === "game" ? "game" : "series";
}

function mobileAdvancedExpanded(mode = mobileAdvancedMode()) {
  return mode === "game" ? uiState.mobileAdvancedExpandedGame : uiState.mobileAdvancedExpandedSeries;
}

function setMobileAdvancedExpanded(expanded, mode = mobileAdvancedMode()) {
  const safeExpanded = Boolean(expanded);
  if (mode === "game") {
    uiState.mobileAdvancedExpandedGame = safeExpanded;
  } else {
    uiState.mobileAdvancedExpandedSeries = safeExpanded;
  }

  try {
    localStorage.setItem(`pulseboard.mobileAdvancedExpanded.${mode}`, safeExpanded ? "1" : "0");
  } catch {
    // Ignore storage failures and keep current in-memory preference.
  }
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

function persistFeedControlsExpanded() {
  try {
    localStorage.setItem("pulseboard.feedControlsExpanded", uiState.feedControlsExpanded ? "1" : "0");
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

function shouldMatchPanelBeOpenByDefault(headingTitle, match) {
  if (MOBILE_MATCH_PANELS_ALWAYS_OPEN.has(headingTitle)) {
    return true;
  }

  const mode = uiState.viewMode === "game"
    ? "game"
    : match?.status === "upcoming"
      ? "upcoming"
      : match?.status === "completed"
        ? "seriesCompleted"
        : match?.status === "live"
          ? "seriesLive"
          : "series";
  return MOBILE_MATCH_PANELS_DEFAULT_OPEN[mode]?.has(headingTitle) || false;
}

function panelElementForPriorityTarget(targetId) {
  if (!targetId) {
    return null;
  }

  const target = document.getElementById(targetId);
  if (!target) {
    return null;
  }

  if (target.matches("section.panel")) {
    return target;
  }

  return target.closest("section.panel");
}

function mobilePanelPriorityMode(match) {
  if (uiState.viewMode === "game") {
    const selectedState = String(match?.selectedGame?.state || "inProgress");
    if (selectedState === "completed") {
      return "gameCompleted";
    }
    if (selectedState === "unstarted" || selectedState === "unneeded") {
      return "gameUpcoming";
    }
    return "gameLive";
  }

  if (match?.status === "upcoming") {
    return "upcoming";
  }

  if (match?.status === "completed") {
    return "seriesCompleted";
  }

  if (match?.status === "live") {
    return "seriesLive";
  }

  return "series";
}

function applyMobilePanelPriorities(match = uiState.match) {
  const panels = Array.from(document.querySelectorAll(".match-page main section.panel"));

  if (!isCompactUI() || !match) {
    panels.forEach((panel) => {
      panel.style.order = "";
      panel.classList.remove("mobile-priority-panel", "mobile-secondary-panel");
    });
    return;
  }

  const priorityMode = mobilePanelPriorityMode(match);
  const orderedTargets = MOBILE_PANEL_ORDER_BY_MODE[priorityMode] || [];
  const orderedPanels = [];

  for (const targetId of orderedTargets) {
    const panel = panelElementForPriorityTarget(targetId);
    if (panel && !orderedPanels.includes(panel)) {
      orderedPanels.push(panel);
    }
  }

  let nextOrder = 1;
  for (const panel of orderedPanels) {
    panel.style.order = String(nextOrder);
    panel.classList.toggle("mobile-priority-panel", nextOrder <= 4);
    panel.classList.toggle("mobile-secondary-panel", nextOrder > 4);
    nextOrder += 1;
  }

  for (const panel of panels) {
    if (orderedPanels.includes(panel)) {
      continue;
    }
    panel.style.order = String(nextOrder);
    panel.classList.remove("mobile-priority-panel");
    panel.classList.add("mobile-secondary-panel");
    nextOrder += 1;
  }
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
    if (!heading.dataset.fullTitle) {
      heading.dataset.fullTitle = headingTitle;
    }
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
    const hiddenAsAdvanced = panelElement.classList.contains("mobile-advanced-collapsed");
    const shouldHideControl = !compact || hiddenByScope || hiddenAsAdvanced;
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
      toggleButton.hidden = true;
      toggleButton.disabled = true;
      toggleButton.classList.remove("locked");
      toggleButton.removeAttribute("data-state");
      toggleButton.removeAttribute("aria-label");
      toggleButton.removeAttribute("title");
      return;
    }

    const hasSaved = Object.prototype.hasOwnProperty.call(uiState.mobilePanelCollapsedByKey, panelKey);
    const collapsed = hasSaved
      ? Boolean(uiState.mobilePanelCollapsedByKey[panelKey])
      : !shouldMatchPanelBeOpenByDefault(headingTitle, match);
    panelElement.classList.toggle("mobile-panel-collapsed", collapsed);
    toggleButton.innerHTML = `<span class="sr-only">${collapsed ? "Expand section" : "Collapse section"}</span>`;
    toggleButton.dataset.state = collapsed ? "collapsed" : "expanded";
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("aria-label", collapsed ? "Expand section" : "Collapse section");
    toggleButton.setAttribute("title", collapsed ? "Expand section" : "Collapse section");
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

    const toggleButton = target.closest(".panel-section-toggle");
    if (!toggleButton || toggleButton.disabled || !isCompactUI() || !toggleButton.closest(".match-page")) {
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
    const map = new Map();
    for (const [key, record] of Object.entries(DOTA_HERO_MANIFEST?.byName || {})) {
      const iconUrl = toAbsoluteAssetUrl(record?.iconUrl || record?.portraitUrl || "");
      if (iconUrl) {
        map.set(key, iconUrl);
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
          renderSelectedGameRecap(uiState.match);
          renderSeriesLineups(uiState.match);
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
        renderSelectedGameRecap(uiState.match);
        renderSeriesLineups(uiState.match);
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
  if (catalog.status === "ready") {
    return catalog.map.get(normalizeLookupKey(heroName)) || null;
  }

  const localMeta = resolveLocalDotaHeroMeta(heroName);
  return toAbsoluteAssetUrl(localMeta?.iconUrl || localMeta?.portraitUrl || "");
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

function teamNameValue(teamOrName) {
  if (teamOrName && typeof teamOrName === "object") {
    return String(teamOrName.name || "").trim();
  }
  return String(teamOrName || "").trim();
}

function shortTeamName(teamOrName, game = null) {
  const raw = teamNameValue(teamOrName);
  if (!raw) {
    return "TBD";
  }

  const providerCode = resolveLocalTeamCode({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: raw,
    code: teamOrName && typeof teamOrName === "object" ? teamOrName.code : null
  });
  if (providerCode && providerCode.length <= 6) {
    return providerCode;
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

function displayTeamName(teamOrName, game = null) {
  return isCompactUI() ? shortTeamName(teamOrName, game) : teamNameValue(teamOrName) || "Unknown";
}

function scoreboardTeamName(teamOrName, game = null) {
  const raw = teamNameValue(teamOrName);
  if (!raw) {
    return "TBD";
  }

  const providerCode = resolveLocalTeamCode({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: raw,
    code: teamOrName && typeof teamOrName === "object" ? teamOrName.code : null
  });
  if (providerCode && providerCode.length <= 6) {
    return providerCode;
  }

  return TEAM_HEADER_ABBREVIATIONS[normalizeTeamKey(raw)] || shortTeamName(raw);
}

function headerTeamCodeValue(teamOrName, game = null) {
  const displayName = displayTeamName(teamOrName, game);
  const scoreboardName = scoreboardTeamName(teamOrName, game);
  const normalizedDisplay = String(displayName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const normalizedScoreboard = String(scoreboardName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (!normalizedScoreboard || normalizedScoreboard === normalizedDisplay) {
    return "";
  }

  return scoreboardName;
}

function feedTypeSummaryLabel(value) {
  const normalized = String(value || "all").toLowerCase();
  if (normalized === "combat") return "Combat";
  if (normalized === "objective") return "Objective";
  if (normalized === "swing") return "Swing";
  if (normalized === "moment") return "Moment";
  return "All events";
}

function feedTeamSummaryLabel(match, value) {
  const normalized = String(value || "all").toLowerCase();
  if (normalized === "left") {
    return scoreboardTeamName(match?.teams?.left?.name || "Left");
  }
  if (normalized === "right") {
    return scoreboardTeamName(match?.teams?.right?.name || "Right");
  }
  return "Both teams";
}

function feedWindowSummaryLabel(value) {
  const minutes = Number(value);
  if (Number.isFinite(minutes) && minutes > 0) {
    return `${minutes}m window`;
  }
  return "All time";
}

function compactFeedControlsSummary(match = uiState.match) {
  const parts = [
    feedTypeSummaryLabel(uiState.feedType),
    feedTeamSummaryLabel(match, uiState.feedTeam),
    feedWindowSummaryLabel(uiState.feedWindowMinutes)
  ];
  if (uiState.feedImportance !== "all") {
    parts.push(`${String(uiState.feedImportance || "").toUpperCase()}+`);
  }
  return parts.filter(Boolean).join(" · ");
}

function renderFeedControlsChrome(match = uiState.match) {
  if (!elements.feedControlsWrap) {
    return;
  }

  const compact = isCompactUI();

  if (elements.feedTypeFilter) {
    elements.feedTypeFilter.value = uiState.feedType;
    elements.feedTypeFilter.title = feedTypeSummaryLabel(uiState.feedType);
  }

  if (elements.feedTeamFilter) {
    elements.feedTeamFilter.value = uiState.feedTeam;
    elements.feedTeamFilter.title = feedTeamSummaryLabel(match, uiState.feedTeam);
  }

  if (elements.feedImportanceFilter) {
    elements.feedImportanceFilter.value = uiState.feedImportance;
  }

  if (elements.feedWindowFilter) {
    elements.feedWindowFilter.value = uiState.feedWindowMinutes === null ? "all" : String(uiState.feedWindowMinutes);
    elements.feedWindowFilter.title = feedWindowSummaryLabel(uiState.feedWindowMinutes);
  }

  const hasActiveFilters =
    uiState.feedType !== "all" ||
    uiState.feedTeam !== "all" ||
    uiState.feedImportance !== "all" ||
    uiState.feedWindowMinutes !== null;
  elements.feedControlsWrap.dataset.active = hasActiveFilters ? "1" : "0";
  if (elements.feedResetFilter) {
    elements.feedResetFilter.hidden = !hasActiveFilters;
  }

  if (elements.feedControlsToggle) {
    elements.feedControlsToggle.hidden = !compact;
    elements.feedControlsToggle.setAttribute("aria-expanded", compact && uiState.feedControlsExpanded ? "true" : "false");
    elements.feedControlsToggle.innerHTML = `
      <span class="toggle-label">Feed filters</span>
      <span class="toggle-value">${escapeHtml(compactFeedControlsSummary(match))}</span>
    `;
  }

  elements.feedControlsWrap.hidden = compact && !uiState.feedControlsExpanded;
  elements.feedControlsWrap.dataset.compact = compact ? "1" : "0";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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
    elements.backLink.textContent = isCompactUI() ? "Live Desk" : "Back to Live Desk";
  }

  const headings = Array.from(document.querySelectorAll(".match-page .section-head h2, .match-page .match-subcluster-head h3"));
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

function setPanelHeadingTitleByTargetId(targetId, fullTitle) {
  const panel = panelForTargetId(targetId);
  const heading = panel?.querySelector(".section-head h2");
  if (!heading) {
    return;
  }

  heading.dataset.fullTitle = fullTitle;
}

function applyGameStateSectionTitles(match) {
  setPanelHeadingTitleByTargetId("leadTrendWrap", "Live Feed");
  setPanelHeadingTitleByTargetId("gameOverviewDeskWrap", "Game Overview");
  setPanelHeadingTitleByTargetId("playerTrackerWrap", "Players");
  setPanelHeadingTitleByTargetId("gameCommandWrap", "Map Desk");
  setPanelHeadingTitleByTargetId("teamCompareWrap", "Team Stats");
  setPanelHeadingTitleByTargetId("pulseCard", "Key Story");
  setPanelHeadingTitleByTargetId("objectiveTimelineList", "Timeline");
  setPanelHeadingTitleByTargetId("performersWrap", "Performance Leaders");
  setPanelHeadingTitleByTargetId("objectiveControlWrap", "Objective Control");
  setPanelHeadingTitleByTargetId("objectiveBreakdownWrap", "Objective Breakdown");
  setPanelHeadingTitleByTargetId("draftBoardWrap", "Draft Board");
  setPanelHeadingTitleByTargetId("draftDeltaWrap", "Draft Delta");
  setPanelHeadingTitleByTargetId("economyBoardWrap", "Economy");
  setPanelHeadingTitleByTargetId("laneMatchupsWrap", "Lane Matchups");
  setPanelHeadingTitleByTargetId("roleDeltaWrap", "Role Delta");
  setPanelHeadingTitleByTargetId("objectiveRunsWrap", "Objective Runs");
  setPanelHeadingTitleByTargetId("dataConfidenceWrap", "Coverage");
  setPanelHeadingTitleByTargetId("edgeMeterWrap", "Analysis");
  setPanelHeadingTitleByTargetId("tempoSnapshotWrap", "Pace");
  setPanelHeadingTitleByTargetId("tacticalChecklistWrap", "Keys to Win");
  setPanelHeadingTitleByTargetId("playerDeltaWrap", "Player Delta");

  if (uiState.viewMode !== "game") {
    applyMobileSectionHeadings();
    return;
  }

  const selectedState = String(match?.selectedGame?.state || "");
  if (selectedState === "completed") {
    setPanelHeadingTitleByTargetId("leadTrendWrap", "Map Feed");
    setPanelHeadingTitleByTargetId("gameOverviewDeskWrap", "Final Game");
  }

  applyMobileSectionHeadings();
}

function panelForTargetId(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return null;
  }

  return target.closest("section.panel");
}

function panelVisibleInCurrentLayout(panelElement) {
  if (!panelElement || panelElement.hidden || panelElement.classList.contains("hidden-panel")) {
    return false;
  }

  const groupWrapper = panelElement.closest(".match-content-group");
  if (groupWrapper?.hidden) {
    return false;
  }

  return true;
}

function matchLayoutMode(match = uiState.match) {
  if (uiState.viewMode === "game") {
    const selectedState = String(match?.selectedGame?.state || "inProgress");
    if (selectedState === "completed") return "gameCompleted";
    if (selectedState === "unstarted" || selectedState === "unneeded") return "gameUpcoming";
    return "gameLive";
  }

  if (match?.status === "upcoming") return "upcoming";
  if (match?.status === "completed") return "seriesCompleted";
  if (match?.status === "live") return "seriesLive";
  return "series";
}

function matchContentGroupMap() {
  const wrappers = Array.isArray(elements.matchContentGroupWrappers) ? elements.matchContentGroupWrappers : [];
  return new Map(
    wrappers
      .map((wrapper) => [String(wrapper?.dataset?.layoutGroup || "").trim(), wrapper])
      .filter(([groupId, wrapper]) => groupId && wrapper)
  );
}

function identifyPanelLayoutGroup(panelElement) {
  if (!panelElement) {
    return "overview";
  }

  const candidateIds = [];
  if (panelElement.id) {
    candidateIds.push(panelElement.id);
  }

  for (const node of panelElement.querySelectorAll("[id]")) {
    if (node.id) {
      candidateIds.push(node.id);
    }
  }

  for (const candidateId of candidateIds) {
    const mappedGroup = MATCH_PANEL_GROUP_BY_TARGET_ID[candidateId];
    if (mappedGroup) {
      return mappedGroup;
    }
  }

  const scope = String(panelElement.getAttribute("data-scope") || "").trim();
  if (scope === "game") {
    return "stats";
  }
  if (scope === "series") {
    return "history";
  }
  return "overview";
}

function initializeMatchLayoutShell() {
  if (!elements.matchDetailRail || !elements.matchContentGroups || elements.matchContentGroups.dataset.initialized === "1") {
    return;
  }

  const groupMap = matchContentGroupMap();
  const panels = Array.from(document.querySelectorAll(".match-page main > section.panel"));

  for (const panel of panels) {
    const groupId = identifyPanelLayoutGroup(panel);
    panel.dataset.layoutGroup = groupId;
    const destination =
      groupId === "rail"
        ? elements.matchDetailRail
        : groupMap.get(groupId) || groupMap.get("overview") || elements.matchDetailContent;
    destination?.appendChild(panel);
  }

  elements.matchContentGroups.dataset.initialized = "1";
}

function visiblePanelsInGroup(groupId) {
  const wrapper = matchContentGroupMap().get(groupId);
  if (!wrapper) {
    return [];
  }

  return Array.from(wrapper.querySelectorAll("section.panel")).filter(
    (panel) => !panel.classList.contains("hidden-panel")
  );
}

function visibleMatchLayoutTabs(match = uiState.match) {
  const mode = matchLayoutMode(match);
  const layout = MATCH_PAGE_LAYOUTS[mode] || MATCH_PAGE_LAYOUTS.series;
  const tabs = Array.isArray(layout.tabs) ? layout.tabs : [];
  const visibleTabs = tabs.filter((tab) => tab.groups.some((groupId) => visiblePanelsInGroup(groupId).length > 0));
  return { mode, layout, tabs: visibleTabs };
}

function activeMatchLayoutTab(match = uiState.match) {
  const { mode, layout, tabs } = visibleMatchLayoutTabs(match);
  const defaultTabId = layout?.defaultTab || tabs[0]?.id || "";
  const savedTabId = uiState.activeLayoutTabByMode[mode];
  const activeTab = tabs.find((tab) => tab.id === savedTabId) || tabs.find((tab) => tab.id === defaultTabId) || tabs[0] || null;
  return { mode, layout, tabs, activeTab };
}

function compactSeriesVisibleGroups(match = uiState.match) {
  const status = String(match?.status || "");
  const primaryGroups =
    status === "upcoming"
      ? ["overview", "stats"]
      : ["overview", "games", "stats"];
  const extraGroups = ["history", "lineups"];
  return new Set([
    ...primaryGroups,
    ...(mobileAdvancedExpanded("series") ? extraGroups : [])
  ]);
}

function renderMatchTopTabs(match) {
  if (!elements.matchTopTabs) {
    return;
  }

  if (!match || isCompactUI()) {
    elements.matchTopTabs.hidden = true;
    elements.matchTopTabs.innerHTML = "";
    return;
  }

  const { mode, tabs, activeTab } = activeMatchLayoutTab(match);
  if (!tabs.length || !activeTab) {
    elements.matchTopTabs.hidden = true;
    elements.matchTopTabs.innerHTML = "";
    return;
  }

  uiState.activeLayoutTabByMode[mode] = activeTab.id;
  elements.matchTopTabs.hidden = false;
  elements.matchTopTabs.innerHTML = tabs
    .map(
      (tab) => `
        <button
          type="button"
          class="match-top-tab${tab.id === activeTab.id ? " active" : ""}"
          data-layout-mode="${mode}"
          data-layout-tab="${tab.id}"
          aria-pressed="${tab.id === activeTab.id ? "true" : "false"}"
        >${tab.label}</button>
      `
    )
    .join("");
}

function applyMatchLayoutGroups(match = uiState.match) {
  const groupMap = matchContentGroupMap();
  if (!elements.matchDetailContent || !groupMap.size) {
    return;
  }

  if (!match) {
    elements.matchDetailContent.dataset.layoutMode = "";
    elements.matchDetailContent.dataset.activeTab = "";
    elements.matchDetailContent.hidden = false;
    if (elements.matchTopTabs) {
      elements.matchTopTabs.hidden = true;
      elements.matchTopTabs.innerHTML = "";
    }
    for (const wrapper of groupMap.values()) {
      wrapper.hidden = false;
    }
    if (elements.matchDetailRail) {
      elements.matchDetailRail.hidden = false;
    }
    return;
  }

  renderMatchTopTabs(match);
  const { mode, activeTab } = activeMatchLayoutTab(match);
  const activeGroups = new Set(activeTab?.groups || []);
  const compact = isCompactUI();
  const compactSeriesGroups = compact && uiState.viewMode !== "game" ? compactSeriesVisibleGroups(match) : null;

  elements.matchDetailContent.dataset.layoutMode = mode;
  elements.matchDetailContent.dataset.activeTab = compact ? "" : activeTab?.id || "";
  elements.matchDetailContent.dataset.layoutCompact = compact ? "true" : "false";

  for (const [groupId, wrapper] of groupMap.entries()) {
    const hasVisiblePanels = visiblePanelsInGroup(groupId).length > 0;
    if (compact) {
      wrapper.hidden = !hasVisiblePanels || (compactSeriesGroups ? !compactSeriesGroups.has(groupId) : false);
      continue;
    }
    wrapper.hidden = !activeGroups.has(groupId) || !hasVisiblePanels;
  }

  if (elements.matchDetailRail) {
    const hasRailPanels = Array.from(elements.matchDetailRail.querySelectorAll("section.panel")).some(
      (panel) => !panel.classList.contains("hidden-panel")
    );
    elements.matchDetailRail.hidden = !hasRailPanels;
  }
}

function bindMatchTopTabs() {
  if (!elements.matchTopTabs || elements.matchTopTabs.dataset.bound === "1") {
    return;
  }

  elements.matchTopTabs.dataset.bound = "1";
  elements.matchTopTabs.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-layout-tab]");
    if (!button) {
      return;
    }

    const mode = String(button.getAttribute("data-layout-mode") || "");
    const tabId = String(button.getAttribute("data-layout-tab") || "");
    if (!mode || !tabId) {
      return;
    }

    uiState.activeLayoutTabByMode[mode] = tabId;
    applyMatchLayoutGroups(uiState.match);
    renderMatchQuickNav(uiState.match);
  });
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

    const mode = mobileAdvancedMode();
    setMobileAdvancedExpanded(!mobileAdvancedExpanded(mode), mode);

    if (uiState.match) {
      applyMobileGameEnhancements(uiState.match);
    }
  });
}

function bindMatchQuickNav() {
  if (!elements.matchQuickNav || elements.matchQuickNav.dataset.bound === "1") {
    return;
  }

  elements.matchQuickNav.dataset.bound = "1";
  elements.matchQuickNav.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const jumpButton = target.closest("[data-jump-target]");
    if (!jumpButton) {
      return;
    }

    const jumpTarget = String(jumpButton.getAttribute("data-jump-target") || "").trim();
    if (!jumpTarget) {
      return;
    }

    for (const button of elements.matchQuickNav.querySelectorAll("[data-jump-target]")) {
      const active = button === jumpButton;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    scrollToTargetId(jumpTarget);
  });
}

function mobileJumpTargetsForCurrentMode(match) {
  if (uiState.viewMode === "game") {
    return MOBILE_GAME_JUMP_TARGETS;
  }

  if (match?.status === "upcoming") {
    return MOBILE_UPCOMING_JUMP_TARGETS;
  }

  if (match?.status === "completed") {
    return MOBILE_COMPLETED_SERIES_JUMP_TARGETS;
  }

  if (match?.status === "live") {
    return MOBILE_LIVE_SERIES_JUMP_TARGETS;
  }

  return MOBILE_SERIES_JUMP_TARGETS;
}

function renderMatchQuickNav(match) {
  if (!elements.matchQuickNav) {
    return;
  }

  elements.matchQuickNav.hidden = true;
  elements.matchQuickNav.innerHTML = "";
}

function renderMobileModeToolbar(match, { advancedVisibleCount = 0 } = {}) {
  if (!elements.mobileModeToolbar) {
    return;
  }

  if (!isCompactUI() || uiState.viewMode === "game") {
    elements.mobileModeToolbar.hidden = true;
    elements.mobileModeToolbar.innerHTML = "";
    return;
  }

  const seriesAdvancedExpanded = mobileAdvancedExpanded("series");
  const jumpButtons = mobileJumpTargetsForCurrentMode(match)
    .filter((item) => {
      const panel = panelForTargetId(item.id);
      return panelVisibleInCurrentLayout(panel);
    })
    .map((item) => `<button type="button" class="mobile-mode-chip" data-jump-target="${item.id}">${item.label}</button>`)
    .join("");

  const advancedButton =
    advancedVisibleCount > 0
      ? `<button type="button" class="mobile-advanced-toggle${seriesAdvancedExpanded ? " open" : ""}" data-advanced-toggle="1">${seriesAdvancedExpanded ? "Hide extras" : `More (${advancedVisibleCount})`}</button>`
      : "";

  if (!jumpButtons && !advancedButton) {
    elements.mobileModeToolbar.hidden = true;
    elements.mobileModeToolbar.innerHTML = "";
    return;
  }

  elements.mobileModeToolbar.hidden = false;
  elements.mobileModeToolbar.innerHTML = `
    ${jumpButtons ? `<div class="mobile-mode-row">${jumpButtons}</div>` : ""}
    ${advancedButton}
  `;
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

  const gameAdvancedExpanded = mobileAdvancedExpanded("game");
  const jumpButtons = MOBILE_GAME_JUMP_TARGETS
    .filter((item) => {
      const panel = panelForTargetId(item.id);
      return panelVisibleInCurrentLayout(panel);
    })
    .map((item) => `<button type="button" class="mobile-jump-chip" data-jump-target="${item.id}">${item.label}</button>`)
    .join("");

  const advancedButton =
    advancedVisibleCount > 0
      ? `<button type="button" class="mobile-advanced-toggle${gameAdvancedExpanded ? " open" : ""}" data-advanced-toggle="1">${gameAdvancedExpanded ? "Hide extras" : `More (${advancedVisibleCount})`}</button>`
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

function liveTelemetryStatus(match) {
  return String(match?.selectedGame?.telemetryStatus || match?.telemetryStatus || "none").toLowerCase();
}

function applyMobileGameEnhancements(match) {
  const selectedState = String(match?.selectedGame?.state || "");
  const compactGameMode = isCompactUI() && uiState.viewMode === "game";
  const compactSeriesMode = isCompactUI() && uiState.viewMode !== "game";
  const desktopGameMode = !isCompactUI() && uiState.viewMode === "game";
  const gameAdvancedExpanded = mobileAdvancedExpanded("game");
  const seriesAdvancedExpanded = mobileAdvancedExpanded("series");
  const telemetryStatus = liveTelemetryStatus(match);
  document.body.classList.toggle("mobile-game-mode", compactGameMode);
  document.body.classList.toggle("mobile-series-mode", compactSeriesMode);
  document.body.classList.toggle("mobile-game-live", compactGameMode && selectedState === "inProgress");
  document.body.classList.toggle("mobile-game-complete", compactGameMode && selectedState === "completed");
  document.body.classList.toggle(
    "mobile-game-upcoming",
    compactGameMode && (selectedState === "unstarted" || selectedState === "unneeded")
  );
  document.body.classList.toggle("desktop-game-mode", desktopGameMode);
  document.body.classList.toggle("desktop-game-live", desktopGameMode && selectedState === "inProgress");
  document.body.classList.toggle("desktop-game-complete", desktopGameMode && selectedState === "completed");
  document.body.classList.toggle(
    "desktop-game-upcoming",
    desktopGameMode && (selectedState === "unstarted" || selectedState === "unneeded")
  );
  document.body.classList.toggle(
    "desktop-game-live-rich",
    desktopGameMode && selectedState === "inProgress" && telemetryStatus === "rich"
  );
  bindMobileJumpContainer(elements.mobileGameToolbar, { allowAdvanced: true });
  bindMobileJumpContainer(elements.mobileModeToolbar, { allowAdvanced: true });

  const corePanels = new Set(
    mobileCorePanelTargetIds(match)
      .map((targetId) => panelForTargetId(targetId))
      .filter(Boolean)
  );

  let advancedVisibleCount = 0;
  for (const panel of elements.gamePanels) {
    if (compactSeriesMode) {
      panel.classList.remove("mobile-core-panel", "mobile-advanced-panel");
      panel.classList.add("mobile-advanced-collapsed");
      continue;
    }

    const isCore = corePanels.has(panel);
    panel.classList.toggle("mobile-core-panel", isCore);
    panel.classList.toggle("mobile-advanced-panel", !isCore);
    panel.classList.toggle("mobile-advanced-collapsed", compactGameMode && !gameAdvancedExpanded && !isCore);
    if (!isCore && !panel.classList.contains("hidden-panel")) {
      advancedVisibleCount += 1;
    }
  }

  renderMobileGameToolbar({
    compactGameMode,
    advancedVisibleCount
  });

  const seriesScopePanels = [...elements.seriesPanels, ...elements.upcomingPanels];
  const priorityMode = mobilePanelPriorityMode(match);
  const orderedTargets = MOBILE_PANEL_ORDER_BY_MODE[priorityMode] || [];
  const priorityPanels = [];
  for (const targetId of orderedTargets) {
    const panel = panelElementForPriorityTarget(targetId);
    if (panel && !priorityPanels.includes(panel)) {
      priorityPanels.push(panel);
    }
  }
  const keptSeriesPanels = new Set(priorityPanels.slice(0, 4));
  let seriesAdvancedVisibleCount = 0;
  for (const panel of seriesScopePanels) {
    const isAdvanced = compactSeriesMode && !keptSeriesPanels.has(panel);
    panel.classList.toggle("mobile-advanced-panel", isAdvanced);
    panel.classList.toggle("mobile-advanced-collapsed", isAdvanced && !seriesAdvancedExpanded);
    if (isAdvanced && !panel.classList.contains("hidden-panel")) {
      seriesAdvancedVisibleCount += 1;
    }
    if (!compactSeriesMode) {
      panel.classList.remove("mobile-advanced-panel", "mobile-advanced-collapsed");
    }
  }

  renderMobileModeToolbar(match, {
    advancedVisibleCount: compactSeriesMode ? seriesAdvancedVisibleCount : 0
  });
  renderMatchQuickNav(match);
  renderFeedControlsChrome(match);
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

function teamBadgeText(teamOrName, game = null) {
  const short = shortTeamName(teamOrName, game)
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

function teamLogoUrl(teamOrName, game = null) {
  const raw = teamNameValue(teamOrName);
  const localLogo = resolveLocalTeamLogo({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: raw
  });
  if (localLogo) {
    return localLogo;
  }

  if (!raw) {
    return null;
  }

  return TEAM_LOGO_BY_KEY[normalizeTeamKey(raw)] || null;
}

function teamLogoAssetMeta(teamOrName, game = null) {
  return resolveLocalTeamMeta({
    game,
    id: teamOrName && typeof teamOrName === "object" ? teamOrName.id : null,
    name: teamNameValue(teamOrName),
    code: teamOrName && typeof teamOrName === "object" ? teamOrName.code || teamOrName.tag : null
  });
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

function teamBadgeMarkup(teamOrName, game = null) {
  const meta = teamLogoAssetMeta(teamOrName, game);
  const assetType = String(meta?.assetType || "missing").trim().toLowerCase();
  const label = scoreboardTeamName(teamOrName, game);
  const title = `${label} · ${teamLogoAssetLabel(assetType)}`;
  const classes = ["team-badge", `asset-${assetType}`];
  const logo = teamLogoUrl(teamOrName, game);
  if (logo) {
    return `<span class="${classes.join(" ")} has-logo" title="${escapeHtml(title)}"><img src="${logo}" alt="${label} logo" loading="lazy" decoding="async" /></span>`;
  }

  return `<span class="${classes.join(" ")}" title="${escapeHtml(title)}">${teamBadgeText(teamOrName, game)}</span>`;
}

function selectedGameScoreContext(match, options = {}) {
  const selected = match?.selectedGame;
  if (!selected || (!options.includeSeriesView && uiState.viewMode !== "game")) {
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

  return {
    number: selectedNumber > 0 ? selectedNumber : null,
    state: String(selected?.state || "unstarted"),
    leftKills,
    rightKills,
    leftSide: leftSide || null,
    rightSide: rightSide || null
  };
}

function headerFormFacts(profile, compact = false) {
  if (!profile) {
    return [];
  }

  const facts = [];
  const wins = Number(profile.wins || 0);
  const losses = Number(profile.losses || 0);
  const draws = Number(profile.draws || 0);
  if (wins + losses + draws > 0) {
    facts.push(`Series ${wins}-${losses}${draws ? `-${draws}` : ""}`);
  }
  if (Number.isFinite(profile.seriesWinRatePct) && profile.seriesWinRatePct > 0) {
    facts.push(`${compact ? "SER WR" : "Series WR"} ${formatRatePct(profile.seriesWinRatePct)}`);
  }
  if (Number.isFinite(profile.gameWinRatePct) && profile.gameWinRatePct > 0) {
    facts.push(`${compact ? "MAP WR" : "Map WR"} ${formatRatePct(profile.gameWinRatePct)}`);
  }
  if (profile.streakLabel && profile.streakLabel !== "n/a") {
    facts.push(String(profile.streakLabel).toUpperCase());
  }
  if (profile.formLabel && profile.formLabel !== "n/a" && !compact) {
    facts.push(`FORM ${String(profile.formLabel).toUpperCase()}`);
  }

  return facts.slice(0, compact ? 2 : 4);
}

function matchStageLabel(match) {
  const candidates = [match?.stage, match?.phase, match?.round, match?.bracketRound];
  for (const value of candidates) {
    const label = String(value || "").trim();
    if (label) {
      return label;
    }
  }
  return null;
}

function selectedGameHeaderFacts(match, side, compact = false) {
  const selected = match?.selectedGame;
  const snapshot = selected?.snapshot?.[side];
  if (!snapshot) {
    return [];
  }

  const gameContext = selectedGameScoreContext(match, { includeSeriesView: true });
  const facts = [];
  const sideLabel = side === "left" ? gameContext?.leftSide : gameContext?.rightSide;
  if (sideLabel) {
    facts.push(sideLabel);
  }

  const gold = Number(snapshot?.gold);
  if (Number.isFinite(gold) && gold > 0) {
    facts.push(`${compactGold(gold)} gold`);
  }

  const towers = Number(snapshot?.towers);
  if (Number.isFinite(towers) && towers > 0) {
    facts.push(`${towers} towers`);
  }

  const primaryEpic = Number(snapshot?.barons);
  if (Number.isFinite(primaryEpic) && primaryEpic > 0) {
    facts.push(`${primaryEpic} barons`);
  } else {
    const dragons = Number(snapshot?.dragons);
    if (Number.isFinite(dragons) && dragons > 0) {
      facts.push(`${dragons} dragons`);
    }
  }

  return facts.slice(0, compact ? 2 : 3);
}

function matchHeroChipMarkup(label, tone = "neutral") {
  return `<span class="match-shell-chip ${tone}">${escapeHtml(label)}</span>`;
}

function setMatchHeroState({ title, kicker = "", meta = "", focus = "", copy = "", chips = [] }) {
  if (elements.matchTitle) {
    elements.matchTitle.textContent = title;
  }
  if (elements.matchHeroKicker) {
    elements.matchHeroKicker.textContent = kicker;
  }
  if (elements.matchHeroMeta) {
    elements.matchHeroMeta.textContent = meta;
  }
  if (elements.matchHeroFocus) {
    elements.matchHeroFocus.textContent = focus;
  }
  if (elements.matchHeroCopy) {
    elements.matchHeroCopy.textContent = copy;
  }
  if (elements.matchHeroChips) {
    elements.matchHeroChips.innerHTML = chips.map((chip) => matchHeroChipMarkup(chip.label, chip.tone)).join("");
  }
}

function clearMatchShellBoard() {
  if (elements.scoreboard) {
    elements.scoreboard.innerHTML = "";
  }
  if (elements.streamStatusWrap) {
    elements.streamStatusWrap.innerHTML = "";
  }
}

function renderMatchHero(match) {
  if (!match) {
    setMatchHeroState({
      title: "Match Center",
      kicker: "Esports Match Center",
      meta: "Live series and map-level context.",
      chips: []
    });
    return;
  }

  const compact = isCompactUI();
  const isGameMode = uiState.viewMode === "game" && Number.isInteger(uiState.activeGameNumber);
  const liveGameNumber = firstInProgressGameNumber(match);
  const bestOf = Number(match?.bestOf || match?.seriesProgress?.bestOf || 1);
  const leftRawName = String(match?.teams?.left?.name || "Left");
  const rightRawName = String(match?.teams?.right?.name || "Right");
  const matchupLabel = compact
    ? `${scoreboardTeamName(leftRawName, match?.game)} vs ${scoreboardTeamName(rightRawName, match?.game)}`
    : `${displayTeamName(leftRawName, match?.game)} vs ${displayTeamName(rightRawName, match?.game)}`;
  const startTs = Date.parse(String(match?.startAt || ""));
  const startLabel = Number.isFinite(startTs)
    ? compact
      ? dateTimeCompact(match.startAt)
      : dateTimeLabel(match.startAt)
    : "TBD";
  const stageLabel = matchStageLabel(match);
  const gameLabel = match.game === "dota2" ? "DOTA 2" : match.game === "lol" ? "LEAGUE OF LEGENDS" : "ESPORTS";
  const heroKicker = [gameLabel, "Match Center"]
    .filter(Boolean)
    .join(" · ");

  const metaParts = [stageLabel, matchupLabel, Number.isFinite(startTs) ? startLabel : null, `BO${bestOf}`];
  let title = String(match?.tournament || "").trim() || matchupLabel;
  let meta = metaParts.filter(Boolean).join(" · ");
  const chips = [];

  if (match.status === "upcoming") {
    chips.push({ label: "Upcoming", tone: "upcoming" });
  } else if (match.status === "live") {
    chips.push({ label: "Live", tone: "live" });
    if (Number.isInteger(liveGameNumber)) {
      chips.push({ label: `G${liveGameNumber} Live`, tone: "live" });
    }
  } else {
    chips.push({ label: "Final", tone: "complete" });
  }

  if (isGameMode) {
    chips.unshift({ label: `Game ${uiState.activeGameNumber}`, tone: "focus" });
  } else {
    chips.unshift({ label: "Series View", tone: "focus" });
  }

  const visibleChips = compact ? chips.slice(0, 2) : chips;
  if (match.patch) {
    visibleChips.push({ label: `Patch ${match.patch}`, tone: "neutral" });
  }
  if (match.region && !compact) {
    visibleChips.push({ label: String(match.region).toUpperCase(), tone: "neutral" });
  }

  if (isGameMode && Number.isInteger(uiState.activeGameNumber) && title === matchupLabel) {
    title = `${matchupLabel} · Game ${uiState.activeGameNumber}`;
  }

  setMatchHeroState({
    title,
    kicker: heroKicker,
    meta,
    chips: visibleChips
  });
}

function renderScoreboard(match) {
  const compact = isCompactUI();
  const isSeriesView = uiState.viewMode === "series";
  const winner = winnerTeamName(match);
  const winnerLabel = winner ? scoreboardTeamName(winner) : null;
  const leftRawName = String(match?.teams?.left?.name || "Unknown");
  const rightRawName = String(match?.teams?.right?.name || "Unknown");
  const leftDisplayName = displayTeamName(leftRawName, match?.game);
  const rightDisplayName = displayTeamName(rightRawName, match?.game);
  const leftCode = headerTeamCodeValue(leftRawName, match?.game);
  const rightCode = headerTeamCodeValue(rightRawName, match?.game);
  const selectedGameNumber = contextGameNumber();
  const bestOf = Number(match?.bestOf || match?.seriesProgress?.bestOf || 1);
  const formatLabel = `BO${bestOf}`;
  const tournamentName = match?.tournament || "Tournament";
  const startTs = Date.parse(String(match?.startAt || ""));
  const startLabel = Number.isFinite(startTs)
    ? compact
      ? dateTimeCompact(match.startAt)
      : dateTimeLabel(match.startAt)
    : "TBD";
  const projectionCountdown = Number(match?.seriesProjection?.countdownSeconds);
  const fallbackCountdown = Number.isFinite(startTs) ? Math.max(0, Math.round((startTs - Date.now()) / 1000)) : null;
  const countdown = Number.isFinite(projectionCountdown) ? projectionCountdown : fallbackCountdown;
  const countdownLabel = countdown !== null ? (countdown > 0 ? shortDuration(countdown) : "Soon") : "TBD";
  const liveGameNumber = firstInProgressGameNumber(match);
  const completedMaps = Array.isArray(match?.seriesGames)
    ? match.seriesGames.filter((game) => game?.state === "completed").length
    : 0;
  const seriesHref = detailUrlForGame(match.id, uiState.apiBase, null);
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
  const gameContext = selectedGameScoreContext(match, { includeSeriesView: true });
  const isGameMode = !isSeriesView && Boolean(gameContext);
  const gameStatus = gameContext?.state ? stateLabel(gameContext.state) : "";
  const statusTone = isGameMode
    ? stateClass(gameContext?.state || "unstarted")
    : match.status === "live"
      ? "live"
      : match.status === "completed"
        ? "complete"
        : "upcoming";
  const stageLabel = matchStageLabel(match);
  const matchupProfiles = resolvedUpcomingFormProfiles(match);
  const leftFacts = isGameMode
    ? selectedGameHeaderFacts(match, "left", compact)
    : headerFormFacts(matchupProfiles.left, compact);
  const rightFacts = isGameMode
    ? selectedGameHeaderFacts(match, "right", compact)
    : headerFormFacts(matchupProfiles.right, compact);
  const seriesScoreLabel = `${match.seriesScore.left}-${match.seriesScore.right}`;
  const sideSummary = [gameContext?.leftSide, gameContext?.rightSide].filter(Boolean).join(" / ");

  let scoreEyebrow = stageLabel || (Number.isFinite(startTs) ? startLabel : tournamentName);
  let mainLeftScore = Number(match?.seriesScore?.left || 0);
  let mainRightScore = Number(match?.seriesScore?.right || 0);
  let scoreCaption = formatLabel;
  let centerNote = Number.isFinite(startTs) ? startLabel : tournamentName;

  if (match.status === "upcoming") {
    centerNote = countdown !== null ? `Starts in ${countdownLabel}` : startLabel;
  } else if (match.status === "live") {
    centerNote = Number.isInteger(liveGameNumber)
      ? `Game ${liveGameNumber} live now${completedMaps ? ` · ${completedMaps} completed` : ""}`
      : `Live series${completedMaps ? ` · ${completedMaps} completed` : ""}`;
  } else if (match.status === "completed") {
    centerNote = winnerLabel
      ? `${winnerLabel} won the series${completedMaps ? ` · ${completedMaps} maps played` : ""}`
      : `Final series score`;
  }

  if (isGameMode && gameContext) {
    scoreEyebrow = gameContext.number ? `Game ${gameContext.number}` : "Selected Game";
    mainLeftScore = Number.isFinite(gameContext.leftKills) ? gameContext.leftKills : "—";
    mainRightScore = Number.isFinite(gameContext.rightKills) ? gameContext.rightKills : "—";
    scoreCaption = gameContext.state === "completed" ? "Final kills" : "Kills";
    centerNote = [gameStatus || null, sideSummary || null, `Series ${seriesScoreLabel}`].filter(Boolean).join(" · ");
  }

  const centerStatuses = isGameMode
    ? [
        {
          label: gameContext?.state === "inProgress" ? "Live" : gameContext?.state === "completed" ? "Final" : "Upcoming",
          tone: statusTone
        },
        { label: `Series ${seriesScoreLabel}`, tone: "neutral" }
      ].filter(Boolean)
    : [
        { label: match.status === "live" ? "Live" : match.status === "completed" ? "Final" : "Upcoming", tone: statusTone },
        { label: formatLabel, tone: "neutral" },
        Number.isInteger(liveGameNumber) && match.status === "live" ? { label: `G${liveGameNumber} Live`, tone: "live" } : null
      ].filter(Boolean);

  let gameStripMarkup = "";
  if (isGameMode && gameContext) {
    const compact = isCompactUI();
    gameStripMarkup = `
      <article class="score-hero-context-band ${statusTone}${compact ? " compact" : ""}">
        <div class="score-hero-context-item">
          <span class="score-hero-context-label">Series</span>
          <strong class="score-hero-context-value">${seriesScoreLabel}</strong>
        </div>
        <div class="score-hero-context-item">
          <span class="score-hero-context-label">Map</span>
          <strong class="score-hero-context-value">${gameContext.number ? (compact ? `G${gameContext.number}` : `Game ${gameContext.number}`) : compact ? "Map" : "Selected"}</strong>
          <span class="score-hero-context-note">${escapeHtml(gameStatus || "Awaiting map state")}</span>
        </div>
        <div class="score-hero-context-actions">
          <a class="link-btn ghost score-hero-open-link" href="${seriesHref}">${compact ? "Series" : "Series View"}</a>
        </div>
      </article>
    `;
  } else if (match.status === "live" && Number.isInteger(liveGameNumber)) {
    const compact = isCompactUI();
    const liveGameHref = detailUrlForGame(match.id, uiState.apiBase, liveGameNumber);
    const liveGameValue =
      gameContext && gameContext.number === liveGameNumber && Number.isFinite(gameContext.leftKills) && Number.isFinite(gameContext.rightKills)
        ? `${gameContext.leftKills}-${gameContext.rightKills}${compact ? "" : " kills"}`
        : "Open live map";
    gameStripMarkup = `
      <article class="score-hero-context-band live${compact ? " compact" : ""}">
        <div class="score-hero-context-item">
          <span class="score-hero-context-label">Current Game</span>
          <strong class="score-hero-context-value">${compact ? `G${liveGameNumber}` : `Game ${liveGameNumber}`}</strong>
        </div>
        <div class="score-hero-context-item">
          <span class="score-hero-context-label">Map State</span>
          <strong class="score-hero-context-value">${escapeHtml(liveGameValue)}</strong>
          <span class="score-hero-context-note">${escapeHtml(sideSummary || "Live now")}</span>
        </div>
        <div class="score-hero-context-actions">
          <a class="link-btn score-hero-open-link" href="${liveGameHref}">${compact ? `Open G${liveGameNumber}` : `Open Game ${liveGameNumber}`}</a>
        </div>
      </article>
    `;
  }

  elements.scoreboard.classList.toggle("scoreboard-series-only", isSeriesView);

  elements.scoreboard.innerHTML = `
    <article class="score-hero-board ${statusTone}">
      <a class="score-hero-team left" href="${leftTeamUrl}" aria-label="Open ${leftRawName} team page">
        <span class="score-hero-team-mark">
          ${teamBadgeMarkup(match?.teams?.left || leftRawName, match?.game)}
        </span>
        ${leftCode ? `<span class="score-hero-team-code">${leftCode}</span>` : ""}
        <span class="score-hero-team-name">${escapeHtml(leftDisplayName)}</span>
        ${
          leftFacts.length
            ? `<span class="score-hero-team-facts">${leftFacts.map((fact) => `<span class="score-hero-team-fact">${escapeHtml(fact)}</span>`).join("")}</span>`
            : ""
        }
      </a>
      <div class="score-hero-center">
        <p class="score-hero-event">${escapeHtml(scoreEyebrow)}</p>
        <p class="score-hero-score">${mainLeftScore}<span>-</span>${mainRightScore}</p>
        <p class="score-hero-score-caption">${escapeHtml(scoreCaption)}</p>
        <div class="score-hero-statuses">
          ${centerStatuses.map((item) => `<span class="score-hero-status ${item.tone}">${escapeHtml(item.label)}</span>`).join("")}
        </div>
        <p class="score-hero-note">${escapeHtml(centerNote)}</p>
      </div>
      <a class="score-hero-team right" href="${rightTeamUrl}" aria-label="Open ${rightRawName} team page">
        <span class="score-hero-team-mark">
          ${teamBadgeMarkup(match?.teams?.right || rightRawName, match?.game)}
        </span>
        ${rightCode ? `<span class="score-hero-team-code">${rightCode}</span>` : ""}
        <span class="score-hero-team-name">${escapeHtml(rightDisplayName)}</span>
        ${
          rightFacts.length
            ? `<span class="score-hero-team-facts">${rightFacts.map((fact) => `<span class="score-hero-team-fact">${escapeHtml(fact)}</span>`).join("")}</span>`
            : ""
        }
      </a>
    </article>
    ${gameStripMarkup}
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

function readableMetaToken(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/[+_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactFreshnessToken(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "Sync";
  }
  if (normalized.includes("fresh")) return "Fresh";
  if (normalized.includes("stale") || normalized.includes("delay") || normalized.includes("lag")) return "Lag";
  if (normalized.includes("sync")) return "Sync";
  if (normalized.includes("live")) return "Live";
  return readableMetaToken(value).split(" ")[0] || "Sync";
}

function compactProvenanceLabel(provenance) {
  const rawLabel = String(provenance?.label || provenance?.text || "").trim();
  if (!rawLabel) {
    return "";
  }

  return rawLabel
    .replace(/\b(live\s+stats|stats|telemetry|snapshot)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTrustChips(match, { compact = false } = {}) {
  const provenance = buildRowDataProvenance(match, {
    fallbackTimestamp: match?.updatedAt || match?.startAt || null
  });
  const qualityNotice = buildRowQualityNotice(match);
  const chips = [];

  if (provenance.text) {
    chips.push(
      `<span class="stream-chip provenance" title="${escapeHtml(provenance.title)}">${escapeHtml(
        compact ? provenance.label || provenance.text : provenance.text
      )}</span>`
    );
  }

  if (qualityNotice.text) {
    chips.push(
      `<span class="stream-chip quality ${qualityNotice.tone}" title="${escapeHtml(
        qualityNotice.title
      )}">${escapeHtml(compact ? qualityNotice.text : `Data ${qualityNotice.text}`)}</span>`
    );
  }

  return chips.join("");
}

function renderStreamStatus(match) {
  if (!elements.streamStatusWrap) {
    return;
  }

  const compact = isCompactUI();
  const lastErrorAt = Number(uiState.stream.lastErrorAt || 0);
  const errorSeconds = lastErrorAt ? Math.max(0, Math.round((Date.now() - lastErrorAt) / 1000)) : null;
  const badge = streamBadge(uiState.stream.connected ? "connected" : uiState.stream.source === "sse" ? "reconnecting" : "polling");
  const freshnessStatus = readableMetaToken(match?.freshness?.status || "syncing");
  const freshnessUpdatedAt = match?.freshness?.updatedAt
    ? compact
      ? dateTimeCompact(match.freshness.updatedAt)
      : dateTimeLabel(match.freshness.updatedAt)
    : null;
  const errorText = lastErrorAt
    ? compact
      ? `Err ${errorSeconds}s`
      : `Stream error ${dateTimeCompact(lastErrorAt)}`
    : null;
  const trustChips = matchTrustChips(match, { compact });
  if (compact) {
    const provenance = buildRowDataProvenance(match, {
      fallbackTimestamp: match?.updatedAt || match?.startAt || null
    });
    const qualityNotice = buildRowQualityNotice(match);
    const primaryCompact = uiState.stream.source === "sse"
      ? uiState.stream.connected
        ? "LIVE"
        : uiState.stream.reconnectAttempt > 0
          ? `RETRY ${uiState.stream.reconnectAttempt}`
          : "SYNC"
      : `${Number(match?.refreshAfterSeconds || DEFAULT_REFRESH_SECONDS)}s`;
    const provenanceCompact = compactProvenanceLabel(provenance);
    const sourceCompact = qualityNotice.text
      ? { label: qualityNotice.text, tone: `quality ${qualityNotice.tone}` }
      : provenanceCompact
        ? { label: provenanceCompact, tone: "provenance" }
        : { label: compactFreshnessToken(match?.freshness?.status), tone: "freshness" };
    elements.streamStatusWrap.innerHTML = `
      <article class="stream-card ${badge} stream-inline-card compact">
        <span class="stream-chip primary ${badge}">${primaryCompact}</span>
        <span class="stream-chip">${streamStatusDetail()}</span>
        <span class="stream-chip ${sourceCompact.tone}">${escapeHtml(sourceCompact.label)}</span>
        ${errorText ? `<span class="stream-chip error">${errorText}</span>` : ""}
      </article>
    `;
    return;
  }

  elements.streamStatusWrap.innerHTML = `
    <article class="stream-card ${badge} stream-inline-card">
      <span class="stream-chip primary ${badge}">${streamStatusText(match)}</span>
      <span class="stream-chip">${streamStatusDetail()}</span>
      <span class="stream-chip freshness">${freshnessStatus}</span>
      ${trustChips}
      ${freshnessUpdatedAt ? `<span class="stream-chip">${compact ? freshnessUpdatedAt : `Updated ${freshnessUpdatedAt}`}</span>` : ""}
      ${errorText ? `<span class="stream-chip error">${errorText}</span>` : ""}
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
      (Number.isInteger(selectedFromPayload) && selectedFromPayload > 0 && selectedFromPayload);
    if (!Number.isInteger(activeGameNumber) || activeGameNumber <= 0) {
      return {
        viewMode: "series",
        activeGameNumber: null
      };
    }
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
    ? `/schedule.html?game=${encodeURIComponent(seoGameKey)}`
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

function syncResolvedMatchIdentityInUrl({ resolvedMatchId, requestedGameNumber = null, apiBase = null } = {}) {
  const nextMatchId = String(resolvedMatchId || "").trim();
  if (!nextMatchId) {
    return;
  }

  const currentUrl = new URL(window.location.href);
  const currentRoute = parseMatchRoute(currentUrl.toString());
  if (String(currentRoute.id || "") === nextMatchId) {
    return;
  }

  const nextUrl = new URL(
    buildMatchUrl({
      matchId: nextMatchId,
      gameNumber: Number.isInteger(requestedGameNumber) ? requestedGameNumber : null
    }),
    window.location.origin
  );

  for (const key of ["api", "h2h_limit", "stream"]) {
    if (currentUrl.searchParams.has(key)) {
      nextUrl.searchParams.set(key, currentUrl.searchParams.get(key));
    }
  }

  if (apiBase && !nextUrl.searchParams.has("api")) {
    nextUrl.searchParams.set("api", String(apiBase));
  }

  window.history.replaceState({}, "", nextUrl.toString());
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

  const payload = await fetchJsonWithTimeout(requestUrl.toString(), {
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    timeoutMessage: "Matchup request timed out.",
    errorMessage: `Unable to load team profile for ${teamName || teamId}.`
  });

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
    renderMatchHero(uiState.match || match);
    renderScoreboard(uiState.match || match);
    renderSeriesOverview(uiState.match || match);
    renderSeriesStatsSummary(uiState.match || match);
    renderMatchupConsole(uiState.match || match);
    renderUpcomingForm(uiState.match || match);
    renderUpcomingHeadToHead(uiState.match || match);
    renderGameExplorer(uiState.match || match, apiBase);
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
    renderMatchHero(uiState.match || match);
    renderScoreboard(uiState.match || match);
    renderSeriesOverview(uiState.match || match);
    renderSeriesStatsSummary(uiState.match || match);
    renderMatchupConsole(uiState.match || match);
    renderUpcomingForm(uiState.match || match);
    renderUpcomingHeadToHead(uiState.match || match);
    renderGameExplorer(uiState.match || match, apiBase);
  }
}

function seriesRecordLabel(summary = {}) {
  const wins = Number(summary.wins || 0);
  const losses = Number(summary.losses || 0);
  const draws = Number(summary.draws || 0);
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

function seriesDeskMetricCard(label, value, note = null, tone = "neutral") {
  return `
    <article class="series-desk-metric ${escapeHtml(String(tone || "neutral").toLowerCase())}">
      <p class="tempo-label">${escapeHtml(label)}</p>
      <p class="series-desk-metric-value">${escapeHtml(value)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function summarizeRecentMatchRows(rows = []) {
  const sample = Array.isArray(rows) ? rows.filter(Boolean).slice(0, 5) : [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const row of sample) {
    const result = String(row?.result || "").toLowerCase();
    if (result === "win") wins += 1;
    else if (result === "loss") losses += 1;
    else if (result === "draw") draws += 1;
  }
  const tokens = sample.map((row) => h2hResultLabel(row?.result)).join("");
  return {
    total: sample.length,
    wins,
    losses,
    draws,
    recordLabel: draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`,
    formLabel: tokens || "n/a"
  };
}

function matchupSampleWindowLabel(limit = uiState.matchupH2hLimit) {
  const sample = normalizeMatchupLimit(limit);
  return `Last ${sample}`;
}

function renderMatchupTeamCard({ teamName, teamId, opponentId, profile, match, toneClass }) {
  const selectedGameNumber = contextGameNumber() || 0;
  const teamUrl = teamId
    ? teamDetailUrl(teamId, match?.game, uiState.apiBase, {
        matchId: match?.id || null,
        gameNumber: Number.isInteger(selectedGameNumber) && selectedGameNumber > 0 ? selectedGameNumber : null,
        opponentId,
        teamName
      })
    : null;
  const heading = teamUrl ? `<a class="team-link" href="${teamUrl}">${escapeHtml(teamName)}</a>` : escapeHtml(teamName);
  const summary = profile?.summary || {};
  const recentForm = String(summary.formLast5 || profile?.formLabel || "n/a").replace(/-/g, "") || "n/a";
  const teamRecord = {
    wins: Number(summary.wins ?? profile?.wins ?? 0),
    losses: Number(summary.losses ?? profile?.losses ?? 0),
    draws: Number(summary.draws ?? profile?.draws ?? 0)
  };
  const mapWins = Number(summary.mapWins ?? profile?.gameWins ?? 0);
  const mapLosses = Number(summary.mapLosses ?? profile?.gameLosses ?? 0);
  const shortName = scoreboardTeamName(teamName, match?.game);
  const displayName = displayTeamName(teamName, match?.game);

  return `
    <article class="series-matchup-team ${toneClass}">
      <div class="series-matchup-team-head">
        <div class="series-matchup-team-ident">
          <span class="series-matchup-team-mark">${teamBadgeMarkup({ id: teamId, name: teamName }, match?.game)}</span>
          <div class="series-matchup-team-copy">
            <h3>${heading}</h3>
            <p class="meta-text">${escapeHtml(displayName)}</p>
          </div>
        </div>
        ${teamUrl ? `<a class="table-link" href="${teamUrl}">Team page</a>` : ""}
      </div>
      <div class="series-matchup-team-metrics">
        ${seriesDeskMetricCard("Series", seriesRecordLabel(teamRecord), `${shortName} WR ${formatRatePct(summary.seriesWinRatePct ?? profile?.seriesWinRatePct)}`, toneClass)}
        ${seriesDeskMetricCard("Maps", `${mapWins}-${mapLosses}`, `Map WR ${formatRatePct(summary.mapWinRatePct ?? profile?.gameWinRatePct)}`, toneClass)}
        ${seriesDeskMetricCard("Form", recentForm, `Streak ${summary.streakLabel || profile?.streakLabel || "n/a"}`, toneClass)}
      </div>
      <div class="series-matchup-team-notes">
        <p class="meta-text">${escapeHtml(shortName)} recent read</p>
        <p class="meta-text">${escapeHtml(seriesRecordLabel(teamRecord))} series · ${mapWins + mapLosses} maps in sample</p>
      </div>
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
    elements.matchupMetaText.textContent = "Series statistics unavailable.";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Load a valid match to view head-to-head and matchup compare.</div>`;
    return;
  }

  const leftName = match?.teams?.left?.name || "Left Team";
  const rightName = match?.teams?.right?.name || "Right Team";
  const matchupState = uiState.matchup;
  const expectedKey = matchupRequestKey(match, uiState.apiBase);

  if (matchupState.key && matchupState.key !== expectedKey && !matchupState.loading) {
    elements.matchupMetaText.textContent = "Loading statistics...";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Loading team profile and head-to-head data.</div>`;
    return;
  }

  if (matchupState.loading) {
    elements.matchupMetaText.textContent = "Loading statistics...";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Loading team profile and head-to-head data.</div>`;
    return;
  }

  if (matchupState.error) {
    elements.matchupMetaText.textContent = "Statistics unavailable.";
    elements.matchupConsoleWrap.innerHTML = `<div class="empty">Unable to load matchup data: ${matchupState.error}</div>`;
    return;
  }

  const leftProfile = matchupState.leftProfile;
  const rightProfile = matchupState.rightProfile;
  if (!leftProfile || !rightProfile) {
    elements.matchupMetaText.textContent = "Waiting for matchup data.";
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
  const sampleLabel = matchupSampleWindowLabel(uiState.matchupH2hLimit);
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const leftSeriesWin = Number(leftProfile?.summary?.seriesWinRatePct ?? leftProfile?.seriesWinRatePct ?? 0);
  const rightSeriesWin = Number(rightProfile?.summary?.seriesWinRatePct ?? rightProfile?.seriesWinRatePct ?? 0);
  const leftMapWin = Number(leftProfile?.summary?.mapWinRatePct ?? leftProfile?.gameWinRatePct ?? 0);
  const rightMapWin = Number(rightProfile?.summary?.mapWinRatePct ?? rightProfile?.gameWinRatePct ?? 0);
  const seriesGap = Math.abs(leftSeriesWin - rightSeriesWin);
  const mapGap = Math.abs(leftMapWin - rightMapWin);
  const seriesLeader = leftSeriesWin === rightSeriesWin ? null : leftSeriesWin > rightSeriesWin ? leftName : rightName;
  const mapLeader = leftMapWin === rightMapWin ? null : leftMapWin > rightMapWin ? leftName : rightName;
  const favoriteTone =
    edge.favoriteName === leftName ? "left" : edge.favoriteName === rightName ? "right" : "neutral";

  elements.matchupMetaText.textContent = `${sampleLabel} sample · ${total ? `H2H ${leftWins}-${rightWins}${draws ? `-${draws}` : ""}` : "No direct H2H"} · ${edge.confidence.toUpperCase()} confidence`;

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
                ${row.detailMatchId || row.matchId ? `<a class="table-link" href="${detailUrlForGame(row.detailMatchId || row.matchId, uiState.apiBase)}">Open match</a>` : ""}
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
                    <td>${row.detailMatchId || row.matchId ? `<a class="table-link" href="${detailUrlForGame(row.detailMatchId || row.matchId, uiState.apiBase)}">Open</a>` : `<span class="meta-text">-</span>`}</td>
                  </tr>
                `)
                .join("")}
            </tbody>
          </table>
        </div>
      `
    : `<div class="empty">No direct meetings found in the selected sample window.</div>`;

  elements.matchupConsoleWrap.innerHTML = `
    <div class="series-matchup-desk">
      <article class="series-matchup-lead ${favoriteTone}">
        <div class="series-matchup-lead-head">
          <div>
            <p class="tempo-label">Matchup desk</p>
            <h3>${escapeHtml(scoreboardTeamName(edge.favoriteName, match?.game))} favored</h3>
            <p class="series-matchup-lead-note">${escapeHtml(edge.drivers[0] || "Both teams are close on recent form and conversion rates.")}</p>
          </div>
          <div class="series-matchup-scoreboard">
            <span>${escapeHtml(leftShort)} ${edge.leftEdgePct.toFixed(1)}%</span>
            <strong>${escapeHtml(scoreboardTeamName(edge.favoriteName, match?.game))}</strong>
            <span>${escapeHtml(rightShort)} ${edge.rightEdgePct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="edge-head">
          <p class="meta-text">${escapeHtml(leftShort)}</p>
          <p class="meta-text">${escapeHtml(rightShort)}</p>
        </div>
        <div class="edge-bars">
          <div class="edge-side left" style="width:${edge.leftEdgePct.toFixed(1)}%"></div>
          <div class="edge-side right" style="width:${edge.rightEdgePct.toFixed(1)}%"></div>
        </div>
        <div class="edge-head">
          <p class="edge-score">${edge.leftEdgePct.toFixed(1)}%</p>
          <p class="edge-score">${edge.rightEdgePct.toFixed(1)}%</p>
        </div>
        <div class="series-matchup-metrics">
          ${seriesDeskMetricCard("H2H", total ? `${leftWins}-${rightWins}${draws ? `-${draws}` : ""}` : "No sample", total ? `${leftShort} vs ${rightShort}` : `${sampleLabel} profile read`, favoriteTone)}
          ${seriesDeskMetricCard("Sample", total ? `${total} series` : sampleLabel, total ? "Direct meetings loaded" : "Profile-only edge", "neutral")}
          ${seriesDeskMetricCard("Series WR gap", `${seriesGap.toFixed(1)} pts`, seriesLeader ? `${scoreboardTeamName(seriesLeader, match?.game)} ahead on recent series` : "Even recent series conversion", favoriteTone)}
          ${seriesDeskMetricCard("Map WR gap", `${mapGap.toFixed(1)} pts`, mapLeader ? `${scoreboardTeamName(mapLeader, match?.game)} ahead on maps` : "Even recent map conversion", favoriteTone)}
        </div>
        <ul class="series-matchup-driver-list">${edge.drivers.map((driver) => `<li>${escapeHtml(driver)}</li>`).join("")}</ul>
      </article>
      <div class="series-matchup-team-grid">
      ${renderMatchupTeamCard({
        teamName: leftName,
        teamId: match?.teams?.left?.id,
        opponentId: match?.teams?.right?.id,
        profile: leftProfile,
        match,
        toneClass: "left"
      })}
      ${renderMatchupTeamCard({
        teamName: rightName,
        teamId: match?.teams?.right?.id,
        opponentId: match?.teams?.left?.id,
        profile: rightProfile,
        match,
        toneClass: "right"
      })}
      </div>
      <article class="series-matchup-h2h-card">
        <div class="series-matchup-h2h-head">
          <div>
            <p class="tempo-label">Recent meetings</p>
            <h3>Head-to-head sample</h3>
            <p class="series-matchup-h2h-note">${total ? `${sampleLabel} loaded from direct meetings.` : "No direct meetings in this sample window."}</p>
          </div>
          <div class="form-summary-strip">
            <span class="form-summary-pill">${escapeHtml(leftShort)} ${leftWins}</span>
            <span class="form-summary-pill">${escapeHtml(rightShort)} ${rightWins}</span>
            ${draws ? `<span class="form-summary-pill">Draws ${draws}</span>` : ""}
          </div>
        </div>
        ${h2hTable}
      </article>
    </div>
  `;
}

function renderSeriesHeader(match) {
  const header = match.seriesHeader;
  const leftName = match?.teams?.left?.name || "Left Team";
  const rightName = match?.teams?.right?.name || "Right Team";
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const status = String(match?.status || "").toLowerCase();
  const liveGameNumber = firstInProgressGameNumber(match);
  const winnerName = winnerTeamName(match);
  const leaderName = currentSeriesLeader(match);
  const bestOf = Math.max(1, Number(match?.bestOf || match?.seriesProgress?.bestOf || 1));
  const seriesScoreLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
  const countdownSeconds = Number(match?.seriesProjection?.countdownSeconds);
  const countdownLabel = Number.isFinite(countdownSeconds)
    ? countdownSeconds > 0
      ? shortDuration(Math.max(0, countdownSeconds))
      : "Soon"
    : "TBD";
  const startLabel = match?.startAt ? dateTimeLabel(match.startAt) : "TBD";
  const fallbackSubhead =
    status === "live"
      ? Number.isInteger(liveGameNumber)
        ? `Game ${liveGameNumber} is live. Stay here for the series read, then open the map when you want full game detail.`
        : "Series is live. Stay here for the broader read, then open the active map for game detail."
      : status === "completed"
        ? "Read the finished series here first, then open each map for the full game story."
        : "Use this layer for kickoff timing, matchup context, and series expectation before the first map.";

  if (!header && !match?.teams?.left && !match?.teams?.right) {
    elements.seriesHeaderSubhead.textContent = "";
    elements.seriesHeaderWrap.innerHTML = `<div class="empty">Series read unavailable.</div>`;
    return;
  }

  const subhead = String(header?.subhead || "").trim() || fallbackSubhead;
  let title = String(header?.headline || "").trim() || "Series in progress";
  let tone = "neutral";
  const chips = [];

  if (status === "upcoming") {
    title = title || `${leftShort} vs ${rightShort}`;
    tone = "upcoming";
    chips.push(
      { label: "Upcoming", tone: "upcoming" },
      { label: `Starts ${countdownLabel}`, tone: "upcoming" },
      { label: `BO${bestOf}`, tone: "neutral" }
    );
  } else if (status === "completed") {
    title = title || (winnerName ? `${scoreboardTeamName(winnerName, match?.game)} closed the series` : `Final ${seriesScoreLabel}`);
    tone = "complete";
    chips.push(
      winnerName ? { label: `${scoreboardTeamName(winnerName, match?.game)} won`, tone: "complete" } : { label: "Final", tone: "complete" },
      { label: `Series ${seriesScoreLabel}`, tone: "neutral" },
      { label: `BO${bestOf}`, tone: "neutral" }
    );
  } else {
    title = title || (leaderName ? `${scoreboardTeamName(leaderName, match?.game)} controls the series` : `${leftShort} and ${rightShort} are dead even`);
    tone = "live";
    chips.push(
      { label: "Live", tone: "live" },
      Number.isInteger(liveGameNumber) ? { label: `Game ${liveGameNumber}`, tone: "neutral" } : null,
      { label: `Series ${seriesScoreLabel}`, tone: leaderName ? (leaderName === leftName ? "left" : "right") : "neutral" }
    );
  }

  if (match?.tournament) {
    chips.push({ label: clampSummaryText(match.tournament, 28), tone: "neutral" });
  }

  elements.seriesHeaderSubhead.textContent = subhead;
  elements.seriesHeaderWrap.innerHTML = `
    ${recapFeatureCard({
      kicker: status === "completed" ? "Final Read" : status === "live" ? "Live Read" : "Pre-Match Read",
      title,
      summary: subhead,
      chips,
      tone
    })}
    ${recapNoteMarkup([
      match?.stage ? `${match.stage} · ${startLabel}` : startLabel !== "TBD" ? startLabel : null,
      header?.winnerName ? `Winner: ${displayTeamName(header.winnerName, match?.game)}` : null
    ])}
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

function renderSeriesInfoCards(items, { limit = null } = {}) {
  const visibleItems = (Array.isArray(items) ? items : []).filter(
    (item) =>
      item &&
      item.label &&
      item.value !== null &&
      item.value !== undefined &&
      String(item.value).trim() !== ""
  );
  const boundedItems =
    Number.isInteger(limit) && limit > 0 ? visibleItems.slice(0, limit) : visibleItems;
  return boundedItems
    .map((item) => seriesInfoCard(item.label, item.value, item.note || null))
    .join("");
}

function resolvedSeriesPrediction(match) {
  const matchupState = currentMatchupState(match);
  if (matchupState?.leftProfile && matchupState?.rightProfile) {
    const edge = matchupEdgeModel(
      matchupState.leftProfile,
      matchupState.rightProfile,
      match?.teams?.left?.name || "Left Team",
      match?.teams?.right?.name || "Right Team"
    );

    return {
      leftWinPct: edge.leftEdgePct,
      rightWinPct: edge.rightEdgePct,
      favoriteTeamName: edge.favoriteName,
      confidence: edge.confidence,
      drivers: edge.drivers,
      modelVersion: "matchup-edge-v1"
    };
  }

  const prediction = upcomingIntel(match)?.prediction;
  return prediction || null;
}

function renderSeriesOverview(match) {
  if (!elements.seriesOverviewWrap) {
    return;
  }

  if (!match?.teams?.left || !match?.teams?.right) {
    elements.seriesOverviewWrap.innerHTML = `<div class="empty">Series overview appears once team and event context are available.</div>`;
    return;
  }

  const compact = isCompactUI();
  const status = String(match?.status || "live").toLowerCase();
  const bestOf = Math.max(1, Number(match?.bestOf || match?.seriesProgress?.bestOf || 1));
  const formatLabel = `BO${bestOf}`;
  const leftName = match.teams.left.name || "Left Team";
  const rightName = match.teams.right.name || "Right Team";
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const tournamentName = match.tournament || "Tournament";
  const stageLabel = matchStageLabel(match);
  const regionLabel = String(match.region || "global").toUpperCase();
  const startTs = Date.parse(String(match?.startAt || ""));
  const startLabel = Number.isFinite(startTs)
    ? compact
      ? dateTimeCompact(match.startAt)
      : dateTimeLabel(match.startAt)
    : "TBD";
  const countdownSeconds = Number(match?.seriesProjection?.countdownSeconds);
  const countdownLabel = Number.isFinite(countdownSeconds)
    ? countdownSeconds > 0
      ? shortDuration(Math.max(0, countdownSeconds))
      : "Soon"
    : "TBD";
  const seriesScoreLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
  const completedMaps = Array.isArray(match?.seriesGames)
    ? match.seriesGames.filter((game) => game?.state === "completed").length
    : 0;
  const liveGameNumber = firstInProgressGameNumber(match);
  const leaderName = currentSeriesLeader(match);
  const winnerName = winnerTeamName(match);
  const prediction = resolvedSeriesPrediction(match);
  const watchOptions = Array.isArray(upcomingIntel(match)?.watchOptions) ? upcomingIntel(match).watchOptions.slice(0, 4) : [];
  const formProfiles = resolvedUpcomingFormProfiles(match);
  const heroTags = [stageLabel, tournamentName, formatLabel, match.patch ? `Patch ${match.patch}` : null, regionLabel].filter(Boolean);

  let title = "Series overview";
  let note = `${startLabel} · ${formatLabel}`;
  let statePill = "Series";
  let stateTone = "neutral";

  if (status === "upcoming") {
    title = `${leftShort} vs ${rightShort}`;
    note = `${stageLabel ? `${stageLabel} · ` : ""}Starts in ${countdownLabel}`;
    statePill = "Upcoming";
    stateTone = "upcoming";
  } else if (status === "completed") {
    title = winnerName ? `${scoreboardTeamName(winnerName)} won ${seriesScoreLabel}` : `Final ${seriesScoreLabel}`;
    note = `${completedMaps} map${completedMaps === 1 ? "" : "s"} played · Started ${startLabel}`;
    statePill = "Final";
    stateTone = "complete";
  } else {
    title = leaderName ? `${scoreboardTeamName(leaderName)} leads ${seriesScoreLabel}` : `Series tied ${seriesScoreLabel}`;
    note = Number.isInteger(liveGameNumber)
      ? `Game ${liveGameNumber} live now · ${completedMaps} complete`
      : `Series live · ${completedMaps} complete`;
    statePill = "Live";
    stateTone = "live";
  }

  const overviewCards = [
    seriesInfoCard(status === "upcoming" ? "Kickoff" : "Started", startLabel),
    seriesInfoCard("Format", formatLabel),
    seriesInfoCard("Tournament", tournamentName, stageLabel || null),
    seriesInfoCard("Patch", match.patch || "Unknown"),
    seriesInfoCard("Region", regionLabel),
    status === "upcoming"
      ? seriesInfoCard("Countdown", countdownLabel)
      : seriesInfoCard("Series Score", seriesScoreLabel),
    status === "upcoming"
      ? seriesInfoCard("Status", "Scheduled")
      : status === "completed"
        ? seriesInfoCard("Winner", winnerName ? scoreboardTeamName(winnerName) : "TBD")
        : seriesInfoCard("Current Game", Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber}` : "Live"),
    status === "completed"
      ? seriesInfoCard("Maps Played", String(completedMaps))
      : seriesInfoCard("Leader", leaderName ? scoreboardTeamName(leaderName) : "Even")
  ]
    .filter(Boolean)
    .join("");

  const formCards = [
    formProfiles.left
      ? seriesInfoCard(`${leftShort} form`, seriesRecordLabel(formProfiles.left), `Win ${formatRatePct(formProfiles.left.seriesWinRatePct)}`)
      : "",
    formProfiles.right
      ? seriesInfoCard(`${rightShort} form`, seriesRecordLabel(formProfiles.right), `Win ${formatRatePct(formProfiles.right.seriesWinRatePct)}`)
      : ""
  ]
    .filter(Boolean)
    .join("");

  const predictionMarkup = prediction
    ? `
      <article class="series-overview-panel series-overview-edge">
        <div class="series-overview-panel-head">
          <div>
            <p class="tempo-label">Matchup edge</p>
            <p class="series-overview-panel-title">${prediction.favoriteTeamName ? `${scoreboardTeamName(prediction.favoriteTeamName)} favored` : "Edge looks even"}</p>
          </div>
          <span class="form-summary-pill">Confidence ${String(prediction.confidence || "low").toUpperCase()}</span>
        </div>
        <div class="edge-head">
          <p class="meta-text">${leftShort}</p>
          <p class="meta-text">${rightShort}</p>
        </div>
        <div class="edge-bars">
          <div class="edge-side left" style="width:${Math.max(0, Math.min(100, Number(prediction.leftWinPct || 0)))}%"></div>
          <div class="edge-side right" style="width:${Math.max(0, Math.min(100, Number(prediction.rightWinPct || 0)))}%"></div>
        </div>
        <div class="edge-head">
          <p class="edge-score">${Number(prediction.leftWinPct || 0).toFixed(1)}%</p>
          <p class="edge-score">${Number(prediction.rightWinPct || 0).toFixed(1)}%</p>
        </div>
        <p class="meta-text">Model ${prediction.modelVersion || "heuristic-v1"} · Pre-series edge read</p>
        ${
          Array.isArray(prediction.drivers) && prediction.drivers.length
            ? `<ul class="series-overview-driver-list">${prediction.drivers.slice(0, compact ? 2 : 3).map((driver) => `<li>${driver}</li>`).join("")}</ul>`
            : ""
        }
      </article>
    `
    : "";

  const watchMarkup =
    status === "upcoming"
      ? `
        <article class="series-overview-panel series-overview-watch">
          <div class="series-overview-panel-head">
            <div>
              <p class="tempo-label">Watch</p>
              <p class="series-overview-panel-title">${watchOptions.length ? "Official streams and mirrors" : "Broadcast links pending"}</p>
            </div>
          </div>
          ${
            watchOptions.length
              ? `<div class="series-overview-watch-list">${watchOptions
                  .map(
                    (option) => `
                      <a class="series-overview-watch-link" href="${option.url}" target="_blank" rel="noreferrer">
                        <span>${option.label || "Watch"}</span>
                        ${option.note ? `<span class="meta-text">${option.note}</span>` : ""}
                      </a>
                    `
                  )
                  .join("")}</div>`
              : `<p class="meta-text">Check official event channels closer to match start.</p>`
          }
        </article>
      `
      : "";

  const completedSummaryMarkup = status === "completed" ? buildCompletedSeriesSummaryCards(match) : "";

  elements.seriesOverviewWrap.innerHTML = `
    <div class="series-overview-shell status-${status}">
      <article class="series-overview-hero ${stateTone}">
        <div class="series-overview-copy">
          <div class="series-overview-topline">
            <span class="series-overview-pill ${stateTone}">${statePill}</span>
            ${heroTags.map((tag) => `<span class="series-overview-pill">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <h3 class="series-overview-title">${escapeHtml(title)}</h3>
          <p class="series-overview-note">${escapeHtml(note)}</p>
        </div>
        <div class="series-overview-scorecard">
          <div class="series-overview-side left">
            <span class="series-overview-team-mark">${teamBadgeMarkup(match.teams.left, match.game)}</span>
            <span class="series-overview-team-name">${escapeHtml(displayTeamName(leftName, match.game))}</span>
            <strong class="series-overview-team-score">${match?.seriesScore?.left ?? 0}</strong>
          </div>
          <div class="series-overview-score-meta">
            <span class="series-overview-score-label">${statePill}</span>
            <strong class="series-overview-score-value">${seriesScoreLabel}</strong>
          </div>
          <div class="series-overview-side right">
            <span class="series-overview-team-mark">${teamBadgeMarkup(match.teams.right, match.game)}</span>
            <span class="series-overview-team-name">${escapeHtml(displayTeamName(rightName, match.game))}</span>
            <strong class="series-overview-team-score">${match?.seriesScore?.right ?? 0}</strong>
          </div>
        </div>
      </article>
      <div class="series-overview-grid">
        ${overviewCards}
        ${formCards}
        ${completedSummaryMarkup}
      </div>
      ${predictionMarkup || watchMarkup ? `<div class="series-overview-lower">${predictionMarkup}${watchMarkup}</div>` : ""}
    </div>
  `;
}

function seriesStatsMetric(label, value, note = null) {
  return `
    <article class="series-stats-metric">
      <p class="tempo-label">${label}</p>
      <p class="series-stats-metric-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderSeriesStatsTeamSummary(match, team, profile, toneClass = "left") {
  const teamName = team?.name || "Team";
  const shortName = scoreboardTeamName(teamName, match?.game);
  const displayName = displayTeamName(teamName, match?.game);

  if (!profile) {
    return `
      <article class="series-stats-team ${toneClass}">
        <div class="series-stats-team-head">
          <span class="series-stats-team-mark">${teamBadgeMarkup(team, match?.game)}</span>
          <div class="series-stats-team-copy">
            <h3>${escapeHtml(shortName)}</h3>
            <p class="meta-text">${escapeHtml(displayName)}</p>
          </div>
        </div>
        <div class="series-stats-team-empty">
          <p class="meta-text">Profile data is still loading for this sample.</p>
        </div>
      </article>
    `;
  }

  const formLabel = String(profile?.formLabel || "n/a").replace(/-/g, "") || "n/a";
  const mapRecord = `${profile?.gameWins ?? 0}-${profile?.gameLosses ?? 0}`;
  const metrics = [
    seriesStatsMetric("Series WR", formatRatePct(profile?.seriesWinRatePct), `Record ${seriesRecordLabel(profile)}`),
    seriesStatsMetric("Map WR", formatRatePct(profile?.gameWinRatePct), `Maps ${mapRecord}`),
    seriesStatsMetric("Form", escapeHtml(formLabel), `Streak ${escapeHtml(profile?.streakLabel || "n/a")}`)
  ].join("");

  return `
    <article class="series-stats-team ${toneClass}">
      <div class="series-stats-team-head">
        <span class="series-stats-team-mark">${teamBadgeMarkup(team, match?.game)}</span>
        <div class="series-stats-team-copy">
          <h3>${escapeHtml(shortName)}</h3>
          <p class="meta-text">${escapeHtml(displayName)}</p>
        </div>
      </div>
      <div class="series-stats-team-grid">
        ${metrics}
      </div>
    </article>
  `;
}

function renderSeriesStatsSummary(match) {
  if (!elements.seriesStatsSummaryWrap) {
    return;
  }

  if (!match?.teams?.left || !match?.teams?.right) {
    elements.seriesStatsSummaryWrap.innerHTML = `<div class="empty">Series statistics appear once both teams are available.</div>`;
    return;
  }

  const compact = isCompactUI();
  const matchupState = currentMatchupState(match);
  const leftProfile = resolvedUpcomingFormProfiles(match).left;
  const rightProfile = resolvedUpcomingFormProfiles(match).right;
  const headToHead = resolvedUpcomingHeadToHead(match);
  const prediction = resolvedSeriesPrediction(match);
  const leftName = match.teams.left.name || "Left Team";
  const rightName = match.teams.right.name || "Right Team";
  const h2hTotal = Number(headToHead?.total || headToHead?.matches || headToHead?.lastMeetings?.length || 0);
  const h2hLeftWins = Number(headToHead?.leftWins || headToHead?.wins || 0);
  const h2hRightWins = Number(headToHead?.rightWins || headToHead?.losses || 0);
  const h2hDraws = Number(headToHead?.draws || 0);
  const leftPct = prediction ? Math.max(0, Math.min(100, Number(prediction.leftWinPct || 0))) : 50;
  const rightPct = prediction ? Math.max(0, Math.min(100, Number(prediction.rightWinPct || 0))) : 50;
  const favoriteTone =
    prediction?.favoriteTeamName === leftName ? "left" : prediction?.favoriteTeamName === rightName ? "right" : "neutral";
  const drivers = Array.isArray(prediction?.drivers) ? prediction.drivers.slice(0, compact ? 1 : 3) : [];
  const centerTitle = prediction?.favoriteTeamName
    ? `${scoreboardTeamName(prediction.favoriteTeamName, match?.game)} have the edge`
    : "Series looks level";
  const centerNote = prediction
    ? `Confidence ${String(prediction.confidence || "low").toUpperCase()}`
    : matchupState?.loading
      ? "Loading matchup model"
      : matchupState?.error
        ? "Matchup model unavailable"
        : "Edge read builds once team profiles land";
  const h2hLabel = h2hTotal
    ? `${scoreboardTeamName(leftName, match?.game)} ${h2hLeftWins}-${h2hRightWins}${h2hDraws ? `-${h2hDraws}` : ""} ${scoreboardTeamName(rightName, match?.game)}`
    : "No direct meetings in this sample";
  const centerPills = [
    h2hTotal ? `Sample ${h2hTotal}` : "Sample pending",
    prediction?.modelVersion ? `Model ${prediction.modelVersion}` : null,
    matchupState?.loading ? "Refreshing" : null
  ]
    .filter(Boolean)
    .map((pill) => `<span class="form-summary-pill">${escapeHtml(pill)}</span>`)
    .join("");

  const centerMarkup = `
      <article class="series-stats-center ${favoriteTone}${compact ? " compact" : ""}">
        <div class="series-stats-center-head">
          <p class="tempo-label">${compact ? "Stats desk" : "Matchup read"}</p>
          <h3>${escapeHtml(centerTitle)}</h3>
          <p class="series-stats-center-note">${escapeHtml(
            compact
              ? prediction
                ? `Sample ${h2hTotal || "pending"} · ${String(prediction.confidence || "low").toUpperCase()} confidence`
                : centerNote
              : centerNote
          )}</p>
        </div>
        <div class="edge-head">
          <p class="meta-text">${escapeHtml(scoreboardTeamName(leftName, match?.game))}</p>
          <p class="meta-text">${escapeHtml(scoreboardTeamName(rightName, match?.game))}</p>
        </div>
        <div class="edge-bars">
          <div class="edge-side left" style="width:${leftPct.toFixed(1)}%"></div>
          <div class="edge-side right" style="width:${rightPct.toFixed(1)}%"></div>
        </div>
        <div class="edge-head">
          <p class="edge-score">${leftPct.toFixed(1)}%</p>
          <p class="edge-score">${rightPct.toFixed(1)}%</p>
        </div>
        ${
          compact
            ? ""
            : `<div class="series-stats-center-strip">
          <span class="series-stats-h2h">${escapeHtml(h2hLabel)}</span>
          ${centerPills}
        </div>`
        }
        ${
          drivers.length
            ? `<ul class="series-stats-driver-list">${drivers.map((driver) => `<li>${escapeHtml(driver)}</li>`).join("")}</ul>`
            : compact
              ? ""
              : `<p class="meta-text">Use the sample control below to widen or tighten the form window.</p>`
        }
      </article>
    `;

  const leftMarkup = renderSeriesStatsTeamSummary(match, match.teams.left, leftProfile, "left");
  const rightMarkup = renderSeriesStatsTeamSummary(match, match.teams.right, rightProfile, "right");

  elements.seriesStatsSummaryWrap.innerHTML = `
    <div class="series-stats-shell ${favoriteTone}${compact ? " compact" : ""}">
      ${compact ? `${centerMarkup}${leftMarkup}${rightMarkup}` : `${leftMarkup}${centerMarkup}${rightMarkup}`}
    </div>
  `;
}

function seriesGamesLeadCard(label, value, note = null) {
  return seriesInfoCard(label, value, note);
}

function sanitizedSeriesDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /^loading(?:\.\.\.)?$/i.test(raw)) {
    return null;
  }
  return value;
}

function nextSeriesGameEstimateLabel(match, game) {
  if (!game) {
    return null;
  }

  const estimatedStartAt =
    sanitizedSeriesDateValue(selectedGameEstimatedStart(match, game.number)) ||
    sanitizedSeriesDateValue(game?.estimatedStartAt) ||
    sanitizedSeriesDateValue(game?.startedAt) ||
    null;
  if (!estimatedStartAt) {
    return null;
  }

  return isCompactUI() ? dateTimeCompact(estimatedStartAt) : dateTimeLabel(estimatedStartAt);
}

function renderSeriesGamePathTile(match, game, apiBase) {
  const statusClass = stateClass(game?.state);
  const winnerName = resolveSeriesGameWinnerName(game, match);
  const durationText = durationLabelFromMinutes(game?.durationMinutes);
  const winningSide = winningSideLabelForSeriesGame(match, game);
  const etaLabel = nextSeriesGameEstimateLabel(match, game);
  let title = "Waiting";
  let note = seriesGameStatusNote(game, match);

  if (game?.state === "completed") {
    title = winnerName ? `${scoreboardTeamName(winnerName, match?.game)} won` : "Result confirmed";
    note = [durationText !== "n/a" ? durationText : null, winningSide ? `${winningSide} side` : null].filter(Boolean).join(" · ") || "Result confirmed";
  } else if (game?.state === "inProgress") {
    title = "Live now";
    note = game?.startedAt
      ? `Started ${isCompactUI() ? dateTimeCompact(game.startedAt) : shortTimeLabel(game.startedAt)}`
      : "Current map in progress";
  } else if (game?.state === "unneeded") {
    title = "Not needed";
    note = "Series closed before this map.";
  } else if (etaLabel) {
    title = `ETA ${etaLabel}`;
    note = "Projected next start.";
  }

  const openHref =
    game?.state === "unneeded" ? null : detailUrlForGame(match?.id, apiBase, Number(game?.number || 0));
  const tagName = openHref && !game?.selected ? "a" : "article";
  const hrefAttr = openHref && !game?.selected ? ` href="${openHref}"` : "";

  return `
    <${tagName} class="series-games-path-card state-${statusClass}${game?.selected ? " selected" : ""}"${hrefAttr}>
      <div class="series-games-path-head">
        <p class="series-games-path-label">G${Number(game?.number || 0)}</p>
        <span class="pill ${statusClass}">${stateLabel(game?.state)}</span>
      </div>
      <p class="series-games-path-title">${escapeHtml(title)}</p>
      <p class="series-games-path-note">${escapeHtml(note)}</p>
    </${tagName}>
  `;
}

function renderSeriesGamesSummary(match, apiBase) {
  if (!elements.seriesGamesSummaryWrap) {
    return;
  }

  const compact = isCompactUI();
  const games = Array.isArray(match?.seriesGames) ? match.seriesGames : [];
  if (!games.length) {
    elements.seriesGamesSummaryWrap.innerHTML = `<div class="empty">Series game path appears once map-level data is available.</div>`;
    return;
  }

  const status = String(match?.status || "").toLowerCase();
  const bestOf = Math.max(1, Number(match?.bestOf || match?.seriesProgress?.bestOf || games.length || 1));
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const completedGames = games.filter((game) => game?.state === "completed");
  const completedCount = completedGames.length;
  const liveGame = games.find((game) => game?.state === "inProgress") || null;
  const upcomingGame = games.find((game) => game?.state === "unstarted") || null;
  const upcomingCount = games.filter((game) => game?.state === "unstarted").length;
  const skippedCount = games.filter((game) => game?.state === "unneeded").length;
  const focusedGame = games.find((game) => game?.selected) || null;
  const leftShort = scoreboardTeamName(match?.teams?.left?.name, match?.game);
  const rightShort = scoreboardTeamName(match?.teams?.right?.name, match?.game);
  const seriesScoreLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
  const durationValues = completedGames
    .map((game) => Number(game?.durationMinutes))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageDuration =
    durationValues.length > 0
      ? durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length
      : null;
  const sideCounts = new Map();
  for (const game of completedGames) {
    const sideLabel = winningSideLabelForSeriesGame(match, game);
    if (!sideLabel) {
      continue;
    }
    sideCounts.set(sideLabel, Number(sideCounts.get(sideLabel) || 0) + 1);
  }
  const sideEntries = [...sideCounts.entries()].sort((left, right) => Number(right[1]) - Number(left[1]));
  const sideEntryTotal = sideEntries.reduce((sum, [, count]) => sum + count, 0);
  const sideWinsValue =
    sideEntries.length > 0
      ? sideEntries.map(([label, count]) => `${label} ${count}`).join(" · ")
      : null;

  let headline = `${completedCount}/${games.length} maps played`;
  let note = `First to ${winsNeeded} wins · Series score ${seriesScoreLabel}`;
  if (status === "live" && liveGame) {
    headline = compact ? `G${liveGame.number} live` : `Game ${liveGame.number} is live`;
    note = compact
      ? `${seriesScoreLabel} in series · ${completedCount}/${games.length} played`
      : `${completedCount} map${completedCount === 1 ? "" : "s"} complete · ${leftShort} ${match?.seriesScore?.left ?? 0} - ${match?.seriesScore?.right ?? 0} ${rightShort}`;
  } else if (status === "completed") {
    const winnerName = winnerTeamName(match);
    headline = winnerName
      ? compact
        ? "Series final"
        : `${scoreboardTeamName(winnerName, match?.game)} closed the series ${seriesScoreLabel}`
      : `Series final ${seriesScoreLabel}`;
    note = compact
      ? `${leftShort} ${match?.seriesScore?.left ?? 0} - ${match?.seriesScore?.right ?? 0} ${rightShort} · ${completedCount} played`
      : `${completedCount} completed map${completedCount === 1 ? "" : "s"} · BO${bestOf}`;
  } else if (upcomingGame) {
    const etaLabel = nextSeriesGameEstimateLabel(match, upcomingGame);
    headline = compact ? `Waiting for G${upcomingGame.number}` : `Waiting for Game ${upcomingGame.number}`;
    note = etaLabel ? `Projected ${etaLabel} · BO${bestOf}` : `Next map pending · BO${bestOf}`;
  }

  const leadCardItems = [
    { label: "Format", value: `BO${bestOf}`, note: compact ? null : `First to ${winsNeeded}` },
    liveGame
      ? {
          label: compact ? "Live" : "Live Map",
          value: `G${liveGame.number}`,
          note: nextSeriesGameEstimateLabel(match, liveGame) ? `Started ${nextSeriesGameEstimateLabel(match, liveGame)}` : "Live now"
        }
      : upcomingGame
        ? {
            label: compact ? "Next" : "Next Map",
            value: `G${upcomingGame.number}`,
            note: nextSeriesGameEstimateLabel(match, upcomingGame) || "Waiting"
          }
        : { label: "Status", value: status === "completed" ? "Final" : "Pending", note: null },
    {
      label: "Maps",
      value: `${completedCount}/${games.length}`,
      note: compact ? `${upcomingCount} up${skippedCount ? ` · ${skippedCount} skip` : ""}` : `${upcomingCount} upcoming${skippedCount ? ` · ${skippedCount} skipped` : ""}`
    },
    status !== "completed" && averageDuration !== null
      ? {
          label: compact ? "Avg" : "Avg Map",
          value: durationLabelFromMinutes(averageDuration),
          note: compact ? null : `${durationValues.length} timed map${durationValues.length === 1 ? "" : "s"}`
        }
      : null,
    !compact && focusedGame
      ? {
          label: "Viewing",
          value: `G${focusedGame.number}`,
          note:
            focusedGame.state === "completed"
              ? "Completed map detail"
              : focusedGame.state === "inProgress"
                ? "Live map detail"
                : "Queued map detail"
        }
      : null,
    !compact && status !== "completed" && sideWinsValue
      ? {
          label: "Side Wins",
          value: sideWinsValue,
          note: `${sideEntryTotal} map${sideEntryTotal === 1 ? "" : "s"} with side data`
        }
      : null
  ];
  const leadCards = renderSeriesInfoCards(leadCardItems, compact ? { limit: 4 } : {});
  const compactRaceStrip =
    compact && (status === "live" || status === "completed")
      ? `
        <div class="series-games-race-strip status-${status}">
          <div class="series-games-race-team left">
            <span>${escapeHtml(leftShort)}</span>
            <strong>${match?.seriesScore?.left ?? 0}</strong>
          </div>
          <div class="series-games-race-meta">
            <span>${status === "completed" ? "Final" : `G${liveGame?.number || completedCount + 1} live`}</span>
            <strong>First to ${winsNeeded}</strong>
          </div>
          <div class="series-games-race-team right">
            <strong>${match?.seriesScore?.right ?? 0}</strong>
            <span>${escapeHtml(rightShort)}</span>
          </div>
        </div>
      `
      : "";

  const completedCards = status === "completed" && !compact ? buildCompletedSeriesSummaryCards(match) : "";
  const pathTiles = games
    .slice()
    .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0))
    .map((game) => renderSeriesGamePathTile(match, game, apiBase))
    .join("");

  elements.seriesGamesSummaryWrap.innerHTML = `
    <div class="series-games-lead status-${status}">
      <article class="series-games-lead-hero">
        <div class="series-games-lead-copy">
          <p class="tempo-label">Series path</p>
          <h3>${escapeHtml(headline)}</h3>
          <p class="series-games-lead-note">${escapeHtml(note)}</p>
        </div>
        ${compactRaceStrip}
        <div class="series-games-path">
          ${pathTiles}
        </div>
      </article>
      <div class="series-games-lead-grid">
        ${leadCards}
        ${completedCards}
      </div>
    </div>
  `;
}

function gameContextInfoCard(label, value, note = null) {
  return `
    <article class="game-context-info-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function formatSeriesSideLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized ? normalized.toUpperCase() : null;
}

function winningSideLabelForSeriesGame(match, game) {
  if (!game || !match?.teams?.left || !match?.teams?.right) {
    return null;
  }

  const winnerName = resolveSeriesGameWinnerName(game, match);
  const sideInfo = game?.sideInfo || {};
  if (winnerName === match.teams.left.name) {
    return formatSeriesSideLabel(sideInfo.leftSide);
  }
  if (winnerName === match.teams.right.name) {
    return formatSeriesSideLabel(sideInfo.rightSide);
  }
  return null;
}

function buildCompletedSeriesSummaryCardItems(match) {
  const games = (Array.isArray(match?.seriesGames) ? match.seriesGames : [])
    .filter((game) => game?.state === "completed")
    .slice()
    .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0));
  if (!games.length) {
    return [];
  }

  const overallWinner = winnerTeamName(match);
  const bestOf = Math.max(1, Number(match?.bestOf || games.length || 1));
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const durationGames = games.filter((game) => Number.isFinite(Number(game?.durationMinutes)) && Number(game.durationMinutes) > 0);
  const averageDuration =
    durationGames.length > 0
      ? durationGames.reduce((sum, game) => sum + Number(game.durationMinutes || 0), 0) / durationGames.length
      : null;
  const longestGame =
    durationGames.length > 0
      ? durationGames.reduce((best, game) => (Number(game.durationMinutes || 0) > Number(best.durationMinutes || 0) ? game : best), durationGames[0])
      : null;
  const shortestGame =
    durationGames.length > 0
      ? durationGames.reduce((best, game) => (Number(game.durationMinutes || 0) < Number(best.durationMinutes || 0) ? game : best), durationGames[0])
      : null;
  const firstWinner = games.find((game) => resolveSeriesGameWinnerName(game, match)) || null;
  const mapPath = games
    .map((game) => {
      const winner = resolveSeriesGameWinnerName(game, match);
      return winner ? `G${game.number} ${scoreboardTeamName(winner)}` : null;
    })
    .filter(Boolean);

  let leftWins = 0;
  let rightWins = 0;
  let clincher = null;
  for (const game of games) {
    const winner = resolveSeriesGameWinnerName(game, match);
    if (winner === match?.teams?.left?.name) {
      leftWins += 1;
      if (!clincher && overallWinner === winner && leftWins >= winsNeeded) {
        clincher = game;
      }
    } else if (winner === match?.teams?.right?.name) {
      rightWins += 1;
      if (!clincher && overallWinner === winner && rightWins >= winsNeeded) {
        clincher = game;
      }
    }
  }

  const sideCounts = new Map();
  for (const game of games) {
    const sideLabel = winningSideLabelForSeriesGame(match, game);
    if (!sideLabel) {
      continue;
    }
    sideCounts.set(sideLabel, Number(sideCounts.get(sideLabel) || 0) + 1);
  }
  const sideEntries = [...sideCounts.entries()].sort((left, right) => Number(right[1]) - Number(left[1]));
  const sideEntryTotal = sideEntries.reduce((sum, [, count]) => sum + count, 0);
  const sideWinsValue =
    sideEntries.length > 0
      ? sideEntries.map(([label, count]) => `${label} ${count}`).join(" · ")
      : null;

  const cards = [];
  if (clincher) {
    cards.push({
      label: "Clincher",
      value: `G${clincher.number}`,
      note: `${overallWinner ? scoreboardTeamName(overallWinner) : "Series winner"} · ${durationLabelFromMinutes(clincher.durationMinutes)}`
    });
  }

  if (averageDuration !== null) {
    cards.push({
      label: "Avg Map",
      value: durationLabelFromMinutes(averageDuration),
      note: `${games.length} completed map${games.length === 1 ? "" : "s"}`
    });
  }

  if (longestGame) {
    cards.push({
      label: "Longest",
      value: `G${longestGame.number}`,
      note: durationLabelFromMinutes(longestGame.durationMinutes)
    });
  }

  if (shortestGame) {
    cards.push({
      label: "Fastest",
      value: `G${shortestGame.number}`,
      note: durationLabelFromMinutes(shortestGame.durationMinutes)
    });
  }

  if (firstWinner) {
    cards.push({
      label: "Game 1",
      value: scoreboardTeamName(resolveSeriesGameWinnerName(firstWinner, match) || "TBD"),
      note: "Opened the series"
    });
  }

  if (sideWinsValue) {
    cards.push({
      label: "Side Wins",
      value: sideWinsValue,
      note: `${sideEntryTotal} map${sideEntryTotal === 1 ? "" : "s"} with side data`
    });
  } else if (mapPath.length) {
    cards.push({
      label: "Map Path",
      value: mapPath.join(" · "),
      note: `${games.length} completed map${games.length === 1 ? "" : "s"}`
    });
  }

  return cards;
}

function buildCompletedSeriesSummaryCards(match, { limit = null } = {}) {
  return renderSeriesInfoCards(buildCompletedSeriesSummaryCardItems(match), { limit });
}

function currentSeriesLeader(match) {
  const leftScore = Number(match?.seriesScore?.left || 0);
  const rightScore = Number(match?.seriesScore?.right || 0);
  if (leftScore > rightScore) {
    return match?.teams?.left?.name || null;
  }
  if (rightScore > leftScore) {
    return match?.teams?.right?.name || null;
  }
  return null;
}

function seriesNavPillState(match) {
  const status = String(match?.status || "").toLowerCase();
  if (status === "live") {
    return "inProgress";
  }
  if (status === "completed") {
    return "completed";
  }
  return "unstarted";
}

function buildGameNavPill({ href, label, state = "complete", selected = false, currentLive = false, disabled = false }) {
  const classes = ["game-pill", gameNavPillClass(state, selected)];
  if (currentLive) {
    classes.push("current-live");
  }
  if (disabled) {
    classes.push("disabled");
  }

  const content = `${escapeHtml(label)}${currentLive ? `<span class="game-pill-live-dot" aria-hidden="true"></span>` : ""}`;
  if (disabled || !href) {
    return `<span class="${classes.join(" ")}" aria-disabled="true">${content}</span>`;
  }
  return `<a class="${classes.join(" ")}" href="${href}">${content}</a>`;
}

function buildGameStepControl({ href = "", direction = "prev", disabled = false }) {
  const label = direction === "prev" ? "&lt;&lt;" : "&gt;&gt;";
  const ariaLabel = direction === "prev" ? "Previous view" : "Next view";
  if (disabled || !href) {
    return `<span class="game-step-control ${direction} disabled" aria-hidden="true">${label}</span>`;
  }
  return `<a class="game-step-control ${direction}" href="${href}" aria-label="${ariaLabel}">${label}</a>`;
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
  const seriesHref = detailUrlForGame(match.id, apiBase, null);
  const focusItems = [{ key: "series", href: seriesHref, label: compact ? "S" : "Series" }];
  const liveGameNumber = firstInProgressGameNumber(match);
  for (const game of availableGames) {
    if (game?.state === "unneeded") {
      continue;
    }
    focusItems.push({
      key: `game:${game.number}`,
      href: detailUrlForGame(match.id, apiBase, game.number),
      label: compact ? `G${game.number}` : `Game ${game.number}`,
      game
    });
  }

  const currentFocusKey = isGameMode && Number.isInteger(activeGameNumber) ? `game:${activeGameNumber}` : "series";
  const currentFocusIndex = Math.max(
    0,
    focusItems.findIndex((item) => item.key === currentFocusKey)
  );
  const previousFocus = currentFocusIndex > 0 ? focusItems[currentFocusIndex - 1] : null;
  const nextFocus = currentFocusIndex < focusItems.length - 1 ? focusItems[currentFocusIndex + 1] : null;
  const completedMaps = availableGames.filter((game) => game?.state === "completed").length;
  const skippedMaps = availableGames.filter((game) => game?.state === "unneeded").length;
  const upcomingMaps = availableGames.filter((game) => game?.state === "unstarted").length;
  const bestOf = Number(match?.bestOf || 1);
  const seriesScoreLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
  const kickoffLabel = match?.startAt ? (compact ? dateTimeCompact(match.startAt) : dateTimeLabel(match.startAt)) : "TBD";
  const tournamentName = match.tournament || "Tournament TBD";
  const selectedWinner = selected ? resolveSeriesGameWinnerName(selected, match) : null;
  let navEyebrow = isGameMode ? "Map Focus" : "Series Navigator";
  let navTitle = "Series View";
  let navNote = "";
  let navTone = isGameMode
    ? selected?.state === "inProgress"
      ? "live"
      : selected?.state === "completed"
        ? "complete"
        : "upcoming"
    : match.status === "live"
      ? "live"
      : match.status === "completed"
        ? "complete"
        : "upcoming";
  const navTags = [];
  const navActions = [];

  if (isGameMode && Number.isInteger(activeGameNumber)) {
    if (compact) {
      navTitle =
        selected?.state === "inProgress"
          ? `G${activeGameNumber} Live`
          : selected?.state === "completed"
            ? `G${activeGameNumber} Final`
            : `G${activeGameNumber}`;
      navEyebrow =
        selected?.state === "inProgress"
          ? "Live map"
          : selected?.state === "completed"
            ? "Final map"
            : "Map focus";
    } else {
      navTitle =
        selected?.state === "inProgress"
          ? `Game ${activeGameNumber} Live`
          : selected?.state === "completed"
            ? `Game ${activeGameNumber} Final`
            : `Game ${activeGameNumber} Preview`;
    }
    navNote = `Series ${seriesScoreLabel} · ${completedMaps} complete${
      selectedWinner ? ` · Winner ${scoreboardTeamName(selectedWinner)}` : ""
    }`;
    if (compact) {
      navTags.push(seriesScoreLabel, selected?.state === "completed" ? "Final" : selected?.state === "inProgress" ? "Live" : `BO${bestOf}`);
    } else {
      navTags.push(`Series ${seriesScoreLabel}`, `BO${bestOf}`);
    }
    if (!compact && selected?.telemetryStatus) {
      navTags.push(compact ? String(selected.telemetryStatus).toUpperCase() : `${String(selected.telemetryStatus).toUpperCase()} telemetry`);
    }
    if (!compact && selected?.startedAt) {
      navTags.push(`Started ${compact ? dateTimeCompact(selected.startedAt) : dateTimeLabel(selected.startedAt)}`);
    }
    navActions.push(`<a class="link-btn ghost" href="${seriesHref}">Series View</a>`);
    if (Number.isInteger(nav.previousGameNumber)) {
      navActions.push(`<a class="link-btn ghost" href="${detailUrlForGame(match.id, apiBase, nav.previousGameNumber)}">Previous</a>`);
    }
    if (Number.isInteger(nav.nextGameNumber)) {
      navActions.push(`<a class="link-btn ghost" href="${detailUrlForGame(match.id, apiBase, nav.nextGameNumber)}">Next</a>`);
    }
  } else if (match.status === "live") {
    navTitle = compact ? (Number.isInteger(liveGameNumber) ? `G${liveGameNumber} Live` : "Series Live") : Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber} Live` : "Series Live";
    navEyebrow = compact
      ? Number.isInteger(liveGameNumber)
        ? `G${liveGameNumber} running`
        : "Live series"
      : navEyebrow;
    navNote = compact
      ? ""
      : `Series ${seriesScoreLabel} · ${completedMaps} map${completedMaps === 1 ? "" : "s"} complete${
          upcomingMaps > 0 ? ` · ${upcomingMaps} still to play` : ""
        }`;
    if (compact) {
      navTags.push(seriesScoreLabel, `BO${bestOf}`);
    } else {
      navTags.push(`BO${bestOf}`, `Started ${kickoffLabel}`, `Series ${seriesScoreLabel}`);
    }
    if (!compact && Number.isInteger(liveGameNumber)) {
      navTags.push(`Live G${liveGameNumber}`);
      navActions.push(
        `<a class="link-btn" href="${detailUrlForGame(match.id, apiBase, liveGameNumber)}">Open Game ${liveGameNumber}</a>`
      );
    }
  } else if (match.status === "completed") {
    const winner = winnerTeamName(match);
    navTitle = compact ? "Series Final" : "Final Series";
    navEyebrow = compact ? "Result" : navEyebrow;
    navNote = compact ? "" : `${winner ? `${displayTeamName(winner)} won` : "Series complete"} ${seriesScoreLabel} · ${completedMaps} maps played`;
    if (compact) {
      navTags.push(seriesScoreLabel, `${completedMaps} map${completedMaps === 1 ? "" : "s"}`);
    } else {
      navTags.push(`BO${bestOf}`, `Started ${kickoffLabel}`, `Series ${seriesScoreLabel}`);
    }
  } else {
    navTitle = "Series Setup";
    navEyebrow = compact ? "Upcoming" : navEyebrow;
    navNote = compact ? "" : `Starts ${kickoffLabel} · ${tournamentName}`;
    if (compact) {
      navTags.push(kickoffLabel, `BO${bestOf}`);
    } else {
      navTags.push(`BO${bestOf}`, `Kickoff ${kickoffLabel}`);
    }
    if (!compact && upcomingMaps > 0) {
      navTags.push(`${upcomingMaps} scheduled`);
    }
  }
  if (skippedMaps > 0) {
    navTags.push(`${skippedMaps} skipped`);
  }
  if (compact && navTags.length > 2) {
    navTags.length = 2;
  }

  const desktopNavPills = [
    buildGameNavPill({
      href: seriesHref,
      label: compact ? "S" : "Series",
      state: seriesNavPillState(match),
      selected: !isGameMode
    }),
    ...availableGames.map((game) => {
      const isCurrentLiveGame =
        match.status === "live" &&
        Number.isInteger(liveGameNumber) &&
        liveGameNumber === game.number;
      return buildGameNavPill({
        href: detailUrlForGame(match.id, apiBase, game.number),
        label: compact ? `G${game.number}` : `Game ${game.number}`,
        state: game?.state,
        selected: isGameMode && activeGameNumber === game.number,
        currentLive: isCurrentLiveGame,
        disabled: game?.state === "unneeded"
      });
    })
  ].join("");

  const compactNavPills = focusItems
    .map((item) => {
      const game = item.game;
      const isCurrentLiveGame =
        !item.game
          ? false
          :
        match.status === "live" &&
        Number.isInteger(liveGameNumber) &&
        liveGameNumber === game.number;
      return buildGameNavPill({
        href: item.href,
        label: item.key === "series" ? "S" : `G${game.number}`,
        state: item.key === "series" ? seriesNavPillState(match) : game?.state,
        selected: item.key === "series" ? !isGameMode : isGameMode && activeGameNumber === game.number,
        currentLive: isCurrentLiveGame,
        disabled: game?.state === "unneeded"
      });
    })
    .join("");

  const compactStepper = compact
    ? `
      <div class="game-nav-stepper">
        ${buildGameStepControl({ href: previousFocus?.href || "", direction: "prev", disabled: !previousFocus })}
        <div class="game-pill-row">${compactNavPills}</div>
        ${buildGameStepControl({ href: nextFocus?.href || "", direction: "next", disabled: !nextFocus })}
      </div>
    `
    : "";

  elements.gameNavWrap.innerHTML = `
    <article class="game-nav-board ${navTone}${compact ? " compact" : ""}">
      <div class="game-nav-board-copy">
        <p class="game-nav-board-eyebrow">${navEyebrow}</p>
        <p class="game-nav-board-title">${navTitle}</p>
        <p class="game-nav-board-note">${navNote}</p>
        <div class="game-nav-board-tags">
          ${navTags.map((tag) => `<span class="game-nav-chip">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      ${
        navActions.length
          ? `<div class="game-nav-board-actions">${navActions.join("")}</div>`
          : ""
      }
    </article>
    ${
      Number.isInteger(uiState.requestedGameFallback)
        ? `<p class="game-nav-note">Requested Game ${uiState.requestedGameFallback} could not be loaded.</p>`
        : ""
    }
    ${nav.requestedMissing ? `<p class="game-nav-note">Requested Game ${nav.requestedGameNumber} not found.</p>` : ""}
    ${compact ? compactStepper : desktopNavPills ? `<div class="game-pill-row">${desktopNavPills}</div>` : ""}
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
    const formatLabel = `Best of ${bestOf}`;

    if (match.status === "upcoming") {
      const intel = upcomingIntel(match);
      const matchupState = currentMatchupState(match);
      const essentials = intel?.essentials || {};
      const scheduledAt = essentials.scheduledAt || match.startAt;
      const estimatedEndAt = essentials.estimatedEndAt || match?.seriesProjection?.estimatedEndAt || null;
      const watchOptions = Array.isArray(intel?.watchOptions) ? intel.watchOptions : [];
      const featuredWatchOptions = watchOptions.slice(0, compact ? 2 : 3);
      const overflowWatchCount = Math.max(0, watchOptions.length - featuredWatchOptions.length);
      const edgeForecast =
        matchupState?.leftProfile && matchupState?.rightProfile
          ? (() => {
              const edge = matchupEdgeModel(
                matchupState.leftProfile,
                matchupState.rightProfile,
                match.teams.left.name,
                match.teams.right.name
              );
              return {
                leftWinPct: edge.leftEdgePct,
                rightWinPct: edge.rightEdgePct,
                favoriteTeamName: edge.favoriteName,
                confidence: edge.confidence,
                drivers: edge.drivers,
                modelVersion: "matchup-edge-v1"
              };
            })()
          : null;
      const prediction = edgeForecast || intel?.prediction || null;
      const leftPct = prediction ? Math.max(0, Math.min(100, Number(prediction.leftWinPct || 0))) : null;
      const rightPct = prediction ? Math.max(0, Math.min(100, Number(prediction.rightWinPct || 0))) : null;
      const drivers = prediction && Array.isArray(prediction.drivers) ? prediction.drivers.slice(0, compact ? 2 : 3) : [];
      const favoriteName = prediction?.favoriteTeamName || "";
      const favoriteTone =
        favoriteName === match?.teams?.left?.name
          ? "left"
          : favoriteName === match?.teams?.right?.name
            ? "right"
            : "neutral";
      const countdownLabel = countdown !== null ? (countdown > 0 ? shortDuration(Math.max(0, countdown)) : "Soon") : "TBD";
      const kickoffLabel = scheduledAt ? (compact ? dateTimeCompact(scheduledAt) : dateTimeLabel(scheduledAt)) : `${kickoffDate} · ${kickoffTime}`;
      const heroTags = compact
        ? [tournamentName, match.patch ? `Patch ${match.patch}` : null].filter(Boolean)
        : [
            formatLabel,
            tournamentName,
            match.patch ? `Patch ${match.patch}` : null,
            estimatedEndAt ? `Ends ${compact ? dateTimeCompact(estimatedEndAt) : dateTimeLabel(estimatedEndAt)}` : null
          ].filter(Boolean);
      const setupCards = compact
        ? renderSeriesInfoCards([
            { label: "Kickoff", value: kickoffLabel },
            { label: "Countdown", value: countdownLabel },
            { label: "Format", value: formatLabel },
            { label: match.patch ? "Patch" : "Region", value: match.patch || String(match.region || "global").toUpperCase() }
          ])
        : renderSeriesInfoCards([
            { label: "Kickoff", value: kickoffLabel },
            { label: "Countdown", value: countdownLabel },
            { label: "Format", value: formatLabel },
            { label: "Tournament", value: tournamentName },
            { label: "Patch", value: match.patch || "unknown" },
            { label: "Region", value: String(match.region || "global").toUpperCase() }
          ]);
      const watchMarkup = featuredWatchOptions.length
        ? `
          <div class="vod-options">
            ${featuredWatchOptions
              .map(
                (option) => `
                  <a class="vod-link" href="${option.url}" target="_blank" rel="noreferrer">${option.label || "Watch"}</a>
                `
              )
              .join("")}
            ${overflowWatchCount ? `<span class="series-context-more">+${overflowWatchCount} more</span>` : ""}
          </div>
        `
        : `<p class="meta-text">Broadcast links are not published yet.</p>`;
      const predictionMarkup = prediction
        ? `
          <article class="series-forecast-card ${favoriteTone}">
            <div class="series-forecast-head">
              <div>
                <p class="tempo-label">Forecast</p>
                <p class="series-forecast-favorite">${favoriteName ? `${displayTeamName(favoriteName)} favored` : "Forecast looks even"}</p>
              </div>
              <p class="meta-text">Confidence ${String(prediction.confidence || "low").toUpperCase()}</p>
            </div>
            <div class="edge-head">
              <p class="meta-text">${scoreboardTeamName(match.teams.left.name)}</p>
              <p class="meta-text">${scoreboardTeamName(match.teams.right.name)}</p>
            </div>
            <div class="edge-bars">
              <div class="edge-side left" style="width:${leftPct}%"></div>
              <div class="edge-side right" style="width:${rightPct}%"></div>
            </div>
            <div class="edge-head">
              <p class="edge-score">${leftPct.toFixed(1)}%</p>
              <p class="edge-score">${rightPct.toFixed(1)}%</p>
            </div>
            <p class="meta-text">Model ${prediction.modelVersion || "heuristic-v1"} weighs form, map-rate, H2H, and streak.</p>
            ${drivers.length ? `<ul class="series-forecast-drivers">${drivers.map((driver) => `<li>${driver}</li>`).join("")}</ul>` : ""}
          </article>
        `
        : `
          <article class="series-forecast-card neutral">
            <div class="series-forecast-head">
              <div>
                <p class="tempo-label">Forecast</p>
                <p class="series-forecast-favorite">Prediction still building</p>
              </div>
            </div>
            <p class="meta-text">Need recent form and head-to-head sample to project a favorite.</p>
          </article>
        `;

      elements.gameContextWrap.innerHTML = `
        <article class="game-context-card none series-context-card upcoming-series-card">
          ${compact ? "" : `<div class="game-context-top"><p class="game-context-title">Series setup view</p></div>`}
          <article class="series-context-hero">
            <div class="series-context-headline">
              <div class="series-context-matchup">
                <span class="series-context-team left">${scoreboardTeamName(match.teams.left.name)}</span>
                <span class="series-context-vs">vs</span>
                <span class="series-context-team right">${scoreboardTeamName(match.teams.right.name)}</span>
              </div>
              <p class="series-context-fullname">${matchupLabel}</p>
            </div>
            <div class="series-context-timing">
              <p class="series-context-kicker">${kickoffDate} · ${kickoffTime}</p>
              <p class="series-context-countdown">${countdownLabel}</p>
              <p class="meta-text">${countdown !== null ? "until first map" : kickoffLabel}</p>
            </div>
          </article>
          <div class="series-context-tags">
            ${heroTags.map((tag) => `<span class="series-context-tag">${tag}</span>`).join("")}
          </div>
          <div class="series-context-grid">${setupCards}</div>
          ${compact ? "" : predictionMarkup}
          ${
            compact
              ? ""
              : `
                <article class="series-watch-card">
                  <div class="series-forecast-head">
                    <div>
                      <p class="tempo-label">Watch</p>
                      <p class="series-forecast-favorite">${featuredWatchOptions.length ? "Official streams and mirrors" : "Watch links pending"}</p>
                    </div>
                  </div>
                  ${watchMarkup}
                </article>
              `
          }
        </article>
      `;
      return;
    }

    if (match.status === "completed") {
      const leftWinner =
        match?.winnerTeamId === match?.teams?.left?.id || winner === match?.teams?.left?.name;
      const rightWinner =
        match?.winnerTeamId === match?.teams?.right?.id || winner === match?.teams?.right?.name;
      const winnerTone = leftWinner ? "winner-left" : rightWinner ? "winner-right" : "winner-neutral";
      const finalScoreLabel = `${match.seriesScore.left} - ${match.seriesScore.right}`;
      const completedHeroTags = compact
        ? [formatLabel, `${completedMaps} maps played`].filter(Boolean)
        : [
            formatLabel,
            tournamentName,
            match.patch ? `Patch ${match.patch}` : null,
            `${completedMaps} maps played`
          ].filter(Boolean);
      const seriesSummaryCards = buildCompletedSeriesSummaryCards(match, compact ? { limit: 4 } : {});
      elements.gameContextWrap.innerHTML = `
        <article class="game-context-card none series-context-card completed-series-card">
          ${compact ? "" : `<div class="game-context-top"><p class="game-context-title">Series final view</p></div>`}
          <article class="series-context-hero result ${winnerTone}">
            ${
              compact
                ? ""
                : `
                  <div class="series-final-status-row">
                    <p class="series-final-kicker">Final result</p>
                    <span class="series-final-stamp">Series complete</span>
                  </div>
                `
            }
            <div class="series-final-scoreboard">
              <div class="series-final-side left ${leftWinner ? "winner" : "loser"}">
                <div class="series-final-side-head">
                  ${teamBadgeMarkup(match.teams.left, match.game)}
                  <span class="series-final-side-name">${scoreboardTeamName(match.teams.left.name)}</span>
                </div>
                <strong class="series-final-side-score">${match.seriesScore.left}</strong>
                <span class="series-final-side-label">${leftWinner ? "Winner" : "Defeated"}</span>
              </div>
              <div class="series-final-center">
                ${compact ? "" : `<span class="series-final-center-mark">Series closed</span>`}
                <strong class="series-final-center-score">${finalScoreLabel}</strong>
                <p class="series-final-center-meta">${compact ? `${completedMaps} maps · ${kickoffDate}` : `${completedMaps} maps complete · Started ${kickoffDate}`}</p>
              </div>
              <div class="series-final-side right ${rightWinner ? "winner" : "loser"}">
                <div class="series-final-side-head">
                  ${teamBadgeMarkup(match.teams.right, match.game)}
                  <span class="series-final-side-name">${scoreboardTeamName(match.teams.right.name)}</span>
                </div>
                <strong class="series-final-side-score">${match.seriesScore.right}</strong>
                <span class="series-final-side-label">${rightWinner ? "Winner" : "Defeated"}</span>
              </div>
            </div>
          </article>
          <div class="series-context-tags">
            ${completedHeroTags.map((tag) => `<span class="series-context-tag">${tag}</span>`).join("")}
          </div>
          ${seriesSummaryCards ? `<div class="series-context-grid">${seriesSummaryCards}</div>` : ""}
        </article>
      `;
      return;
    }

    const liveScoreLabel = `${match.seriesScore.left} - ${match.seriesScore.right}`;
    const liveLeadValue = Number(match?.momentum?.goldLead);
    const liveLeadLabel = Number.isFinite(liveLeadValue) ? feedLeadDescriptor(match, liveLeadValue).label : "Lead forming";
    const liveKickoffLabel = `${kickoffDate} · ${kickoffTime}`;
    const liveHeroTags = compact
      ? [tournamentName, match.patch ? `Patch ${match.patch}` : null].filter(Boolean)
      : [
          formatLabel,
          tournamentName,
          match.patch ? `Patch ${match.patch}` : null,
          liveSeriesGame?.startedAt ? `Started ${compact ? dateTimeCompact(liveSeriesGame.startedAt) : dateTimeLabel(liveSeriesGame.startedAt)}` : null
        ].filter(Boolean);
    const liveCards = compact
      ? renderSeriesInfoCards([
          { label: "Current", value: Number.isInteger(liveGameNumber) ? `G${liveGameNumber}` : "Live" },
          { label: "Series", value: liveScoreLabel },
          {
            label: "Maps",
            value: `${completedMaps} done`,
            note: upcomingMaps > 0 ? `${upcomingMaps} left` : "Series in progress"
          },
          Number.isFinite(Number(match?.momentum?.goldLead))
            ? { label: "Lead", value: liveLeadLabel }
            : Number.isFinite(Number(match?.momentum?.killDiff))
              ? { label: "Kill Diff", value: signed(match.momentum.killDiff) }
              : liveSeriesGame?.startedAt
                ? {
                    label: "Started",
                    value: compact ? dateTimeCompact(liveSeriesGame.startedAt) : dateTimeLabel(liveSeriesGame.startedAt)
                  }
                : { label: "Format", value: formatLabel }
        ])
      : renderSeriesInfoCards([
          { label: "Current Game", value: Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber}` : "Live" },
          { label: "Series Score", value: liveScoreLabel },
          { label: "Matchup", value: matchupLabel },
          { label: "Format", value: formatLabel },
          { label: "Tournament", value: tournamentName },
          { label: "Maps Completed", value: String(completedMaps) },
          { label: "Kickoff", value: liveKickoffLabel },
          { label: "Patch", value: match.patch || "unknown" },
          Number.isFinite(Number(match?.momentum?.goldLead))
            ? { label: "Gold Lead", value: liveLeadLabel }
            : null,
          Number.isFinite(Number(match?.momentum?.killDiff))
            ? { label: "Kill Diff", value: signed(match.momentum.killDiff) }
            : null,
          liveSeriesGame?.startedAt
            ? {
                label: "Current Map Start",
                value: compact ? dateTimeCompact(liveSeriesGame.startedAt) : dateTimeLabel(liveSeriesGame.startedAt)
              }
            : null
        ]);

    elements.gameContextWrap.innerHTML = `
      <article class="game-context-card none series-context-card live-series-card">
        ${compact ? "" : `<div class="game-context-top"><p class="game-context-title">Live series view</p></div>`}
        <article class="series-context-hero live">
          <div class="series-context-headline">
            <div class="series-context-matchup">
              <span class="series-context-team left">${scoreboardTeamName(match.teams.left.name)}</span>
              <span class="series-context-vs">vs</span>
              <span class="series-context-team right">${scoreboardTeamName(match.teams.right.name)}</span>
            </div>
            <p class="series-context-fullname">${Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber} is live now` : "Series is live"}</p>
          </div>
          <div class="series-context-timing">
            <p class="series-context-kicker">${liveLeadLabel}</p>
            <p class="series-context-countdown live">${liveScoreLabel}</p>
            <p class="meta-text">${Number.isInteger(liveGameNumber) ? `Current map: Game ${liveGameNumber}` : "Current map live"} · ${completedMaps} complete</p>
          </div>
        </article>
        <div class="series-context-tags">
          ${liveHeroTags.map((tag) => `<span class="series-context-tag">${tag}</span>`).join("")}
        </div>
        <div class="series-context-grid">${liveCards}</div>
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
  const draftPreview = inferDraftPreview(match);
  const compactStateSummary = compact && selected.state !== "inProgress";
  const selectedGameTitle = compact ? `Game ${selected.number}` : `Game ${selected.number} command`;
  const telemetryCountsLine = `Ticker ${selected.telemetryCounts?.tickerEvents || 0} · Objective ${selected.telemetryCounts?.objectiveEvents || 0} · Bursts ${selected.telemetryCounts?.combatBursts || 0} · Milestones ${selected.telemetryCounts?.goldMilestones || 0}`;
  const startedLabel = selected.startedAt
    ? compact
      ? dateTimeCompact(selected.startedAt)
      : dateTimeLabel(selected.startedAt)
    : "Waiting";
  const sideLabel = sideSummary.length ? sideSummary.join(" · ") : "Sides pending";
  const tipsList = tips.length ? `<ul class="confidence-notes">${tips.map((tip) => `<li>${tip}</li>`).join("")}</ul>` : "";

  if (draftPreview) {
    const infoCards = [
      gameContextInfoCard("Map", `Game ${selected.number}`),
      gameContextInfoCard("Phase", draftPreview.label),
      gameContextInfoCard("Started", startedLabel),
      gameContextInfoCard("Sides", sideLabel),
      gameContextInfoCard("Telemetry", String(selected.telemetryStatus || "none").toUpperCase(), telemetryCountsLine)
    ];

    if (selected.watchUrl) {
      infoCards.push(gameContextInfoCard("Watch", "Broadcast / VOD", "Primary link available below"));
    }

    elements.gameContextWrap.innerHTML = `
      <article class="game-context-card ${selected.telemetryStatus || "none"} draft-context-card">
        <div class="game-context-top">
          <p class="game-context-title">${selectedGameTitle}</p>
          <span class="pill live">${draftPreview.badge}</span>
        </div>
        <article class="draft-phase-banner ${draftPreview.tone}">
          <div class="draft-phase-copy">
            <p class="draft-phase-kicker">${draftPreview.badge}</p>
            <p class="draft-phase-title">${draftPreview.headline || (draftPreview.hasDraftRows ? "Champion select is underway" : "Game start is close")}</p>
            <p class="meta-text">${draftPreview.summary}</p>
          </div>
          <p class="draft-phase-detail">${draftPreview.detail}</p>
        </article>
        <div class="game-context-grid">
          ${infoCards.join("")}
        </div>
        ${
          draftPreview.suppressDraftGrid
            ? `<article class="recap-note"><p class="meta-text">${sideLabel}</p></article>`
            : `<div class="recap-draft-grid">
          ${renderRecapDraftTeam(match, match.teams.left.name, draftPreview.leftRows)}
          ${renderRecapDraftTeam(match, match.teams.right.name, draftPreview.rightRows)}
        </div>`
        }
        ${selected.watchUrl ? `<a class="table-link" href="${selected.watchUrl}" target="_blank" rel="noreferrer">Open Primary Stream</a>` : ""}
        ${watchOptions.length
          ? `<div class="vod-options">${watchOptions
              .map((option) => `<a class="vod-link" href="${option.watchUrl}" target="_blank" rel="noreferrer">${compact ? option.shortLabel || option.label : option.label}</a>`)
              .join("")}</div>`
          : ""}
        ${tipsList}
      </article>
    `;
    return;
  }

  if (selected.state === "completed") {
    const selectedSeriesGame = (Array.isArray(match.seriesGames) ? match.seriesGames : []).find((game) => game.selected) || null;
    const winnerName = selectedGameWinnerName(match, selectedSeriesGame, selected) || "TBD";
    const winnerShort = winnerName === "TBD" ? "TBD" : displayTeamName(winnerName);
    const winnerTone =
      winnerName === match?.teams?.left?.name ? "left" : winnerName === match?.teams?.right?.name ? "right" : "neutral";
    const duration = durationLabelFromMinutes(selectedSeriesGame?.durationMinutes);
    const snapshot = selected.snapshot || {};
    const left = snapshot.left || {};
    const right = snapshot.right || {};
    const leftGold = Number(left.gold);
    const rightGold = Number(right.gold);
    const hasGold = Number.isFinite(leftGold) && Number.isFinite(rightGold);
    const finalKills = `${left.kills ?? 0} - ${right.kills ?? 0}`;
    const objectiveSummary = objectiveSummaryLine(match, selected.snapshot);
    const objectives = objectiveSummary.primary.replace(/ · /g, " · ");
    const completedStory = buildCompletedGameStory(match);
    const topRows = Array.isArray(match.topPerformers) ? match.topPerformers.slice(0, compact ? 2 : 3) : [];
    const completedResultTitle = compact ? `${winnerShort} won G${selected.number}` : `${winnerShort} won Game ${selected.number}`;
    const completedResultMeta = compact
      ? [finalKills, duration !== "n/a" ? duration : null, `Series ${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`]
          .filter(Boolean)
          .join(" · ")
      : `${finalKills} kills · ${duration} · ${sideLabel}`;
    const spotlightMarkup = topRows.length
      ? `
        <div class="completed-spotlights${compact ? " compact" : ""}">
          ${topRows
            .map(
              (player) => `
                <article class="completed-spotlight-card${compact ? " compact" : ""}">
                  <p class="completed-spotlight-name">${heroIconMarkup(match, player)}<span>${player.name}</span></p>
                  <p class="meta-text">${player.champion || "Unknown"} · ${String(player.role || "flex").toUpperCase()}</p>
                  <p class="meta-text">${compact ? `KDA ${player.kills}/${player.deaths}/${player.assists}` : `KDA ${player.kills}/${player.deaths}/${player.assists} · Gold ${formatNumber(player.goldEarned)}`}</p>
                </article>
              `
            )
            .join("")}
        </div>
      `
      : "";
    const completedStoryMarkup = completedStory
      ? `
        <div class="completed-result-story${compact ? " compact" : ""}">
          <p class="tempo-label">${compact ? "Story" : "Game Story"}</p>
          <p class="completed-story-title">${completedStory.headline}</p>
          <p class="meta-text">${escapeHtml(compact ? clampSummaryText(completedStory.summary, 82) : completedStory.summary)}</p>
          <div class="completed-story-pills">
            ${[
              completedStory.peakLeadLabel,
              ...(compact ? [] : completedStory.peakLeadNote ? [completedStory.peakLeadNote] : []),
              completedStory.turningPointLabel
            ]
              .filter(Boolean)
              .slice(0, compact ? 2 : 3)
              .map((item) => `<span class="completed-story-pill">${escapeHtml(item)}</span>`)
              .join("")}
          </div>
        </div>
      `
      : "";
    const infoCards = [
      gameContextInfoCard("Objectives", objectives, objectiveSummary.secondary),
      gameContextInfoCard("Gold", hasGold ? `${formatNumber(leftGold)} - ${formatNumber(rightGold)}` : "n/a")
    ];
    if (!compact) {
      infoCards.push(gameContextInfoCard("Started", startedLabel));
      infoCards.push(gameContextInfoCard("Telemetry", String(selected.telemetryStatus || "none").toUpperCase(), telemetryCountsLine));
    }

    elements.gameContextWrap.innerHTML = `
      <article class="game-context-card ${selected.telemetryStatus || "none"} completed-context-card${compact ? " compact" : ""}">
        <div class="game-context-top">
          <p class="game-context-title">${selectedGameTitle}</p>
          <span class="pill complete">Complete</span>
        </div>
        <article class="completed-result-banner ${winnerTone}${compact ? " compact" : ""}">
          <div class="completed-result-copy">
            <p class="completed-result-kicker">Result</p>
            <p class="completed-result-title">${completedResultTitle}</p>
            <p class="meta-text">${escapeHtml(completedResultMeta)}</p>
          </div>
          ${completedStoryMarkup}
        </article>
        <div class="game-context-grid${compact ? " compact" : ""}">
          ${infoCards.join("")}
        </div>
        ${spotlightMarkup}
        ${selected.watchUrl ? `<a class="table-link" href="${selected.watchUrl}" target="_blank" rel="noreferrer">Open VOD / Stream</a>` : ""}
        ${watchOptions.length
          ? `<div class="vod-options">${watchOptions
              .map((option) => `<a class="vod-link" href="${option.watchUrl}" target="_blank" rel="noreferrer">${compact ? option.shortLabel || option.label : option.label}</a>`)
              .join("")}</div>`
          : ""}
        ${tipsList}
      </article>
    `;
    return;
  }

  if (selected.state === "inProgress") {
    elements.gameContextWrap.innerHTML = "";
    return;
  }

  elements.gameContextWrap.innerHTML = `
    <article class="game-context-card ${selected.telemetryStatus || "none"}">
      <div class="game-context-top">
        <p class="game-context-title">${selectedGameTitle}</p>
        <span class="pill ${selected.state === "inProgress" ? "live" : selected.state === "completed" ? "complete" : selected.state === "unneeded" ? "skip" : "upcoming"}">${selected.telemetryStatus || "none"} telemetry</span>
      </div>
      <p class="meta-text">${selected.label || "No game label."}</p>
      ${draftPreview
        ? `
      <article class="draft-phase-banner ${draftPreview.tone}">
        <div class="draft-phase-copy">
          <p class="draft-phase-kicker">${draftPreview.badge}</p>
          <p class="draft-phase-title">${draftPreview.headline || (draftPreview.hasDraftRows ? "Champion select is underway" : "Game start is close")}</p>
          <p class="meta-text">${draftPreview.summary}</p>
        </div>
        <p class="draft-phase-detail">${draftPreview.detail}</p>
      </article>
      `
        : ""}
      ${selected.startedAt ? `<p class="meta-text">Started: ${dateTimeLabel(selected.startedAt)}</p>` : ""}
      ${sideSummary.length ? `<p class="meta-text">${sideSummary.join(" · ")}</p>` : ""}
      ${compactStateSummary ? "" : `<p class="meta-text">${telemetryCountsLine}</p>`}
      ${selected.watchUrl ? `<a class="table-link" href="${selected.watchUrl}" target="_blank" rel="noreferrer">${compactStateSummary ? "Watch" : "Primary VOD"}</a>` : `<span class="meta-text">${compactStateSummary ? "No watch link." : "No primary VOD link."}</span>`}
      ${watchOptions.length
        ? `<div class="vod-options">${watchOptions
            .map((option) => `<a class="vod-link" href="${option.watchUrl}" target="_blank" rel="noreferrer">${compactStateSummary ? option.shortLabel || option.label : option.label}</a>`)
            .join("")}</div>`
        : ""}
      ${compactStateSummary ? "" : tipsList}
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
  const hasBasicTelemetry = telemetryStatus === "basic";
  const hasRichTelemetry = telemetryStatus === "rich";
  const hasAnyTelemetry = hasBasicTelemetry || hasRichTelemetry;
  const draftPreview = inferDraftPreview(match);
  const hasSnapshot = Boolean(selected?.snapshot && (selected.snapshot.left || selected.snapshot.right));
  const setTargetVisibility = (element, visible) => {
    if (!element) {
      return;
    }
    setPanelVisibility(element.closest("section.panel"), visible);
  };
  const setInlineVisibility = (element, visible) => {
    if (!element) {
      return;
    }
    element.hidden = !visible;
  };
  const hasRows = (rows) => Array.isArray(rows) && rows.length > 0;
  const hasPlayerBoard =
    hasRows(match?.playerEconomy?.left) ||
    hasRows(match?.playerEconomy?.right);
  const hasLeadTrend =
    hasRows(match?.goldLeadSeries) ||
    hasPlayerBoard;
  const hasFeedSignals = [
    match?.liveTicker,
    match?.liveAlerts,
    match?.objectiveTimeline,
    match?.combatBursts,
    match?.goldMilestones
  ].some((rows) => hasRows(rows));
  const hasLiveFeedPanel = hasLeadTrend || hasFeedSignals;
  const showGameCommand = selectedState === "completed" || !draftPreview;
  const showSelectedGameRecap =
    Boolean(draftPreview) ||
    hasSnapshot ||
    selectedState === "completed" ||
    selectedState === "unstarted" ||
    selectedState === "unneeded";
  const showTeamCompare =
    hasSnapshot &&
    selectedState !== "unstarted" &&
    selectedState !== "unneeded";
  const showPulseCard = selectedState === "inProgress" && Boolean(match?.pulseCard);
  const showLiveAlerts = selectedState === "inProgress" && hasAnyTelemetry;
  const showDataConfidence = Boolean(match?.dataConfidence);
  const showAnalysis =
    selectedState === "inProgress" ||
    Boolean(match?.edgeMeter?.left && match?.edgeMeter?.right);
  const showPace = Boolean(match?.tempoSnapshot);
  const showKeysToWin = Array.isArray(match?.tacticalChecklist) && match.tacticalChecklist.length > 0;
  const showStorylines = Array.isArray(match?.storylines) && match.storylines.length > 0;
  const showObjectiveControl = Boolean(match?.objectiveControl);
  const showObjectiveBreakdown = Boolean(match?.objectiveBreakdown?.left || match?.objectiveBreakdown?.right);
  const showDraftBoard = Boolean(match?.teamDraft);
  const showDraftDelta = Array.isArray(match?.draftDelta?.rows) && match.draftDelta.rows.length > 0;
  const showEconomy = hasPlayerBoard;
  const showLaneMatchups = Array.isArray(match?.laneMatchups) && match.laneMatchups.length > 0;
  const showRoleDelta = Array.isArray(match?.roleMatchupDeltas) && match.roleMatchupDeltas.length > 0;
  const showObjectiveRuns = Array.isArray(match?.objectiveRuns) && match.objectiveRuns.length > 0;
  const showPerformers = Array.isArray(match?.topPerformers) && match.topPerformers.length > 0;
  const showLiveTicker = selectedState === "inProgress" || hasRows(match?.liveTicker);
  const showObjectiveTimeline = selectedState === "inProgress" || hasRows(match?.objectiveTimeline);
  const showObjectiveForecast =
    selectedState === "inProgress" ||
    selectedState === "completed" ||
    hasRows(match?.objectiveForecast);
  const showPlayerDelta =
    Array.isArray(match?.playerDeltaPanel?.players) &&
    match.playerDeltaPanel.players.length > 0;
  const showSignals =
    selectedState === "inProgress" ||
    hasRows(match?.combatBursts) ||
    hasRows(match?.goldMilestones);
  const showEconomyMilestones = hasRows(match?.goldMilestones);
  const showKeyMoments = hasRows(match?.keyMoments);
  const showFeedPanel = hasLiveFeedPanel || showLiveAlerts || showLiveTicker || showStorylines;
  const showTimelinePanel =
    showObjectiveTimeline ||
    showSignals ||
    showEconomyMilestones ||
    showObjectiveForecast ||
    showKeyMoments;

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
    setTargetVisibility(elements.gameCommandWrap, showGameCommand);
    setTargetVisibility(elements.selectedGameRecapWrap, showSelectedGameRecap);
    setInlineVisibility(elements.feedAlertsCluster, false);
    setInlineVisibility(elements.feedTickerCluster, false);
    setInlineVisibility(elements.feedStoryCluster, false);
    setInlineVisibility(elements.timelineSignalsCluster, false);
    setInlineVisibility(elements.timelineMilestonesCluster, false);
    setInlineVisibility(elements.timelineForecastCluster, false);
    setInlineVisibility(elements.timelineMomentsCluster, false);
    return;
  }

  if (!hasAnyTelemetry) {
    for (const panel of telemetryPanels) {
      setPanelVisibility(panel, false);
    }
    setTargetVisibility(elements.gameCommandWrap, showGameCommand);
    setTargetVisibility(elements.selectedGameRecapWrap, showSelectedGameRecap);
    setTargetVisibility(elements.teamCompareWrap, showTeamCompare);
    setTargetVisibility(elements.pulseCard, false);
    setInlineVisibility(elements.feedAlertsCluster, false);
    setInlineVisibility(elements.feedTickerCluster, false);
    setInlineVisibility(elements.feedStoryCluster, false);
    setInlineVisibility(elements.timelineSignalsCluster, false);
    setInlineVisibility(elements.timelineMilestonesCluster, false);
    setInlineVisibility(elements.timelineForecastCluster, false);
    setInlineVisibility(elements.timelineMomentsCluster, false);
    return;
  }

  if (hasBasicTelemetry) {
    for (const panel of telemetryPanels) {
      setPanelVisibility(panel, false);
    }

    setPanelVisibility(elements.liveFeedPanel, showFeedPanel);
    setPanelVisibility(elements.gameObjectiveTimelinePanel, showTimelinePanel);
    setTargetVisibility(elements.gameCommandWrap, showGameCommand);
    setTargetVisibility(elements.selectedGameRecapWrap, showSelectedGameRecap);
    setTargetVisibility(elements.playerTrackerWrap, hasPlayerBoard);
    setInlineVisibility(elements.liveFeedList, hasLiveFeedPanel);
    setTargetVisibility(elements.objectiveControlWrap, showObjectiveControl);
    setTargetVisibility(elements.pulseCard, showPulseCard);
    setTargetVisibility(elements.teamCompareWrap, showTeamCompare);
    setInlineVisibility(elements.objectiveTimelineList, showObjectiveTimeline);
    setInlineVisibility(elements.feedAlertsCluster, showLiveAlerts);
    setInlineVisibility(elements.feedTickerCluster, showLiveTicker);
    setInlineVisibility(elements.feedStoryCluster, showStorylines);
    setInlineVisibility(elements.timelineSignalsCluster, showSignals);
    setInlineVisibility(elements.timelineMilestonesCluster, showEconomyMilestones);
    setInlineVisibility(elements.timelineForecastCluster, showObjectiveForecast);
    setInlineVisibility(elements.timelineMomentsCluster, showKeyMoments);
    return;
  }

  setTargetVisibility(elements.dataConfidenceWrap, showDataConfidence);
  setTargetVisibility(elements.edgeMeterWrap, showAnalysis);
  setTargetVisibility(elements.tempoSnapshotWrap, showPace);
  setTargetVisibility(elements.tacticalChecklistWrap, showKeysToWin);
  setTargetVisibility(elements.objectiveControlWrap, showObjectiveControl);
  setTargetVisibility(elements.objectiveBreakdownWrap, showObjectiveBreakdown);
  setTargetVisibility(elements.draftBoardWrap, showDraftBoard);
  setTargetVisibility(elements.draftDeltaWrap, showDraftDelta);
  setTargetVisibility(elements.economyBoardWrap, showEconomy);
  setTargetVisibility(elements.laneMatchupsWrap, showLaneMatchups);
  setTargetVisibility(elements.roleDeltaWrap, showRoleDelta);
  setTargetVisibility(elements.objectiveRunsWrap, showObjectiveRuns);
  setTargetVisibility(elements.performersWrap, showPerformers);
  setPanelVisibility(elements.liveFeedPanel, showFeedPanel);
  setPanelVisibility(elements.gameObjectiveTimelinePanel, showTimelinePanel);
  setInlineVisibility(elements.objectiveTimelineList, showObjectiveTimeline);
  setTargetVisibility(elements.playerDeltaWrap, showPlayerDelta);
  setTargetVisibility(elements.gameCommandWrap, showGameCommand);
  setTargetVisibility(elements.selectedGameRecapWrap, showSelectedGameRecap);
  setTargetVisibility(elements.playerTrackerWrap, hasPlayerBoard);
  setInlineVisibility(elements.liveFeedList, hasLiveFeedPanel);
  setTargetVisibility(elements.teamCompareWrap, showTeamCompare);
  setTargetVisibility(elements.pulseCard, showPulseCard);
  setInlineVisibility(elements.feedAlertsCluster, showLiveAlerts);
  setInlineVisibility(elements.feedTickerCluster, showLiveTicker);
  setInlineVisibility(elements.feedStoryCluster, showStorylines);
  setInlineVisibility(elements.timelineSignalsCluster, showSignals);
  setInlineVisibility(elements.timelineMilestonesCluster, showEconomyMilestones);
  setInlineVisibility(elements.timelineForecastCluster, showObjectiveForecast);
  setInlineVisibility(elements.timelineMomentsCluster, showKeyMoments);
}

function applySeriesPanelVisibility(match = uiState.match) {
  const showSeriesPanels = uiState.viewMode === "series";
  for (const panel of elements.seriesPanels) {
    setPanelVisibility(panel, showSeriesPanels);
  }

  setPanelVisibility(elements.seriesHeaderWrap?.closest("section.panel"), false);
  setPanelVisibility(elements.statusSummary?.closest("section.panel"), false);

  if (!showSeriesPanels) {
    return;
  }

  const status = String(match?.status || "");
  const compactSeriesMode = isCompactUI() && uiState.viewMode === "series";
  const seriesGames = Array.isArray(match?.seriesGames) ? match.seriesGames : [];
  const completedGames = seriesGames.filter((game) => game?.state === "completed").length;
  const hasSeriesMoments = Array.isArray(match?.seriesMoments) && match.seriesMoments.length > 0;
  const hasPlayerTrends = Array.isArray(match?.seriesPlayerTrends) && match.seriesPlayerTrends.length > 0;
  const setSeriesVisibility = (element, visible) => {
    const panel = element?.closest("section.panel");
    if (!panel) {
      return;
    }
    setPanelVisibility(panel, visible);
  };

  setSeriesVisibility(elements.seriesOverviewWrap, true);
  setSeriesVisibility(elements.matchupConsoleWrap, true);
  setSeriesVisibility(elements.seriesLineupsWrap, true);
  setSeriesVisibility(elements.upcomingFormWrap, true);
  setSeriesVisibility(elements.upcomingH2hWrap, true);
  setSeriesVisibility(elements.seriesProgressWrap, !compactSeriesMode && (status === "live" || status === "completed"));
  setSeriesVisibility(elements.seriesMomentsList, !compactSeriesMode && hasSeriesMoments && (status === "live" || status === "completed"));
  setSeriesVisibility(elements.seriesGamesWrap, status === "live" || status === "completed");
  setSeriesVisibility(elements.seriesCompareWrap, status === "completed" && completedGames > 0);
  setSeriesVisibility(elements.seriesPlayerTrendsWrap, status === "completed" && hasPlayerTrends);
}

function applyUpcomingPanelVisibility(match) {
  const isUpcoming = match?.status === "upcoming";
  setPanelVisibility(elements.upcomingEssentialsWrap?.closest("section.panel"), isUpcoming);
  setPanelVisibility(elements.upcomingWatchWrap?.closest("section.panel"), isUpcoming);
  setPanelVisibility(elements.upcomingPredictionWrap?.closest("section.panel"), isUpcoming);
  setPanelVisibility(elements.preMatchPlanner?.closest("section.panel"), isUpcoming);
}

function commandCard(label, value, hint, options = {}) {
  const tone = String(options.tone || "neutral").toLowerCase();
  const featuredClass = options.featured ? " featured" : "";
  const compactClass = options.compact ? " compact" : "";
  return `
    <article class="command-card ${tone}${featuredClass}${compactClass}">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${hint ? `<p class="meta-text">${hint}</p>` : ""}
    </article>
  `;
}

function objectiveTerminology(matchOrGame) {
  const gameKey = normalizeGameKey(
    typeof matchOrGame === "string" ? matchOrGame : matchOrGame?.game
  );

  if (gameKey === "dota2") {
    return {
      baronLabel: "Roshans",
      baronSingle: "Roshan",
      baronShort: "Rosh",
      inhibitorLabel: "Barracks",
      inhibitorShort: "Rax",
      dragonLabel: null,
      dragonShort: null,
      heraldLabel: null
    };
  }

  return {
    baronLabel: "Barons",
    baronSingle: "Baron",
    baronShort: "Brn",
    inhibitorLabel: "Inhibitors",
    inhibitorShort: "Inhib",
    dragonLabel: "Dragons",
    dragonShort: "Drg",
    heraldLabel: "Herald"
  };
}

function displayObjectiveName(type, matchOrGame = null) {
  const normalized = String(type || "").toLowerCase();
  const terms = objectiveTerminology(matchOrGame);
  if (normalized === "dragon") return "Dragon";
  if (normalized === "baron") return terms.baronSingle;
  if (normalized === "herald") return terms.heraldLabel || "Objective";
  if (normalized === "tower") return "Tower";
  if (normalized === "inhibitor") return terms.inhibitorShort;
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Objective";
}

function objectiveMetricDefinitions(match) {
  const terms = objectiveTerminology(match);
  if (normalizeGameKey(match?.game) === "dota2") {
    return [
      { key: "towers", label: "Towers" },
      { key: "barons", label: terms.baronLabel },
      { key: "inhibitors", label: terms.inhibitorLabel }
    ];
  }

  return [
    { key: "towers", label: "Towers" },
    { key: "dragons", label: terms.dragonLabel },
    { key: "barons", label: terms.baronLabel },
    { key: "inhibitors", label: terms.inhibitorLabel }
  ];
}

function objectiveSummaryLine(match, snapshot) {
  const left = snapshot?.left || {};
  const right = snapshot?.right || {};
  const leftTowers = Number(left?.towers || 0);
  const rightTowers = Number(right?.towers || 0);
  const leftBarons = Number(left?.barons || 0);
  const rightBarons = Number(right?.barons || 0);
  const leftInhibitors = Number(left?.inhibitors || 0);
  const rightInhibitors = Number(right?.inhibitors || 0);
  const leftDragons = Number(left?.dragons || 0);
  const rightDragons = Number(right?.dragons || 0);
  const leftGold = Number(left?.gold);
  const rightGold = Number(right?.gold);
  const goldLine =
    Number.isFinite(leftGold) && Number.isFinite(rightGold)
      ? `${formatNumber(leftGold)}-${formatNumber(rightGold)} gold`
      : "Gold totals pending";
  const terms = objectiveTerminology(match);

  if (normalizeGameKey(match?.game) === "dota2") {
    return {
      primary: `T ${leftTowers}-${rightTowers} · ${terms.baronShort} ${leftBarons}-${rightBarons}`,
      secondary: `${terms.inhibitorShort} ${leftInhibitors}-${rightInhibitors} · ${goldLine}`,
      signalCount: leftTowers + rightTowers + leftBarons + rightBarons + leftInhibitors + rightInhibitors
    };
  }

  return {
    primary: `T ${leftTowers}-${rightTowers} · ${terms.dragonShort} ${leftDragons}-${rightDragons}`,
    secondary: `${terms.baronSingle} ${leftBarons}-${rightBarons} · ${goldLine}`,
    signalCount: leftTowers + rightTowers + leftDragons + rightDragons + leftBarons + rightBarons
  };
}

function objectiveAdvantageDelta(snapshot, match) {
  const left = snapshot?.left || {};
  const right = snapshot?.right || {};
  if (normalizeGameKey(match?.game) === "dota2") {
    return (Number(left.barons || 0) + Number(left.inhibitors || 0)) -
      (Number(right.barons || 0) + Number(right.inhibitors || 0));
  }

  return (Number(left.dragons || 0) + Number(left.barons || 0)) -
    (Number(right.dragons || 0) + Number(right.barons || 0));
}

function readableGameStateLabel(state) {
  const normalized = String(state || "").trim();
  if (normalized === "inProgress") return "In Progress";
  if (normalized === "completed") return "Completed";
  if (normalized === "unneeded") return "Skipped";
  if (normalized === "unstarted") return "Upcoming";
  if (!normalized) return "Unknown";
  return normalized
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isGenericLiveStateTitle(title, selectedNumber = null) {
  const normalized = String(title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  const gamePattern = Number.isInteger(selectedNumber)
    ? new RegExp(`^game ${selectedNumber} (in progress|live|started)$`, "i")
    : /^game \d+ (in progress|live|started)$/i;
  return gamePattern.test(normalized) || /^map \d+ (in progress|live|started)$/i.test(normalized);
}

function nextObjectiveWindow(match) {
  const rows = Array.isArray(match?.objectiveForecast) ? match.objectiveForecast : [];
  if (!rows.length) {
    return null;
  }

  return [...rows]
    .map((row) => ({
      ...row,
      safeEta: Number.isFinite(Number(row?.etaSeconds)) ? Number(row.etaSeconds) : Number.MAX_SAFE_INTEGER
    }))
    .sort((left, right) => {
      const leftPriority = left.state === "available" ? -1 : 0;
      const rightPriority = right.state === "available" ? -1 : 0;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.safeEta - right.safeEta;
    })[0];
}

function playerDeathCounts(match) {
  const left = Array.isArray(match?.playerEconomy?.left) ? match.playerEconomy.left.filter((row) => Boolean(row?.isDead)).length : 0;
  const right = Array.isArray(match?.playerEconomy?.right) ? match.playerEconomy.right.filter((row) => Boolean(row?.isDead)).length : 0;
  return { left, right };
}

function focusedLiveEventContext(match) {
  const feedRows = buildUnifiedFeed(match);
  if (!feedRows.length) {
    return {
      timelineAnchor: { startTs: null, estimated: true },
      row: null,
      latestRow: null
    };
  }

  const { timelineAnchor, rows } = feedRowsWithGameClock(match, feedRows);
  const enrichedRows = enrichFeedRowsWithState(match, rows);
  const activeEventId = ensureStoryFocus(enrichedRows);
  const latestRow = enrichedRows[0] || null;
  const focusedRow = enrichedRows.find((row) => row.eventId === activeEventId) || latestRow;

  return {
    timelineAnchor,
    row: focusedRow,
    latestRow
  };
}

function formatFocusedEventClock(row, timelineAnchor) {
  if (!row || row.gameClockSeconds === null || row.gameClockSeconds === undefined) {
    return "--:--";
  }

  return `${timelineAnchor?.estimated ? "~" : ""}${formatGameClock(row.gameClockSeconds)}`;
}

function clampSummaryText(value, limit = 68) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.length <= limit) {
    return raw;
  }
  return `${raw.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function liveSummaryCardMarkup(label, value, meta, tone = "neutral", options = {}) {
  const compactClass = options.compact ? " compact" : "";
  return `
    <article class="live-summary-card ${tone}${compactClass}">
      <p class="live-summary-label">${label}</p>
      <p class="live-summary-value">${value}</p>
      <p class="live-summary-meta">${meta}</p>
    </article>
  `;
}

function renderLiveFollowSummary(match, rows, timelineAnchor, activeEventId) {
  if (!elements.liveSummaryWrap) {
    return;
  }

  const selectedState = String(match?.selectedGame?.state || "");
  if (uiState.viewMode !== "game" || selectedState !== "inProgress") {
    elements.liveSummaryWrap.classList.remove("compact");
    elements.liveSummaryWrap.innerHTML = "";
    return;
  }

  const compact = isCompactUI();
  elements.liveSummaryWrap.classList.toggle("compact", compact);
  const feedRows = Array.isArray(rows) ? rows : [];
  const focusedRow = feedRows.find((row) => row.eventId === activeEventId) || feedRows[0] || null;
  const leadRows = feedLeadSeriesRows(match);
  const currentLead = leadRows.length
    ? Number(leadRows[leadRows.length - 1].lead || 0)
    : Number(match?.momentum?.goldLead || 0);
  const leadDescriptor = focusedRow?.leadDescriptor || feedLeadDescriptor(match, currentLead);
  const swingDescriptor = focusedRow?.swingDescriptor || { short: "Δ n/a" };
  const nextObjective = nextObjectiveWindow(match);
  const alerts = buildLiveAlerts(match);
  const priorityAlert = alerts.find((alert) => importanceRank(alert?.importance) >= importanceRank("medium")) || alerts[0] || null;
  const leftShort = scoreboardTeamName(match?.teams?.left?.name);
  const rightShort = scoreboardTeamName(match?.teams?.right?.name);
  const deaths = playerDeathCounts(match);
  const pulse = updateMapPulseState(match);

  const nowValue = clampSummaryText(focusedRow?.title || "Waiting for first tracked event", 60);
  const nowMeta = [
    focusedRow ? `${formatFocusedEventClock(focusedRow, timelineAnchor)} ${focusedRow.phase.label}` : "Feed watching for live changes",
    leadDescriptor.label,
    swingDescriptor.short
  ].filter(Boolean).join(" · ");

  const nextValue = clampSummaryText(
    nextObjective?.label || (nextObjective ? displayObjectiveName(nextObjective.type, match) : "Objective forecast loading"),
    40
  );
  const nextMeta = nextObjective
    ? `${nextObjective.state === "available" ? "Available now" : `ETA ${objectiveEtaLabel(nextObjective)}`}${
        nextObjective.nextAt ? ` · ${shortTimeLabel(nextObjective.nextAt)}` : ""
      }`
    : "Spawn windows appear once cadence is detected";

  let pressureTone = "neutral";
  let pressureValue = "State stable";
  let pressureMeta = "No immediate fight or numbers edge.";
  if (deaths.left && deaths.right) {
    pressureTone = "warn";
    pressureValue = `${leftShort} ${deaths.left} down · ${rightShort} ${deaths.right} down`;
    pressureMeta = "Both teams are playing around respawn timers.";
  } else if (deaths.left || deaths.right) {
    const advantaged = deaths.left ? rightShort : leftShort;
    const punished = deaths.left ? leftShort : rightShort;
    const playersDown = deaths.left || deaths.right;
    pressureTone = deaths.left ? "right" : "left";
    pressureValue = `${advantaged} up ${playersDown}`;
    pressureMeta = `${punished} has ${playersDown} player${playersDown === 1 ? "" : "s"} dead.`;
  } else if (pulse?.team === "left" || pulse?.team === "right") {
    pressureTone = pulse.team;
    pressureValue = `${pulse.team === "left" ? leftShort : rightShort} has map pressure`;
    pressureMeta = "Recent events favor that side around the next contest.";
  } else if (pulse?.team === "both") {
    pressureTone = "warn";
    pressureValue = "Fight window open";
    pressureMeta = "Both sides are contesting the same area right now.";
  } else if (priorityAlert) {
    const importance = normalizedImportance(priorityAlert.importance);
    pressureTone = importance === "critical" ? "critical" : importance === "high" ? "warn" : "neutral";
    pressureValue = clampSummaryText(priorityAlert.title || "Pressure alert", 44);
    pressureMeta = clampSummaryText(priorityAlert.summary || "Watch for the next objective setup.", 76);
  }

  const cards = compact
    ? [
        liveSummaryCardMarkup(
          "Now",
          clampSummaryText(nowValue, 34),
          clampSummaryText(
            [focusedRow ? formatFocusedEventClock(focusedRow, timelineAnchor) : "Watching", leadDescriptor.label].filter(Boolean).join(" · "),
            34
          ),
          focusedRow?.leadDescriptor?.tone || "neutral",
          { compact: true }
        ),
        liveSummaryCardMarkup(
          nextObjective ? "Next" : "Risk",
          clampSummaryText(nextObjective ? nextValue : pressureValue, 30),
          clampSummaryText(nextObjective ? nextMeta : pressureMeta, 42),
          nextObjective ? (nextObjective?.state === "available" ? "live" : "warn") : pressureTone,
          { compact: true }
        )
      ]
    : [
        liveSummaryCardMarkup("Now", nowValue, nowMeta, focusedRow?.leadDescriptor?.tone || "neutral"),
        liveSummaryCardMarkup("Next", nextValue, nextMeta, nextObjective?.state === "available" ? "live" : "warn"),
        liveSummaryCardMarkup("Pressure", pressureValue, pressureMeta, pressureTone)
      ];

  elements.liveSummaryWrap.innerHTML = cards.join("");
}

function renderGameCommandCenter(match) {
  const selected = match.selectedGame;
  if (!selected) {
    elements.gameCommandWrap?.classList.remove("compact");
    elements.gameCommandWrap.innerHTML = `<div class="empty">Game command metrics unavailable.</div>`;
    return;
  }

  const compact = isCompactUI();
  elements.gameCommandWrap?.classList.toggle("compact", compact);
  const gameKey = normalizeGameKey(match?.game);
  const isDota = gameKey === "dota2";
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
  const liveContext = focusedLiveEventContext(match);
  const latestEvent = liveContext.latestRow;
  const nextObjective = nextObjectiveWindow(match);
  const deaths = playerDeathCounts(match);
  const pulse = updateMapPulseState(match);
  const liveClock = elapsedSeconds > 0 ? formatGameClock(elapsedSeconds) : "n/a";
  const telemetryMode = String(selected?.telemetryStatus || "none").toLowerCase();
  const leftTowers = Number(selected?.snapshot?.left?.towers || 0);
  const rightTowers = Number(selected?.snapshot?.right?.towers || 0);
  const leftEpic = Number(selected?.snapshot?.left?.barons || 0);
  const rightEpic = Number(selected?.snapshot?.right?.barons || 0);
  const leftBase = Number(selected?.snapshot?.left?.inhibitors || 0);
  const rightBase = Number(selected?.snapshot?.right?.inhibitors || 0);
  const objectiveRaceLabel = isDota
    ? `T ${leftTowers}-${rightTowers} · Rax ${leftBase}-${rightBase}`
    : `T ${leftTowers}-${rightTowers} · Obj ${leftEpic}-${rightEpic}`;
  const objectiveRaceHint = isDota
    ? `Roshan ${leftEpic}-${rightEpic} · ${displayTeamName(leftName)} vs ${displayTeamName(rightName)}`
    : `${displayTeamName(leftName)} vs ${displayTeamName(rightName)}`;
  const objectiveLabel = nextObjective ? `${displayObjectiveName(nextObjective.type, match)} ${objectiveEtaLabel(nextObjective)}` : "Forecast waiting";
  const objectiveHint = nextObjective?.note || "Next major map timer from tracked cadence.";
  const fightLabel = pulse ? "Fight live" : deaths.left + deaths.right > 0 ? "Reset window" : "Calm map";
  const fightHint = pulse
    ? `${pulse.team === "both" ? "Both teams" : pulse.team === "left" ? displayTeamName(leftName) : displayTeamName(rightName)} showing live pressure`
    : `${displayTeamName(leftName)} ${deaths.left} down · ${displayTeamName(rightName)} ${deaths.right} down`;
  const genericLiveStateEvent = latestEvent && isGenericLiveStateTitle(latestEvent.title, selected.number);
  const latestEventLabel = genericLiveStateEvent ? "Waiting for a major moment" : latestEvent ? latestEvent.title : "No event yet";
  const latestEventHint = genericLiveStateEvent
    ? `Map is ${readableGameStateLabel(selected.state).toLowerCase()}. Live feed will update once the first meaningful event lands.`
    : latestEvent
      ? `${formatFocusedEventClock(latestEvent, liveContext.timelineAnchor)} · ${latestEvent.phase.label} · ${latestEvent.leadDescriptor.label}`
      : "Waiting for timeline events.";
  const mapStateLabel = readableGameStateLabel(selected.state);
  const shortHint = (value, limit = 62) => compact ? clampSummaryText(value, limit) : value;
  const createCommandCard = (label, value, hint, options = {}) =>
    commandCard(label, value, shortHint(hint), { ...options, compact });

  if (selected.state === "inProgress" && telemetryMode !== "rich") {
    const sideSummary = Array.isArray(selected?.sideSummary) && selected.sideSummary.length
      ? selected.sideSummary.join(" · ")
      : "Side assignment pending";
    const clockHint = selected.startedAt ? `Started ${dateTimeCompact(selected.startedAt)}` : `Refresh ${refreshSeconds}s`;
    const watchGuide = match?.watchGuide || {};
    const teamForm = match?.teamForm || match?.preMatchInsights?.teamForm || {};
    const leftForm = normalizeUpcomingTeamFormProfile(teamForm.left);
    const rightForm = normalizeUpcomingTeamFormProfile(teamForm.right);
    const prediction = match?.prediction || match?.preMatchInsights?.prediction || null;
    const headToHead = match?.headToHead || match?.preMatchInsights?.headToHead || null;
    const liveConfirmedLabel = telemetryMode === "pending" ? "Feed warming up" : "Live confirmed";
    const coverageHint = tickerEvents > 0
      ? `${tickerEvents} live signal${tickerEvents === 1 ? "" : "s"} captured so far`
      : "Source confirms the series is live, but full map telemetry is not exposed yet.";
    const watchLabel = selected.watchUrl
      ? String(watchGuide.streamLabel || "Open stream")
      : "Watch pending";
    const watchHint = selected.watchUrl
      ? `${watchGuide.venue || "Tournament stage"} · ${watchGuide.language || "Global"}`
      : "Primary stream link not published yet.";
    const seriesLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
    const seriesHint = `Game ${selected.number} · BO${match?.bestOf || 1} · ${match?.tournament || "Dota 2"}`;
    const formLabel =
      leftForm || rightForm
        ? `${scoreboardTeamName(leftName)} ${formatRatePct(leftForm?.seriesWinRatePct)} · ${scoreboardTeamName(rightName)} ${formatRatePct(rightForm?.seriesWinRatePct)}`
        : "Form loading";
    const formHint =
      leftForm || rightForm
        ? `${scoreboardTeamName(leftName)} ${leftForm?.streakLabel || "n/a"} · ${scoreboardTeamName(rightName)} ${rightForm?.streakLabel || "n/a"}`
        : "Recent team form becomes available as history loads.";
    const favoredPct = prediction
      ? Math.max(Number(prediction.leftWinPct || 0), Number(prediction.rightWinPct || 0))
      : 0;
    const favoriteTeamName = String(prediction?.favoriteTeamName || "").trim();
    const seriesLeaderName = currentSeriesLeader(match);
    const neutralPrediction = !favoriteTeamName || favoriteTeamName === "Even";
    const modelLabel = prediction
      ? neutralPrediction
        ? match.status === "live" && seriesLeaderName
          ? "No clear edge"
          : `Toss-up ${favoredPct.toFixed(1)}%`
        : `${favoriteTeamName} ${favoredPct.toFixed(1)}%`
      : "Edge loading";
    const modelHint = prediction
      ? `${
          match.status === "live" && neutralPrediction && seriesLeaderName
            ? `Series lead: ${scoreboardTeamName(seriesLeaderName)} ${seriesLabel} · `
            : ""
        }${String(prediction.confidence || "low").toUpperCase()} confidence · ${
          Array.isArray(prediction.drivers) && prediction.drivers.length ? prediction.drivers[0] : "Recent Dota history only."
        }`
      : "Need more recent series history to score the matchup.";
    const h2hLabel =
      headToHead && Number(headToHead.total || headToHead.matches || 0) > 0
        ? `${scoreboardTeamName(leftName)} ${headToHead.leftWins ?? headToHead.wins ?? 0}-${headToHead.rightWins ?? headToHead.losses ?? 0} ${scoreboardTeamName(rightName)}`
        : "No recent H2H";
    const h2hHint =
      headToHead && Number(headToHead.total || headToHead.matches || 0) > 0
        ? `${headToHead.total || headToHead.matches} recent meeting${Number(headToHead.total || headToHead.matches) === 1 ? "" : "s"}`
        : "Direct series history is limited.";

    const cards = [
      {
        key: "state",
        markup: createCommandCard(
          compact ? "State" : "Current State",
          liveConfirmedLabel,
          compact ? `G${selected.number} · ${mapStateLabel}` : `Game ${selected.number} · ${mapStateLabel} · ${telemetryMode.toUpperCase()} telemetry`,
          {
            tone: "live",
            featured: true
          }
        )
      },
      {
        key: "series",
        markup: createCommandCard("Series", seriesLabel, compact ? `BO${match?.bestOf || 1} · ${match?.tournament || "Dota 2"}` : seriesHint, {
          tone: "neutral"
        })
      },
      {
        key: "watch",
        markup: createCommandCard(
          "Watch",
          watchLabel,
          compact
            ? selected.watchUrl
              ? `${watchGuide.venue || "Stage"} · ${watchGuide.language || "Global"}`
              : "Stream link pending"
            : watchHint,
          {
            tone: selected.watchUrl ? "live" : "neutral"
          }
        )
      },
      {
        key: "form",
        markup: createCommandCard("Form", formLabel, formHint, {
          tone: leftForm || rightForm ? "neutral" : "warn"
        })
      },
      {
        key: "edge",
        markup: createCommandCard(compact ? "Edge" : "Matchup Edge", modelLabel, modelHint, {
          tone: !neutralPrediction ? "warn" : "neutral"
        })
      },
      {
        key: "history",
        markup: createCommandCard(isDota ? "Objectives" : "Head-to-Head", isDota ? objectiveRaceLabel : h2hLabel, isDota ? objectiveRaceHint : h2hHint, {
          tone:
            isDota
              ? leftTowers + rightTowers + leftBase + rightBase + leftEpic + rightEpic > 0
                ? "neutral"
                : "warn"
              : headToHead && Number(headToHead.total || headToHead.matches || 0) > 0
                ? "neutral"
                : "warn"
        })
      },
      {
        key: "coverage",
        markup: createCommandCard(
          "Coverage",
          liveClock,
          compact ? `${tickerEvents} signal${tickerEvents === 1 ? "" : "s"} · ${sideSummary}` : `${clockHint} · ${coverageHint} · ${sideSummary}`,
          {
            tone: telemetryMode === "pending" ? "warn" : "neutral"
          }
        )
      }
    ];
    const compactKeys = selected.watchUrl ? ["state", "series", "watch", "coverage"] : ["state", "series", "edge", "coverage"];
    elements.gameCommandWrap.innerHTML = cards
      .filter((card) => !compact || compactKeys.includes(card.key))
      .map((card) => card.markup)
      .join("");
    return;
  }

  const richCards = [
    {
      key: "focus",
      markup: createCommandCard(
        compact ? "Focus" : "Live Focus",
        latestEventLabel,
        compact
          ? latestEvent
            ? `${formatFocusedEventClock(latestEvent, liveContext.timelineAnchor)} · ${latestEvent.phase.label}`
            : `Map ${mapStateLabel.toLowerCase()}`
          : latestEventHint,
        { tone: latestEvent?.leadDescriptor?.tone || "neutral", featured: true }
      )
    },
    {
      key: "state",
      markup: createCommandCard(compact ? "State" : "Map State", mapStateLabel, compact
        ? `G${selected.number} · ${selected.telemetryStatus || "none"}`
        : `Game ${selected.number} · ${selected.telemetryStatus || "none"} telemetry`, {
        tone: selected.state === "inProgress" ? "live" : selected.state === "completed" ? "neutral" : "warn"
      })
    },
    {
      key: "clock",
      markup: createCommandCard("Clock", liveClock, compact ? `${tickerEvents} signal${tickerEvents === 1 ? "" : "s"}` : `Refresh ${refreshSeconds}s · ${tickerEvents} feed signals`, {
        tone: "neutral"
      })
    },
    {
      key: "kills",
      markup: createCommandCard("Kills", `${leftKills}-${rightKills}`, compact
        ? `${killPace} · ${scoreboardTeamName(leftName)} / ${scoreboardTeamName(rightName)}`
        : `${killPace} · ${displayTeamName(leftName)} vs ${displayTeamName(rightName)}`, {
        tone: totalKills >= 18 ? "warn" : "neutral"
      })
    },
    {
      key: "objectives",
      markup: createCommandCard(isDota ? "Objectives" : "Map Race", objectiveRaceLabel, objectiveRaceHint, {
        tone: leftTowers + rightTowers + leftBase + rightBase + leftEpic + rightEpic > 0 ? "neutral" : "warn"
      })
    },
    {
      key: "next",
      markup: createCommandCard(compact ? "Next" : "Next Objective", objectiveLabel, objectiveHint, {
        tone: nextObjective?.state === "available" ? "live" : "warn"
      })
    },
    {
      key: "fight",
      markup: createCommandCard(compact ? "Pressure" : "Fight State", fightLabel, fightHint, {
        tone: pulse ? "warn" : deaths.left + deaths.right > 0 ? "neutral" : "live"
      })
    },
    {
      key: "down",
      markup: createCommandCard(compact ? "Down" : "Players Down", `${deaths.left}-${deaths.right}`, `${displayTeamName(leftName)} · ${displayTeamName(rightName)}`, {
        tone: deaths.left + deaths.right >= 2 ? "warn" : "neutral"
      })
    },
    {
      key: "feed",
      markup: createCommandCard(
        compact ? (isDota ? "Feed" : "Throughput") : isDota ? "Telemetry" : "Throughput",
        `${objectiveEvents} obj · ${bursts} bursts`,
        `${milestones} milestones tracked this map`,
        {
          tone: bursts >= 2 ? "warn" : "neutral"
        }
      )
    }
  ];
  const compactKeys = selected.state === "completed"
    ? ["focus", "kills", "objectives", "state"]
    : selected.state === "inProgress"
      ? ["focus", "kills", "objectives", "next"]
      : ["focus", "state", "clock", "objectives"];
  elements.gameCommandWrap.innerHTML = richCards
    .filter((card) => !compact || compactKeys.includes(card.key))
    .map((card) => card.markup)
    .join("");
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

function buildTeamComparisonRows(match) {
  const selected = match.selectedGame;
  const snapshot = selected?.snapshot;
  if (!snapshot) {
    return null;
  }

  const rows = [
    { key: "gold", label: "Gold" },
    { key: "kills", label: "Kills" },
    ...objectiveMetricDefinitions(match)
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

  return rows;
}

function comparisonRaceChip(match, row) {
  if (!row) {
    return null;
  }

  const leftShort = scoreboardTeamName(match?.teams?.left?.name);
  const rightShort = scoreboardTeamName(match?.teams?.right?.name);
  const totalValue = Number(row.left || 0) + Number(row.right || 0);

  if (row.key !== "gold" && row.key !== "kills" && totalValue <= 0 && !Number(row.diff)) {
    return null;
  }

  if (row.diff === null) {
    return {
      label: `${row.label} n/a`,
      tone: "even"
    };
  }

  if (row.diff === 0) {
    if (row.key === "gold") {
      return {
        label: `${row.label} even`,
        tone: "even"
      };
    }
    return {
      label: `${row.label} ${formatMetricValue(row.key, row.left)}-${formatMetricValue(row.key, row.right)}`,
      tone: "even"
    };
  }

  const leader = row.diff > 0 ? leftShort : rightShort;
  const amount = row.key === "gold" ? compactGold(Math.abs(row.diff)) : String(Math.abs(Math.round(row.diff)));
  return {
    label: `${row.label} ${leader} +${amount}`,
    tone: row.diff > 0 ? "left" : "right"
  };
}

function renderTeamComparison(match) {
  const compact = isCompactUI();
  const rows = buildTeamComparisonRows(match);
  if (!rows) {
    elements.teamCompareWrap.innerHTML = `<div class="empty">Team comparison unavailable for this game.</div>`;
    return;
  }

  if (!rows.length) {
    elements.teamCompareWrap.innerHTML = `<div class="empty">Not enough team metrics to compare this map.</div>`;
    return;
  }

  const leftShort = scoreboardTeamName(match.teams.left.name, match?.game);
  const rightShort = scoreboardTeamName(match.teams.right.name, match?.game);
  const raceChips = rows
    .map((row) => comparisonRaceChip(match, row))
    .filter(Boolean)
    .slice(0, compact ? 3 : 6);
  const topSummary = raceChips[0] || null;
  const compactCards = rows
    .slice(0, 4)
    .map((row) => {
      const diff = row.diff === null ? "n/a" : signed(Math.round(row.diff));
      const tone = row.diff === null ? "neutral" : row.diff > 0 ? "left" : row.diff < 0 ? "right" : "neutral";
      return metricDeskCard(
        row.label,
        diff,
        `${leftShort} ${formatMetricValue(row.key, row.left)} · ${rightShort} ${formatMetricValue(row.key, row.right)}`,
        tone,
        { compact }
      );
    })
    .join("");

  elements.teamCompareWrap.innerHTML = `
    <div class="game-team-compare-desk">
      <article class="game-team-compare-hero${compact ? " compact" : ""}">
        <div class="game-team-compare-head">
          <div>
            <p class="tempo-label">Team desk</p>
            <h3>${escapeHtml(topSummary?.label || "Map-wide team comparison")}</h3>
            <p class="game-team-compare-note">${escapeHtml(
              compact
                ? "Latest map totals."
                : `${leftShort} vs ${rightShort} across the latest tracked map totals.`
            )}</p>
          </div>
          ${compact ? "" : `<div class="form-summary-strip">
            <span class="form-summary-pill">${escapeHtml(leftShort)}</span>
            <span class="form-summary-pill">${escapeHtml(rightShort)}</span>
          </div>`}
        </div>
        ${
          raceChips.length
            ? `<div class="game-team-compare-chiprow">${raceChips
                .map((chip) => `<span class="game-team-compare-chip ${escapeHtml(chip.tone || "neutral")}">${escapeHtml(chip.label)}</span>`)
                .join("")}</div>`
            : ""
        }
      </article>
      ${
        compact
          ? `<div class="match-desk-mini-grid compact">${compactCards}</div>`
          : `<div class="lane-table-wrap">
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
      </div>`
      }
    </div>
  `;
}

function buildGamePlayerRows(match) {
  const economy = match?.playerEconomy;
  if (!economy || (!Array.isArray(economy.left) && !Array.isArray(economy.right))) {
    return [];
  }

  const teamKills = {
    left: Number(match?.selectedGame?.snapshot?.left?.kills || match?.teams?.left?.kills || 0),
    right: Number(match?.selectedGame?.snapshot?.right?.kills || match?.teams?.right?.kills || 0)
  };
  const teamGold = {
    left: Number(match?.teamEconomyTotals?.left?.totalGold || 0),
    right: Number(match?.teamEconomyTotals?.right?.totalGold || 0)
  };
  const impactByKey = new Map(
    (match?.topPerformers || []).map((player) => [
      `${player.team}::${String(player.name || "").toLowerCase()}`,
      Number(player?.impactScore || 0)
    ])
  );

  const leftRows = Array.isArray(economy.left) ? economy.left : [];
  const rightRows = Array.isArray(economy.right) ? economy.right : [];
  return [...leftRows.map((row) => ({ ...row, team: "left" })), ...rightRows.map((row) => ({ ...row, team: "right" }))]
    .map((row) => {
      const key = `${row.team}::${String(row.name || "").toLowerCase()}`;
      const kp =
        teamKills[row.team] > 0 ? ((Number(row.kills || 0) + Number(row.assists || 0)) / teamKills[row.team]) * 100 : null;
      const goldShare = teamGold[row.team] > 0 ? (Number(row.goldEarned || 0) / teamGold[row.team]) * 100 : null;

      return {
        ...row,
        kp,
        goldShare,
        impact: impactByKey.get(key)
      };
    });
}

function gamePlayerSpotlightScore(row) {
  return (
    Number(row?.impact || 0) * 10 +
    Number(row?.goldEarned || 0) / 1000 +
    Number(row?.kp || 0) / 6 +
    Number(row?.kills || 0) * 0.8 +
    Number(row?.assists || 0) * 0.25
  );
}

function pickBestPlayerRow(rows, scorer) {
  return rows.reduce((best, row) => {
    if (!row) {
      return best;
    }
    if (!best) {
      return row;
    }
    const candidateScore = Number(scorer(row) || 0);
    const bestScore = Number(scorer(best) || 0);
    if (candidateScore !== bestScore) {
      return candidateScore > bestScore ? row : best;
    }
    return Number(row?.goldEarned || 0) > Number(best?.goldEarned || 0) ? row : best;
  }, null);
}

function gamePlayerMetricCard(label, value, note = null, tone = "neutral") {
  return `
    <article class="game-player-metric ${tone}">
      <p class="tempo-label">${escapeHtml(label)}</p>
      <p class="game-player-metric-value">${escapeHtml(value)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function renderGamePlayerSpotlight(match, row, toneClass = "left") {
  const compact = isCompactUI();
  const teamName = row?.team === "right" ? match?.teams?.right?.name : match?.teams?.left?.name;
  const teamShort = scoreboardTeamName(teamName, match?.game);
  if (!row || !teamName) {
    return `
      <article class="game-player-spotlight ${toneClass}${compact ? " compact" : ""}">
        <p class="tempo-label">${toneClass === "right" ? "Right side" : "Left side"}</p>
        <p class="meta-text">Waiting for player telemetry.</p>
      </article>
    `;
  }

  const role = roleMeta(row.role, normalizeGameKey(match?.game));
  const playerName = displayPlayerHandle(row.name, teamName);
  const heroName = trackerHeroName(row);
  const kpLabel = Number.isFinite(row.kp) ? `${row.kp.toFixed(1)}% KP` : "KP n/a";
  const impactLabel = Number.isFinite(row.impact) ? `Impact ${row.impact.toFixed(1)}` : "Impact n/a";

  return `
    <article class="game-player-spotlight ${toneClass}${compact ? " compact" : ""}">
      <div class="game-player-spotlight-head">
        <span class="game-player-spotlight-tag">${escapeHtml(teamShort)}</span>
        <span class="form-summary-pill">${escapeHtml(role.short)}</span>
      </div>
      <div class="game-player-spotlight-main">
        <span class="game-player-spotlight-avatar">${heroIconMarkup(match, row)}</span>
        <div class="game-player-spotlight-copy">
          <h3>${escapeHtml(playerName)}</h3>
          <p class="meta-text">${escapeHtml(compact ? heroName : `${heroName} · ${role.label}`)}</p>
        </div>
      </div>
      ${
        compact
          ? ""
          : `<div class="form-summary-strip">
        <span class="form-summary-pill">Gold ${formatNumber(row.goldEarned || 0)}</span>
        <span class="form-summary-pill">${kpLabel}</span>
        <span class="form-summary-pill">${impactLabel}</span>
      </div>`
      }
      <p class="meta-text">${
        compact
          ? `KDA ${row.kills || 0}/${row.deaths || 0}/${row.assists || 0} · Gold ${formatNumber(row.goldEarned || 0)} · ${kpLabel}`
          : `KDA ${row.kills || 0}/${row.deaths || 0}/${row.assists || 0} · Share ${toPercent(row.goldShare)}`
      }</p>
    </article>
  `;
}

function renderGamePlayerSummary(match) {
  if (!elements.gamePlayerSummaryWrap) {
    return;
  }

  const rows = buildGamePlayerRows(match);
  if (!rows.length) {
    elements.gamePlayerSummaryWrap.innerHTML = "";
    return;
  }

  const leftRows = rows.filter((row) => row.team === "left");
  const rightRows = rows.filter((row) => row.team === "right");
  const leftStandout = pickBestPlayerRow(leftRows, gamePlayerSpotlightScore);
  const rightStandout = pickBestPlayerRow(rightRows, gamePlayerSpotlightScore);
  const richest = pickBestPlayerRow(rows, (row) => Number(row?.goldEarned || 0));
  const kpLeader = pickBestPlayerRow(rows, (row) => Number.isFinite(row?.kp) ? row.kp : -1);
  const impactLeader = pickBestPlayerRow(rows, (row) => Number.isFinite(row?.impact) ? row.impact : -1);
  const selectedState = String(match?.selectedGame?.state || "");
  const compact = isCompactUI();
  const centerMetrics = [
    gamePlayerMetricCard(
      "Richest",
      richest ? displayPlayerHandle(richest.name, teamNameBySide(match, richest.team)) : "n/a",
      richest ? `${scoreboardTeamName(teamNameBySide(match, richest.team), match?.game)} · ${formatNumber(richest.goldEarned || 0)} gold` : "Waiting for player totals.",
      richest?.team || "neutral"
    ),
    gamePlayerMetricCard(
      "Best KP",
      kpLeader && Number.isFinite(kpLeader.kp) ? `${kpLeader.kp.toFixed(1)}%` : "n/a",
      kpLeader ? `${displayPlayerHandle(kpLeader.name, teamNameBySide(match, kpLeader.team))} · ${scoreboardTeamName(teamNameBySide(match, kpLeader.team), match?.game)}` : "Kill participation appears once team kills land.",
      kpLeader?.team || "neutral"
    ),
    gamePlayerMetricCard(
      "Impact",
      impactLeader && Number.isFinite(impactLeader.impact) ? impactLeader.impact.toFixed(1) : "n/a",
      impactLeader ? `${displayPlayerHandle(impactLeader.name, teamNameBySide(match, impactLeader.team))} · ${trackerHeroName(impactLeader)}` : selectedState === "inProgress" ? "Impact score building from live events." : "Impact score unavailable.",
      impactLeader?.team || "neutral"
    )
  ].filter((_, index) => !compact || index !== 1);

  elements.gamePlayerSummaryWrap.innerHTML = `
    <div class="game-player-summary-shell">
      ${renderGamePlayerSpotlight(match, leftStandout, "left")}
      <div class="game-player-summary-center${compact ? " compact" : ""}">
        ${centerMetrics.join("")}
      </div>
      ${renderGamePlayerSpotlight(match, rightStandout, "right")}
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

function syncTrackerSortControls() {
  const current = uiState.trackerSort || "role";
  if (elements.trackerSort) {
    elements.trackerSort.value = current;
  }

  if (!Array.isArray(elements.trackerSortButtons)) {
    return;
  }

  for (const button of elements.trackerSortButtons) {
    const active = button.getAttribute("data-sort") === current;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function renderPlayerTracker(match) {
  syncTrackerSortControls();
  const economy = match.playerEconomy;
  if (!economy || (!Array.isArray(economy.left) && !Array.isArray(economy.right))) {
    clearRespawnTicker();
    elements.playerTrackerWrap.innerHTML = `<div class="empty">Player tracker appears once economy telemetry is available.</div>`;
    return;
  }

  const gameKey = normalizeGameKey(match?.game);
  const isDota = gameKey === "dota2";
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
  const hasHealthTelemetry = rows.some((row) => Number.isFinite(healthPctForRow(row)));
  const compactTrackerUsesGpm = gameKey === "dota2" && !hasHealthTelemetry;

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
              <th>${compactTrackerUsesGpm ? "GPM" : "HP"}</th>
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
                const compactMetricValue = compactTrackerUsesGpm ? formatNumber(row.gpm || 0) : hpCompactLabel;
                const compactSubline = isDota
                  ? `<span class="tracker-player-inline-sub" title="LH/DN ${row.cs ?? 0}/${row.denies ?? 0}">LH/DN ${row.cs ?? 0}/${row.denies ?? 0}</span>`
                  : "";
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
                          ${compactSubline}
                        </div>
                      </div>
                      ${respawnOverlay}
                    </td>
                    <td>
                      ${compactTrackerUsesGpm
                        ? `<span class="tracker-hp-label compact" title="GPM">${compactMetricValue}</span>`
                        : `<div class="tracker-hp-cell compact">
                            <div class="hp-track ${hpTone}">
                              <div class="hp-fill ${hpTone}" style="width:${hpWidth}%"></div>
                            </div>
                            <span class="tracker-hp-label compact" title="${hpLabel}">${compactMetricValue}</span>
                          </div>`}
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
            <th>${isDota ? "LH/DN" : "CS"}</th>
            <th>Net Worth</th>
            <th>${isDota ? "GPM/XPM" : "GPM"}</th>
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
                  <td>${isDota ? `${row.cs ?? 0}/${row.denies ?? 0}` : row.cs ?? "n/a"}</td>
                  <td>${formatNumber(row.goldEarned || 0)}</td>
                  <td>${isDota ? `${formatNumber(row.gpm || 0)} / ${formatNumber(row.xpm || 0)}` : formatNumber(row.gpm || 0)}</td>
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

function feedBucketTagLabel(bucket) {
  const normalized = String(bucket || "").toLowerCase();
  if (normalized === "combat") return "Fight";
  if (normalized === "objective") return "Obj";
  if (normalized === "swing") return "Gold";
  if (normalized === "moment") return "State";
  return "Event";
}

function normalizeFeedTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function feedBucketSpecificityRank(bucket) {
  const normalized = String(bucket || "").toLowerCase();
  if (normalized === "objective") return 4;
  if (normalized === "combat") return 3;
  if (normalized === "swing") return 2;
  if (normalized === "moment") return 1;
  return 0;
}

function feedHasUsefulSummary(row) {
  const summary = String(row?.summary || "").trim();
  if (!summary) {
    return false;
  }

  const normalized = summary.toLowerCase();
  if (
    normalized === "objective timeline event." ||
    normalized === "team crossed an economy threshold." ||
    normalized === "multi-kill combat window detected."
  ) {
    return false;
  }

  return normalized !== normalizeFeedTitle(row?.title);
}

function feedRowPreferenceScore(row) {
  return importanceRank(row?.importance) * 10 + feedBucketSpecificityRank(row?.bucket) + (feedHasUsefulSummary(row) ? 1 : 0);
}

function semanticFeedEventKey(row) {
  const titleKey = normalizeFeedTitle(row?.title);
  if (!titleKey) {
    return "";
  }

  const teamKey = String(row?.team || "none").trim().toLowerCase();
  const parsedAt = Date.parse(String(row?.at || ""));
  const timeKey = Number.isFinite(parsedAt) ? String(Math.floor(parsedAt / 10_000)) : String(row?.at || "").trim();
  return `${teamKey}|${titleKey}|${timeKey}`;
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
  const semanticIndexByKey = new Map();

  for (const row of rows) {
    const rowId = String(row?.id || "").trim();
    const contentFingerprint = feedRowContentFingerprint(row);
    const semanticKey = semanticFeedEventKey(row);
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

    if (semanticKey && semanticIndexByKey.has(semanticKey)) {
      const existingIndex = semanticIndexByKey.get(semanticKey);
      if (Number.isInteger(existingIndex) && deduped[existingIndex]) {
        const existing = deduped[existingIndex];
        if (feedRowPreferenceScore(row) > feedRowPreferenceScore(existing)) {
          deduped[existingIndex] = row;
        }
      }
      continue;
    }

    if (semanticKey) {
      semanticIndexByKey.set(semanticKey, deduped.length);
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

function buildCompletedGameStory(match) {
  const selectedGame = match?.selectedGame;
  if (!selectedGame || String(selectedGame.state || "") !== "completed") {
    return null;
  }

  const leadRows = feedLeadSeriesRows(match);
  const peakLeadRow = leadRows.reduce((best, row) => {
    if (!best) {
      return row;
    }
    return Math.abs(row.lead) > Math.abs(best.lead) ? row : best;
  }, null);
  const peakLead = Number(peakLeadRow?.lead || 0);
  const peakLeadLabel = peakLeadRow ? feedLeadDescriptor(match, peakLead).label : "Lead data unavailable";
  const peakLeadClockSeconds =
    peakLeadRow && selectedGame.startedAt
      ? Math.max(0, Math.round((peakLeadRow.at - Date.parse(String(selectedGame.startedAt || ""))) / 1000))
      : null;
  const peakLeadNote = Number.isFinite(peakLeadClockSeconds)
    ? `Peak at ${formatGameClock(peakLeadClockSeconds)}`
    : "Peak lead timing unavailable";

  const feedRows = enrichFeedRowsWithState(match, feedRowsWithGameClock(match, buildUnifiedFeed(match)).rows);
  const turningPoint = [...feedRows]
    .filter((row) => !isGenericLiveStateTitle(row.title, selectedGame.number))
    .sort((left, right) => {
      const majorDelta = Number(Boolean(right.majorEvent)) - Number(Boolean(left.majorEvent));
      if (majorDelta !== 0) {
        return majorDelta;
      }
      const importanceDelta = importanceRank(right.importance) - importanceRank(left.importance);
      if (importanceDelta !== 0) {
        return importanceDelta;
      }
      return Number(right.eventTs || 0) - Number(left.eventTs || 0);
    })[0] || null;

  const turningPointLabel = turningPoint ? turningPoint.title : "No major turning point captured";
  const turningPointBits = [];
  if (turningPoint) {
    if (Number.isFinite(turningPoint.gameClockSeconds)) {
      turningPointBits.push(formatGameClock(turningPoint.gameClockSeconds));
    }
    if (turningPoint.leadDescriptor?.label) {
      turningPointBits.push(turningPoint.leadDescriptor.label);
    }
  }

  const pulseTitle = String(match?.pulseCard?.title || "").trim();
  const pulseSummary = String(match?.pulseCard?.summary || "").trim();
  const headline = pulseTitle || (turningPoint ? turningPoint.title : "Final map recap");
  const summary =
    pulseSummary ||
    (turningPoint?.summary && feedHasUsefulSummary(turningPoint) ? turningPoint.summary : "") ||
    "Map-level live story signals were limited for this final result.";

  return {
    headline,
    summary,
    peakLeadLabel,
    peakLeadNote,
    turningPointLabel,
    turningPointNote: turningPointBits.join(" · ")
  };
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

function normalizedImportance(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return "low";
}

function feedPhaseDescriptor(gameClockSeconds) {
  if (!Number.isFinite(gameClockSeconds)) {
    return { key: "unknown", label: "Phase ?" };
  }
  if (gameClockSeconds < 15 * 60) {
    return { key: "early", label: "Early" };
  }
  if (gameClockSeconds < 28 * 60) {
    return { key: "mid", label: "Mid" };
  }
  return { key: "late", label: "Late" };
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

function feedSwingDescriptor(leadRows, eventTs) {
  if (!Number.isFinite(eventTs) || !Array.isArray(leadRows) || !leadRows.length) {
    return {
      label: "Δ n/a",
      short: "Δ n/a",
      tone: "even",
      value: 0
    };
  }

  const current = leadValueAtTimestamp(leadRows, eventTs);
  const prior = leadValueAtTimestamp(leadRows, eventTs - 120_000);
  const delta = current - prior;
  if (!Number.isFinite(delta) || Math.abs(delta) < 120) {
    return {
      label: "Δ Flat",
      short: "Δ Flat",
      tone: "even",
      value: 0
    };
  }

  const tone = delta > 0 ? "left" : "right";
  const amount = compactGold(Math.abs(delta));
  return {
    label: `Δ ${delta > 0 ? "+" : "-"}${amount} (2m)`,
    short: `${delta > 0 ? "+" : "-"}${amount}`,
    tone,
    value: delta
  };
}

function inferObjectiveKeyFromEvent(row) {
  if (!row || row.bucket !== "objective") {
    return null;
  }

  const source = `${String(row.title || "")} ${String(row.summary || "")}`.toLowerCase();
  if (source.includes("baron")) return "baron";
  if (source.includes("dragon") || source.includes("drake")) return "dragon";
  if (source.includes("herald")) return "herald";
  return null;
}

function majorFeedEvent(row) {
  const importance = importanceRank(row?.importance);
  const swingValue = Math.abs(Number(row?.swingDescriptor?.value || 0));
  const leadValue = Math.abs(Number(row?.leadAtEvent || 0));

  if (row?.bucket === "objective") {
    return { kind: "objective", label: "Objective" };
  }
  if (importance >= 4) {
    return { kind: "critical", label: "Critical" };
  }
  if (row?.bucket === "swing" && (swingValue >= 1200 || importance >= 3)) {
    return { kind: "swing", label: "Swing" };
  }
  if (row?.bucket === "combat" && importance >= 3) {
    return { kind: "fight", label: "Fight" };
  }
  if (leadValue >= 4000 && importance >= 2) {
    return { kind: "lead", label: "Lead" };
  }

  return null;
}

function enrichFeedRowsWithState(match, rows) {
  const leadRows = feedLeadSeriesRows(match);
  return rows.map((row) => {
    const leadAtEvent = Number.isFinite(row.eventTs) && leadRows.length ? leadValueAtTimestamp(leadRows, row.eventTs) : null;
    const leadDescriptor = feedLeadDescriptor(match, leadAtEvent);
    const swingDescriptor = feedSwingDescriptor(leadRows, row.eventTs);
    const phase = feedPhaseDescriptor(row.gameClockSeconds);
    const importance = normalizedImportance(row.importance);
    const objectiveKey = inferObjectiveKeyFromEvent(row);
    const majorEvent = majorFeedEvent({
      ...row,
      leadAtEvent,
      swingDescriptor,
      importance
    });
    return {
      ...row,
      leadAtEvent,
      leadDescriptor,
      swingDescriptor,
      phase,
      importance,
      objectiveKey,
      majorEvent,
      hasUsefulSummary: feedHasUsefulSummary(row)
    };
  });
}

function feedClusterKey(row) {
  if (!row || row.majorEvent || importanceRank(row.importance) > 2 || row.bucket === "objective") {
    return "";
  }

  const titleKey = normalizeFeedTitle(row.title);
  if (!titleKey) {
    return "";
  }

  return `${String(row.team || "none").toLowerCase()}|${String(row.bucket || "event").toLowerCase()}|${titleKey}`;
}

function collapseFeedRowsForDisplay(rows) {
  const collapsed = [];

  for (const row of rows) {
    const clusterKey = feedClusterKey(row);
    const rowTs = Number(row?.eventTs || 0);
    const previous = collapsed[collapsed.length - 1];

    if (
      previous &&
      clusterKey &&
      previous.clusterKey === clusterKey &&
      Number.isFinite(rowTs) &&
      Number.isFinite(previous.latestEventTs) &&
      Math.abs(previous.latestEventTs - rowTs) <= 75_000
    ) {
      previous.clusterCount += 1;
      previous.clusterEventIds.push(row.eventId);
      previous.latestEventTs = Math.max(previous.latestEventTs, rowTs);
      continue;
    }

    collapsed.push({
      ...row,
      clusterKey,
      clusterCount: 1,
      clusterEventIds: [row.eventId],
      latestEventTs: rowTs
    });
  }

  return collapsed;
}

function ensureStoryFocus(rows) {
  if (!rows.length) {
    uiState.storyFocusEventId = null;
    uiState.storyFocusUserSet = false;
    return null;
  }

  const byId = new Set(rows.map((row) => String(row.eventId || "")).filter(Boolean));
  if (uiState.storyFocusEventId && byId.has(uiState.storyFocusEventId)) {
    return uiState.storyFocusEventId;
  }

  const rankedRows = [...rows].sort((left, right) => {
    const importanceDelta = importanceRank(right.importance) - importanceRank(left.importance);
    if (importanceDelta !== 0) {
      return importanceDelta;
    }
    const leftTs = Number(left.eventTs || 0);
    const rightTs = Number(right.eventTs || 0);
    return rightTs - leftTs;
  });
  const preferred = uiState.storyFocusUserSet ? rows[0] : rankedRows[0] || rows[0];
  const fallback = String(preferred?.eventId || rows[0].eventId || "");
  uiState.storyFocusEventId = fallback || null;
  return uiState.storyFocusEventId;
}

function setStoryFocusEvent(eventId, options = {}) {
  const normalized = String(eventId || "").trim();
  if (!normalized || normalized === uiState.storyFocusEventId) {
    return;
  }

  uiState.storyFocusEventId = normalized;
  uiState.storyFocusUserSet = true;
  if (uiState.match) {
    renderLeadTrend(uiState.match);
    renderGameOverviewDesk(uiState.match);
    renderGameFeedDesk(uiState.match);
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

function gameFeedDeskCard(label, value, note = null, tone = "neutral", options = {}) {
  const compactClass = options.compact ? " compact" : "";
  return `
    <article class="game-feed-desk-card ${tone}${compactClass}">
      <p class="tempo-label">${escapeHtml(label)}</p>
      <p class="game-feed-desk-value">${escapeHtml(value)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function renderGameFeedDesk(match) {
  if (!elements.gameFeedDeskWrap) {
    return;
  }

  const selected = match?.selectedGame;
  if (!selected) {
    elements.gameFeedDeskWrap.innerHTML = "";
    return;
  }

  const selectedState = String(selected?.state || "");
  const stateClass = selectedState === "inProgress" ? "live" : selectedState === "completed" ? "complete" : "upcoming";
  const compact = isCompactUI();
  const feedRows = buildUnifiedFeed(match);
  const totalEvents = feedRows.length;
  const alerts = buildLiveAlerts(match);
  const priorityAlert = alerts.find((alert) => importanceRank(alert?.importance) >= importanceRank("medium")) || alerts[0] || null;
  const latestEventTime = feedRows[0]?.at ? shortTimeLabel(feedRows[0].at) : null;

  let title = `Game ${selected.number} live desk`;
  let note = "Waiting for the next tracked event.";
  let cards = [];
  const createDeskCard = (label, value, copy = null, tone = "neutral") =>
    gameFeedDeskCard(label, value, compact ? clampSummaryText(copy, 54) : copy, tone, { compact });

  if (selectedState === "completed") {
    const story = buildCompletedGameStory(match);
    title = story?.headline || `Game ${selected.number} final story`;
    note = story?.summary || "Completed map story built from the captured event log.";
    cards = [
      createDeskCard(compact ? "Turn" : "Turning Point", story?.turningPointLabel || "n/a", story?.turningPointNote || "No decisive event captured.", "neutral"),
      createDeskCard(compact ? "Peak" : "Peak Lead", story?.peakLeadLabel || "n/a", story?.peakLeadNote || "Lead data unavailable.", "neutral"),
      createDeskCard(
        compact ? "Alert" : "Alerts",
        priorityAlert?.title || "Stable",
        priorityAlert?.summary || "No major pressure alerts recorded.",
        priorityAlert && importanceRank(priorityAlert.importance) >= importanceRank("high") ? "warn" : "neutral"
      ),
      createDeskCard("Events", String(totalEvents), latestEventTime ? `Latest ${latestEventTime}` : "No event timestamps.", "neutral")
    ];
  } else if (selectedState === "inProgress") {
    const context = focusedLiveEventContext(match);
    const focusedRow = context.row || context.latestRow;
    const nextObjective = nextObjectiveWindow(match);
    const leadDescriptor = focusedRow?.leadDescriptor || feedLeadDescriptor(match, Number(match?.momentum?.goldLead || 0));
    const focusClock = focusedRow ? formatFocusedEventClock(focusedRow, context.timelineAnchor) : "--:--";
    title = focusedRow?.title || `Game ${selected.number} live desk`;
    note = focusedRow
      ? `${focusClock} · ${focusedRow.phase.label} · ${leadDescriptor.label}`
      : "Live desk watching for the first major event.";
    cards = [
      createDeskCard(
        compact ? "Now" : "Focus",
        focusedRow?.bucket ? feedBucketLabel(focusedRow.bucket) : "Watching",
        focusedRow?.summary && feedHasUsefulSummary(focusedRow) ? clampSummaryText(focusedRow.summary, 84) : note,
        focusedRow?.leadDescriptor?.tone || "neutral"
      ),
      createDeskCard(
        compact ? "Next" : "Next Objective",
        nextObjective ? displayObjectiveName(nextObjective.type, match) : "Forecast waiting",
        nextObjective
          ? `${nextObjective.state === "available" ? "Available now" : `ETA ${objectiveEtaLabel(nextObjective)}`}${
              nextObjective.nextAt ? ` · ${shortTimeLabel(nextObjective.nextAt)}` : ""
            }`
          : "Timer windows appear once cadence is established.",
        nextObjective?.state === "available" ? "live" : "neutral"
      ),
      createDeskCard(
        "Alert",
        priorityAlert?.title || "Stable state",
        priorityAlert?.summary || "No major pressure alerts right now.",
        priorityAlert?.importance === "critical" ? "critical" : priorityAlert?.importance === "high" ? "warn" : "neutral"
      ),
      createDeskCard("Events", String(totalEvents), latestEventTime ? `Latest ${latestEventTime}` : "No event timestamps yet.", "neutral")
    ];
  } else {
    const draftPreview = inferDraftPreview(match);
    const estimatedStart = selectedGameEstimatedStart(match, selected.number);
    const watchLabel = selected.watchUrl ? "Watch link ready" : "Watch pending";
    title = draftPreview?.headline || `Game ${selected.number} not live yet`;
    note = draftPreview?.summary || "Feed will open once the map starts and events begin to land.";
    cards = [
      createDeskCard("State", draftPreview?.label || stateLabel(selectedState), draftPreview?.detail || "Waiting for map start.", "neutral"),
      createDeskCard(
        compact ? "ETA" : "Start",
        estimatedStart ? (isCompactUI() ? dateTimeCompact(estimatedStart) : dateTimeLabel(estimatedStart)) : "TBD",
        estimatedStart ? "Projected map start." : "Start time not projected yet.",
        "neutral"
      ),
      createDeskCard("Watch", watchLabel, selected.watchUrl ? "Primary stream or VOD link is available." : "Link appears once coverage is published.", selected.watchUrl ? "live" : "neutral"),
      createDeskCard("Events", String(totalEvents), "Feed is still empty before first tracked events.", "neutral")
    ];
  }

  const compactStateLabel = selectedState === "inProgress" ? "Live" : selectedState === "completed" ? "Final" : "Soon";
  const summaryPills = compact
    ? [`G${selected.number}`, compactStateLabel, `${totalEvents} ev`]
    : [`Game ${selected.number}`, stateLabel(selectedState), `${totalEvents} event${totalEvents === 1 ? "" : "s"}`];
  const visibleCards = compact ? cards.slice(0, 3) : cards;

  elements.gameFeedDeskWrap.innerHTML = `
    <div class="game-feed-desk-shell ${stateClass}${compact ? " compact" : ""}">
      <article class="game-feed-desk-hero${compact ? " compact" : ""}">
        <div class="game-feed-desk-copy">
          <p class="tempo-label">Feed desk</p>
          <h3>${escapeHtml(compact ? clampSummaryText(title, 58) : title)}</h3>
          <p class="game-feed-desk-note">${escapeHtml(compact ? clampSummaryText(note, 78) : note)}</p>
        </div>
        ${compact ? "" : `<div class="form-summary-strip${compact ? " compact" : ""}">
          ${summaryPills.map((pill) => `<span class="form-summary-pill">${escapeHtml(pill)}</span>`).join("")}
        </div>`}
      </article>
      <div class="game-feed-desk-grid${compact ? " compact" : ""}">
        ${visibleCards.join("")}
      </div>
    </div>
  `;
}

function renderUnifiedLiveFeed(match) {
  renderFeedControlsChrome(match);

  const selectedState = String(match?.selectedGame?.state || "");
  const compact = isCompactUI();
  if (elements.liveSummaryWrap && selectedState !== "inProgress") {
    elements.liveSummaryWrap.innerHTML = "";
  }

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
    uiState.storyFocusUserSet = false;
    if (elements.liveSummaryWrap && selectedState === "inProgress") {
      renderLiveFollowSummary(match, [], { startTs: null, estimated: true }, null);
    }
    elements.liveFeedList.innerHTML = `<li>${selectedState === "completed" ? "No game events were captured for this final map." : "No live events yet."}</li>`;
    return;
  }

  const { timelineAnchor, rows: anchoredRows } = feedRowsWithGameClock(match, filtered);
  const rowsWithLead = enrichFeedRowsWithState(match, anchoredRows);
  const activeEventId = ensureStoryFocus(rowsWithLead);
  const displayRows = collapseFeedRowsForDisplay(rowsWithLead);
  renderLiveFollowSummary(match, rowsWithLead, timelineAnchor, activeEventId);

  elements.liveFeedList.innerHTML = displayRows
    .map(
      (row) => {
        const active = row.clusterEventIds?.includes(activeEventId);
        const storyTargetId = active ? activeEventId : row.eventId;
        const majorClass = row.majorEvent ? ` major-event major-${row.majorEvent.kind}` : "";
        const clusterChip =
          row.clusterCount > 1 && !compact ? `<span class="feed-cluster-chip">+${row.clusterCount - 1} linked</span>` : "";
        const majorPill = row.majorEvent ? `<span class="feed-major-pill ${row.majorEvent.kind}">${row.majorEvent.label}</span>` : "";
        const majorSummary =
          row.majorEvent && row.hasUsefulSummary
            ? `<p class="feed-major-summary${compact ? " compact" : ""}">${clampSummaryText(row.summary, compact ? 78 : 108)}</p>`
            : "";
        const teamTag =
          row.team
            ? `<span class="feed-team-tag ${row.team}">${
                compact
                  ? scoreboardTeamName(row.team === "left" ? match.teams.left.name : match.teams.right.name)
                  : displayTeamName(row.team === "left" ? match.teams.left.name : match.teams.right.name)
              }</span>`
            : "";
        const compactMomentumTag =
          row.bucket === "swing" || row.majorEvent?.kind === "swing"
            ? `<span class="feed-swing-tag ${row.swingDescriptor.tone}">${row.swingDescriptor.short}</span>`
            : `<span class="feed-lead-tag ${row.leadDescriptor.tone}">${row.leadDescriptor.label}</span>`;
        const metaTags = compact
          ? [teamTag, compactMomentumTag]
          : [
              `<span class="feed-phase-tag ${row.phase.key}">${row.phase.label}</span>`,
              `<span class="feed-bucket-tag ${row.bucket}">${feedBucketTagLabel(row.bucket)}</span>`,
              teamTag,
              `<span class="feed-lead-tag ${row.leadDescriptor.tone}">${row.leadDescriptor.label}</span>`,
              `<span class="feed-swing-tag ${row.swingDescriptor.tone}">${row.swingDescriptor.short}</span>`,
              clusterChip
            ];
        return `
      <li class="live-feed-item ${row.team === "left" ? "team-left" : row.team === "right" ? "team-right" : "team-neutral"}${
          active ? " active" : ""
        } importance-${row.importance}${majorClass}${compact ? " compact" : ""}" data-story-event-id="${encodeStoryEventId(
          storyTargetId
        )}" tabindex="0" role="button" aria-label="Jump to event in trend">
        <div class="live-feed-row${compact ? " compact" : ""}">
          <span class="feed-game-time">${row.gameClockSeconds === null ? "--:--" : `${timelineAnchor.estimated ? "~" : ""}${formatGameClock(row.gameClockSeconds)}`}</span>
          <div class="live-feed-main${compact ? " compact" : ""}">
            <div class="live-feed-top${compact ? " compact" : ""}">
              <p class="live-feed-title">
                <span class="feed-priority-dot ${row.importance}" aria-hidden="true"></span>
                <span>${escapeHtml(compact ? clampSummaryText(row.title, 54) : row.title)}</span>
              </p>
              <div class="feed-top-side${compact ? " compact" : ""}">
                ${majorPill}
                <span class="feed-absolute-time">${shortTimeLabel(row.at)}</span>
              </div>
            </div>
            ${majorSummary}
            <div class="live-feed-meta-row${compact ? " compact" : ""}">
              ${metaTags.filter(Boolean).join("")}
            </div>
          </div>
        </div>
      </li>
    `;
      }
    )
    .join("");
}

function bindFeedControls() {
  if (uiState.controlsBound) {
    return;
  }

  if (elements.feedControlsToggle) {
    elements.feedControlsToggle.addEventListener("click", () => {
      uiState.feedControlsExpanded = !uiState.feedControlsExpanded;
      persistFeedControlsExpanded();
      renderFeedControlsChrome(uiState.match);
    });
  }

  if (elements.feedTypeFilter) {
    elements.feedTypeFilter.value = uiState.feedType;
    elements.feedTypeFilter.addEventListener("change", () => {
      uiState.feedType = elements.feedTypeFilter.value || "all";
      renderFeedControlsChrome(uiState.match);
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.feedTeamFilter) {
    elements.feedTeamFilter.value = uiState.feedTeam;
    elements.feedTeamFilter.addEventListener("change", () => {
      uiState.feedTeam = elements.feedTeamFilter.value || "all";
      renderFeedControlsChrome(uiState.match);
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

      renderFeedControlsChrome(uiState.match);
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.feedResetFilter) {
    elements.feedResetFilter.addEventListener("click", () => {
      uiState.feedType = "all";
      uiState.feedTeam = "all";
      uiState.feedImportance = "all";
      uiState.feedWindowMinutes = null;
      renderFeedControlsChrome(uiState.match);
      if (uiState.match) {
        renderUnifiedLiveFeed(uiState.match);
      }
    });
  }

  if (elements.trackerSort) {
    elements.trackerSort.addEventListener("change", () => {
      uiState.trackerSort = elements.trackerSort.value || "role";
      syncTrackerSortControls();
      if (uiState.match) {
        renderPlayerTracker(uiState.match);
      }
    });
  }

  if (Array.isArray(elements.trackerSortButtons)) {
    for (const button of elements.trackerSortButtons) {
      button.addEventListener("click", () => {
        uiState.trackerSort = button.getAttribute("data-sort") || "role";
        syncTrackerSortControls();
        if (uiState.match) {
          renderPlayerTracker(uiState.match);
        }
      });
    }
  }

  syncTrackerSortControls();

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

function currentMatchupState(match) {
  if (!match) {
    return null;
  }
  const expectedKey = matchupRequestKey(match, uiState.apiBase);
  return uiState.matchup?.key === expectedKey ? uiState.matchup : null;
}

function normalizeUpcomingTeamFormProfile(profile) {
  if (!profile) {
    return null;
  }

  const summary = profile.summary || {};
  return {
    teamId: profile.teamId || profile.id || null,
    teamName: profile.teamName || profile.name || null,
    wins: Number(profile.wins ?? summary.wins ?? 0),
    losses: Number(profile.losses ?? summary.losses ?? 0),
    draws: Number(profile.draws ?? summary.draws ?? 0),
    gameWins: Number(profile.gameWins ?? summary.mapWins ?? 0),
    gameLosses: Number(profile.gameLosses ?? summary.mapLosses ?? 0),
    seriesWinRatePct: Number(profile.seriesWinRatePct ?? summary.seriesWinRatePct ?? 0),
    gameWinRatePct: Number(profile.gameWinRatePct ?? summary.mapWinRatePct ?? 0),
    streakLabel: profile.streakLabel || summary.streakLabel || "n/a",
    formLabel: profile.formLabel || summary.formLast5 || "n/a",
    recentMatches: Array.isArray(profile.recentMatches) ? profile.recentMatches : []
  };
}

function resolvedUpcomingFormProfiles(match) {
  const intel = upcomingIntel(match);
  const teamForm = intel?.teamForm || {};
  const matchupState = currentMatchupState(match);

  const leftProfile =
    normalizeUpcomingTeamFormProfile(matchupState?.leftProfile) ||
    normalizeUpcomingTeamFormProfile(teamForm.left);
  const rightProfile =
    normalizeUpcomingTeamFormProfile(matchupState?.rightProfile) ||
    normalizeUpcomingTeamFormProfile(teamForm.right);

  return {
    left: leftProfile,
    right: rightProfile
  };
}

function resolvedUpcomingHeadToHead(match) {
  const matchupState = currentMatchupState(match);
  const matchupH2h = matchupState?.leftProfile?.headToHead;
  if (matchupH2h && Array.isArray(matchupH2h.recentMatches) && matchupH2h.recentMatches.length) {
    return {
      total: Number(matchupH2h.matches || matchupH2h.recentMatches.length || 0),
      leftWins: Number(matchupH2h.wins || 0),
      rightWins: Number(matchupH2h.losses || 0),
      lastMeetings: matchupH2h.recentMatches.map((row) => ({
        ...row,
        id: row.matchId || row.id || null,
        winnerName: row.winnerName || winnerLabelForH2hRow(row, match)
      }))
    };
  }

  return upcomingIntel(match)?.headToHead || null;
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

function formatRecentFormRow(row, apiBase, { match = null, focalTeamId = null } = {}) {
  if (!row) {
    return `<li class="meta-text">No recent result.</li>`;
  }

  const resultClass = row.result === "win" ? "win-left" : row.result === "loss" ? "win-right" : "even";
  const detailLink = row.id ? `<a class="table-link" href="${detailUrlForGame(row.id, apiBase)}">Open</a>` : "";
  const opponentLink = row.opponentId
    ? `<a class="team-link" href="${teamDetailUrl(row.opponentId, match?.game, uiState.apiBase, {
        matchId: match?.id || null,
        opponentId: focalTeamId,
        teamName: row.opponentName || null
      })}">${row.opponentName || "Unknown"}</a>`
    : row.opponentName || "Unknown";
  return `
    <li class="form-match-item">
      <div class="form-match-top">
        <span class="series-h2h-result ${resultClass}">${h2hResultLabel(row.result)}</span>
        <span class="form-match-opponent">${opponentLink}</span>
        <span class="form-match-score">${row.scoreLabel || "n/a"}</span>
      </div>
      <div class="form-match-meta">
        <span>${isCompactUI() ? dateTimeCompact(row.startAt) : dateTimeLabel(row.startAt)}</span>
        <span>${row.tournament || "Unknown"}</span>
        ${detailLink || `<span class="meta-text">-</span>`}
      </div>
    </li>
  `;
}

function renderTeamFormCard({ teamName, teamId, opponentId, profile, toneClass, match }) {
  const compact = isCompactUI();
  const selectedGameNumber = contextGameNumber();
  const teamLink = teamId
    ? teamDetailUrl(teamId, match?.game, uiState.apiBase, {
        matchId: match?.id || null,
        gameNumber: selectedGameNumber,
        opponentId,
        teamName
      })
    : null;
  const headerText = teamLink ? `<a class="team-link" href="${teamLink}">${escapeHtml(teamName)}</a>` : escapeHtml(teamName);
  const shortName = scoreboardTeamName(teamName, match?.game);

  if (!profile) {
    return `
      <article class="series-history-team ${toneClass}">
        <div class="series-history-team-head">
          <div class="series-history-team-ident">
            <span class="series-history-team-mark">${teamBadgeMarkup({ id: teamId, name: teamName }, match?.game)}</span>
            <div class="series-history-team-copy">
              <h3>${headerText}</h3>
              <p class="meta-text">${escapeHtml(displayTeamName(teamName, match?.game))}</p>
            </div>
          </div>
        </div>
        <div class="series-history-team-empty">
          <p class="meta-text">No recent form data available.</p>
        </div>
      </article>
    `;
  }

  const recentRows = Array.isArray(profile.recentMatches) ? profile.recentMatches.slice(0, compact ? 3 : 5) : [];
  const recentSummary = summarizeRecentMatchRows(recentRows);
  return `
    <article class="series-history-team ${toneClass}${compact ? " compact" : ""}">
      <div class="series-history-team-head">
        <div class="series-history-team-ident">
          <span class="series-history-team-mark">${teamBadgeMarkup({ id: teamId, name: teamName }, match?.game)}</span>
          <div class="series-history-team-copy">
            <h3>${headerText}</h3>
            <p class="meta-text">${escapeHtml(displayTeamName(teamName, match?.game))}</p>
          </div>
        </div>
        ${teamLink && !compact ? `<a class="table-link" href="${teamLink}">Team page</a>` : ""}
      </div>
      <div class="series-history-team-summary">
        ${seriesDeskMetricCard(compact ? "WR" : "Series", compact ? `${Number(profile.seriesWinRatePct || 0).toFixed(0)}%` : `${profile.wins ?? 0}-${profile.losses ?? 0}`, compact ? `${shortName} ${profile.wins ?? 0}-${profile.losses ?? 0}` : `${shortName} WR ${Number(profile.seriesWinRatePct || 0).toFixed(0)}%`, toneClass)}
        ${compact ? "" : seriesDeskMetricCard("Maps", `${profile.gameWins ?? 0}-${profile.gameLosses ?? 0}`, `Map WR ${Number(profile.gameWinRatePct || 0).toFixed(0)}%`, toneClass)}
        ${seriesDeskMetricCard("Form", recentSummary.formLabel, `Last ${recentRows.length || 0} ${recentSummary.recordLabel}`, toneClass)}
        ${seriesDeskMetricCard("Streak", profile.streakLabel || "n/a", `${recentSummary.total || 0} recent result${recentSummary.total === 1 ? "" : "s"}`, toneClass)}
      </div>
      <p class="series-history-team-list-head">${compact ? "Recent" : "Recent results"}</p>
      <ul class="mini-list form-list">
        ${recentRows.length
          ? recentRows
              .map((row) =>
                formatRecentFormRow(row, uiState.apiBase, {
                  match,
                  focalTeamId: teamId
                })
              )
              .join("")
          : `<li class="meta-text">No recent matches.</li>`}
      </ul>
    </article>
  `;
}

function renderUpcomingForm(match) {
  if (!match?.teams?.left || !match?.teams?.right) {
    elements.upcomingFormWrap.innerHTML = `<div class="empty">Past match history is unavailable for this series.</div>`;
    return;
  }

  const compact = isCompactUI();
  const teamForm = resolvedUpcomingFormProfiles(match);
  const leftShort = scoreboardTeamName(match.teams.left.name, match?.game);
  const rightShort = scoreboardTeamName(match.teams.right.name, match?.game);
  const leftRecent = summarizeRecentMatchRows(teamForm.left?.recentMatches);
  const rightRecent = summarizeRecentMatchRows(teamForm.right?.recentMatches);
  const leftSeriesWin = Number(teamForm.left?.seriesWinRatePct || 0);
  const rightSeriesWin = Number(teamForm.right?.seriesWinRatePct || 0);
  const formLeader =
    leftSeriesWin === rightSeriesWin ? null : leftSeriesWin > rightSeriesWin ? match.teams.left.name : match.teams.right.name;
  const leadTone =
    formLeader === match.teams.left.name ? "left" : formLeader === match.teams.right.name ? "right" : "neutral";
  elements.upcomingFormWrap.innerHTML = `
    <div class="series-history-desk${compact ? " compact" : ""}">
      <article class="series-history-lead ${leadTone}${compact ? " compact" : ""}">
        <div class="series-history-head">
          <div>
            <p class="tempo-label">History desk</p>
            <h3>${compact ? "Recent form" : "Recent form and streak context"}</h3>
            <p class="series-history-note">${escapeHtml(
              compact
                ? `${leftShort} ${teamForm.left?.streakLabel || "n/a"} · ${rightShort} ${teamForm.right?.streakLabel || "n/a"}`
                : "Read current momentum first, then scan the last five series for both sides."
            )}</p>
          </div>
          ${
            compact
              ? ""
              : `<div class="form-summary-strip">
            <span class="form-summary-pill">${escapeHtml(leftShort)} ${leftRecent.recordLabel}</span>
            <span class="form-summary-pill">${escapeHtml(rightShort)} ${rightRecent.recordLabel}</span>
          </div>`
          }
        </div>
        <div class="series-history-metrics">
          ${seriesDeskMetricCard(compact ? leftShort : `${leftShort} last 5`, leftRecent.recordLabel, `Form ${leftRecent.formLabel}`, "left")}
          ${seriesDeskMetricCard(compact ? rightShort : `${rightShort} last 5`, rightRecent.recordLabel, `Form ${rightRecent.formLabel}`, "right")}
          ${seriesDeskMetricCard("Form edge", formLeader ? scoreboardTeamName(formLeader, match?.game) : "Even", `${leftShort} ${leftSeriesWin.toFixed(0)}% · ${rightShort} ${rightSeriesWin.toFixed(0)}%`, leadTone)}
          ${compact ? "" : seriesDeskMetricCard("Streaks", `${teamForm.left?.streakLabel || "n/a"} / ${teamForm.right?.streakLabel || "n/a"}`, `${leftShort} vs ${rightShort}`, "neutral")}
        </div>
      </article>
      <div class="series-history-grid">
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
      </div>
    </div>
  `;
}

function renderUpcomingHeadToHead(match) {
  if (!match?.teams?.left || !match?.teams?.right) {
    elements.upcomingH2hWrap.innerHTML = `<div class="empty">Head-to-head is unavailable for this series.</div>`;
    return;
  }

  const compact = isCompactUI();
  const h2h = resolvedUpcomingHeadToHead(match);
  if (!h2h || !Array.isArray(h2h.lastMeetings) || !h2h.lastMeetings.length) {
    elements.upcomingH2hWrap.innerHTML = `<div class="empty">No recent direct meetings found.</div>`;
    return;
  }

  const rows = h2h.lastMeetings
    .slice(0, compact ? 3 : h2h.lastMeetings.length)
    .map((row) => {
      const winnerName = row.winnerName || winnerLabelForH2hRow(row, match);
      const winnerTone =
        winnerName === match?.teams?.left?.name
          ? "win-left"
          : winnerName === match?.teams?.right?.name
            ? "win-right"
            : "even";
      const detailId = row.detailMatchId || row.matchId || row.id || null;
      const detailLink = detailId ? `<a class="table-link" href="${detailUrlForGame(detailId, uiState.apiBase)}">Open</a>` : "";
      return `
        <article class="series-h2h-item upcoming-h2h-card">
          <div class="series-h2h-top">
            <p class="series-h2h-date">${isCompactUI() ? dateTimeCompact(row.startAt) : dateTimeLabel(row.startAt)}</p>
            <span class="form-match-score">${row.scoreLabel || "n/a"}</span>
          </div>
          <div class="form-match-top">
            <span class="series-h2h-result ${winnerTone}">${winnerName === match?.teams?.left?.name ? scoreboardTeamName(match.teams.left.name) : winnerName === match?.teams?.right?.name ? scoreboardTeamName(match.teams.right.name) : "TBD"}</span>
            <span class="form-match-opponent">${winnerName || "TBD"} won</span>
          </div>
          <div class="form-match-meta">
            <span>${row.tournament || "Unknown"}</span>
            ${detailLink || `<span class="meta-text">-</span>`}
          </div>
        </article>
      `;
    })
    .join("");

  const leftShort = scoreboardTeamName(match.teams.left.name, match?.game);
  const rightShort = scoreboardTeamName(match.teams.right.name, match?.game);
  const totalMeetings = Number(h2h.total ?? h2h.matches ?? h2h.lastMeetings.length ?? 0);
  const leftWins = Number(h2h.leftWins ?? h2h.wins ?? 0);
  const rightWins = Number(h2h.rightWins ?? h2h.losses ?? 0);
  const draws = Number(h2h.draws ?? 0);
  const lastMeeting = h2h.lastMeetings[0] || null;
  const lastWinnerName = lastMeeting?.winnerName || (lastMeeting ? winnerLabelForH2hRow(lastMeeting, match) : null);
  const winnerTone =
    lastWinnerName === match.teams.left.name ? "left" : lastWinnerName === match.teams.right.name ? "right" : "neutral";

  elements.upcomingH2hWrap.innerHTML = `
    <div class="series-h2h-desk${compact ? " compact" : ""}">
      <article class="series-h2h-lead ${winnerTone}${compact ? " compact" : ""}">
        <div class="series-history-head">
          <div>
            <p class="tempo-label">History desk</p>
            <h3>${compact ? "Head-to-head" : "Direct meetings and latest results"}</h3>
            <p class="series-history-note">${escapeHtml(
              compact
                ? lastMeeting
                  ? `Latest ${dateTimeCompact(lastMeeting.startAt)}`
                  : `${totalMeetings} meetings on record`
                : lastMeeting ? `Latest meeting: ${dateTimeCompact(lastMeeting.startAt)} · ${lastMeeting.tournament || "Unknown tournament"}` : "Recent series history is available below."
            )}</p>
          </div>
          ${
            compact
              ? ""
              : `<div class="form-summary-strip">
            <span class="form-summary-pill">${escapeHtml(leftShort)} ${leftWins}</span>
            <span class="form-summary-pill">${escapeHtml(rightShort)} ${rightWins}</span>
            ${draws ? `<span class="form-summary-pill">Draws ${draws}</span>` : ""}
          </div>`
          }
        </div>
        <div class="series-history-metrics">
          ${seriesDeskMetricCard("Record", `${leftWins}-${rightWins}${draws ? `-${draws}` : ""}`, `${leftShort} vs ${rightShort}`, winnerTone)}
          ${seriesDeskMetricCard("Meetings", String(totalMeetings), totalMeetings > h2h.lastMeetings.length ? `${h2h.lastMeetings.length} shown below` : "All sampled meetings shown", "neutral")}
          ${seriesDeskMetricCard("Last winner", lastWinnerName ? scoreboardTeamName(lastWinnerName, match?.game) : "TBD", lastMeeting?.scoreLabel || "Result pending", winnerTone)}
          ${compact ? "" : seriesDeskMetricCard("Last score", lastMeeting?.scoreLabel || "n/a", lastMeeting?.tournament || "Unknown", "neutral")}
        </div>
      </article>
      <div class="series-h2h-list upcoming-h2h-list">${rows}</div>
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

  const compact = isCompactUI();
  const liveContext = focusedLiveEventContext(match);
  const focusedRow = liveContext.row;
  const nextObjective = nextObjectiveWindow(match);
  const pulseState = updateMapPulseState(match);
  const selected = match.selectedGame;
  const selectedState = String(selected?.state || "");
  const alerts = buildLiveAlerts(match);
  const chips = [
    focusedRow
      ? {
          label: `${formatFocusedEventClock(focusedRow, liveContext.timelineAnchor)} ${focusedRow.phase.label}`,
          tone: "neutral"
        }
      : null,
    focusedRow
      ? {
          label: focusedRow.leadDescriptor.label,
          tone: focusedRow.leadDescriptor.tone
        }
      : null,
    focusedRow
      ? {
          label: focusedRow.swingDescriptor.short,
          tone: focusedRow.swingDescriptor.tone
        }
      : null,
    nextObjective
      ? {
          label: `${displayObjectiveName(nextObjective.type, match)} ${objectiveEtaLabel(nextObjective)}`,
          tone: nextObjective.state === "available" ? "live" : "warn"
        }
      : null,
    pulseState
      ? {
          label: pulseState.team === "both" ? "Fight both sides" : `${pulseState.team === "left" ? displayTeamName(match.teams.left.name) : displayTeamName(match.teams.right.name)} pressure`,
          tone: "warn"
        }
      : null
  ].filter(Boolean);
  const visibleChips = compact ? chips.slice(0, 3) : chips;

  if (selectedState === "inProgress" && selected) {
    const leftName = match.teams?.left?.name || "Left Team";
    const rightName = match.teams?.right?.name || "Right Team";
    const elapsedSeconds = Number(match?.playerEconomy?.elapsedSeconds || 0);
    const elapsedMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
    const leftKills = Number(selected?.snapshot?.left?.kills || 0);
    const rightKills = Number(selected?.snapshot?.right?.kills || 0);
    const totalKills = leftKills + rightKills;
    const killPace = elapsedMinutes > 0 ? `${((totalKills / elapsedMinutes) * 10).toFixed(2)} / 10m` : "n/a";
    const deaths = playerDeathCounts(match);
    const genericLiveStateEvent = focusedRow && isGenericLiveStateTitle(focusedRow.title, selected.number);
    const latestEventLabel = genericLiveStateEvent ? "Waiting for first major moment" : focusedRow ? focusedRow.title : "No event yet";
    const latestEventHint = genericLiveStateEvent
      ? `Map is ${readableGameStateLabel(selected.state).toLowerCase()}. Live feed will update once the first meaningful event lands.`
      : focusedRow
        ? `${formatFocusedEventClock(focusedRow, liveContext.timelineAnchor)} · ${focusedRow.phase.label} · ${focusedRow.leadDescriptor.label}`
        : "Waiting for timeline events.";
    const objectiveLabel = nextObjective ? `${displayObjectiveName(nextObjective.type, match)} ${objectiveEtaLabel(nextObjective)}` : "Forecast waiting";
    const objectiveHint = nextObjective?.note || "Next major map timer from tracked cadence.";
    const fightLabel = pulseState ? "Fight live" : deaths.left + deaths.right > 0 ? "Reset window" : "Calm map";
    const fightHint = pulseState
      ? `${pulseState.team === "both" ? "Both teams" : pulseState.team === "left" ? displayTeamName(leftName) : displayTeamName(rightName)} showing live pressure`
      : `${displayTeamName(leftName)} ${deaths.left} down · ${displayTeamName(rightName)} ${deaths.right} down`;
    const liveClock = elapsedSeconds > 0 ? formatGameClock(elapsedSeconds) : "n/a";
    const priorityAlert = alerts.find((alert) => importanceRank(alert?.importance) >= importanceRank("medium")) || alerts[0] || null;
    const priorityAlertMarkup = priorityAlert
      ? `
        <article class="pulse-priority importance-${String(priorityAlert.importance || "low").toLowerCase()}">
          <div class="pulse-priority-top">
            <span class="pulse-alert-severity ${String(priorityAlert.importance || "low").toLowerCase()}">${String(priorityAlert.importance || "low").toUpperCase()}</span>
            <strong>${priorityAlert.title}</strong>
          </div>
          <p class="meta-text">${compact ? clampSummaryText(priorityAlert.summary, 74) : priorityAlert.summary}</p>
        </article>
      `
      : "";
    const pulseTitle = compact
      ? pulse.title && pulse.title !== "Match Pulse"
        ? clampSummaryText(pulse.title, 56)
        : "Live read"
      : pulse.title || "Match Pulse";
    const pulseBody = compact
      ? clampSummaryText(pulse.summary || "Signal unavailable.", 96)
      : pulse.summary || "Signal unavailable.";
    const latestHintCompact = genericLiveStateEvent
      ? "Waiting for feed"
      : focusedRow
        ? `${formatFocusedEventClock(focusedRow, liveContext.timelineAnchor)} · ${focusedRow.leadDescriptor.label}`
        : "Waiting";
    const stateHintCompact = `${leftKills}-${rightKills} · ${killPace}`;
    const nextHintCompact = nextObjective
      ? `${objectiveEtaLabel(nextObjective)}${nextObjective.nextAt ? ` · ${shortTimeLabel(nextObjective.nextAt)}` : ""}`
      : "Waiting";
    const pressureHintCompact = pulseState
      ? pulseState.team === "both"
        ? "Contest live"
        : `${pulseState.team === "left" ? displayTeamName(leftName) : displayTeamName(rightName)} pressure`
      : `${deaths.left}-${deaths.right} down`;

    elements.pulseCard.innerHTML = `
      <article class="pulse ${pulse.tone || "neutral"} pulse-shell${compact ? " compact" : ""}">
        <div class="pulse-head">
          <div class="pulse-head-copy">
            <p class="pulse-kicker">What matters now</p>
            <p class="pulse-title">${pulseTitle}</p>
          </div>
          <span class="pulse-tone-pill ${pulse.tone || "neutral"}">${String(pulse.tone || "neutral").toUpperCase()}</span>
        </div>
        <p class="pulse-body">${pulseBody}</p>
        ${visibleChips.length ? `<div class="pulse-chips">${visibleChips
          .map((chip) => `<span class="pulse-chip ${chip.tone || "neutral"}">${chip.label}</span>`)
          .join("")}</div>` : ""}
        ${priorityAlertMarkup}
        <div class="pulse-command-grid">
          ${commandCard(compact ? "Changed" : "What Changed", latestEventLabel, compact ? latestHintCompact : latestEventHint, {
            tone: focusedRow?.leadDescriptor?.tone || "neutral",
            featured: true
          })}
          ${commandCard(compact ? "State" : "Current State", liveClock, compact ? stateHintCompact : `${leftKills}-${rightKills} kills · ${killPace}`, {
            tone: totalKills >= 18 ? "warn" : "neutral"
          })}
          ${commandCard("Next", objectiveLabel, compact ? nextHintCompact : objectiveHint, {
            tone: nextObjective?.state === "available" ? "live" : "warn"
          })}
          ${commandCard("Pressure", fightLabel, compact ? pressureHintCompact : fightHint, {
            tone: pulseState ? "warn" : deaths.left + deaths.right > 0 ? "neutral" : "live"
          })}
        </div>
      </article>
    `;
    return;
  }

  elements.pulseCard.innerHTML = `
    <article class="pulse ${pulse.tone || "neutral"}">
      <div class="pulse-head">
        <p class="pulse-title">${pulse.title || "Match Pulse"}</p>
        <span class="pulse-tone-pill ${pulse.tone || "neutral"}">${String(pulse.tone || "neutral").toUpperCase()}</span>
      </div>
      <p class="pulse-body">${pulse.summary || "Signal unavailable."}</p>
      ${chips.length ? `<div class="pulse-chips">${chips
        .map((chip) => `<span class="pulse-chip ${chip.tone || "neutral"}">${chip.label}</span>`)
        .join("")}</div>` : ""}
    </article>
  `;
}

function renderEdgeMeter(match) {
  if (String(match?.selectedGame?.state || "") === "inProgress") {
    const edge = match.edgeMeter;
    const confidence = match.dataConfidence;
    const tempo = match.tempoSnapshot;
    const checklist = Array.isArray(match.tacticalChecklist) ? match.tacticalChecklist.slice(0, 3) : [];
    const comparisonRows = buildTeamComparisonRows(match) || [];
    const comparisonChips = comparisonRows
      .map((row) => comparisonRaceChip(match, row))
      .filter(Boolean)
      .slice(0, 5);
    const edgeAvailable = Boolean(edge?.left && edge?.right);
    const leftScore = edgeAvailable ? Math.max(0, Math.min(100, Number(edge.left.score || 0))) : 0;
    const rightScore = edgeAvailable ? Math.max(0, Math.min(100, Number(edge.right.score || 0))) : 0;
    const total = Math.max(1, leftScore + rightScore);
    const leftWidth = (leftScore / total) * 100;
    const rightWidth = (rightScore / total) * 100;
    const confidenceTone =
      String(confidence?.grade || "").toLowerCase() === "high"
        ? "good"
        : String(confidence?.grade || "").toLowerCase() === "low"
          ? "warn"
          : "neutral";
    const confidenceLabel = confidence
      ? `${String(confidence.grade || "medium").toUpperCase()} · ${formatNumber(confidence.score)} / 100`
      : "Confidence unavailable";
    const tempoCards = [
      tempoCard(
        "Series Pace",
        Number.isFinite(tempo?.averageDurationMinutes) ? `${tempo.averageDurationMinutes.toFixed(1)}m` : "n/a",
        Number.isFinite(tempo?.completedGames) ? `${tempo.completedGames} completed games` : "Waiting for history"
      ),
      tempoCard(
        "Current Map",
        Number.isFinite(tempo?.currentGameMinutes) ? `${tempo.currentGameMinutes.toFixed(1)}m` : "n/a",
        Number.isFinite(tempo?.objectivePer10Minutes) ? `${tempo.objectivePer10Minutes.toFixed(2)} obj / 10m` : "Objective pace pending"
      )
    ].join("");

    elements.edgeMeterWrap.innerHTML = `
      <article class="analyst-desk">
        <div class="analyst-grid">
          <section class="analyst-card analyst-card-edge">
            <div class="analyst-head">
              <p class="tempo-label">Edge</p>
              <span class="analyst-pill ${edgeAvailable ? "live" : "neutral"}">${edgeAvailable ? "LIVE" : "MODEL"}</span>
            </div>
            ${
              edgeAvailable
                ? `
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
                  <p class="analyst-verdict">${edge.verdict || "Pressure balance is even."}</p>
                  ${
                    comparisonChips.length
                      ? `<div class="analyst-race">
                          <p class="tempo-label">Map Race</p>
                          <div class="analyst-race-strip">
                            ${comparisonChips
                              .map((chip) => `<span class="analyst-race-chip ${chip.tone}">${chip.label}</span>`)
                              .join("")}
                          </div>
                        </div>`
                      : ""
                  }
                `
                : `<p class="analyst-verdict">Edge model is waiting for enough live/control signals.</p>`
            }
          </section>
          <section class="analyst-card">
            <div class="analyst-head">
              <p class="tempo-label">Coverage</p>
              <span class="analyst-pill ${confidenceTone}">${confidence ? String(confidence.telemetry || "unknown").toUpperCase() : "N/A"}</span>
            </div>
            <p class="analyst-verdict">${confidenceLabel}</p>
            ${
              Array.isArray(confidence?.notes) && confidence.notes.length
                ? `<ul class="analyst-mini-list">${confidence.notes.slice(0, 2).map((note) => `<li>${note}</li>`).join("")}</ul>`
                : `<p class="meta-text">Live model confidence updates as telemetry fills in.</p>`
            }
          </section>
        </div>
        <div class="analyst-grid secondary">
          <section class="analyst-card">
            <div class="analyst-head">
              <p class="tempo-label">Tempo</p>
              <span class="analyst-pill neutral">PACE</span>
            </div>
            <div class="analyst-tempo-grid">${tempoCards}</div>
          </section>
          <section class="analyst-card">
            <div class="analyst-head">
              <p class="tempo-label">Priorities</p>
              <span class="analyst-pill warn">${checklist.length ? `${checklist.length} live` : "Watch"}</span>
            </div>
            ${
              checklist.length
                ? `<div class="analyst-checklist">${checklist
                    .map(
                      (row, index) => `
                        <article class="analyst-check ${checklistClass(row.tone)}">
                          <span class="analyst-check-rank">${index + 1}</span>
                          <div>
                            <p class="check-title">${row.title || "Signal"}</p>
                            <p class="meta-text">${row.detail || "No details provided."}</p>
                          </div>
                        </article>
                      `
                    )
                    .join("")}</div>`
                : `<p class="meta-text">No tactical priorities generated yet.</p>`
            }
          </section>
        </div>
      </article>
    `;
    return;
  }

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
    .slice(0, 4)
    .map(
      (row, index) => `
      <article class="check-item ${checklistClass(row.tone)}">
        <span class="check-rank">${index + 1}</span>
        <div class="check-copy">
          <p class="check-title">${row.title || "Signal"}</p>
          <p class="meta-text">${row.detail || "No details provided."}</p>
        </div>
      </article>
    `
    )
    .join("");
}

function renderStorylines(match) {
  const compact = isCompactUI();
  const rows = Array.isArray(match.storylines) ? match.storylines : [];
  if (!rows.length) {
    elements.storylinesList.innerHTML = '<li class="storyline-item empty">No storyline signals yet.</li>';
    return;
  }

  elements.storylinesList.innerHTML = rows
    .slice(0, compact ? 3 : 5)
    .map(
      (row, index) => `
        <li class="storyline-item">
          ${compact ? "" : `<div class="storyline-head"><span class="storyline-index">Read ${index + 1}</span></div>`}
          <p class="storyline-text">${escapeHtml(String(row || "Signal"))}</p>
        </li>
      `
    )
    .join("");
}

function renderSeriesProgress(match) {
  const progress = match.seriesProgress;
  if (!progress) {
    elements.seriesProgressWrap.innerHTML = `<div class="empty">No series progress available.</div>`;
    return;
  }

  const compact = isCompactUI();
  const status = String(match?.status || "").toLowerCase();
  const leftName = match?.teams?.left?.name || "Left Team";
  const rightName = match?.teams?.right?.name || "Right Team";
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const leaderName = currentSeriesLeader(match);
  const winnerName = winnerTeamName(match);
  const liveGameNumber = firstInProgressGameNumber(match);
  const accountedGames = Number(progress.completedGames || 0) + Number(progress.inProgressGames || 0) + Number(progress.skippedGames || 0);
  const leftPct = Math.min(100, (progress.leftWins / Math.max(1, progress.winsNeeded)) * 100);
  const rightPct = Math.min(100, (progress.rightWins / Math.max(1, progress.winsNeeded)) * 100);
  const tone = status === "completed" ? "complete" : status === "live" ? "live" : "neutral";
  const title =
    status === "completed"
      ? winnerName
        ? `${scoreboardTeamName(winnerName, match?.game)} closed the series`
        : `Final ${progress.leftWins}-${progress.rightWins}`
      : leaderName
        ? `${scoreboardTeamName(leaderName, match?.game)} controls the race`
        : "Series race is still even";
  const note =
    status === "completed"
      ? compact
        ? `${progress.completedGames} map${progress.completedGames === 1 ? "" : "s"} done${progress.skippedGames ? ` · ${progress.skippedGames} skipped` : ""}`
        : `${progress.completedGames} map${progress.completedGames === 1 ? "" : "s"} completed${progress.skippedGames ? ` · ${progress.skippedGames} skipped` : ""}.`
      : Number.isInteger(liveGameNumber)
        ? compact
          ? `G${liveGameNumber} live · first to ${progress.winsNeeded}`
          : `Game ${liveGameNumber} is live. First to ${progress.winsNeeded} wins takes the series.`
        : compact
          ? `First to ${progress.winsNeeded}`
          : `First to ${progress.winsNeeded} wins takes the series.`;

  elements.seriesProgressWrap.innerHTML = `
    <article class="series-progress-card ${tone}">
      <div class="series-progress-head">
        <div>
          <p class="tempo-label">Series race</p>
          <h3>${escapeHtml(title)}</h3>
          <p class="series-progress-note">${escapeHtml(note)}</p>
        </div>
        <div class="series-progress-scoreboard">
          <span>${escapeHtml(leftShort)}</span>
          <strong>${progress.leftWins}-${progress.rightWins}</strong>
          <span>${escapeHtml(rightShort)}</span>
        </div>
      </div>
      <div class="progress-split">
        <div class="bar left" style="width:${leftPct}%"></div>
        <div class="bar right" style="width:${rightPct}%"></div>
      </div>
      <div class="series-progress-metrics">
        ${seriesDeskMetricCard(leftShort, `${progress.leftWins} win${progress.leftWins === 1 ? "" : "s"}`, `${progress.leftToWin} to clinch`, "left")}
        ${seriesDeskMetricCard(rightShort, `${progress.rightWins} win${progress.rightWins === 1 ? "" : "s"}`, `${progress.rightToWin} to clinch`, "right")}
        ${seriesDeskMetricCard("State", status === "completed" ? "Final" : Number.isInteger(liveGameNumber) ? `Game ${liveGameNumber} live` : "Waiting", `${progress.completedGames} complete · ${progress.inProgressGames} live`, status === "live" ? "live" : "neutral")}
        ${seriesDeskMetricCard("Format", `First to ${progress.winsNeeded}`, `${accountedGames} maps tracked${progress.skippedGames ? ` · ${progress.skippedGames} skipped` : ""}`, progress.skippedGames ? "warn" : "neutral")}
      </div>
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

  const catalog = normalizeGameKey(match?.game) === "dota2"
    ? [{ id: "baron", name: "Roshan", short: "R", x: 59, y: 42 }]
    : [
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
  const gameKey = normalizeGameKey(match?.game);
  const telemetryStatus = liveTelemetryStatus(match);
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
  const allowPlayerPositions = gameKey === "dota2" ? telemetryStatus === "rich" : true;
  const exactForAllPlayers = allowPlayerPositions && rows.length > 0 && exactRows.length === rows.length;

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
    gameKey,
    positionsAllowed: allowPlayerPositions,
    structures: buildStructureLayer(match)
  };
}

function renderMiniMap(match, options = {}) {
  const miniMap = buildMiniMap(match);
  const structures = miniMap.structures;
  const focusedEvent = options?.focusedEvent || null;
  const dynamicPulse = updateMapPulseState(match);
  const focusedTeam = focusedEvent?.team === "left" || focusedEvent?.team === "right" ? focusedEvent.team : null;
  const pulse = focusedTeam ? { team: focusedTeam, expiresAt: Date.now() + 20_000 } : dynamicPulse;
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
  const summaryChips =
    miniMap.gameKey === "dota2"
      ? `
        <div class="minimap-objectives">
          <span class="minimap-chip left">Radiant ${structures.summary.leftTowers}/${structures.summary.towerTotal} towers</span>
          <span class="minimap-chip left">Radiant ${structures.summary.leftInhibitors}/${structures.summary.inhibitorTotal} rax</span>
          <span class="minimap-chip right">Dire ${structures.summary.rightTowers}/${structures.summary.towerTotal} towers</span>
          <span class="minimap-chip right">Dire ${structures.summary.rightInhibitors}/${structures.summary.inhibitorTotal} rax</span>
        </div>
      `
      : "";
  const mapNote =
    miniMap.gameKey === "dota2" && !miniMap.positionsAllowed
      ? "Player positions are hidden until exact Dota telemetry is available."
      : miniMap.gameKey === "dota2" && miniMap.mode !== "exact" && miniMap.totalPlayers
        ? "Current player positions are not exact enough to show on the map."
        : "";

  return `
    <section class="minimap-card${pulse ? ` fight-${pulse.team}` : ""}">
      <p class="minimap-title">Map View</p>
      <div class="minimap-stage ${miniMap.gameKey}">
        <img src="${structures.background}" class="minimap-image" alt="${miniMap.gameKey === "dota2" ? "Dota 2 minimap" : "League of Legends minimap"}" loading="lazy" decoding="async" />
        <div class="minimap-overlay minimap-structures-layer">${structureNodes}</div>
        <div class="minimap-overlay minimap-players-layer">${playerNodes}</div>
      </div>
      ${summaryChips}
      ${mapNote ? `<p class="minimap-note">${mapNote}</p>` : ""}
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
      activeRow: null
    };
  }

  const { timelineAnchor, rows } = feedRowsWithGameClock(match, feedRows);
  const enrichedRows = enrichFeedRowsWithState(match, rows);
  const chronologicalRows = enrichedRows
    .filter((row) => Number.isFinite(row.eventTs))
    .sort((left, right) => left.eventTs - right.eventTs);
  if (!chronologicalRows.length) {
    return {
      timelineAnchor,
      markers: [],
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
    activeRow
  };
}

function renderLeadTrend(match) {
  const series = Array.isArray(match.goldLeadSeries) ? match.goldLeadSeries : [];
  const trend = match.leadTrend;
  const selectedState = String(match?.selectedGame?.state || "");
  const miniMap = buildMiniMap(match);
  if (!series.length || !trend) {
    const hasMapView = miniMap.mode !== "none" || Array.isArray(miniMap?.structures?.markers);
    if (hasMapView) {
      elements.leadTrendWrap.innerHTML = `
        <article class="trend-card trend-card-map-only">
          ${renderMiniMap(match)}
          <div class="trend-map-empty">
            <p class="trend-headline even">Map view active</p>
            <p class="meta-text">${
              selectedState === "completed"
                ? "Gold trend is unavailable for this final map, but structure state and tracked player positions are still visible."
                : "Gold trend is unavailable right now, but structure state and tracked player positions are still visible."
            }</p>
          </div>
        </article>
      `;
      return;
    }

    elements.leadTrendWrap.innerHTML = `<div class="empty">${
      selectedState === "completed"
        ? "Gold lead story is unavailable for this final map."
        : "Lead trend appears once enough frames are tracked."
    }</div>`;
    return;
  }

  const selectedGameNumber = contextGameNumber();
  const trendScaleKey = `${String(match?.id || "match")}::${Number.isInteger(selectedGameNumber) ? selectedGameNumber : "series"}`;
  const previousAbsScale = Number(uiState.leadTrendScaleByContext[trendScaleKey] || 0);
  const chart = buildLeadTrendChart(series, { lockedAbsLead: previousAbsScale });
  if (!chart) {
    elements.leadTrendWrap.innerHTML = `<div class="empty">${
      selectedState === "completed"
        ? "Gold lead story is unavailable for this final map."
        : "Lead trend appears once enough frames are tracked."
    }</div>`;
    return;
  }
  uiState.leadTrendScaleByContext[trendScaleKey] = chart.displayAbsLead;

  const leadCallout = trendLeadCallout(match, Number(trend.finalLead || 0));
  const finalPoint = chart.points[chart.points.length - 1];
  const finalToneClass = leadCallout.tone === "left" ? "left" : leadCallout.tone === "right" ? "right" : "even";
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
  const trendStory = buildTrendStory(match, chart);
  const activeStory = trendStory.activeRow;
  const miniMapMarkup = renderMiniMap(match, { focusedEvent: activeStory });
  const activeStoryTone = activeStory?.team === "left" ? "left" : activeStory?.team === "right" ? "right" : "neutral";
  const activeStoryMarker = trendStory.markers.find((row) => row.eventId === activeStory?.eventId) || null;
  const activeStoryGuideMarkup = activeStoryMarker
    ? `<line x1="${activeStoryMarker.chartX.toFixed(2)}" x2="${activeStoryMarker.chartX.toFixed(2)}" y1="${chart.chartBounds.top.toFixed(2)}" y2="${chart.chartBounds.bottom.toFixed(2)}" class="trend-event-guide ${activeStoryTone}"></line>`
    : "";
  const trendMarkerMarkup = trendStory.markers
    .map((row) => {
      const tone = row.team === "left" ? "left" : row.team === "right" ? "right" : "neutral";
      const isActive = Boolean(activeStory?.eventId) && row.eventId === activeStory.eventId;
      const baseRadius = row.importance === "critical" ? 1.02 : row.importance === "high" ? 0.94 : 0.84;
      const markerRadius = isActive ? baseRadius + 0.36 : baseRadius;
      return `<circle cx="${row.chartX.toFixed(2)}" cy="${row.chartY.toFixed(2)}" r="${markerRadius.toFixed(2)}" class="trend-event-marker ${tone} ${row.bucket} importance-${row.importance}${isActive ? " active" : ""}" data-story-event-id="${encodeStoryEventId(row.eventId)}" tabindex="0"></circle>`;
    })
    .join("");

  elements.leadTrendWrap.innerHTML = `
    <article class="trend-card">
      <p class="trend-headline ${finalToneClass}">${leadCallout.headline}</p>
      <p class="meta-text">${leadCallout.detail}</p>
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
            ${activeStoryGuideMarkup}
            <line x1="${finalPoint.x.toFixed(2)}" x2="${finalPoint.x.toFixed(2)}" y1="${chart.zeroY.toFixed(2)}" y2="${finalPoint.y.toFixed(2)}" class="trend-current-guide ${finalToneClass}"></line>
            <path d="${chart.areaPath}" class="trend-area"></path>
            <path d="${chart.linePath}" class="trend-line"></path>
            ${trendMarkerMarkup}
            <circle cx="${finalPoint.x.toFixed(2)}" cy="${finalPoint.y.toFixed(2)}" r="1.2" class="trend-dot ${finalToneClass}"></circle>
            <text x="${currentLabelX.toFixed(2)}" y="${currentLabelY.toFixed(2)}" class="trend-current-label ${finalToneClass}">${currentLeadLabel}</text>
          </svg>
          <div class="trend-axis">
            <span>${shortTimeLabel(new Date(chart.minAt).toISOString())}</span>
            <span>${shortTimeLabel(new Date(chart.maxAt).toISOString())}</span>
          </div>
        </section>
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

  const compact = isCompactUI();
  const leftPct = Math.max(0, Math.min(100, Number(control.left?.controlPct || 0)));
  const rightPct = Math.max(0, Math.min(100, Number(control.right?.controlPct || 0)));

  const metrics = objectiveMetricDefinitions(match);
  const leftShort = scoreboardTeamName(match.teams.left.name, match?.game);
  const rightShort = scoreboardTeamName(match.teams.right.name, match?.game);

  elements.objectiveControlWrap.innerHTML = `
    <article class="control-card${compact ? " compact" : ""}">
      <div class="control-bar">
        <div class="left" style="width:${leftPct}%"></div>
        <div class="right" style="width:${rightPct}%"></div>
      </div>
      <p class="meta-text">${compact ? `${leftShort} ${leftPct.toFixed(1)}% · ${rightPct.toFixed(1)}% ${rightShort}` : `${match.teams.left.name} ${leftPct.toFixed(1)}% · ${rightPct.toFixed(1)}% ${match.teams.right.name}`}</p>
      ${compact ? "" : `<div class="control-rows">
        ${metrics
          .map(
            (metric) =>
              `<p class="meta-text">${metric.label} ${control.left?.[metric.key] ?? 0} - ${control.right?.[metric.key] ?? 0}</p>`
          )
          .join("")}
      </div>`}
    </article>
  `;
}

function renderObjectiveBreakdown(match) {
  const breakdown = match.objectiveBreakdown;
  if (!breakdown?.left || !breakdown?.right) {
    elements.objectiveBreakdownWrap.innerHTML = `<div class="empty">Objective-type totals unavailable.</div>`;
    return;
  }

  const metrics = objectiveMetricDefinitions(match);
  const renderSide = (teamName, sideRows) => `
    <article class="objective-side">
      <h3>${teamName}</h3>
      <p class="meta-text">Total ${sideRows.total || 0}</p>
      <div class="objective-stats">
        ${metrics
          .map((metric) => {
            const breakdownKey =
              metric.key === "barons" ? "baron" : metric.key === "inhibitors" ? "inhibitor" : metric.key;
            return `<p><span>${metric.label}</span><span>${sideRows[breakdownKey] || 0}</span></p>`;
          })
          .join("")}
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

function compactLineupSourceLabel(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized.includes("draft")) return "Draft";
  if (normalized.includes("live")) return "Live";
  if (normalized.includes("trend")) return "Trend";
  if (normalized.includes("unavailable")) return "Unavailable";
  return String(source || "Source");
}

function renderSeriesLineupTeamCard(match, { teamName, rows, source, toneClass = "left" }) {
  const compact = isCompactUI();
  const gameKey = normalizeGameKey(match?.game);
  const normalizedRows = normalizeLineupRows(rows);
  const shortName = scoreboardTeamName(teamName, match?.game);
  return `
    <section class="series-lineup-card ${toneClass}${compact ? " compact" : ""}">
      <div class="series-lineup-head">
        <div class="series-lineup-ident">
          <span class="series-lineup-mark">${teamBadgeMarkup({ name: teamName }, match?.game)}</span>
          <div class="series-lineup-copyhead">
            <h3>${escapeHtml(displayTeamName(teamName, match?.game))}</h3>
            ${compact ? "" : `<p class="meta-text">${normalizedRows.length} projected starter${normalizedRows.length === 1 ? "" : "s"}</p>`}
          </div>
        </div>
        <span class="form-summary-pill">${compactLineupSourceLabel(source)}</span>
      </div>
      ${
        compact
          ? ""
          : `<div class="series-lineup-summary">
        ${seriesDeskMetricCard("Team", shortName, "Series roster view", toneClass)}
        ${seriesDeskMetricCard("Roles", String(normalizedRows.length), normalizedRows.length ? "Projected positions mapped" : "Waiting on roster feed", toneClass)}
      </div>`
      }
      ${normalizedRows.length
        ? normalizedRows
            .map(
              (row) => `
                <article class="series-lineup-row${compact ? " compact" : ""}">
                  <div class="series-lineup-icons">
                    ${heroIconMarkup(match, row)}
                    ${roleIconMarkup(row.role, gameKey, false)}
                  </div>
                  <div class="series-lineup-copy">
                    <p class="series-lineup-player">${escapeHtml(displayPlayerHandle(row.name, teamName))}</p>
                    <p class="meta-text">${escapeHtml(
                      compact
                        ? row.champion || roleMeta(row.role, gameKey).label
                        : `${row.champion || "Unknown"} · ${roleMeta(row.role, gameKey).label}`
                    )}</p>
                  </div>
                  <span class="series-lineup-role-tag">${escapeHtml(roleMeta(row.role, gameKey).short)}</span>
                </article>
              `
            )
            .join("")
        : `<div class="empty">No lineup rows.</div>`}
    </section>
  `;
}

function renderSeriesLineups(match) {
  if (!elements.seriesLineupsWrap) {
    return;
  }

  const compact = isCompactUI();
  scheduleHeroIconCatalogLoad(match);
  const left = resolveSeriesLineup(match, "left");
  const right = resolveSeriesLineup(match, "right");
  if (!left.rows.length && !right.rows.length) {
    elements.seriesLineupsWrap.innerHTML = `<div class="empty">Lineup data appears once draft/player metadata is available.</div>`;
    return;
  }

  const sources = Array.from(
    new Set([left.source, right.source].filter((value) => value && value !== "Unavailable"))
  );
  const sourcePills = sources.length
    ? sources.map((value) => `<span class="form-summary-pill">${compactLineupSourceLabel(value)}</span>`).join("")
    : `<span class="form-summary-pill">Unavailable</span>`;
  const leftShort = scoreboardTeamName(match?.teams?.left?.name || "Left Team", match?.game);
  const rightShort = scoreboardTeamName(match?.teams?.right?.name || "Right Team", match?.game);
  elements.seriesLineupsWrap.innerHTML = `
    <div class="series-lineups-desk${compact ? " compact" : ""}">
      <article class="series-lineups-lead${compact ? " compact" : ""}">
        <div class="series-lineups-head">
          <div>
            <p class="tempo-label">Lineup desk</p>
            <h3>${compact ? "Projected starters" : "Projected starters and likely roles"}</h3>
            <p class="series-lineups-note">${escapeHtml(
              compact
                ? `${leftShort} ${left.rows.length} · ${rightShort} ${right.rows.length}`
                : "Use the series roster view for likely starters. Open a game tab for live per-map player stats and champion confirmation."
            )}</p>
          </div>
          ${compact ? "" : `<div class="form-summary-strip">${sourcePills}</div>`}
        </div>
        ${
          compact
            ? ""
            : `<div class="series-lineups-metrics">
          ${seriesDeskMetricCard(`${leftShort} starters`, String(left.rows.length), compactLineupSourceLabel(left.source), "left")}
          ${seriesDeskMetricCard(`${rightShort} starters`, String(right.rows.length), compactLineupSourceLabel(right.source), "right")}
          ${seriesDeskMetricCard("Coverage", String(left.rows.length + right.rows.length), "Projected players on this series view", "neutral")}
          ${seriesDeskMetricCard("Source blend", sources.length ? sources.map((value) => compactLineupSourceLabel(value)).join(" · ") : "Unavailable", "Draft, live, or trend-derived roster seed", "neutral")}
        </div>`
        }
      </article>
      <div class="series-lineup-grid">
        ${renderSeriesLineupTeamCard(match, {
          teamName: match.teams.left.name,
          rows: left.rows,
          source: left.source,
          toneClass: "left"
        })}
        ${renderSeriesLineupTeamCard(match, {
          teamName: match.teams.right.name,
          rows: right.rows,
          source: right.source,
          toneClass: "right"
        })}
      </div>
    </div>
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
  const compact = isCompactUI();
  return `
    <section class="economy-team${compact ? " compact" : ""}">
      <h3>${title}</h3>
      ${rows.length
        ? rows
            .map(
              (row) => `
                <article class="economy-row${compact ? " compact" : ""}">
                  <p class="name">${row.name} · ${row.champion}</p>
                  <p class="meta-text">${
                    compact
                      ? `${String(row.role || "flex").toUpperCase()} · KDA ${row.kills}/${row.deaths}/${row.assists} · GPM ${formatNumber(row.gpm)}`
                      : `${String(row.role || "flex").toUpperCase()} · KDA ${row.kills}/${row.deaths}/${row.assists} · CS ${row.cs}`
                  }</p>
                  ${compact ? "" : `<p class="meta-text">Gold ${formatNumber(row.goldEarned)} · GPM ${formatNumber(row.gpm)} · Items ${row.itemCount}</p>`}
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
  const compact = isCompactUI();
  if (!economy) {
    elements.economyBoardWrap.innerHTML = `<div class="empty">Economy board available during active/recent games.</div>`;
    return;
  }

  elements.economyBoardWrap.innerHTML = `
    ${totals && !compact ? `<article class="totals-strip">
      <p class="meta-text">${match.teams.left.name}: Gold ${formatNumber(totals.left.totalGold)} · Avg GPM ${formatNumber(totals.left.avgGpm)}</p>
      <p class="meta-text">${match.teams.right.name}: Gold ${formatNumber(totals.right.totalGold)} · Avg GPM ${formatNumber(totals.right.avgGpm)}</p>
    </article>` : ""}
    ${renderEconomyTeam(match.teams.left.name, economy.left || [])}
    ${renderEconomyTeam(match.teams.right.name, economy.right || [])}
    ${compact ? "" : `<p class="meta-text">Window ${shortDuration(economy.elapsedSeconds)} · Updated ${dateTimeLabel(economy.updatedAt)}</p>`}
  `;
}

function renderLaneMatchups(match) {
  const compact = isCompactUI();
  const rows = Array.isArray(match.laneMatchups) ? match.laneMatchups : [];
  if (!rows.length) {
    elements.laneMatchupsWrap.innerHTML = `<div class="empty">Lane matchup data requires draft + economy feeds.</div>`;
    return;
  }

  if (compact) {
    elements.laneMatchupsWrap.innerHTML = `
      <div class="lane-matchup-cards">
        ${rows
          .map((row) => {
            const diff = signed(row.goldDiff);
            const tone = Number(row.goldDiff || 0) > 0 ? "left" : Number(row.goldDiff || 0) < 0 ? "right" : "neutral";
            return `
              <article class="lane-matchup-card ${tone}">
                <div class="lane-matchup-head">
                  <p class="lane-matchup-role">${escapeHtml(String(row.role || "flex").toUpperCase())}</p>
                  <span class="lane-matchup-diff ${tone}">${escapeHtml(diff)}</span>
                </div>
                <div class="lane-matchup-team left">
                  <strong>${escapeHtml(row.left.player || "Player")}</strong>
                  <p class="meta-text">${escapeHtml(`${row.left.champion || "Unknown"} · ${row.left.kda || "n/a"} · CS ${row.left.cs ?? "n/a"}`)}</p>
                </div>
                <div class="lane-matchup-team right">
                  <strong>${escapeHtml(row.right.player || "Player")}</strong>
                  <p class="meta-text">${escapeHtml(`${row.right.champion || "Unknown"} · ${row.right.kda || "n/a"} · CS ${row.right.cs ?? "n/a"}`)}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
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
  if (state === "inProgress") {
    return "Live now.";
  }
  if (state === "completed") {
    return "Result confirmed.";
  }
  if (state === "unneeded") {
    return "Not needed after clinch.";
  }
  return "Scheduled.";
}

function renderSeriesGames(match, apiBase) {
  const games = Array.isArray(match.seriesGames) ? match.seriesGames : [];
  if (!games.length) {
    elements.seriesGamesWrap.innerHTML = `<div class="empty">No game breakdown available.</div>`;
    return;
  }

  const compact = isCompactUI();
  const leftTag = scoreboardTeamName(match?.teams?.left?.name);
  const rightTag = scoreboardTeamName(match?.teams?.right?.name);

  const cards = games
    .map((game) => {
      const options = Array.isArray(game.watchOptions) ? game.watchOptions : [];
      const openGameHref = detailUrlForGame(match.id, apiBase, game.number);
      const sideInfo = game?.sideInfo || {};
      const leftSide = String(sideInfo.leftSide || "").toLowerCase();
      const rightSide = String(sideInfo.rightSide || "").toLowerCase();
      const leftSideTone = leftSide === "blue" ? "blue" : leftSide === "red" ? "red" : "neutral";
      const rightSideTone = rightSide === "red" ? "red" : rightSide === "blue" ? "blue" : "neutral";
      const winnerMeta = resolvedSeriesGameWinner(match, game);
      const winnerName = winnerMeta?.name || null;
      const startedValue = sanitizedSeriesDateValue(game.startedAt);
      const startedLabel = startedValue ? (compact ? dateTimeCompact(startedValue) : dateTimeLabel(startedValue)) : "TBD";
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
      const hasSideInfo = Boolean(leftSide && rightSide);
      const facts = [
        `<span class="series-game-fact"><strong>Start</strong>${escapeHtml(startedLabel)}</span>`,
        `<span class="series-game-fact"><strong>Duration</strong>${escapeHtml(durationLabel)}</span>`
      ];
      if (hasSideInfo) {
        facts.push(`<span class="series-game-fact"><strong>Sides</strong>${escapeHtml(sideSummaryFromSeriesGame(game, match))}</span>`);
      }
      if (game.state === "completed" && !winnerMeta) {
        facts.push(`<span class="series-game-fact warn"><strong>Outcome</strong>Confirmed</span>`);
      }
      const openAction =
        game.state === "unneeded"
          ? `<span class="series-game-vod disabled">${compact ? "Skipped" : "Not played"}</span>`
          : game.selected
            ? `<span class="series-game-focused">${compact ? "Viewing" : "Viewing Game"}</span>`
            : `<a class="series-game-open" href="${openGameHref}">${compact ? "Open" : "Open Game"}</a>`;
      const vodAction = game.watchUrl
        ? `<a class="series-game-vod" href="${game.watchUrl}" target="_blank" rel="noreferrer">${compact ? "VOD" : "Watch VOD"}</a>`
        : `<span class="series-game-vod disabled">No VOD</span>`;
      const compactMeta = [
        winnerName
          ? `Winner ${scoreboardTeamName(winnerName, match?.game)}`
          : game.state === "completed"
            ? "Result confirmed"
            : statusNote,
        durationLabel !== "n/a" ? durationLabel : null,
        hasSideInfo ? sideSummaryFromSeriesGame(game, match) : null
      ].filter(Boolean);

      if (compact) {
        return `
          <article class="series-game-card compact-card ${game.selected ? "selected" : ""} state-${stateClass(game.state)}">
            <div class="series-game-topline compact">
              <div class="series-game-head">
                <p class="series-game-title">G${game.number}</p>
                <span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span>
              </div>
              ${
                game.selected
                  ? `<span class="series-game-focused compact">Viewing</span>`
                  : ""
              }
            </div>
            <p class="series-game-compact-note">${escapeHtml(compactMeta[0] || statusNote)}</p>
            ${
              compactMeta.length > 1
                ? `<div class="series-game-compact-facts">${compactMeta
                    .slice(1)
                    .map((entry) => `<span class="series-game-compact-chip">${escapeHtml(entry)}</span>`)
                    .join("")}</div>`
                : ""
            }
            <div class="series-game-actions compact">
              ${game.selected ? `<a class="series-game-open" href="${detailUrlForGame(match.id, apiBase, null)}">Series</a>` : openAction}
              ${vodAction}
            </div>
            ${
              game.state === "completed" && !winnerMeta
                ? `<p class="series-game-provider-note compact">Winner label unavailable on the series payload.</p>`
                : ""
            }
          </article>
        `;
      }

      return `
        <article class="series-game-card ${game.selected ? "selected" : ""} state-${stateClass(game.state)}">
          <div class="series-game-topline">
            <div class="series-game-head">
              <p class="series-game-title">${compact ? `G${game.number}` : `Game ${game.number}`}</p>
              <span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span>
            </div>
            ${
              winnerName
                ? `<p class="series-game-winner">Winner ${scoreboardTeamName(winnerName, match?.game)}</p>`
                : game.state === "completed"
                  ? `<p class="series-game-winner unresolved">Result confirmed</p>`
                  : ""
            }
          </div>
          <p class="series-game-status">${statusNote}</p>
          ${showLabel ? `<p class="series-game-caption">${labelText}</p>` : ""}
          <div class="series-game-facts">${facts.join("")}</div>
          ${
            hasSideInfo
              ? `<div class="series-game-sides">
                  <span class="series-side-chip ${leftSideTone}">${leftTag} ${leftSide.toUpperCase()}</span>
                  <span class="series-side-chip ${rightSideTone}">${rightTag} ${rightSide.toUpperCase()}</span>
                </div>`
              : ""
          }
          <div class="series-game-actions">
            ${openAction}
            ${vodAction}
          </div>
          ${
            game.state === "completed" && !winnerMeta
              ? `<p class="series-game-provider-note">Winner label unavailable on the series payload.</p>`
              : ""
          }
          ${options.length
            ? `<div class="series-game-options">${options
                .map((opt) => `<a class="series-game-option" href="${opt.watchUrl}" target="_blank" rel="noreferrer">${opt.shortLabel || opt.label}</a>`)
                .join("")}</div>`
            : ""}
        </article>
      `;
    })
    .join("");

  elements.seriesGamesWrap.innerHTML = `<div class="series-games-grid">${cards}</div>`;
}

function durationLabelFromMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) {
    return "n/a";
  }

  const totalSeconds = Math.round(value * 60);
  return shortDuration(totalSeconds);
}

function teamSideFromWinnerCandidate(match, candidate) {
  const normalizedCandidate = normalizeLookupKey(candidate);
  if (!normalizedCandidate || !match?.teams?.left || !match?.teams?.right) {
    return null;
  }

  const leftCandidates = [
    match.teams.left.name,
    displayTeamName(match.teams.left.name, match?.game),
    scoreboardTeamName(match.teams.left.name, match?.game)
  ]
    .map((value) => normalizeLookupKey(value))
    .filter(Boolean);
  const rightCandidates = [
    match.teams.right.name,
    displayTeamName(match.teams.right.name, match?.game),
    scoreboardTeamName(match.teams.right.name, match?.game)
  ]
    .map((value) => normalizeLookupKey(value))
    .filter(Boolean);

  if (leftCandidates.includes(normalizedCandidate)) {
    return "left";
  }

  if (rightCandidates.includes(normalizedCandidate)) {
    return "right";
  }

  return null;
}

function resolvedSeriesGameWinner(match, game) {
  if (!game || String(game?.state || "") !== "completed" || !match?.teams?.left || !match?.teams?.right) {
    return null;
  }

  const leftId = String(match.teams.left.id || "");
  const rightId = String(match.teams.right.id || "");
  const winnerTeamId = String(game?.winnerTeamId || "");
  if (winnerTeamId && leftId && winnerTeamId === leftId) {
    return { side: "left", name: match.teams.left.name, source: "provider" };
  }
  if (winnerTeamId && rightId && winnerTeamId === rightId) {
    return { side: "right", name: match.teams.right.name, source: "provider" };
  }

  for (const candidate of [game?.winnerTeamName, game?.winnerName, game?.result?.winnerTeamName, game?.result?.winnerName, game?.winnerLabel]) {
    const side = teamSideFromWinnerCandidate(match, candidate);
    if (side) {
      return { side, name: match.teams[side].name, source: "provider" };
    }
  }

  const leftScore = Number(game?.leftScore);
  const rightScore = Number(game?.rightScore);
  if (Number.isFinite(leftScore) && Number.isFinite(rightScore) && leftScore !== rightScore) {
    return leftScore > rightScore
      ? { side: "left", name: match.teams.left.name, source: "score" }
      : { side: "right", name: match.teams.right.name, source: "score" };
  }

  const selected = match?.selectedGame;
  if (
    selected &&
    String(selected?.state || "") === "completed" &&
    Number(selected?.number || 0) === Number(game?.number || 0)
  ) {
    const selectedLeftKills = Number(selected?.snapshot?.left?.kills);
    const selectedRightKills = Number(selected?.snapshot?.right?.kills);
    if (Number.isFinite(selectedLeftKills) && Number.isFinite(selectedRightKills) && selectedLeftKills !== selectedRightKills) {
      return selectedLeftKills > selectedRightKills
        ? { side: "left", name: match.teams.left.name, source: "selected_snapshot" }
        : { side: "right", name: match.teams.right.name, source: "selected_snapshot" };
    }
  }

  return null;
}

function resolveSeriesGameWinnerName(game, match) {
  return resolvedSeriesGameWinner(match, game)?.name || null;
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
  const resolvedWinners = completedGames.map((game) => ({
    game,
    winner: resolvedSeriesGameWinner(match, game)
  }));
  const resolvedWinnerCount = resolvedWinners.filter((entry) => entry.winner).length;
  const durations = completedGames
    .map((game) => Number(game.durationMinutes))
    .filter((value) => Number.isFinite(value) && value > 0);
  const leftWins = resolvedWinners.filter((entry) => entry.winner?.side === "left").length;
  const rightWins = resolvedWinners.filter((entry) => entry.winner?.side === "right").length;
  const avgDuration = durations.length
    ? durationLabelFromMinutes(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : "n/a";
  const fastest = durations.length ? durationLabelFromMinutes(Math.min(...durations)) : "n/a";
  const slowest = durations.length ? durationLabelFromMinutes(Math.max(...durations)) : "n/a";
  const resultsCoverageLabel =
    resolvedWinnerCount === completedGames.length
      ? "Complete"
      : resolvedWinnerCount > 0
        ? `Partial ${resolvedWinnerCount}/${completedGames.length}`
        : "Limited";
  const resultsCoverageNote =
    resolvedWinnerCount === completedGames.length
      ? "All map winners resolved."
      : resolvedWinnerCount > 0
        ? "Some map winners inferred from provider hints or the focused map."
        : "Provider exposed map completion and VODs, but not per-map winner labels.";

  const summaryCards = compact
    ? [
        { label: "Coverage", value: resultsCoverageLabel, note: null },
        { label: "Maps", value: String(completedGames.length), note: null },
        { label: "Avg", value: avgDuration, note: null },
        { label: "Fast", value: fastest, note: null }
      ]
    : [
        { label: "Final Score", value: `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`, note: null },
        { label: "Completed Maps", value: String(completedGames.length), note: null },
        { label: "Winner Coverage", value: resultsCoverageLabel, note: resultsCoverageNote },
        { label: "Avg Map Length", value: avgDuration, note: null },
        { label: "Fastest Map", value: fastest, note: null },
        { label: "Slowest Map", value: slowest, note: null }
      ];

  if (!compact && resolvedWinnerCount > 0) {
    summaryCards.splice(
      2,
      0,
      { label: `${displayTeamName(match.teams.left.name)} Wins`, value: String(leftWins), note: null },
      { label: `${displayTeamName(match.teams.right.name)} Wins`, value: String(rightWins), note: null }
    );
  }

  const rows = games
    .map((game) => {
      const openHref = detailUrlForGame(match.id, apiBase, game.number);
      const winnerMeta = resolvedSeriesGameWinner(match, game);
      const winnerText =
        (winnerMeta ? displayTeamName(winnerMeta.name, match?.game) : null) ||
        (game.state === "inProgress"
          ? "Live"
          : game.state === "unneeded"
            ? "Not played"
            : game.state === "completed"
              ? "Result confirmed"
              : "TBD");
      const durationText = durationLabelFromMinutes(game.durationMinutes);
      const sideText = sideSummaryFromSeriesGame(game, match);
      const watchLink = game.watchUrl
        ? `<a class="table-link" href="${game.watchUrl}" target="_blank" rel="noreferrer">VOD</a>`
        : `<span class="meta-text">n/a</span>`;
      const openText =
        game.state === "unneeded"
          ? `<span class="meta-text">Not played</span>`
          : game.selected
            ? `<span class="meta-text strong">Focused</span>`
            : `<a class="table-link" href="${openHref}">Open</a>`;

      if (compact) {
        const compactMeta = [durationText !== "n/a" ? durationText : null, sideText !== "n/a" ? sideText : null].filter(Boolean);
        return `
          <article class="series-compare-item ${game.selected ? "selected" : ""}">
            <div class="series-compare-item-top">
              <p class="series-compare-game">G${game.number}</p>
              <span class="pill ${stateClass(game.state)}">${stateLabel(game.state)}</span>
            </div>
            <p class="series-compare-outcome">${winnerText}</p>
            ${compactMeta.length ? `<p class="series-compare-compact-meta">${escapeHtml(compactMeta.join(" · "))}</p>` : ""}
            ${game.state === "completed" && !winnerMeta ? `<p class="meta-text">Winner label unavailable on series payload.</p>` : ""}
            <div class="series-compare-links">
              ${game.watchUrl ? `<a class="table-link" href="${game.watchUrl}" target="_blank" rel="noreferrer">VOD</a>` : `<span class="meta-text">No VOD</span>`}
              ${
                game.state === "unneeded"
                  ? `<span class="meta-text">Not played</span>`
                  : game.selected
                    ? `<span class="meta-text strong">Focused</span>`
                    : `<a class="table-link" href="${openHref}">Open</a>`
              }
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

  const heroMarkup = compact
    ? `
      <article class="series-results-hero compact-header ${resolvedWinnerCount === completedGames.length ? "complete" : "partial"}">
        <div class="series-results-copy">
          <p class="tempo-label">Results desk</p>
          <h3>Map outcomes</h3>
          <p class="series-results-note">${escapeHtml(
            resolvedWinnerCount === completedGames.length
              ? `${completedGames.length} map${completedGames.length === 1 ? "" : "s"} resolved`
              : `${resultsCoverageLabel} · ${completedGames.length} map${completedGames.length === 1 ? "" : "s"}`
          )}</p>
        </div>
      </article>
    `
    : `
      <article class="series-results-hero ${resolvedWinnerCount === completedGames.length ? "complete" : "partial"}">
        <div class="series-results-copy">
          <p class="tempo-label">Results Desk</p>
          <h3>${escapeHtml(
            resolvedWinnerCount === completedGames.length
              ? `Final ${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0} with map winners resolved`
              : `Final ${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`
          )}</h3>
          <p class="series-results-note">${escapeHtml(resultsCoverageNote)}</p>
        </div>
        <div class="series-results-hero-score">
          <span class="series-results-team">${escapeHtml(scoreboardTeamName(match?.teams?.left?.name, match?.game))}</span>
          <strong>${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}</strong>
          <span class="series-results-team">${escapeHtml(scoreboardTeamName(match?.teams?.right?.name, match?.game))}</span>
        </div>
      </article>
    `;

  elements.seriesCompareWrap.innerHTML = `
    <div class="series-results-shell">
      ${heroMarkup}
    <div class="series-compare-summary">
      ${summaryCards
        .map(
          (card) => `
            <article class="series-compare-card">
              <p class="tempo-label">${card.label}</p>
              <p class="tempo-value">${card.value}</p>
              ${card.note ? `<p class="meta-text">${card.note}</p>` : ""}
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
                <th>Outcome</th>
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
    </div>
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

function recapFeatureChip(label, tone = "neutral") {
  if (!label) {
    return "";
  }

  return `<span class="recap-feature-chip ${tone}">${escapeHtml(label)}</span>`;
}

function recapFeatureCard({ kicker = null, title, summary = null, chips = [], tone = "neutral", compact = false }) {
  const chipMarkup = chips
    .filter(Boolean)
    .map((chip) => {
      if (typeof chip === "string") {
        return recapFeatureChip(chip, "neutral");
      }
      return recapFeatureChip(chip.label, chip.tone || "neutral");
    })
    .join("");

  return `
    <article class="recap-feature ${tone}${compact ? " compact" : ""}">
      <div class="recap-feature-copy">
        ${kicker ? `<p class="tempo-label">${escapeHtml(kicker)}</p>` : ""}
        <h3 class="recap-story-title">${escapeHtml(title || "Map recap")}</h3>
        ${summary ? `<p class="meta-text">${escapeHtml(summary)}</p>` : ""}
      </div>
      ${chipMarkup ? `<div class="recap-feature-chips">${chipMarkup}</div>` : ""}
    </article>
  `;
}

function recapNoteMarkup(lines = [], { compact = false } = {}) {
  const rendered = lines.filter(Boolean).map((line) => `<p class="meta-text">${escapeHtml(line)}</p>`).join("");
  if (!rendered) {
    return "";
  }
  return `<article class="recap-note${compact ? " compact" : ""}">${rendered}</article>`;
}

function gameOverviewFactCard(label, value, note = null, tone = "neutral") {
  return `
    <article class="game-overview-fact ${tone}">
      <p class="tempo-label">${escapeHtml(label)}</p>
      <p class="game-overview-fact-value">${escapeHtml(value)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function gameOverviewObjectiveSummary(match, left = {}, right = {}) {
  const terms = objectiveTerminology(match);
  const leftTowers = Number(left?.towers || 0);
  const rightTowers = Number(right?.towers || 0);
  const leftBarons = Number(left?.barons || 0);
  const rightBarons = Number(right?.barons || 0);
  const leftBase = Number(left?.inhibitors || 0);
  const rightBase = Number(right?.inhibitors || 0);

  if (normalizeGameKey(match?.game) === "dota2") {
    return {
      value: `${terms.baronLabel} ${leftBarons}-${rightBarons}`,
      note: `Towers ${leftTowers}-${rightTowers} · Barracks ${leftBase}-${rightBase}`
    };
  }

  const leftDragons = Number(left?.dragons || 0);
  const rightDragons = Number(right?.dragons || 0);
  return {
    value: `${terms.dragonLabel} ${leftDragons}-${rightDragons}`,
    note: `Towers ${leftTowers}-${rightTowers} · ${terms.baronLabel} ${leftBarons}-${rightBarons}`
  };
}

function renderGameOverviewDesk(match) {
  if (!elements.gameOverviewDeskWrap) {
    return;
  }

  const selectedGame = match?.selectedGame;
  if (!selectedGame || !match?.teams?.left || !match?.teams?.right) {
    elements.gameOverviewDeskWrap.innerHTML = `<div class="empty">Game desk appears once a map is selected.</div>`;
    return;
  }

  const compact = isCompactUI();
  const status = String(selectedGame.state || "").trim();
  const statusLabelText = readableGameStateLabel(status);
  const draftPreview = inferDraftPreview(match);
  const selectedSeriesGame = (Array.isArray(match?.seriesGames) ? match.seriesGames : []).find((game) => game.selected) || null;
  const winnerName = selectedGameWinnerName(match, selectedSeriesGame, selectedGame) || null;
  const seriesScoreLabel = `${match?.seriesScore?.left ?? 0}-${match?.seriesScore?.right ?? 0}`;
  const durationLabel = durationLabelFromMinutes(selectedSeriesGame?.durationMinutes);
  const snapshot = selectedGame.snapshot || {};
  const left = snapshot.left || {};
  const right = snapshot.right || {};
  const leftName = match.teams.left.name || "Left Team";
  const rightName = match.teams.right.name || "Right Team";
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const leftKills = Number(left?.kills || 0);
  const rightKills = Number(right?.kills || 0);
  const leftGold = Number(left?.gold);
  const rightGold = Number(right?.gold);
  const hasGold = Number.isFinite(leftGold) && Number.isFinite(rightGold);
  const goldDiff = hasGold ? leftGold - rightGold : Number(match?.momentum?.goldLead || 0);
  const leadDescriptor = feedLeadDescriptor(match, goldDiff);
  const startedLabel = selectedGame?.startedAt
    ? compact
      ? dateTimeCompact(selectedGame.startedAt)
      : dateTimeLabel(selectedGame.startedAt)
    : "TBD";
  const estimatedStart = selectedGameEstimatedStart(match, selectedGame.number);
  const estimatedStartLabel = estimatedStart
    ? compact
      ? dateTimeCompact(estimatedStart)
      : dateTimeLabel(estimatedStart)
    : "TBD";
  const sideSummary = Array.isArray(selectedGame.sideSummary) ? selectedGame.sideSummary.filter(Boolean) : [];
  const sideSummaryLabel = sideSummary.length ? sideSummary.join(" · ") : "Sides pending";
  const telemetryLabel = String(selectedGame.telemetryStatus || "none").toUpperCase();
  const focusedContext = focusedLiveEventContext(match);
  const focusedRow = focusedContext.row || focusedContext.latestRow;
  const genericFocusedRow = focusedRow && isGenericLiveStateTitle(focusedRow.title, selectedGame.number);
  const nextObjective = nextObjectiveWindow(match);
  const pulseState = updateMapPulseState(match);
  const completedStory = buildCompletedGameStory(match);
  const topPlayer = Array.isArray(match?.topPerformers) && match.topPerformers.length ? match.topPerformers[0] : null;
  const topPlayerTeam = topPlayer ? teamNameBySide(match, topPlayer.team) : null;
  const objectiveSummary = gameOverviewObjectiveSummary(match, left, right);

  let headline = `Game ${selectedGame.number}`;
  let note = `${statusLabelText} · Series ${seriesScoreLabel}`;
  let toneClass = "upcoming";
  let centerLabel = "Map";
  let centerValue = `${leftKills}-${rightKills}`;
  let centerNote = sideSummaryLabel;

  if (status === "completed") {
    toneClass = "complete";
    headline =
      completedStory?.headline ||
      (winnerName ? `${scoreboardTeamName(winnerName, match?.game)} won Game ${selectedGame.number}` : `Game ${selectedGame.number} final`);
    note = [
      completedStory?.summary || null,
      durationLabel !== "n/a" ? durationLabel : null,
      `Series ${seriesScoreLabel}`
    ]
      .filter(Boolean)
      .join(" · ");
    centerLabel = "Final kills";
    centerNote = durationLabel !== "n/a" ? durationLabel : "Result final";
  } else if (status === "inProgress") {
    toneClass = "live";
    const liveClock = Number(match?.playerEconomy?.elapsedSeconds || 0) > 0 ? formatGameClock(Number(match.playerEconomy.elapsedSeconds)) : "Live";
    headline = !genericFocusedRow && focusedRow ? focusedRow.title : match?.pulseCard?.title || `Game ${selectedGame.number} live`;
    note = [
      focusedRow ? `${formatFocusedEventClock(focusedRow, focusedContext.timelineAnchor)} ${focusedRow.phase.label}` : `Clock ${liveClock}`,
      leadDescriptor.label,
      nextObjective ? `${displayObjectiveName(nextObjective.type, match)} ${objectiveEtaLabel(nextObjective)}` : `${leftKills}-${rightKills} kills`
    ]
      .filter(Boolean)
      .join(" · ");
    centerLabel = "Live kills";
    centerNote = leadDescriptor.label;
  } else if (status === "unneeded") {
    toneClass = "complete";
    headline = `Game ${selectedGame.number} was skipped`;
    note = `Series ended before this map was needed. Final series score ${seriesScoreLabel}.`;
    centerLabel = "Skipped";
    centerValue = "0-0";
    centerNote = "Not played";
  } else {
    toneClass = draftPreview ? "live" : "upcoming";
    headline = draftPreview?.headline || `Game ${selectedGame.number} is next`;
    note =
      draftPreview?.summary ||
      [
        estimatedStart ? `Projected ${estimatedStartLabel}` : null,
        `Series ${seriesScoreLabel}`,
        sideSummaryLabel !== "Sides pending" ? sideSummaryLabel : null
      ]
        .filter(Boolean)
        .join(" · ");
    centerLabel = draftPreview ? draftPreview.badge : "Upcoming";
    centerValue = "0-0";
    centerNote = estimatedStart ? estimatedStartLabel : "Waiting for start";
  }

  const heroPills = [
    `Game ${selectedGame.number}`,
    `Series ${seriesScoreLabel}`,
    telemetryLabel,
    normalizeGameKey(match?.game) === "dota2" ? null : match?.patch ? `Patch ${match.patch}` : null
  ]
    .filter(Boolean)
    .slice(0, compact ? 2 : 4)
    .map((pill) => `<span class="game-overview-pill">${escapeHtml(pill)}</span>`)
    .join("");

  const facts = [];
  facts.push(gameOverviewFactCard("State", statusLabelText, `Telemetry ${telemetryLabel}`, toneClass));

  if (status === "completed") {
    facts.push(
      gameOverviewFactCard(
        "Winner",
        winnerName ? displayTeamName(winnerName, match?.game) : "TBD",
        durationLabel !== "n/a" ? durationLabel : "Duration n/a",
        winnerName === leftName ? "left" : winnerName === rightName ? "right" : "neutral"
      )
    );
    if (completedStory?.turningPointLabel) {
      facts.push(gameOverviewFactCard("Turning Point", completedStory.turningPointLabel, completedStory.turningPointNote || null, "neutral"));
    }
    if (completedStory?.peakLeadLabel) {
      facts.push(gameOverviewFactCard("Peak Lead", completedStory.peakLeadLabel, completedStory.peakLeadNote || null, "neutral"));
    }
  } else if (status === "inProgress") {
    const pressureLabel = pulseState
      ? pulseState.team === "both"
        ? "Fight live"
        : `${pulseState.team === "left" ? leftShort : rightShort} pressure`
      : "State stable";
    facts.push(
      gameOverviewFactCard(
        "Gold",
        hasGold ? `${formatNumber(leftGold)} - ${formatNumber(rightGold)}` : "n/a",
        hasGold ? `Lead ${leadDescriptor.label}` : "Gold totals pending",
        leadDescriptor.tone || "neutral"
      )
    );
    facts.push(gameOverviewFactCard("Objectives", objectiveSummary.value, objectiveSummary.note || null, "neutral"));
    facts.push(
      gameOverviewFactCard(
        "Next Objective",
        nextObjective ? displayObjectiveName(nextObjective.type, match) : "Forecast waiting",
        nextObjective
          ? `${nextObjective.state === "available" ? "Available now" : `ETA ${objectiveEtaLabel(nextObjective)}`}${
              nextObjective.nextAt ? ` · ${shortTimeLabel(nextObjective.nextAt)}` : ""
            }`
          : "Timer windows appear once cadence is established.",
        nextObjective?.state === "available" ? "live" : "neutral"
      )
    );
    facts.push(gameOverviewFactCard("Pressure", pressureLabel, focusedRow?.summary && !genericFocusedRow ? clampSummaryText(focusedRow.summary, 84) : sideSummaryLabel, pulseState ? "warn" : "neutral"));
  } else {
    facts.push(
      gameOverviewFactCard(
        "Start",
        estimatedStartLabel,
        estimatedStart ? "Projected map start" : "Time not published yet",
        "neutral"
      )
    );
    facts.push(gameOverviewFactCard("Sides", sideSummaryLabel, draftPreview?.detail || null, "neutral"));
    facts.push(
      gameOverviewFactCard(
        "Watch",
        selectedGame.watchUrl ? "Ready" : "Pending",
        selectedGame.watchUrl ? "Primary stream or VOD link is available." : "Watch link appears when coverage is published.",
        selectedGame.watchUrl ? "live" : "neutral"
      )
    );
    if (draftPreview) {
      facts.push(gameOverviewFactCard("Phase", draftPreview.label, draftPreview.summary, toneClass));
    }
  }

  if (topPlayer) {
    facts.push(
      gameOverviewFactCard(
        "Top Player",
        displayPlayerHandle(topPlayer.name, topPlayerTeam),
        `${scoreboardTeamName(topPlayerTeam, match?.game)} · ${trackerHeroName(topPlayer)} · KDA ${topPlayer.kills || 0}/${topPlayer.deaths || 0}/${topPlayer.assists || 0}`,
        topPlayer.team || "neutral"
      )
    );
  }

  const visibleFacts = compact ? facts.slice(0, 4) : facts;
  const headlineText =
    compact && status === "completed" && winnerName
      ? `${scoreboardTeamName(winnerName, match?.game)} won G${selectedGame.number}`
      : headline;
  const noteText = compact ? clampSummaryText(note, 96) : note;

  elements.gameOverviewDeskWrap.innerHTML = `
    <div class="game-overview-shell ${toneClass}${compact ? " compact" : ""}">
      <article class="game-overview-hero ${toneClass}${compact ? " compact" : ""}">
        <div class="game-overview-copy">
          <div class="game-overview-topline">
            <span class="game-overview-pill ${toneClass}">${escapeHtml(statusLabelText)}</span>
            ${heroPills}
          </div>
          <h3 class="game-overview-title">${escapeHtml(headlineText)}</h3>
          <p class="game-overview-note">${escapeHtml(noteText)}</p>
        </div>
        <div class="game-overview-scorecard">
          <div class="game-overview-side left">
            <span class="game-overview-team-mark">${teamBadgeMarkup(match.teams.left, match?.game)}</span>
            <span class="game-overview-team-name">${escapeHtml(displayTeamName(leftName, match?.game))}</span>
            <strong class="game-overview-team-score">${Number.isFinite(leftKills) ? leftKills : 0}</strong>
          </div>
          <div class="game-overview-score-meta">
            <span class="game-overview-score-label">${escapeHtml(centerLabel)}</span>
            <strong class="game-overview-score-value">${escapeHtml(centerValue)}</strong>
            <span class="game-overview-score-note">${escapeHtml(centerNote)}</span>
          </div>
          <div class="game-overview-side right">
            <span class="game-overview-team-mark">${teamBadgeMarkup(match.teams.right, match?.game)}</span>
            <span class="game-overview-team-name">${escapeHtml(displayTeamName(rightName, match?.game))}</span>
            <strong class="game-overview-team-score">${Number.isFinite(rightKills) ? rightKills : 0}</strong>
          </div>
        </div>
      </article>
      <div class="game-overview-grid${compact ? " compact" : ""}">
        ${visibleFacts.join("")}
      </div>
    </div>
  `;
}

function eventClockLabel(match, at, gameClockSeconds = null) {
  if (Number.isFinite(gameClockSeconds)) {
    return formatGameClock(gameClockSeconds);
  }

  const eventTs = parseIsoTimestamp(at);
  const anchor = resolveFeedTimelineAnchor(match, []);
  if (Number.isFinite(eventTs) && Number.isFinite(anchor.startTs)) {
    const deltaSeconds = Math.max(0, Math.round((eventTs - anchor.startTs) / 1000));
    return `${anchor.estimated ? "~" : ""}${formatGameClock(deltaSeconds)}`;
  }

  return at ? dateTimeCompact(at) : "Time n/a";
}

function teamShortNameForSide(match, side) {
  if (side === "left") {
    return scoreboardTeamName(match?.teams?.left?.name || "Left");
  }
  if (side === "right") {
    return scoreboardTeamName(match?.teams?.right?.name || "Right");
  }
  return "Map";
}

function completedGameFeedRows(match) {
  return enrichFeedRowsWithState(match, feedRowsWithGameClock(match, buildUnifiedFeed(match)).rows)
    .slice()
    .sort((left, right) => Number(left?.eventTs || 0) - Number(right?.eventTs || 0));
}

function buildCompletedObjectiveRecapCard(label, row, match) {
  if (!row) {
    return null;
  }

  return recapCard(
    label,
    teamShortNameForSide(match, row.team),
    `${eventClockLabel(match, row.at, row.gameClockSeconds)} · ${row.title}`
  );
}

function extractBurstScoreSummary(summary) {
  const text = String(summary || "");
  const normalized = text.toLowerCase();
  if (!normalized.includes("score")) {
    return null;
  }

  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) {
    return null;
  }

  return {
    left: Number(match[1]),
    right: Number(match[2])
  };
}

function buildCompletedGameKillRaceCard(match, threshold = 10) {
  const bursts = (Array.isArray(match?.combatBursts) ? match.combatBursts : [])
    .slice()
    .sort((left, right) => parseIsoTimestamp(left?.occurredAt) - parseIsoTimestamp(right?.occurredAt));

  for (const burst of bursts) {
    const score = extractBurstScoreSummary(burst?.summary);
    if (!score) {
      continue;
    }

    let side = null;
    if (score.left >= threshold && score.right < threshold) {
      side = "left";
    } else if (score.right >= threshold && score.left < threshold) {
      side = "right";
    } else if (score.left >= threshold && score.right >= threshold) {
      side = burst?.team === "left" || burst?.team === "right" ? burst.team : null;
    }

    if (!side && score.left < threshold && score.right < threshold) {
      continue;
    }

    return recapCard(
      `First to ${threshold}`,
      side ? teamShortNameForSide(match, side) : `${score.left}-${score.right}`,
      `${eventClockLabel(match, burst?.occurredAt)} · score ${score.left}-${score.right}`
    );
  }

  return null;
}

function buildCompletedGameDetailCards(match) {
  const feedRows = completedGameFeedRows(match);
  const objectiveRows = feedRows.filter((row) => row.bucket === "objective" && row.team);
  const firstObjective = objectiveRows[0] || null;
  const firstBaron = objectiveRows.find((row) => row.objectiveKey === "baron") || null;
  const firstTower = objectiveRows.find((row) => /tower/i.test(String(row?.title || ""))) || null;
  const firstInhibitor =
    objectiveRows.find((row) =>
      normalizeGameKey(match?.game) === "dota2"
        ? /barracks|rax/i.test(String(row?.title || ""))
        : /inhibitor/i.test(String(row?.title || ""))
    ) || null;
  const closingObjective = objectiveRows.length ? objectiveRows[objectiveRows.length - 1] : null;
  const swingRows = feedRows.filter(
    (row) => row.bucket === "swing" && Number.isFinite(Math.abs(Number(row?.swingDescriptor?.value || 0))) && Math.abs(Number(row?.swingDescriptor?.value || 0)) >= 120
  );
  const biggestSwing = swingRows.reduce((best, row) => {
    if (!best) {
      return row;
    }
    return Math.abs(Number(row?.swingDescriptor?.value || 0)) > Math.abs(Number(best?.swingDescriptor?.value || 0)) ? row : best;
  }, null);
  const biggestFight = (Array.isArray(match?.combatBursts) ? match.combatBursts : []).reduce((best, row) => {
    if (!best) {
      return row;
    }
    const bestKills = Number(best?.kills || 0);
    const nextKills = Number(row?.kills || 0);
    if (nextKills !== bestKills) {
      return nextKills > bestKills ? row : best;
    }
    return parseIsoTimestamp(row?.occurredAt) > parseIsoTimestamp(best?.occurredAt) ? row : best;
  }, null);
  const completedStory = buildCompletedGameStory(match);
  const terms = objectiveTerminology(match);
  const cards = [];
  const seenKeys = new Set();
  const pushCard = (key, markup) => {
    if (!markup || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    cards.push(markup);
  };

  if (firstObjective) {
    pushCard(`event:${firstObjective.eventId || firstObjective.id || "first_objective"}`, buildCompletedObjectiveRecapCard("First Objective", firstObjective, match));
  }
  if (firstBaron) {
    pushCard(`event:${firstBaron.eventId || firstBaron.id || "first_baron"}`, buildCompletedObjectiveRecapCard(`First ${terms.baronSingle}`, firstBaron, match));
  }
  if (firstTower) {
    pushCard(`event:${firstTower.eventId || firstTower.id || "first_tower"}`, buildCompletedObjectiveRecapCard("First Tower", firstTower, match));
  }
  if (firstInhibitor) {
    pushCard(
      `event:${firstInhibitor.eventId || firstInhibitor.id || "first_inhibitor"}`,
      buildCompletedObjectiveRecapCard(
        normalizeGameKey(match?.game) === "dota2" ? "First Barracks" : "First Inhibitor",
        firstInhibitor,
        match
      )
    );
  }

  pushCard("kill_race_10", buildCompletedGameKillRaceCard(match, 10));

  if (biggestFight && Number(biggestFight?.kills || 0) > 0) {
    pushCard(
      `fight:${biggestFight.id || "largest"}`,
      recapCard(
        "Biggest Fight",
        `${Number(biggestFight.kills || 0)} kills`,
        `${eventClockLabel(match, biggestFight?.occurredAt)} · ${biggestFight.title}`
      )
    );
  }

  if (biggestSwing) {
    pushCard(
      `swing:${biggestSwing.eventId || biggestSwing.id || "largest"}`,
      recapCard(
        "Biggest Swing",
        biggestSwing.swingDescriptor?.label || biggestSwing.leadDescriptor?.label || "Swing",
        `${eventClockLabel(match, biggestSwing.at, biggestSwing.gameClockSeconds)} · ${biggestSwing.title}`
      )
    );
  }

  if (closingObjective) {
    pushCard(
      `event:${closingObjective.eventId || closingObjective.id || "closing_objective"}`,
      buildCompletedObjectiveRecapCard("Closing Objective", closingObjective, match)
    );
  }

  if (completedStory?.peakLeadLabel) {
    pushCard("story_peak_lead", recapCard("Peak Lead", completedStory.peakLeadLabel, completedStory.peakLeadNote || null));
  }
  if (completedStory?.turningPointLabel) {
    pushCard(
      "story_turning_point",
      recapCard("Turning Point", completedStory.turningPointLabel, completedStory.turningPointNote || null)
    );
  }

  return cards.slice(0, 6);
}

function selectedGameHasZeroSnapshot(selectedGame) {
  const snapshot = selectedGame?.snapshot || {};
  const left = snapshot.left || {};
  const right = snapshot.right || {};
  const fields = ["kills", "towers", "dragons", "barons", "inhibitors"];
  const hasAnyCount = fields.some((field) => Number(left[field] || 0) > 0 || Number(right[field] || 0) > 0);
  const hasGold = Number.isFinite(Number(left.gold)) || Number.isFinite(Number(right.gold));
  return !hasAnyCount && !hasGold;
}

function defaultDraftRoles(match) {
  const gameKey = normalizeGameKey(match?.game);
  if (gameKey === "dota2") {
    return ["pos1", "pos2", "pos3", "pos4", "pos5"];
  }

  return ["top", "jungle", "mid", "bot", "support"];
}

function buildDraftPlaceholderRows(match) {
  return defaultDraftRoles(match).map((role) => ({
    role,
    champion: "Pending",
    name: "Waiting pick",
    placeholder: true
  }));
}

function inferDraftPreview(match) {
  const selectedGame = match?.selectedGame;
  if (!selectedGame || String(selectedGame.state || "") !== "inProgress") {
    return null;
  }

  const gameKey = normalizeGameKey(match?.game);
  const telemetryStatus = String(selectedGame.telemetryStatus || "").toLowerCase();
  const leftRows = Array.isArray(match?.teamDraft?.left) ? match.teamDraft.left : [];
  const rightRows = Array.isArray(match?.teamDraft?.right) ? match.teamDraft.right : [];
  const hasDraftRows = leftRows.length > 0 || rightRows.length > 0;
  const zeroSnapshot = selectedGameHasZeroSnapshot(selectedGame);
  const startedTs = parseIsoTimestamp(selectedGame?.startedAt);
  const elapsedSeconds = startedTs !== null ? Math.max(0, Math.round((Date.now() - startedTs) / 1000)) : null;
  const elapsedLabel = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? shortDuration(elapsedSeconds) : null;
  const completedGames = Array.isArray(match?.seriesGames)
    ? match.seriesGames.filter((game) => String(game?.state || "") === "completed")
    : [];
  const lastCompletedGame =
    completedGames.length > 0
      ? completedGames
          .slice()
          .sort((left, right) => Number(right?.number || 0) - Number(left?.number || 0))[0]
      : null;

  if (gameKey === "dota2" && telemetryStatus === "pending") {
    const betweenMapsLikely = !selectedGame?.sourceMatchId && completedGames.length > 0;
    if (betweenMapsLikely) {
      return {
        tone: "pending",
        label: "Current Map Pending",
        badge: "Live Series",
        headline: "Current Dota map is not linked yet",
        summary:
          "The series is live, but the current map has not been attached to a usable telemetry feed yet. This usually happens between maps or while the provider has not exposed the new lobby.",
        detail: lastCompletedGame
          ? `Game ${lastCompletedGame.number} is complete. Waiting for the current map feed to attach.`
          : elapsedLabel
            ? `Live state opened ${elapsedLabel} ago.`
            : "Waiting for the current map feed to attach.",
        leftRows: [],
        rightRows: [],
        hasDraftRows: false,
        suppressDraftGrid: true
      };
    }

    if (zeroSnapshot) {
      return {
        tone: "pending",
        label: "Telemetry Pending",
        badge: "Feed Pending",
        headline: "Live Dota feed has not started",
        summary:
          "The map is marked live, but no current-map combat telemetry is available yet. Watch links and series context are still valid while the feed catches up.",
        detail: elapsedLabel ? `Map has been marked live for ${elapsedLabel}.` : "Waiting for the first confirmed current-map frame.",
        leftRows: [],
        rightRows: [],
        hasDraftRows: false,
        suppressDraftGrid: true
      };
    }
  }

  if (telemetryStatus === "pending" && zeroSnapshot) {
    return {
      tone: hasDraftRows ? "draft" : "pending",
      label: hasDraftRows ? "Draft / Loading" : "Likely Draft",
      badge: hasDraftRows ? "Draft Live" : "Awaiting Frame",
      headline: hasDraftRows ? "Champion select is underway" : "Game start is close",
      summary: hasDraftRows
        ? "Champion selections are available, but combat telemetry has not started yet."
        : "Riot has marked this map live, but no in-game frames are available yet. This usually means champion select, loading, or a stage delay.",
      detail: elapsedLabel ? `Live state opened ${elapsedLabel} ago.` : "Waiting for first confirmed in-game frame.",
      leftRows: hasDraftRows ? leftRows : buildDraftPlaceholderRows(match),
      rightRows: hasDraftRows ? rightRows : buildDraftPlaceholderRows(match),
      hasDraftRows
    };
  }

  if (hasDraftRows && telemetryStatus !== "rich") {
    return {
      tone: "draft",
      label: "Draft Snapshot",
      badge: "Metadata Only",
      headline: "Champion select is underway",
      summary: "Current champion selections are available before full live telemetry arrives.",
      detail: elapsedLabel ? `Map state has been live for ${elapsedLabel}.` : "Waiting for telemetry to stabilize.",
      leftRows,
      rightRows,
      hasDraftRows: true
    };
  }

  return null;
}

function draftPreviewAvatar(match, row) {
  if (row?.placeholder) {
    return `<span class="tracker-hero-icon fallback recap-draft-avatar pending">?</span>`;
  }

  return heroIconMarkup(match, row);
}

function renderRecapDraftTeam(match, title, rows = []) {
  const normalized = rows.length ? normalizeLineupRows(rows) : buildDraftPlaceholderRows(match);
  return `
    <section class="recap-draft-team">
      <h3>${title}</h3>
      ${normalized
        .map(
          (row) => `
            <article class="recap-draft-row${row.placeholder ? " pending" : ""}">
              <div class="recap-draft-id">
                ${draftPreviewAvatar(match, row)}
                ${roleIconMarkup(row.role, normalizeGameKey(match?.game), false)}
              </div>
              <div class="recap-draft-copy">
                <p class="recap-draft-title">${row.champion || "Pending"}</p>
                <p class="recap-draft-meta">${row.name || "Player"} · ${roleMeta(row.role, normalizeGameKey(match?.game)).label}</p>
              </div>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderSelectedGameRecap(match) {
  scheduleHeroIconCatalogLoad(match);
  const selectedGame = match.selectedGame;
  if (!selectedGame) {
    elements.selectedGameRecapWrap.innerHTML = `<div class="empty">Select a game to load map-level recap.</div>`;
    return;
  }

  const selectedSeriesGame = (Array.isArray(match.seriesGames) ? match.seriesGames : []).find((game) => game.selected) || null;
  const compact = isCompactUI();
  const winnerName = selectedGameWinnerName(match, selectedSeriesGame, selectedGame);
  const duration = durationLabelFromMinutes(selectedSeriesGame?.durationMinutes);
  const sideSummary = Array.isArray(selectedGame.sideSummary) ? selectedGame.sideSummary : [];
  const sideSummaryText = sideSummary.length ? sideSummary.join(" · ") : "Side assignment not available.";
  const draftPreview = inferDraftPreview(match);
  const detailIntro = (label, note = null) => `
    <div class="game-detail-intro">
      <p class="tempo-label">${escapeHtml(label)}</p>
      ${note ? `<p class="meta-text">${escapeHtml(note)}</p>` : ""}
    </div>
  `;

  if (selectedGame.state === "unstarted") {
    const estimatedStart = selectedGameEstimatedStart(match, selectedGame.number);
    const setupCards = [
      estimatedStart ? recapCard("Projected Start", compact ? dateTimeCompact(estimatedStart) : dateTimeLabel(estimatedStart)) : "",
      sideSummary.length ? recapCard("Sides", sideSummaryText, null) : "",
      selectedGame.watchUrl ? recapCard("Coverage", "Ready", "Primary broadcast is published.") : ""
    ]
      .filter(Boolean)
      .join("");

    elements.selectedGameRecapWrap.innerHTML = setupCards
      ? `
        <div class="game-detail-stack">
          ${detailIntro("Setup detail")}
          <div class="recap-grid${compact ? " compact" : ""}">${setupCards}</div>
        </div>
      `
      : "";
    return;
  }

  if (draftPreview) {
    const tips = Array.isArray(selectedGame.tips) ? selectedGame.tips : [];
    elements.selectedGameRecapWrap.innerHTML = `
      <div class="game-detail-stack">
        ${detailIntro("Draft detail", compact ? clampSummaryText(draftPreview.summary, 88) : draftPreview.summary)}
        <article class="recap-draft-state ${draftPreview.tone}">
          <div>
            <p class="tempo-label">Map Phase</p>
            <h3>${draftPreview.label}</h3>
            <p class="meta-text">${draftPreview.summary}</p>
          </div>
          <div class="recap-draft-state-meta">
            <span class="recap-draft-badge">${draftPreview.badge}</span>
            <p class="meta-text">${draftPreview.detail}</p>
          </div>
        </article>
        ${
          draftPreview.suppressDraftGrid
            ? ""
            : `<div class="recap-draft-grid">
          ${renderRecapDraftTeam(match, match.teams.left.name, draftPreview.leftRows)}
          ${renderRecapDraftTeam(match, match.teams.right.name, draftPreview.rightRows)}
        </div>`
        }
        ${recapNoteMarkup([sideSummaryText, !compact && tips.length ? tips.join(" · ") : null], { compact })}
      </div>
    `;
    return;
  }

  const snapshot = selectedGame.snapshot || {};
  const left = snapshot.left || {};
  const right = snapshot.right || {};
  const killDiff = Number(left.kills || 0) - Number(right.kills || 0);
  const towerDiff = Number(left.towers || 0) - Number(right.towers || 0);
  const baronDiff = Number(left.barons || 0) - Number(right.barons || 0);
  const inhibDiff = Number(left.inhibitors || 0) - Number(right.inhibitors || 0);
  const leftGold = Number(left.gold);
  const rightGold = Number(right.gold);
  const hasGold = Number.isFinite(leftGold) && Number.isFinite(rightGold);
  const goldDiff = hasGold ? leftGold - rightGold : null;
  const terms = objectiveTerminology(match);
  const detailCards = [];
  detailCards.push(recapCard("Kills", `${left.kills ?? 0} : ${right.kills ?? 0}`, `Diff ${signed(killDiff)}`));
  detailCards.push(recapCard("Towers", `${left.towers ?? 0} : ${right.towers ?? 0}`, `Diff ${signed(towerDiff)}`));
  if (normalizeGameKey(match?.game) !== "dota2") {
    const dragonDiff = Number(left.dragons || 0) - Number(right.dragons || 0);
    detailCards.push(recapCard(terms.dragonLabel, `${left.dragons ?? 0} : ${right.dragons ?? 0}`, `Diff ${signed(dragonDiff)}`));
  }
  detailCards.push(recapCard(terms.baronLabel, `${left.barons ?? 0} : ${right.barons ?? 0}`, `Diff ${signed(baronDiff)}`));
  detailCards.push(recapCard(terms.inhibitorLabel, `${left.inhibitors ?? 0} : ${right.inhibitors ?? 0}`, `Diff ${signed(inhibDiff)}`));
  detailCards.push(recapCard("Gold", hasGold ? `${formatNumber(leftGold)} : ${formatNumber(rightGold)}` : "n/a", hasGold ? `Diff ${signed(Math.round(goldDiff))}` : "No gold totals"));

  const topRows = Array.isArray(match.topPerformers) ? match.topPerformers.slice(0, 3) : [];
  const performerText = topRows.length
    ? topRows.map((player) => `${player.name} (${player.kills}/${player.deaths}/${player.assists})`).join(" · ")
    : "No top performer snapshot for this map.";
  const tips = Array.isArray(selectedGame.tips) ? selectedGame.tips : [];

  if (selectedGame.state === "completed") {
    const completedCards = buildCompletedGameDetailCards(match);
    const completedStory = buildCompletedGameStory(match);
    const detailSummary = [
      completedStory?.summary || null,
      duration !== "n/a" ? `${duration} map length` : null
    ]
      .filter(Boolean)
      .join(" · ");

    elements.selectedGameRecapWrap.innerHTML = `
      <div class="game-detail-stack">
        ${detailIntro("Closing detail", compact ? clampSummaryText(detailSummary || (winnerName ? `${displayTeamName(winnerName, match?.game)} won Game ${selectedGame.number}` : `Game ${selectedGame.number} final`), 80) : detailSummary || null)}
        ${
          completedCards.length
            ? `<div class="recap-grid${compact ? " compact" : ""}">${completedCards.slice(0, compact ? 4 : 6).join("")}</div>`
            : `<div class="empty">Detailed closing stats were not captured for this game.</div>`
        }
        ${
          compact
            ? ""
            : recapNoteMarkup([
                sideSummaryText,
                performerText,
                completedStory?.peakLeadLabel ? `Peak lead: ${completedStory.peakLeadLabel}${completedStory.peakLeadNote ? ` · ${completedStory.peakLeadNote}` : ""}` : null,
                completedStory?.turningPointLabel ? `Turning point: ${completedStory.turningPointLabel}${completedStory.turningPointNote ? ` · ${completedStory.turningPointNote}` : ""}` : null,
                tips.length ? tips.join(" · ") : null
              ])
        }
      </div>
    `;
    return;
  }

  elements.selectedGameRecapWrap.innerHTML = `
    <div class="game-detail-stack">
      ${detailIntro("Live map detail")}
      <div class="recap-grid${compact ? " compact" : ""}">${(compact ? detailCards.slice(0, 4) : detailCards).join("")}</div>
      ${recapNoteMarkup([sideSummaryText, !compact ? performerText : null, tips.length && !compact ? tips.join(" · ") : null], { compact })}
    </div>
  `;
}

function renderDraftDelta(match) {
  const delta = match.draftDelta;
  if (!delta || !Array.isArray(delta.rows) || !delta.rows.length) {
    elements.draftDeltaWrap.innerHTML = `<div class="empty">Draft delta appears when at least two completed drafts are available.</div>`;
    return;
  }

  const compact = isCompactUI();
  const leftName = match.teams.left.name;
  const rightName = match.teams.right.name;
  const leftShort = scoreboardTeamName(leftName, match?.game);
  const rightShort = scoreboardTeamName(rightName, match?.game);
  const changedRows = delta.rows.filter((row) => row.leftChanged || row.rightChanged);
  if (compact) {
    const roleSummary = changedRows.length
      ? changedRows
          .slice(0, 2)
          .map((row) => String(row.role || "flex").toUpperCase())
          .join(" · ")
      : "No major role swaps";
    elements.draftDeltaWrap.innerHTML = `
      <article class="draft-delta-summary compact">
        <p class="meta-text">Game ${delta.selectedGameNumber} vs Game ${delta.referenceGameNumber}</p>
        <p class="meta-text">${leftShort} ${delta.leftChanges} · ${rightShort} ${delta.rightChanges} · Total ${delta.totalChanges}</p>
      </article>
      <div class="match-desk-mini-grid compact">
        ${metricDeskCard(leftShort, String(delta.leftChanges), "Champion swaps", delta.leftChanges ? "left" : "neutral", { compact })}
        ${metricDeskCard(rightShort, String(delta.rightChanges), "Champion swaps", delta.rightChanges ? "right" : "neutral", { compact })}
        ${metricDeskCard("Biggest shift", roleSummary, changedRows.length ? `${changedRows.length} role lanes changed` : "Reference draft stayed stable", "warn", { compact })}
      </div>
    `;
    return;
  }

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

  const topRows = rows.slice(0, compact ? 4 : 16);
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
        const champions = Array.isArray(row.champions) ? row.champions.slice(0, 1).join(", ") : "n/a";

        return `
          <article class="series-trend-card compact ${row.team === "right" ? "right" : "left"}">
            <div class="series-trend-head">
              <p class="series-trend-player">${row.name}</p>
              <span class="series-trend-role">${String(row.role || "flex").toUpperCase()}</span>
            </div>
            <p class="meta-text">${teamDisplay} · ${row.mapsPlayed} maps · ${row.mapWins} wins</p>
            <div class="series-trend-metrics">
              <span>WR ${winRate}</span>
              <span>KDA ${kda}</span>
              <span>KP ${avgKp}</span>
            </div>
            <p class="meta-text">Key pick: ${champions} · GPM ${avgGpm}</p>
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

  const compact = isCompactUI();
  const topRows = rows.slice(0, compact ? 2 : 6);
  elements.performersWrap.innerHTML = `
    <div class="performer-grid">
      ${topRows
        .map((player) => {
          const teamName = teamNameBySide(match, player.team);
          const teamShort = scoreboardTeamName(teamName, match?.game);
          const role = roleMeta(player.role, normalizeGameKey(match?.game));
          const kpLabel =
            typeof player.killParticipationPct === "number" ? `${player.killParticipationPct.toFixed(1)}% KP` : "KP n/a";
          const impactLabel =
            typeof player.impactScore === "number" ? `Impact ${player.impactScore.toFixed(1)}` : "Impact n/a";
          return `
            <article class="performer-card ${escapeHtml(player.team || "neutral")}${compact ? " compact" : ""}">
              <div class="performer-card-head">
                <span class="game-player-spotlight-tag">${escapeHtml(teamShort)}</span>
                <span class="form-summary-pill">${escapeHtml(role.short)}</span>
              </div>
              <div class="performer-card-main">
                <span class="performer-card-avatar">${heroIconMarkup(match, player)}</span>
                <div class="performer-card-copy">
                  <h3>${escapeHtml(displayPlayerHandle(player.name, teamName))}</h3>
                  <p class="meta-text">${escapeHtml(compact ? player.champion || "Unknown" : `${player.champion || "Unknown"} · ${role.label}`)}</p>
                </div>
              </div>
              ${
                compact
                  ? ""
                  : `<div class="form-summary-strip">
                <span class="form-summary-pill">Gold ${formatNumber(player.goldEarned)}</span>
                <span class="form-summary-pill">${kpLabel}</span>
                <span class="form-summary-pill">${impactLabel}</span>
              </div>`
              }
              <p class="meta-text">${
                compact
                  ? `KDA ${player.kills}/${player.deaths}/${player.assists} · ${kpLabel}`
                  : `KDA ${player.kills}/${player.deaths}/${player.assists} · CS ${player.cs} · ${escapeHtml(teamName)}`
              }</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLiveTicker(rows, status, match) {
  if (!rows.length) {
    elements.liveTickerList.innerHTML =
      status === "live"
        ? '<li class="signal-log-empty">Waiting for ticker events from live frames...</li>'
        : '<li class="signal-log-empty">Live ticker appears during active games.</li>';
    return;
  }

  elements.liveTickerList.innerHTML = rows
    .map((row) =>
      renderSignalListItem({
        kind: "Ticker",
        tone: teamSideFromCandidate(match, row?.team || row?.teamName || row?.winnerTeamName || "") || "neutral",
        title: row.title || "Ticker update",
        summary: row.summary || "Live-derived update.",
        importance: row.importance || row.type || "info",
        at: row.occurredAt,
        clock: eventClockLabel(match, row.occurredAt, row.gameClockSeconds),
        teamLabel: row.teamName || row.team || row.winnerTeamName || ""
      })
    )
    .join("");
}

function importanceToneClass(importance) {
  const normalized = String(importance || "low").toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "high") {
    return "warn";
  }
  if (normalized === "medium") {
    return "live";
  }
  return "neutral";
}

function metricDeskCard(label, value, meta, tone = "neutral", options = {}) {
  const compactClass = options.compact ? " compact" : "";
  return `
    <article class="match-desk-mini-card ${tone}${compactClass}">
      <p class="match-desk-mini-label">${escapeHtml(label)}</p>
      <p class="match-desk-mini-value">${escapeHtml(value)}</p>
      <p class="match-desk-mini-meta">${escapeHtml(meta)}</p>
    </article>
  `;
}

function teamSideFromCandidate(match, candidate) {
  const normalized = normalizeLookupKey(candidate);
  if (!normalized) {
    return null;
  }
  if (normalized === "left") {
    return "left";
  }
  if (normalized === "right") {
    return "right";
  }
  return teamSideFromWinnerCandidate(match, candidate);
}

function objectiveTimelineKindLabel(row) {
  const normalized = normalizeLookupKey(row?.type || row?.label || "");
  if (!normalized) {
    return "Objective";
  }
  if (normalized.includes("baron")) return "Baron";
  if (normalized.includes("dragon")) return "Dragon";
  if (normalized.includes("grub")) return "Grubs";
  if (normalized.includes("herald")) return "Herald";
  if (normalized.includes("tower") || normalized.includes("turret")) return "Tower";
  if (normalized.includes("inhib")) return "Inhib";
  if (normalized.includes("barrack") || normalized.includes("rax")) return "Barracks";
  if (normalized.includes("roshan")) return "Roshan";
  if (normalized.includes("lotus")) return "Lotus";
  if (normalized.includes("wisdom")) return "Wisdom";
  return "Objective";
}

function objectiveTimelineTone(row, match) {
  const teamSide = teamSideFromCandidate(match, row?.team || row?.winnerTeamName || "");
  if (teamSide) {
    return teamSide;
  }
  const inferred = teamSideFromWinnerCandidate(match, row?.label || "");
  return inferred || "neutral";
}

function renderSignalListItem({ kind, tone = "neutral", title, summary, importance, at, clock, teamLabel = "" }) {
  const compact = isCompactUI();
  const importanceLabel = String(importance || "medium").toUpperCase();
  const compactTeamLabel = compact ? String(teamLabel || "").replace(/^Winner:\s*/i, "") : teamLabel;
  const meta = compact
    ? [compactTeamLabel].filter(Boolean).join(" · ")
    : [compactTeamLabel, at ? shortTimeLabel(at) : ""].filter(Boolean).join(" · ");
  return `
    <li class="signal-log-item ${tone}${compact ? " compact" : ""}">
      <div class="signal-log-top">
        <div class="signal-log-headline">
          <span class="signal-log-kind ${tone}">${escapeHtml(kind)}</span>
          <strong>${escapeHtml(compact ? clampSummaryText(title, 52) : title)}</strong>
        </div>
        <span class="signal-log-time">${escapeHtml(clock || "Time n/a")}</span>
      </div>
      <p class="meta-text">${escapeHtml(compact ? clampSummaryText(summary, 94) : summary)}</p>
      <div class="signal-log-meta">
        <span class="signal-log-pill ${importanceToneClass(importance)}">${escapeHtml(importanceLabel)}</span>
        ${meta ? `<span class="signal-log-stamp">${escapeHtml(compact ? clampSummaryText(meta, 36) : meta)}</span>` : ""}
      </div>
    </li>
  `;
}

function renderCombatBursts(rows, match) {
  if (String(match?.selectedGame?.state || "") === "inProgress") {
    const burstRows = Array.isArray(rows)
      ? rows.map((row) => ({
          kind: "Fight",
          at: row.occurredAt,
          title: row.title || "Combat burst",
          summary: row.summary || "Burst event from kill deltas.",
          importance: String(row.importance || "medium").toUpperCase(),
          teamName: row.winnerTeamName || null,
          tone: "fight"
        }))
      : [];
    const milestoneRows = Array.isArray(match?.goldMilestones)
      ? match.goldMilestones.map((row) => ({
          kind: "Gold",
          at: row.occurredAt,
          title: row.title || "Gold milestone",
          summary: row.summary || "Team crossed a major gold threshold.",
          importance: String(row.importance || "medium").toUpperCase(),
          teamName: row.teamName || null,
          tone: "gold"
        }))
      : [];
    const signalRows = [...burstRows, ...milestoneRows]
      .filter((row) => row.at && row.title)
      .sort((left, right) => Date.parse(String(right.at || "")) - Date.parse(String(left.at || "")))
      .slice(0, 6);

    if (!signalRows.length) {
      elements.combatBurstsList.innerHTML =
        match.status === "live"
          ? "<li class=\"signal-log-empty\">Signal log will populate once fights spike or economy checkpoints trigger.</li>"
          : "<li class=\"signal-log-empty\">Signal log appears during active games.</li>";
      return;
    }

    elements.combatBurstsList.innerHTML = signalRows
      .map((row) =>
        renderSignalListItem({
          kind: row.kind,
          tone: row.tone,
          title: row.title,
          summary: row.summary,
          importance: row.importance,
          at: row.at,
          clock: eventClockLabel(match, row.at),
          teamLabel: row.teamName || ""
        })
      )
      .join("");
    return;
  }

  if (!rows.length) {
    elements.combatBurstsList.innerHTML =
      match.status === "live"
        ? "<li class=\"signal-log-empty\">Waiting for combat burst windows from kill deltas...</li>"
        : "<li class=\"signal-log-empty\">Combat bursts appear when multi-kill windows are detected.</li>";
    return;
  }

  elements.combatBurstsList.innerHTML = rows
    .map((row) =>
      renderSignalListItem({
        kind: "Fight",
        tone: "fight",
        title: row.title || "Combat burst",
        summary: row.summary || "Burst event from kill deltas.",
        importance: row.importance || "medium",
        at: row.occurredAt,
        clock: eventClockLabel(match, row.occurredAt),
        teamLabel: row.winnerTeamName ? `Winner: ${row.winnerTeamName}` : ""
      })
    )
    .join("");
}

function renderGoldMilestones(rows, match) {
  if (!rows.length) {
    elements.goldMilestonesList.innerHTML =
      match.status === "live"
        ? "<li class=\"signal-log-empty\">Gold milestones appear as team economy thresholds are crossed.</li>"
        : "<li class=\"signal-log-empty\">No gold milestone telemetry for this game.</li>";
    return;
  }

  elements.goldMilestonesList.innerHTML = rows
    .map((row) =>
      renderSignalListItem({
        kind: "Gold",
        tone: "gold",
        title: row.title || "Gold milestone",
        summary: row.summary || "Team crossed a major gold threshold.",
        importance: row.importance || "medium",
        at: row.occurredAt,
        clock: eventClockLabel(match, row.occurredAt),
        teamLabel: row.teamName || ""
      })
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

  const objectiveDelta = objectiveAdvantageDelta(
    {
      left: leftSnapshot,
      right: rightSnapshot
    },
    match
  );
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
  const primaryAlert = alerts[0] || null;
  const criticalCount = alerts.filter((alert) => String(alert?.importance || "").toLowerCase() === "critical").length;
  const highCount = alerts.filter((alert) => importanceRank(alert?.importance) >= importanceRank("high")).length;
  const nextObjective = nextObjectiveWindow(match);
  const compact = isCompactUI();
  if (elements.liveAlertsDeskWrap) {
    const selectedState = String(match?.selectedGame?.state || "");
    const stateLabelText = selectedState === "inProgress" ? "Live" : stateLabel(selectedState);
    const summaryPills = compact
      ? [stateLabelText, highCount ? `${highCount} high+` : "Stable"]
      : [
          stateLabelText,
          `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`,
          highCount ? `${highCount} high+` : "No escalations"
        ];
    const deskCards = compact
      ? [
          metricDeskCard("Risk", String(highCount), criticalCount ? `${criticalCount} critical` : "Stable map state.", highCount ? "warn" : "neutral", { compact }),
          metricDeskCard(
            "Next",
            nextObjective ? objectiveEtaLabel(nextObjective) : "n/a",
            nextObjective ? displayObjectiveName(nextObjective.type, match) : "Forecast waiting",
            nextObjective?.state === "available" ? "live" : "neutral",
            { compact }
          )
        ]
      : [
          metricDeskCard("Critical", String(criticalCount), criticalCount ? "Immediate swing risk detected." : "No critical map states flagged.", criticalCount ? "critical" : "neutral"),
          metricDeskCard("High+", String(highCount), highCount ? "Pressure is building in tracked lanes and objectives." : "Map pressure remains controlled.", highCount ? "warn" : "neutral"),
          metricDeskCard(
            "Next objective",
            nextObjective ? displayObjectiveName(nextObjective.type, match) : "Forecast waiting",
            nextObjective ? (nextObjective.state === "available" ? "Available now." : `ETA ${objectiveEtaLabel(nextObjective)}.`) : "Window appears once cadence is established.",
            nextObjective?.state === "available" ? "live" : "neutral"
          )
        ];
    elements.liveAlertsDeskWrap.innerHTML = `
      <div class="game-alert-desk-shell ${importanceToneClass(primaryAlert?.importance)}${compact ? " compact" : ""}">
        <article class="game-alert-desk-hero${compact ? " compact" : ""}">
          <div class="game-alert-desk-copy">
            <p class="tempo-label">Map risk</p>
            <h3>${escapeHtml(compact ? clampSummaryText(primaryAlert?.title || "Stable state", 50) : primaryAlert?.title || "Stable state")}</h3>
            <p class="game-feed-desk-note">${escapeHtml(compact ? clampSummaryText(primaryAlert?.summary || "No major pressure alerts right now.", 72) : primaryAlert?.summary || "No major pressure alerts right now.")}</p>
          </div>
          ${compact ? "" : `<div class="form-summary-strip${compact ? " compact" : ""}">
            ${summaryPills.map((pill) => `<span class="form-summary-pill">${escapeHtml(pill)}</span>`).join("")}
          </div>`}
        </article>
        <div class="match-desk-mini-grid${compact ? " compact" : ""}">
          ${deskCards.join("")}
        </div>
      </div>
    `;
  }
  elements.liveAlertsList.innerHTML = alerts
    .slice(0, compact ? 2 : 4)
    .map(
      (alert, index) => `
      <li class="live-alert-item importance-${String(alert.importance || "low").toLowerCase()}${compact ? " compact" : ""}">
        <div class="live-alert-top">
          <div class="live-alert-headline">
            <span class="live-alert-severity ${String(alert.importance || "low").toLowerCase()}">${String(alert.importance || "low").toUpperCase()}</span>
            <strong>${escapeHtml(compact ? clampSummaryText(alert.title, 44) : alert.title)}</strong>
          </div>
          ${compact ? "" : `<span class="live-alert-index">Alert ${index + 1}</span>`}
        </div>
        <p class="meta-text">${escapeHtml(compact ? clampSummaryText(alert.summary, 92) : alert.summary)}</p>
      </li>
    `
    )
    .join("");
}

function renderObjectiveTimeline(rows, status, match) {
  const compact = isCompactUI();
  const nextObjective = nextObjectiveWindow(match);
  if (elements.objectiveTimelineDeskWrap) {
    const latest = rows[0] || null;
    const latestTone = latest ? objectiveTimelineTone(latest, match) : "neutral";
    const latestLabel = latest?.label || (status === "live" ? "Waiting for the next objective change" : "Objective desk is idle");
    const deskNote = latest
      ? `${objectiveTimelineKindLabel(latest)} captured at ${eventClockLabel(match, latest.at)}.`
      : status === "live"
        ? "Major objective swings will appear here as soon as the map state changes."
        : "Objective desk becomes active once the game begins.";
    const pills = compact
      ? [
          `${rows.length} obj`,
          nextObjective ? `Next ${objectiveEtaLabel(nextObjective)}` : latest ? objectiveTimelineKindLabel(latest) : "Waiting"
        ]
      : [
          `${rows.length} event${rows.length === 1 ? "" : "s"}`,
          latest ? objectiveTimelineKindLabel(latest) : "Waiting",
          nextObjective ? `${displayObjectiveName(nextObjective.type, match)} ${objectiveEtaLabel(nextObjective)}` : "No forecast"
        ];
    const deskCards = [
      metricDeskCard("Latest", latest ? eventClockLabel(match, latest.at) : "--:--", latest ? "Most recent swing in this map." : "No objective swings yet.", latestTone, { compact }),
      metricDeskCard(compact ? "Next" : "Next window", nextObjective ? objectiveEtaLabel(nextObjective) : "n/a", nextObjective ? displayObjectiveName(nextObjective.type, match) : "No forecast available yet.", nextObjective?.state === "available" ? "live" : "neutral", { compact }),
      metricDeskCard("State", status === "live" ? "Tracking" : "Waiting", status === "live" ? "Objective cadence is being monitored now." : "Timeline updates appear during active games.", status === "live" ? "live" : "neutral", { compact })
    ];
    elements.objectiveTimelineDeskWrap.innerHTML = `
      <div class="timeline-desk-shell ${latestTone}${compact ? " compact" : ""}">
        <article class="timeline-desk-hero${compact ? " compact" : ""}">
          <div class="timeline-desk-copy">
            <p class="tempo-label">Objective desk</p>
            <h3>${escapeHtml(compact ? clampSummaryText(latestLabel, 56) : latestLabel)}</h3>
            <p class="game-feed-desk-note">${escapeHtml(compact ? clampSummaryText(deskNote, 68) : deskNote)}</p>
          </div>
          ${compact ? "" : `<div class="form-summary-strip${compact ? " compact" : ""}">
            ${pills.map((pill) => `<span class="form-summary-pill">${escapeHtml(pill)}</span>`).join("")}
          </div>`}
        </article>
        <div class="match-desk-mini-grid${compact ? " compact" : ""}">
          ${deskCards.filter((_, index) => !compact || index < 2).join("")}
        </div>
      </div>
    `;
  }

  if (!rows.length) {
    elements.objectiveTimelineList.innerHTML =
      status === "live"
        ? "<li class=\"objective-timeline-item empty\">No objective changes in this frame window yet.</li>"
        : "<li class=\"objective-timeline-item empty\">Objective timeline appears during active games.</li>";
    return;
  }

  elements.objectiveTimelineList.innerHTML = rows
    .slice(0, compact ? 6 : rows.length)
    .map((row) => {
      const tone = objectiveTimelineTone(row, match);
      const label = row?.label || "Objective update";
      const kind = objectiveTimelineKindLabel(row);
      const sideLabel = tone === "neutral" ? "Map state" : teamShortNameForSide(match, tone);
      return `
        <li class="objective-timeline-item ${tone}">
          <div class="objective-timeline-top">
            <div class="objective-timeline-headline">
              <span class="objective-timeline-kind ${tone}">${escapeHtml(kind)}</span>
              <strong>${escapeHtml(label)}</strong>
            </div>
            <span class="objective-timeline-time">${escapeHtml(eventClockLabel(match, row.at))}</span>
          </div>
          <div class="objective-timeline-meta">
            <span class="objective-timeline-pill ${tone}">${escapeHtml(sideLabel)}</span>
            ${compact ? "" : `<span class="objective-timeline-stamp">${escapeHtml(shortTimeLabel(row.at))}</span>`}
          </div>
        </li>
      `;
    })
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
  const compact = isCompactUI();
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
    .slice(0, compact ? 2 : rows.length)
    .map(
      (row) => `
      <article class="forecast-card ${row.state === "available" ? "available" : "countdown"}${compact ? " compact" : ""}">
        <div class="forecast-top">
          <p class="forecast-title">${escapeHtml(compact ? clampSummaryText(row.label || "Objective Window", 34) : row.label || "Objective Window")}</p>
          <span class="forecast-pill ${row.state === "available" ? "available" : "countdown"}">${escapeHtml(row.state === "available" ? "Ready" : "Forecast")}</span>
        </div>
        <p class="forecast-eta">${escapeHtml(etaLabel(row.etaSeconds))}</p>
        <p class="meta-text">${
          compact
            ? `Expected ${escapeHtml(dateTimeCompact(row.nextAt))} · ${escapeHtml(String(row.confidence || "estimated").toUpperCase())}`
            : `Expected ${escapeHtml(dateTimeLabel(row.nextAt))}`
        }</p>
        ${row.note && !compact ? `<p class="meta-text">${escapeHtml(row.note)}</p>` : ""}
        ${compact ? "" : `<p class="meta-text">Confidence: ${escapeHtml(String(row.confidence || "estimated").toUpperCase())}</p>`}
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

  const compact = isCompactUI();
  if (compact) {
    const summaryRows = [...rows]
      .sort((left, right) => Math.abs(Number(right.selectedDiff || 0)) - Math.abs(Number(left.selectedDiff || 0)))
      .slice(0, 3);
    elements.roleDeltaWrap.innerHTML = `
      <div class="match-desk-mini-grid compact">
        ${summaryRows
          .map((row) =>
            metricDeskCard(
              String(row.role || "flex").toUpperCase(),
              Number.isFinite(row.selectedDiff) ? signed(Math.round(row.selectedDiff)) : "n/a",
              `${Number.isFinite(row.leadConversionPct) ? `${row.leadConversionPct.toFixed(1)}%` : "n/a"} conv · avg ${
                Number.isFinite(row.avgDiff) ? signed(Math.round(row.avgDiff)) : "n/a"
              }`,
              roleDiffClass(row.selectedDiff) === "win-left" ? "left" : roleDiffClass(row.selectedDiff) === "win-right" ? "right" : "neutral",
              { compact }
            )
          )
          .join("")}
      </div>
    `;
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
  const compact = isCompactUI();
  if (!panel || !Array.isArray(panel.players) || !panel.players.length) {
    elements.deltaWindowText.textContent =
      match.status === "live" ? "Collecting enough frames for deltas..." : "Recent deltas unavailable.";
    elements.playerDeltaWrap.innerHTML = `<div class="empty">No recent player deltas available.</div>`;
    return;
  }

  const windowSeconds = Number(panel.windowSeconds || 0);
  const windowLabel = windowSeconds < 60 ? `${windowSeconds}s` : shortDuration(windowSeconds);
  elements.deltaWindowText.textContent = compact ? `Last ${windowLabel}` : `Last ${windowLabel} · Updated ${dateTimeLabel(panel.updatedAt)}`;

  const leftPlayers = panel.players.filter((player) => player.team === "left").slice(0, compact ? 2 : panel.players.length);
  const rightPlayers = panel.players.filter((player) => player.team === "right").slice(0, compact ? 2 : panel.players.length);

  const renderTeam = (title, rows, toneClass) => `
    <section class="delta-team ${toneClass}${compact ? " compact" : ""}">
      <div class="delta-team-head">
        <div>
          <p class="tempo-label">Player deltas</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${compact ? "" : `<span class="form-summary-pill">${rows.length} tracked</span>`}
      </div>
      ${rows.length
        ? rows
            .map(
              (player) => `
                <article class="delta-player ${toneClass}${compact ? " compact" : ""}">
                  <div class="delta-player-head">
                    <span class="performer-card-avatar">${heroIconMarkup(match, player)}</span>
                    <div class="delta-player-copy">
                      <p class="delta-name">${escapeHtml(displayPlayerHandle(player.name, title))}</p>
                      <p class="delta-sub">${escapeHtml(roleMeta(player.role, normalizeGameKey(match?.game)).short)} · ${escapeHtml(player.champion || "Unknown")}</p>
                    </div>
                  </div>
                  ${
                    compact
                      ? ""
                      : `<div class="form-summary-strip">
                    <span class="form-summary-pill">Gold ${signed(player.delta.goldEarned)}</span>
                    <span class="form-summary-pill">CS ${signed(player.delta.cs)}</span>
                    <span class="form-summary-pill">Lvl ${signed(player.delta.level)}</span>
                    <span class="form-summary-pill">Items ${signed(player.delta.itemCount)}</span>
                  </div>`
                  }
                  <p class="delta-now">${
                    compact
                      ? `Gold ${signed(player.delta.goldEarned)} · CS ${signed(player.delta.cs)} · Lvl ${signed(player.delta.level)}`
                      : `Now: KDA ${kdaLabel(player.now)} · L${player.now.level} · CS ${player.now.cs} · Gold ${formatNumber(player.now.goldEarned)}`
                  }</p>
                  <p class="delta-shift">Combat Δ K ${signed(player.delta.kills)} · D ${signed(player.delta.deaths)} · A ${signed(player.delta.assists)}</p>
                </article>
              `
            )
            .join("")
        : `<div class="empty">No player deltas.</div>`}
    </section>
  `;

  elements.playerDeltaWrap.innerHTML = `
    ${renderTeam(match.teams.left.name, leftPlayers, "left")}
    ${renderTeam(match.teams.right.name, rightPlayers, "right")}
  `;
}

function renderMoments(rows, match) {
  if (!rows.length) {
    elements.momentsList.innerHTML = '<li class="signal-log-empty">No key moments yet.</li>';
    return;
  }

  elements.momentsList.innerHTML = rows
    .map((moment) =>
      renderSignalListItem({
        kind: "Moment",
        tone: teamSideFromCandidate(match, moment?.team || moment?.teamName || "") || "neutral",
        title: moment.title || "Key moment",
        summary: moment.summary || "Map-defining moment from the current game state.",
        importance: moment.importance || "medium",
        at: moment.occurredAt,
        clock: eventClockLabel(match, moment.occurredAt, moment.gameClockSeconds),
        teamLabel: moment.teamName || moment.team || ""
      })
    )
    .join("");
}

function renderSeriesMoments(rows) {
  if (!rows.length) {
    elements.seriesMomentsList.innerHTML = '<li class="series-moment-item empty">No series-wide moments yet.</li>';
    return;
  }

  elements.seriesMomentsList.innerHTML = rows
    .map(
      (moment) => `
      <li class="series-moment-item importance-${normalizedImportance(moment.importance)}">
        <div class="series-moment-head">
          <div>
            <p class="tempo-label">${moment.gameNumber ? `Game ${moment.gameNumber}` : "Series"}</p>
            <strong>${escapeHtml(moment.title || "Series moment")}</strong>
          </div>
          <span class="importance">${escapeHtml(String(moment.importance || "info").toUpperCase())}</span>
        </div>
        <p class="meta-text">${escapeHtml(moment.summary || "Series moment.")}</p>
        <p class="meta-text">${escapeHtml(dateTimeLabel(moment.occurredAt))}</p>
      </li>
    `
    )
    .join("");
}

function renderTimeline(rows) {
  if (!rows.length) {
    elements.timelineList.innerHTML = '<li class="series-timeline-item empty">No timeline events yet.</li>';
    return;
  }

  elements.timelineList.innerHTML = rows
    .map((row) => {
      const label = row.watchUrl
        ? `<a class="table-link" href="${row.watchUrl}" target="_blank" rel="noreferrer">${escapeHtml(row.label)}</a>`
        : `<span class="series-timeline-label">${escapeHtml(row.label)}</span>`;
      return `
        <li class="series-timeline-item">
          <div class="series-timeline-at">${escapeHtml(dateTimeLabel(row.at))}</div>
          <div class="series-timeline-event">${label}</div>
        </li>
      `;
    })
    .join("");
}

function applyNavigationLinks(apiBase) {
  const backUrl = applyRouteContext(new URL("./index.html", window.location.href), { apiBase });
  elements.backLink.href = backUrl.toString();
  if (elements.brandHomeLink) {
    elements.brandHomeLink.href = backUrl.toString();
  }

  const scheduleUrl = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase });
  const followsUrl = applyRouteContext(new URL("./follows.html", window.location.href), { apiBase });
  const lolHubUrl = applyRouteContext(new URL("./lol.html", window.location.href), { apiBase });
  const dotaHubUrl = applyRouteContext(new URL("./dota2.html", window.location.href), { apiBase });

  if (elements.liveDeskNav) elements.liveDeskNav.href = backUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = backUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolHubUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaHubUrl.toString();
}

async function fetchJsonWithTimeout(url, {
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
  timeoutMessage = "Request timed out.",
  errorMessage = "API request failed."
} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
      const error = new Error(payload?.error?.message || errorMessage);
      error.statusCode = response.status;
      throw error;
    }

    return payload || { data: null };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.code = "timeout";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMatchSnapshot({ matchId, requestedGameNumber, apiBase }) {
  const detailUrl = new URL(`/v1/matches/${encodeURIComponent(matchId)}`, apiBase);
  if (Number.isInteger(requestedGameNumber)) {
    detailUrl.searchParams.set("game", String(requestedGameNumber));
  }

  const payload = await fetchJsonWithTimeout(detailUrl.toString(), {
    timeoutMs: DEFAULT_API_TIMEOUT_MS,
    timeoutMessage: "Match detail request timed out.",
    errorMessage: "API request failed."
  });

  return payload.data;
}

function renderMatchPayload(match, apiBase, source = "polling") {
  if (uiState.match?.id && uiState.match.id !== match.id) {
    uiState.leadTrendScaleByContext = {};
    uiState.mapPulseByContext = {};
    uiState.storyFocusEventId = null;
    uiState.storyFocusUserSet = false;
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

  renderMatchHero(match);
  if (elements.freshnessText) {
    elements.freshnessText.textContent = "";
    elements.freshnessText.hidden = true;
  }
  applyNavigationLinks(apiBase);
  refreshMatchSeo(match);

  renderScoreboard(match);
  renderStreamStatus(match);
  renderSeriesHeader(match);
  renderSeriesOverview(match);
  renderSeriesStatsSummary(match);
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
  renderGameOverviewDesk(match);
  renderGameCommandCenter(match);
  renderTeamComparison(match);
  renderGamePlayerSummary(match);
  renderPlayerTracker(match);
  renderGameFeedDesk(match);
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
  renderSeriesGamesSummary(match, apiBase);
  renderSeriesGames(match, apiBase);
  renderSeriesComparison(match, apiBase);
  renderSeriesPlayerTrends(match);
  renderSelectedGameRecap(match);
  renderPreMatchPlanner(match);
  renderTopPerformers(match);
  renderLiveTicker(match.liveTicker || [], match.status, match);
  renderCombatBursts(match.combatBursts || [], match);
  renderGoldMilestones(match.goldMilestones || [], match);
  renderObjectiveTimeline(match.objectiveTimeline || [], match.status, match);
  renderObjectiveForecast(match);
  renderPlayerDeltaPanel(match.playerDeltaPanel, match);
  renderMoments(match.keyMoments || [], match);
  renderTimeline(match.timeline || []);
  applyGamePanelVisibility(match);
  applySeriesPanelVisibility(match);
  applyUpcomingPanelVisibility(match);
  applyMatchLayoutGroups(match);
  applyGameStateSectionTitles(match);
  applyMobileGameEnhancements(match);
  applyMobilePanelPriorities(match);
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
        setMatchHeroState({
          title: `Error loading match: ${payload.message}`,
          kicker: "Match Center",
          meta: "The live stream could not resolve this match.",
          focus: "Unavailable",
          copy: "Return to the live desk and reopen the match from the board.",
          chips: []
        });
        clearMatchShellBoard();
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
  const requestId = ++uiState.activeLoadRequestId;
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
    setMatchHeroState({
      title: "Missing match id.",
      kicker: "Match Center",
      meta: "Use /match/<match-id> or ?id=<match-id>.",
      focus: "Unavailable",
      copy: "Open a match from the live desk or schedule to load the series page.",
      chips: []
    });
    clearMatchShellBoard();
    refreshMatchSeo(null);
    renderMatchupConsole(null);
    applyMatchLayoutGroups(null);
    renderMatchQuickNav(null);
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
      if (!Number.isInteger(requestedGameNumber) || primaryError?.code === "timeout") {
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

    if (requestId !== uiState.activeLoadRequestId) {
      return;
    }

    const resolvedSelectedFromNav = Number(match?.gameNavigation?.selectedGameNumber);
    const resolvedSelectedFromPayload = Number(match?.selectedGame?.number);
    const resolvedRequestedGameNumber =
      (Number.isInteger(resolvedSelectedFromNav) && resolvedSelectedFromNav > 0 && resolvedSelectedFromNav) ||
      (Number.isInteger(resolvedSelectedFromPayload) && resolvedSelectedFromPayload > 0 && resolvedSelectedFromPayload) ||
      null;
    if (Number.isInteger(effectiveRequestedGameNumber) && !Number.isInteger(resolvedRequestedGameNumber)) {
      uiState.requestedGameFallback = effectiveRequestedGameNumber;
      effectiveRequestedGameNumber = null;
    }

    uiState.requestedGameNumber = effectiveRequestedGameNumber;
    const effectiveMatchId = String(match?.id || matchId).trim() || matchId;
    syncResolvedMatchIdentityInUrl({
      resolvedMatchId: effectiveMatchId,
      requestedGameNumber: effectiveRequestedGameNumber,
      apiBase
    });
    renderMatchPayload(match, apiBase, "polling");

    if (streamEnabled) {
      startMatchStream({
        matchId: effectiveMatchId,
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
    if (requestId !== uiState.activeLoadRequestId) {
      return;
    }
    uiState.match = null;
    uiState.stream.lastErrorAt = Date.now();
    uiState.viewMode = "series";
    uiState.activeGameNumber = null;
    resetMatchupState();
    setMatchHeroState({
      title: `Error loading match: ${error.message}`,
      kicker: "Match Center",
      meta: error?.code === "timeout" ? "The match detail request timed out." : "The match page could not be loaded.",
      focus: "Unavailable",
      copy: "Try the live desk or schedule again once the source responds.",
      chips: []
    });
    clearMatchShellBoard();
    if (elements.freshnessText) {
      elements.freshnessText.textContent = error?.code === "timeout" ? "Match detail request timed out." : "";
      elements.freshnessText.hidden = !elements.freshnessText.textContent;
    }
    refreshMatchSeo(null);
    renderMatchupConsole(null);
    applyMatchLayoutGroups(null);
    renderMatchQuickNav(null);
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
    applyMatchLayoutGroups(uiState.match);
    applyMobileGameEnhancements(uiState.match);
    applyMobilePanelPriorities(uiState.match);
    applyMatchMobilePanelCollapseState(uiState.match);
  } else {
    applyMatchLayoutGroups(null);
    renderMatchQuickNav(null);
    applyMobilePanelPriorities(null);
    applyMatchMobilePanelCollapseState(null);
  }
});

initializeMatchLayoutShell();
applyMobileSectionHeadings();
bindMatchMobilePanelControls();
bindMatchQuickNav();
bindMatchTopTabs();
applyMatchLayoutGroups(null);
applyMobilePanelPriorities(null);
applyMatchMobilePanelCollapseState(null);
loadMatch();
