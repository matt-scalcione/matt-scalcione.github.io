import { resolveInitialApiBase } from "./api-config.js";
import { applyRouteContext, buildMatchUrl, buildTeamUrl } from "./routes.js?v=20260309c";
import { applySeo, inferRobotsDirective, setJsonLd } from "./seo.js";
import { productEmptyMarkup } from "./loading.js";
import {
  clearRecentWatchlistAction,
  fetchWatchlistRows,
  readRecentWatchlistAction,
  removeWatchlistFollow,
  resolveWatchlistUserId
} from "./watchlist-client.js?v=20260314e";

const DEFAULT_API_BASE = resolveInitialApiBase();
const DEFAULT_API_TIMEOUT_MS = 8000;
const MOBILE_BREAKPOINT = 760;
const STATE_PRIORITY = {
  live: 0,
  upcoming: 1,
  recent: 2,
  idle: 3
};
const FOLLOWS_JUMP_TARGETS = [
  { id: "watchlistLivePanel", label: "Live" },
  { id: "watchlistUpcomingPanel", label: "Next" },
  { id: "watchlistRecentPanel", label: "Recent" },
  { id: "watchlistWorkspacePanel", label: "Watchlist" },
  { id: "prefsPanel", label: "Rules" }
];

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
  refreshButton: document.querySelector("#refreshButton"),
  saveApiButton: document.querySelector("#saveApiButton"),
  statusText: document.querySelector("#statusText"),
  heroContextLabel: document.querySelector("#heroContextLabel"),
  heroContextValue: document.querySelector("#heroContextValue"),
  heroContextCopy: document.querySelector("#heroContextCopy"),
  heroContextChips: document.querySelector("#heroContextChips"),
  heroActionRow: document.querySelector("#heroActionRow"),
  quickJump: document.querySelector("#followsQuickJump"),
  watchlistRecentActionBanner: document.querySelector("#watchlistRecentActionBanner"),
  followsSummaryWrap: document.querySelector("#followsSummaryWrap"),
  watchlistLivePanel: document.querySelector("#watchlistLivePanel"),
  watchlistLiveMeta: document.querySelector("#watchlistLiveMeta"),
  watchlistLiveList: document.querySelector("#watchlistLiveList"),
  watchlistUpcomingPanel: document.querySelector("#watchlistUpcomingPanel"),
  watchlistUpcomingMeta: document.querySelector("#watchlistUpcomingMeta"),
  watchlistUpcomingList: document.querySelector("#watchlistUpcomingList"),
  watchlistRecentPanel: document.querySelector("#watchlistRecentPanel"),
  watchlistRecentMeta: document.querySelector("#watchlistRecentMeta"),
  watchlistRecentList: document.querySelector("#watchlistRecentList"),
  followsMeta: document.querySelector("#followsMeta"),
  followsList: document.querySelector("#followsList"),
  prefsPanel: document.querySelector("#prefsPanel"),
  alertsPanel: document.querySelector("#alertsPanel"),
  alertsMeta: document.querySelector("#alertsMeta"),
  alertsPreviewWrap: document.querySelector("#alertsPreviewWrap"),
  outboxPanel: document.querySelector("#outboxPanel"),
  alertOutboxMeta: document.querySelector("#alertOutboxMeta"),
  alertOutboxWrap: document.querySelector("#alertOutboxWrap"),
  webPushInput: document.querySelector("#webPushInput"),
  emailDigestInput: document.querySelector("#emailDigestInput"),
  swingAlertsInput: document.querySelector("#swingAlertsInput"),
  matchStartInput: document.querySelector("#matchStartInput"),
  matchFinalInput: document.querySelector("#matchFinalInput"),
  savePrefsButton: document.querySelector("#savePrefsButton")
};

const followsState = {
  rows: [],
  preferences: null,
  alertPreview: null,
  alertOutbox: null,
  activeLoadRequestId: 0
};

function refreshFollowsSeo() {
  const inferred = inferRobotsDirective({ allowedQueryParams: [] });
  applySeo({
    title: "Watchlist | Pulseboard",
    description: "Track watched teams, see who is live or next, and manage alert rules on Pulseboard.",
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isCompactViewport() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
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

function getContext() {
  return {
    apiBase: elements.apiBaseInput.value.trim() || DEFAULT_API_BASE,
    userId: resolveWatchlistUserId({
      sourceUrl: window.location.href
    })
  };
}

function scrollToFollowsTarget(targetId) {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const topOffset = isCompactViewport() ? 124 : 88;
  const top = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - topOffset));
  window.scrollTo({ top, behavior: "smooth" });
}

function setFollowsQuickJumpActive(targetId) {
  if (!elements.quickJump) {
    return;
  }

  const activeTarget = String(targetId || "");
  for (const button of elements.quickJump.querySelectorAll("[data-jump-target]")) {
    const matches = button.getAttribute("data-jump-target") === activeTarget;
    button.classList.toggle("active", matches);
    if (matches) {
      button.setAttribute("aria-pressed", "true");
    } else {
      button.removeAttribute("aria-pressed");
    }
  }
}

function renderFollowsQuickJump() {
  if (!elements.quickJump) {
    return;
  }

  if (!isCompactViewport()) {
    elements.quickJump.hidden = true;
    elements.quickJump.innerHTML = "";
    return;
  }

  const visibleTargets = FOLLOWS_JUMP_TARGETS.filter((item) => {
    const target = document.getElementById(item.id);
    return Boolean(target && !target.hidden && !target.classList.contains("hidden-panel"));
  });

  if (!visibleTargets.length) {
    elements.quickJump.hidden = true;
    elements.quickJump.innerHTML = "";
    return;
  }

  elements.quickJump.hidden = false;
  elements.quickJump.innerHTML = visibleTargets
    .map(
      (item) =>
        `<button type="button" class="team-jump-chip" data-jump-target="${item.id}">${item.label}</button>`
    )
    .join("");
  setFollowsQuickJumpActive(visibleTargets[0]?.id || "");
}

function bindFollowsQuickJump() {
  if (!elements.quickJump || elements.quickJump.dataset.bound === "1") {
    return;
  }

  elements.quickJump.dataset.bound = "1";
  elements.quickJump.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("[data-jump-target]");
    if (!button) {
      return;
    }
    const jumpTarget = button.getAttribute("data-jump-target") || "";
    if (!jumpTarget) {
      return;
    }
    setFollowsQuickJumpActive(jumpTarget);
    scrollToFollowsTarget(jumpTarget);
  });
}

function applyControlsCollapsed(collapsed) {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  elements.controlsPanel.classList.toggle("collapsed", collapsed);
  elements.controlsToggle.textContent = collapsed ? "Show Tools" : "Hide Tools";
  elements.controlsToggle.setAttribute("aria-expanded", String(!collapsed));
}

function setupControlsPanel() {
  if (!elements.controlsPanel || !elements.controlsToggle) {
    return;
  }

  applyControlsCollapsed(true);
  elements.controlsToggle.addEventListener("click", () => {
    applyControlsCollapsed(!elements.controlsPanel.classList.contains("collapsed"));
  });
}

function updateNav() {
  const { apiBase } = getContext();
  const liveUrl = applyRouteContext(new URL("./index.html", window.location.href), { apiBase });
  const scheduleUrl = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase });
  const followsUrl = applyRouteContext(new URL("./follows.html", window.location.href), { apiBase });
  const lolHubUrl = applyRouteContext(new URL("./lol.html", window.location.href), { apiBase });
  const dotaHubUrl = applyRouteContext(new URL("./dota2.html", window.location.href), { apiBase });

  if (elements.liveDeskNav) elements.liveDeskNav.href = liveUrl.toString();
  if (elements.mobileLiveNav) elements.mobileLiveNav.href = liveUrl.toString();
  if (elements.scheduleNav) elements.scheduleNav.href = scheduleUrl.toString();
  if (elements.mobileScheduleNav) elements.mobileScheduleNav.href = scheduleUrl.toString();
  if (elements.followsNav) elements.followsNav.href = followsUrl.toString();
  if (elements.mobileFollowsNav) elements.mobileFollowsNav.href = followsUrl.toString();
  if (elements.lolHubNav) elements.lolHubNav.href = lolHubUrl.toString();
  if (elements.dotaHubNav) elements.dotaHubNav.href = dotaHubUrl.toString();
}

function alertTypeLabel(type) {
  if (type === "start") return "Start";
  if (type === "swing") return "Swing";
  if (type === "final") return "Final";
  return "Alert";
}

function alertToneClass(tone) {
  if (tone === "live") return "live";
  if (tone === "complete") return "complete";
  if (tone === "warning") return "upcoming";
  return "neutral";
}

function deliveryStatusPill(status) {
  if (status === "delivered") return "live";
  if (status === "acknowledged") return "complete";
  if (status === "failed") return "upcoming";
  return "neutral";
}

function followEntityTypeLabel(type) {
  if (type === "team") return "Team";
  if (type === "player") return "Player";
  if (type === "tournament") return "Tournament";
  return "Entity";
}

function followGameLabel(game) {
  if (game === "lol") return "LoL";
  if (game === "dota2") return "Dota 2";
  return "";
}

function followSignalTone(state) {
  if (state === "live") return "live";
  if (state === "upcoming") return "upcoming";
  if (state === "recent") return "complete";
  return "neutral";
}

function signalPriority(row) {
  return STATE_PRIORITY[String(row?.signalState || "idle").toLowerCase()] ?? 9;
}

function parseSignalTime(row) {
  const raw = row?.signalAt || row?.updatedAt || row?.createdAt || "";
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortFollows(rows = []) {
  return rows.slice().sort((left, right) => {
    const priorityDiff = signalPriority(left) - signalPriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftTime = parseSignalTime(left);
    const rightTime = parseSignalTime(right);
    const leftLiveLike = String(left?.signalState || "") === "live";
    const rightLiveLike = String(right?.signalState || "") === "live";
    if (leftLiveLike || rightLiveLike) {
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
    } else if (rightTime !== leftTime) {
      return leftTime - rightTime;
    }

    return String(left?.displayName || left?.entityId || "").localeCompare(
      String(right?.displayName || right?.entityId || "")
    );
  });
}

function formatSignalTime(value) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildFollowContextLine(row) {
  const parts = [];
  if (row?.signalOpponentName) {
    parts.push(`vs ${row.signalOpponentName}`);
  }
  if (row?.signalTournament) {
    parts.push(row.signalTournament);
  }
  if (!parts.length && row?.signalDetail) {
    parts.push(row.signalDetail);
  }
  return parts.filter(Boolean).join(" · ");
}

function buildFollowMetaLine(row) {
  const parts = [];
  const timeLabel = formatSignalTime(row?.signalAt);
  if (timeLabel) {
    parts.push(timeLabel);
  }
  if (row?.signalProvider) {
    parts.push(row.signalProvider);
  }
  return parts.filter(Boolean).join(" · ");
}

function followPrimaryHref(row) {
  return buildMatchUrl({
    matchId: row.liveMatchId || row.nextMatchId || row.recentMatchId || null
  });
}

function followPrimaryLabel(row) {
  if (row.liveMatchId) return "Open live";
  if (row.nextMatchId) return "Open next";
  if (row.recentMatchId) return "Open recent";
  return "Open team";
}

function followTeamHref(row) {
  if (row.entityType !== "team") {
    return "";
  }

  return buildTeamUrl({
    teamId: row.entityId,
    game: row.game,
    matchId: row.liveMatchId || row.nextMatchId || row.recentMatchId || null,
    teamName: row.displayName || row.entityId
  });
}

function matchRecentActionRow(rows, recentAction) {
  if (!recentAction || !Array.isArray(rows) || !rows.length) {
    return null;
  }

  const canonicalId = String(recentAction.canonicalEntityId || "").trim().toLowerCase();
  const entityId = String(recentAction.entityId || "").trim();
  return rows.find((row) => {
    if (canonicalId && String(row?.canonicalEntityId || "").trim().toLowerCase() === canonicalId) {
      return true;
    }
    return entityId && String(row?.entityId || "").trim() === entityId;
  }) || null;
}

function renderRecentActionBanner(rows = []) {
  if (!elements.watchlistRecentActionBanner) {
    return;
  }

  const recentAction = readRecentWatchlistAction();
  const actionType = String(recentAction?.action || "").trim().toLowerCase();
  if (actionType !== "added") {
    elements.watchlistRecentActionBanner.hidden = true;
    elements.watchlistRecentActionBanner.innerHTML = "";
    return;
  }

  const resolvedRow = matchRecentActionRow(rows, recentAction) || recentAction;
  const title = escapeHtml(
    String(
      resolvedRow?.displayName ||
      recentAction?.displayName ||
      resolvedRow?.entityId ||
      recentAction?.entityId ||
      "Team"
    ).trim() || "Team"
  );
  const contextLine = escapeHtml(buildFollowContextLine(resolvedRow) || "Saved to your watchlist.");
  const metaLine = escapeHtml(buildFollowMetaLine(resolvedRow));
  const signalTone = followSignalTone(resolvedRow?.signalState);
  const recentActionRow = {
    entityType: resolvedRow?.entityType || recentAction?.entityType || "team",
    entityId: resolvedRow?.entityId || recentAction?.entityId || "",
    game: resolvedRow?.game || recentAction?.game || "",
    displayName: resolvedRow?.displayName || recentAction?.displayName || "",
    liveMatchId: resolvedRow?.liveMatchId || recentAction?.liveMatchId || null,
    nextMatchId: resolvedRow?.nextMatchId || recentAction?.nextMatchId || null,
    recentMatchId: resolvedRow?.recentMatchId || recentAction?.recentMatchId || null
  };
  const primaryHref =
    recentActionRow.liveMatchId || recentActionRow.nextMatchId || recentActionRow.recentMatchId
      ? followPrimaryHref(recentActionRow)
      : "";
  const teamHref = recentActionRow.entityId ? followTeamHref(recentActionRow) : "";

  elements.watchlistRecentActionBanner.hidden = false;
  elements.watchlistRecentActionBanner.innerHTML = `
    <article class="overview-featured static watchlist-recent-banner">
      <div class="overview-featured-top">
        <span class="pill ${signalTone}">Just added</span>
        <span class="overview-featured-meta">Saved on this device</span>
      </div>
      <p class="overview-featured-match">${title} is now on your watchlist.</p>
      <p class="overview-note">${contextLine}${metaLine ? ` ${metaLine}` : ""}</p>
      <div class="follow-actions">
        ${primaryHref ? `<a class="link-btn" href="${primaryHref}">${followPrimaryLabel(recentActionRow)}</a>` : ""}
        ${teamHref ? `<a class="link-btn ghost" href="${teamHref}">Open team</a>` : ""}
        <button type="button" class="ghost" data-dismiss-watch-action="true">Dismiss</button>
      </div>
    </article>
  `;
}

function syncWatchlistPanels() {
  const hasRows = Array.isArray(followsState.rows) && followsState.rows.length > 0;
  if (elements.prefsPanel) {
    elements.prefsPanel.hidden = !hasRows;
  }
  if (!hasRows) {
    if (elements.alertsPanel) {
      elements.alertsPanel.hidden = true;
    }
    if (elements.outboxPanel) {
      elements.outboxPanel.hidden = true;
    }
  }
}

function renderFollowCard(row, { compact = false } = {}) {
  const title = escapeHtml(row.displayName || row.entityId);
  const contextLine = escapeHtml(buildFollowContextLine(row) || "Waiting for the next series.");
  const metaLine = escapeHtml(buildFollowMetaLine(row));
  const gameLabel = followGameLabel(row.game);
  const primaryHref = row.liveMatchId || row.nextMatchId || row.recentMatchId ? followPrimaryHref(row) : followTeamHref(row);
  const teamHref = followTeamHref(row);
  const primaryLabel = followPrimaryLabel(row);

  return `
    <article class="follow-item${compact ? " compact" : ""}">
      <div class="follow-item-head">
        <div class="follow-item-main">
          <div class="follow-alert-top">
            <span class="follow-entity-chip">${followEntityTypeLabel(row.entityType)}</span>
            ${gameLabel ? `<span class="pill neutral">${escapeHtml(gameLabel)}</span>` : ""}
            <span class="pill ${followSignalTone(row.signalState)}">${escapeHtml(row.signalLabel || "Watching")}</span>
          </div>
          <p class="follow-title"><strong>${title}</strong></p>
          <p class="meta-text watchlist-card-line">${contextLine}</p>
          ${metaLine ? `<p class="meta-text watchlist-card-meta">${metaLine}</p>` : ""}
        </div>
      </div>
      <div class="follow-actions">
        ${primaryHref ? `<a class="link-btn" href="${primaryHref}">${primaryLabel}</a>` : ""}
        ${teamHref && primaryHref !== teamHref ? `<a class="link-btn ghost" href="${teamHref}">Team</a>` : ""}
        <button type="button" class="danger-btn" data-follow-id="${escapeHtml(row.id)}">Remove</button>
      </div>
    </article>
  `;
}

function inventoryStateLabel(row) {
  if (row?.signalState === "live") {
    return "Live now";
  }
  if (row?.signalState === "upcoming") {
    return "Up next";
  }
  if (row?.signalState === "recent") {
    return "Recent final";
  }
  return "Watching";
}

function renderWatchlistInventoryCard(row) {
  const title = escapeHtml(row.displayName || row.entityId);
  const gameLabel = followGameLabel(row.game);
  const signalTone = followSignalTone(row.signalState);
  const stateLabel = escapeHtml(inventoryStateLabel(row));
  const primaryHref = row.liveMatchId || row.nextMatchId || row.recentMatchId ? followPrimaryHref(row) : "";
  const teamHref = followTeamHref(row);
  const summaryLine = escapeHtml(buildFollowContextLine(row) || "Waiting for the next series.");

  return `
    <article class="follow-item watchlist-manage-item">
      <div class="follow-item-head">
        <div class="follow-item-main">
          <div class="follow-alert-top">
            <span class="follow-entity-chip">${followEntityTypeLabel(row.entityType)}</span>
            ${gameLabel ? `<span class="pill neutral">${escapeHtml(gameLabel)}</span>` : ""}
            <span class="pill ${signalTone}">${stateLabel}</span>
          </div>
          <p class="follow-title"><strong>${title}</strong></p>
          <p class="meta-text watchlist-card-line">${summaryLine}</p>
        </div>
      </div>
      <div class="follow-actions">
        ${primaryHref ? `<a class="link-btn" href="${primaryHref}">${followPrimaryLabel(row)}</a>` : ""}
        ${teamHref ? `<a class="link-btn ghost" href="${teamHref}">Open team</a>` : ""}
        <button type="button" class="danger-btn" data-follow-id="${escapeHtml(row.id)}">Remove</button>
      </div>
    </article>
  `;
}

function enabledRuleCount(preferences) {
  if (!preferences) {
    return 0;
  }

  return ["webPush", "emailDigest", "swingAlerts", "matchStart", "matchFinal"].filter((key) =>
    Boolean(preferences?.[key])
  ).length;
}

function renderSummaryHero() {
  if (!elements.followsSummaryWrap) {
    return;
  }

  const rows = followsState.rows || [];
  const liveRows = rows.filter((row) => row.signalState === "live");
  const upcomingRows = rows.filter((row) => row.signalState === "upcoming");
  const recentRows = rows.filter((row) => row.signalState === "recent");
  const activeRules = enabledRuleCount(followsState.preferences);
  const previewCount = Number(followsState.alertPreview?.summary?.totalAlerts || 0);

  if (elements.heroContextLabel) {
    elements.heroContextLabel.textContent = "Watchlist";
  }
  if (elements.heroContextValue) {
    elements.heroContextValue.textContent = "Saved on this device";
  }
  if (elements.heroContextCopy) {
    elements.heroContextCopy.textContent = rows.length
      ? `Pulseboard is tracking ${rows.length} watched ${rows.length === 1 ? "team" : "teams"} in this browser. ${liveRows.length} live now and ${upcomingRows.length} up next.`
      : "Save teams from match and team pages. Pulseboard will keep them in this browser and surface their next important state here.";
  }
  if (elements.heroContextChips) {
    elements.heroContextChips.innerHTML = `
      <span class="hero-chip">${rows.length} watching</span>
      <span class="hero-chip">${liveRows.length} live</span>
      <span class="hero-chip">${upcomingRows.length} next</span>
    `;
  }
  if (elements.heroActionRow) {
    const { apiBase } = getContext();
    const liveDeskHref = applyRouteContext(new URL("./index.html", window.location.href), { apiBase }).toString();
    const scheduleHref = applyRouteContext(new URL("./schedule.html", window.location.href), { apiBase }).toString();
    elements.heroActionRow.innerHTML = `
      <a class="link-btn" href="${liveDeskHref}">Open live desk</a>
      <a class="link-btn ghost" href="${scheduleHref}">Open schedule</a>
    `;
  }

  elements.followsSummaryWrap.innerHTML = `
    <article class="overview-card">
      <p class="overview-label">Watching</p>
      <p class="overview-value">${rows.length}</p>
      <p class="overview-note">Teams saved from across Pulseboard.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Live now</p>
      <p class="overview-value">${liveRows.length}</p>
      <p class="overview-note">Watched teams currently in a live series.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">Up next</p>
      <p class="overview-value">${upcomingRows.length}</p>
      <p class="overview-note">Watched teams with a scheduled next series.</p>
    </article>
    <article class="overview-card">
      <p class="overview-label">${rows.length ? "Rules on" : "Alerts"}</p>
      <p class="overview-value">${rows.length ? activeRules : "Ready"}</p>
      <p class="overview-note">${
        rows.length
          ? "Enabled alert categories for this watchlist."
          : "Rules stay local and wake up once you save your first team."
      }</p>
    </article>
    <article class="overview-featured static watchlist-overview-featured">
      <div class="overview-featured-top">
        <span class="pill live">How it works</span>
        <span class="overview-featured-meta">Saved on this device</span>
      </div>
      <p class="overview-featured-match">${
        rows.length
          ? "Use the state sections below to jump directly to watched teams that are live, next, or recently finished."
          : "Start on a match or team page, tap Watch, and the team will appear here immediately."
      }</p>
      <div class="overview-inline-row">
        <span class="mini-chip">${recentRows.length} recent</span>
        <span class="mini-chip">${previewCount} alerts now</span>
        <span class="mini-chip">${activeRules} rules enabled</span>
      </div>
      <p class="overview-note">No login is required. Pulseboard keeps one local watchlist in this browser and uses it throughout the site.</p>
    </article>
  `;
}

function renderLoadingFollows() {
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

function renderStatePanel(panel, meta, list, rows, emptyCopy) {
  if (!panel || !meta || !list) {
    return;
  }

  const sortedRows = sortFollows(rows);
  panel.hidden = sortedRows.length === 0;
  if (!sortedRows.length) {
    list.innerHTML = "";
    meta.textContent = emptyCopy;
    return;
  }

  meta.textContent = `${sortedRows.length} watched ${sortedRows.length === 1 ? "team" : "teams"}`;
  list.innerHTML = sortedRows.map((row) => renderFollowCard(row, { compact: true })).join("");
}

function renderFollows(rows) {
  followsState.rows = rows;
  renderSummaryHero();
  syncWatchlistPanels();

  const sortedRows = sortFollows(rows);
  renderRecentActionBanner(sortedRows);
  const liveRows = sortedRows.filter((row) => row.signalState === "live");
  const upcomingRows = sortedRows.filter((row) => row.signalState === "upcoming");
  const recentRows = sortedRows.filter((row) => row.signalState === "recent");

  renderAlertPreview(followsState.alertPreview);
  renderAlertOutbox(followsState.alertOutbox);

  renderStatePanel(
    elements.watchlistLivePanel,
    elements.watchlistLiveMeta,
    elements.watchlistLiveList,
    liveRows,
    "No watched teams are live right now."
  );
  renderStatePanel(
    elements.watchlistUpcomingPanel,
    elements.watchlistUpcomingMeta,
    elements.watchlistUpcomingList,
    upcomingRows,
    "No watched teams are scheduled next."
  );
  renderStatePanel(
    elements.watchlistRecentPanel,
    elements.watchlistRecentMeta,
    elements.watchlistRecentList,
    recentRows,
    "No recent watched finals yet."
  );

  if (!sortedRows.length) {
    elements.followsList.innerHTML = productEmptyMarkup({
      eyebrow: "Your watchlist",
      title: "No watched teams yet",
      body: "Save a team from any match page or team page and it will appear here with live, next, and recent context.",
      tips: ["Open a live match", "Tap Watch Team", "Come back here to manage the list"],
      compact: true
    });
    elements.followsMeta.textContent = "Nothing saved yet.";
    renderFollowsQuickJump();
    return;
  }

  const teamCount = sortedRows.filter((row) => row.entityType === "team").length;
  const inventoryRows = sortedRows
    .slice()
    .sort((left, right) =>
      String(left?.displayName || left?.entityId || "").localeCompare(String(right?.displayName || right?.entityId || ""))
    );
  elements.followsList.innerHTML = inventoryRows.map((row) => renderWatchlistInventoryCard(row)).join("");
  elements.followsMeta.textContent = `${teamCount} saved ${teamCount === 1 ? "team" : "teams"} · open or remove them here`;
  renderFollowsQuickJump();
}

function renderPreferences(pref) {
  followsState.preferences = pref;
  renderSummaryHero();
  syncWatchlistPanels();
  elements.webPushInput.checked = Boolean(pref.webPush);
  elements.emailDigestInput.checked = Boolean(pref.emailDigest);
  elements.swingAlertsInput.checked = Boolean(pref.swingAlerts);
  elements.matchStartInput.checked = Boolean(pref.matchStart);
  elements.matchFinalInput.checked = Boolean(pref.matchFinal);
}

function renderAlertPreview(payload) {
  followsState.alertPreview = payload || null;
  renderSummaryHero();

  if (!elements.alertsPanel || !elements.alertsMeta || !elements.alertsPreviewWrap) {
    return;
  }

  if (!followsState.rows.length) {
    elements.alertsPanel.hidden = true;
    elements.alertsPreviewWrap.innerHTML = "";
    elements.alertsMeta.textContent = "No current alert candidates.";
    return;
  }

  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const summary = payload?.summary || {};
  elements.alertsPanel.hidden = alerts.length === 0;
  if (!alerts.length) {
    elements.alertsPreviewWrap.innerHTML = "";
    elements.alertsMeta.textContent = "No current alert candidates.";
    return;
  }

  const byType = Object.entries(summary.byType || {})
    .map(([type, count]) => `${alertTypeLabel(type)} ${count}`)
    .join(" · ");
  elements.alertsMeta.textContent = `${alerts.length} alert candidate${alerts.length === 1 ? "" : "s"}${byType ? ` · ${byType}` : ""}`;
  elements.alertsPreviewWrap.innerHTML = alerts
    .map(
      (alert) => `
        <article class="follow-item follow-alert-item">
          <div class="follow-item-main">
            <div class="follow-alert-top">
              <span class="pill ${alertToneClass(alert.tone)}">${alertTypeLabel(alert.type)}</span>
              <span class="meta-text">${escapeHtml(formatSignalTime(alert.occurredAt))}</span>
            </div>
            <p class="follow-title"><strong>${escapeHtml(alert.title)}</strong></p>
            <p class="meta-text watchlist-card-line">${escapeHtml(alert.detail)}</p>
          </div>
          <div class="follow-actions">
            <a class="link-btn" href="${buildMatchUrl({ matchId: alert.matchId })}">Open</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAlertOutbox(payload) {
  followsState.alertOutbox = payload || null;
  renderSummaryHero();

  if (!elements.outboxPanel || !elements.alertOutboxMeta || !elements.alertOutboxWrap) {
    return;
  }

  if (!followsState.rows.length) {
    elements.outboxPanel.hidden = true;
    elements.alertOutboxWrap.innerHTML = "";
    elements.alertOutboxMeta.textContent = "No recent notifications.";
    return;
  }

  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const summary = payload?.summary || {};
  elements.outboxPanel.hidden = alerts.length === 0;
  if (!alerts.length) {
    elements.alertOutboxWrap.innerHTML = "";
    elements.alertOutboxMeta.textContent = "No recent notifications.";
    return;
  }

  elements.alertOutboxMeta.textContent = `${summary.total || alerts.length} recent notification${alerts.length === 1 ? "" : "s"} · ${summary.pending || 0} pending`;
  elements.alertOutboxWrap.innerHTML = alerts
    .map(
      (alert) => `
        <article class="follow-item follow-alert-item">
          <div class="follow-item-main">
            <div class="follow-alert-top">
              <span class="pill ${alertToneClass(alert.tone)}">${alertTypeLabel(alert.type)}</span>
              <span class="pill ${deliveryStatusPill(alert.deliveryStatus)}">${escapeHtml(alert.deliveryStatus || "pending")}</span>
              <span class="meta-text">${escapeHtml(formatSignalTime(alert.lastSeenAt || alert.occurredAt))}</span>
            </div>
            <p class="follow-title"><strong>${escapeHtml(alert.title)}</strong></p>
            <p class="meta-text watchlist-card-line">${escapeHtml(alert.detail)}</p>
          </div>
          <div class="follow-actions">
            ${
              alert.deliveryStatus === "acknowledged"
                ? `<span class="meta-text">Acked</span>`
                : `<button type="button" class="ghost" data-alert-id="${escapeHtml(alert.id)}">Acknowledge</button>`
            }
          </div>
        </article>
      `
    )
    .join("");
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Watchlist request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFollows() {
  const { apiBase, userId } = getContext();
  renderLoadingFollows();
  const rows = await fetchWatchlistRows(apiBase, { userId });
  renderFollows(rows);
}

async function loadPreferences() {
  const { apiBase, userId } = getContext();
  const payload = await requestJson(
    `${apiBase}/v1/notification-preferences?user_id=${encodeURIComponent(userId)}`
  );
  renderPreferences(payload.data);
}

async function loadAlertPreview() {
  const { apiBase, userId } = getContext();
  try {
    const payload = await requestJson(
      `${apiBase}/v1/alerts-preview?user_id=${encodeURIComponent(userId)}`
    );
    renderAlertPreview(payload.data || null);
  } catch {
    renderAlertPreview(null);
  }
}

async function loadAlertOutbox() {
  const { apiBase, userId } = getContext();
  try {
    const payload = await requestJson(
      `${apiBase}/v1/alert-outbox?user_id=${encodeURIComponent(userId)}`
    );
    renderAlertOutbox(payload.data || null);
  } catch {
    renderAlertOutbox(null);
  }
}

async function acknowledgeAlert(alertId) {
  const { apiBase, userId } = getContext();
  if (!alertId) {
    return;
  }

  try {
    setStatus("Acknowledging notification...", "loading");
    await requestJson(`${apiBase}/v1/alert-outbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        alertIds: [alertId]
      })
    });
    await loadAlertOutbox();
    setStatus("Notification acknowledged.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function removeFollow(followId) {
  const { apiBase, userId } = getContext();
  try {
    setStatus("Removing from watchlist...", "loading");
    await removeWatchlistFollow(apiBase, followId, { userId });
    await loadAll();
    setStatus("Removed from watchlist.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function savePreferences() {
  const { apiBase, userId } = getContext();
  try {
    setStatus("Saving alert rules...", "loading");
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

    renderPreferences({
      webPush: elements.webPushInput.checked,
      emailDigest: elements.emailDigestInput.checked,
      swingAlerts: elements.swingAlertsInput.checked,
      matchStart: elements.matchStartInput.checked,
      matchFinal: elements.matchFinalInput.checked
    });
    setStatus("Alert rules saved.", "success");
  } catch (error) {
    setStatus(`Error: ${error.message}`, "error");
  }
}

async function loadAll() {
  const requestId = ++followsState.activeLoadRequestId;
  const { apiBase } = getContext();
  try {
    saveApiBase(apiBase);
  } catch {
    // Ignore storage failures.
  }
  updateNav();

  try {
    setStatus("Loading watchlist...", "loading");
    await Promise.all([loadFollows(), loadPreferences(), loadAlertPreview(), loadAlertOutbox()]);
    if (requestId !== followsState.activeLoadRequestId) {
      return;
    }
    setStatus("Watchlist loaded.", "success");
  } catch (error) {
    if (requestId !== followsState.activeLoadRequestId) {
      return;
    }
    setStatus(`Error: ${error.message}`, "error");
  }
}

function installEvents() {
  if (elements.refreshButton) {
    elements.refreshButton.addEventListener("click", loadAll);
  }
  if (elements.saveApiButton) {
    elements.saveApiButton.addEventListener("click", () => {
      saveApiBase(elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      updateNav();
      setStatus("API base saved locally.", "success");
    });
  }
  if (elements.savePrefsButton) {
    elements.savePrefsButton.addEventListener("click", savePreferences);
  }
  if (elements.followsList) {
    elements.followsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-follow-id]");
      if (!button) {
        return;
      }
      removeFollow(button.getAttribute("data-follow-id") || "");
    });
  }
  if (elements.watchlistRecentActionBanner) {
    elements.watchlistRecentActionBanner.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const dismiss = target.closest("[data-dismiss-watch-action]");
      if (!dismiss) {
        return;
      }
      clearRecentWatchlistAction();
      renderRecentActionBanner(followsState.rows);
    });
  }
  if (elements.watchlistLiveList) {
    elements.watchlistLiveList.addEventListener("click", delegateFollowRemove);
  }
  if (elements.watchlistUpcomingList) {
    elements.watchlistUpcomingList.addEventListener("click", delegateFollowRemove);
  }
  if (elements.watchlistRecentList) {
    elements.watchlistRecentList.addEventListener("click", delegateFollowRemove);
  }
  if (elements.alertOutboxWrap) {
    elements.alertOutboxWrap.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-alert-id]");
      if (!button) {
        return;
      }
      acknowledgeAlert(button.getAttribute("data-alert-id") || "");
    });
  }
}

function delegateFollowRemove(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest("[data-follow-id]");
  if (!button) {
    return;
  }
  removeFollow(button.getAttribute("data-follow-id") || "");
}

function boot() {
  const startupApiBase = readApiBase();
  elements.apiBaseInput.value = startupApiBase;
  updateNav();
  refreshFollowsSeo();
  setupControlsPanel();
  bindFollowsQuickJump();
  renderSummaryHero();
  renderFollowsQuickJump();
  installEvents();
  loadAll();
}

window.addEventListener("resize", () => {
  renderFollowsQuickJump();
  if (elements.controlsPanel) {
    applyControlsCollapsed(elements.controlsPanel.classList.contains("collapsed"));
  }
});

boot();
