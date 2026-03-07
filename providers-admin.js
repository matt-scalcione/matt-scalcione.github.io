import { resolveInitialApiBase } from "./api-config.js";
import {
  applySeo,
  buildBreadcrumbJsonLd,
  setJsonLd
} from "./seo.js";

const DEFAULT_API_BASE = resolveInitialApiBase();
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
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  providerCurrentMeta: document.querySelector("#providerCurrentMeta"),
  providerCurrentSummary: document.querySelector("#providerCurrentSummary"),
  providerDotaSources: document.querySelector("#providerDotaSources"),
  providerRawSnapshot: document.querySelector("#providerRawSnapshot")
};
const state = {
  apiBase: DEFAULT_API_BASE,
  report: null
};

function isCompactViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function readApiBase() {
  return resolveInitialApiBase();
}

function saveApiBase(value) {
  localStorage.setItem("pulseboard.apiBase", value);
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
    const saved = localStorage.getItem("pulseboard.providerAdmin.controlsCollapsed");
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
      localStorage.setItem("pulseboard.providerAdmin.controlsCollapsed", next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  });
}

function syncUrlState() {
  const url = new URL(window.location.href);
  if (state.apiBase && state.apiBase !== DEFAULT_API_BASE) {
    url.searchParams.set("api", state.apiBase);
  } else {
    url.searchParams.delete("api");
  }
  window.history.replaceState(null, "", url.toString());
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
    title: "Pulseboard Provider Admin",
    description: "Internal view for esports provider coverage, source routing, and Dota live-data readiness on Pulseboard.",
    canonicalPath: "/providers.html",
    robots: "noindex,follow"
  });

  setJsonLd(
    "breadcrumbs",
    buildBreadcrumbJsonLd([
      { name: "Pulseboard", item: "/" },
      { name: "Provider Admin", item: "/providers.html" }
    ])
  );
  setJsonLd("page", null);
}

function coveragePill(status, label = status) {
  const normalized = String(status || "unknown").toLowerCase();
  return `<span class="provider-status-pill ${normalized}">${label}</span>`;
}

function yesNoChip(value, yesLabel = "Yes", noLabel = "No") {
  return `<span class="provider-status-pill ${value ? "success" : "disabled"}">${value ? yesLabel : noLabel}</span>`;
}

function providerStat(label, value) {
  return `
    <div class="provider-mini-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderCurrentSummary(report) {
  if (!elements.providerCurrentSummary || !elements.providerCurrentMeta) {
    return;
  }

  const dota = report?.dota || {};
  const lol = report?.lol || {};
  const effective = dota.effectiveLiveCoverage || {};
  elements.providerCurrentMeta.textContent = `Generated ${new Date(report?.generatedAt || Date.now()).toLocaleString()} · mode ${report?.providerMode || "unknown"}`;
  elements.providerCurrentSummary.innerHTML = [
    {
      title: "Dota Live",
      value: String(effective.effectiveLiveRows || 0),
      meta: `${effective.syntheticPromotions || 0} synthetic`
    },
    {
      title: "STRATZ",
      value: dota?.stratz?.liveEnabled ? "Ready" : "Disabled",
      meta: `${dota?.stratz?.liveRows || 0} live rows`
    },
    {
      title: "OpenDota",
      value: String(dota?.openDota?.liveRows || 0),
      meta: `${dota?.openDota?.resultRows || 0} result rows`
    },
    {
      title: "Liquipedia",
      value: String(dota?.liquipedia?.scheduleRows || 0),
      meta: `${dota?.liquipedia?.unresolvedScheduledTeams || 0} unresolved ids`
    },
    {
      title: "LoL Live",
      value: String(lol?.liveRows || 0),
      meta: `${lol?.scheduleRows || 0} scheduled`
    }
  ]
    .map(
      (card) => `
        <article class="hub-kpi-card">
          <p class="hub-kpi-label">${card.title}</p>
          <p class="hub-kpi-value">${card.value}</p>
          <p class="hub-kpi-meta">${card.meta}</p>
        </article>
      `
    )
    .join("");
}

function renderDotaSources(report) {
  if (!elements.providerDotaSources) {
    return;
  }

  const dota = report?.dota || {};
  const cards = [
    {
      name: "STRATZ",
      tone: "primary",
      status: coveragePill(dota?.stratz?.cacheStatus || "disabled"),
      body: [
        providerStat("Token", yesNoChip(Boolean(dota?.stratz?.tokenConfigured), "Configured", "Missing")),
        providerStat("Live Query", yesNoChip(Boolean(dota?.stratz?.liveQueryConfigured), "Configured", "Missing")),
        providerStat("Detail Query", yesNoChip(Boolean(dota?.stratz?.detailQueryConfigured), "Configured", "Missing")),
        providerStat("Detail Mode", dota?.stratz?.detailContractMode || "n/a"),
        providerStat("Live Rows", String(dota?.stratz?.liveRows || 0))
      ].join("")
    },
    {
      name: "OpenDota",
      tone: "secondary",
      status: coveragePill(dota?.openDota?.cacheStatus || "unknown"),
      body: [
        providerStat("Live Rows", String(dota?.openDota?.liveRows || 0)),
        providerStat("Result Rows", String(dota?.openDota?.resultRows || 0)),
        providerStat("Result Cache", coveragePill(dota?.openDota?.resultStatus || "unknown"))
      ].join("")
    },
    {
      name: "Liquipedia",
      tone: "secondary",
      status: coveragePill(dota?.liquipedia?.cacheStatus || "unknown"),
      body: [
        providerStat("API Only", yesNoChip(Boolean(dota?.liquipedia?.apiOnly), "Enabled", "Off")),
        providerStat("Schedule Rows", String(dota?.liquipedia?.scheduleRows || 0)),
        providerStat("Unresolved Teams", String(dota?.liquipedia?.unresolvedScheduledTeams || 0))
      ].join("")
    },
    {
      name: "Effective Dota Live",
      tone: "summary",
      status: coveragePill("success", "Active"),
      body: [
        providerStat("Merged Live", String(dota?.effectiveLiveCoverage?.mergedLiveRows || 0)),
        providerStat("Synthetic", String(dota?.effectiveLiveCoverage?.syntheticPromotions || 0)),
        providerStat("Effective Total", String(dota?.effectiveLiveCoverage?.effectiveLiveRows || 0))
      ].join("")
    }
  ];

  elements.providerDotaSources.innerHTML = cards
    .map(
      (card) => `
        <article class="provider-source-card ${card.tone}">
          <div class="provider-source-head">
            <h3>${card.name}</h3>
            ${card.status}
          </div>
          <div class="provider-source-body">
            ${card.body}
          </div>
        </article>
      `
    )
    .join("");
}

function renderRawSnapshot(report) {
  if (!elements.providerRawSnapshot) {
    return;
  }

  elements.providerRawSnapshot.textContent = JSON.stringify(report, null, 2);
}

async function fetchCoverage(apiBase) {
  const response = await fetch(`${apiBase}/v1/provider-coverage`);
  if (!response.ok) {
    throw new Error(`Coverage request failed ${response.status}`);
  }

  const payload = await response.json();
  return payload?.data || null;
}

async function refreshCoverage() {
  setStatus("Loading provider coverage...", "loading");

  try {
    const report = await fetchCoverage(state.apiBase);
    state.report = report;
    renderCurrentSummary(report);
    renderDotaSources(report);
    renderRawSnapshot(report);
    setStatus("Provider coverage loaded.", "success");
  } catch (error) {
    if (elements.providerCurrentMeta) {
      elements.providerCurrentMeta.textContent = "Unable to load provider coverage.";
    }
    if (elements.providerCurrentSummary) {
      elements.providerCurrentSummary.innerHTML = "";
    }
    if (elements.providerDotaSources) {
      elements.providerDotaSources.innerHTML = "";
    }
    if (elements.providerRawSnapshot) {
      elements.providerRawSnapshot.textContent = String(error?.message || error || "Unknown error");
    }
    setStatus("Unable to load provider coverage.", "error");
  }
}

function bindEvents() {
  if (elements.apiBaseInput) {
    elements.apiBaseInput.value = state.apiBase;
    elements.apiBaseInput.addEventListener("change", (event) => {
      const next = String(event.target.value || "").trim();
      state.apiBase = next || DEFAULT_API_BASE;
      syncUrlState();
      updateNav(state.apiBase);
    });
  }

  elements.refreshButton?.addEventListener("click", () => {
    if (elements.apiBaseInput) {
      state.apiBase = String(elements.apiBaseInput.value || "").trim() || DEFAULT_API_BASE;
    }
    syncUrlState();
    updateNav(state.apiBase);
    refreshCoverage();
  });

  elements.saveButton?.addEventListener("click", () => {
    if (elements.apiBaseInput) {
      state.apiBase = String(elements.apiBaseInput.value || "").trim() || DEFAULT_API_BASE;
      elements.apiBaseInput.value = state.apiBase;
    }
    saveApiBase(state.apiBase);
    syncUrlState();
    updateNav(state.apiBase);
    setStatus("API base saved.", "success");
  });
}

function init() {
  state.apiBase = readApiBase();
  updateNav(state.apiBase);
  refreshSeo();
  setupControlsPanel();
  bindEvents();
  refreshCoverage();
}

init();
