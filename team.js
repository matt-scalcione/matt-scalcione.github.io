import { resolveInitialApiBase } from "./api-config.js";

const DEFAULT_API_BASE = resolveInitialApiBase();

const elements = {
  teamTitle: document.querySelector("#teamTitle"),
  backLink: document.querySelector("#backLink"),
  liveDeskNav: document.querySelector("#liveDeskNav"),
  scheduleNav: document.querySelector("#scheduleNav"),
  followsNav: document.querySelector("#followsNav"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  gameSelect: document.querySelector("#gameSelect"),
  limitSelect: document.querySelector("#limitSelect"),
  opponentSelect: document.querySelector("#opponentSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  saveButton: document.querySelector("#saveButton"),
  statusText: document.querySelector("#statusText"),
  teamMetaText: document.querySelector("#teamMetaText"),
  teamSummaryWrap: document.querySelector("#teamSummaryWrap"),
  performanceMetaText: document.querySelector("#performanceMetaText"),
  performanceInsightsWrap: document.querySelector("#performanceInsightsWrap"),
  formTimelineMeta: document.querySelector("#formTimelineMeta"),
  formTimelineWrap: document.querySelector("#formTimelineWrap"),
  recentMatchesWrap: document.querySelector("#recentMatchesWrap"),
  upcomingMatchesWrap: document.querySelector("#upcomingMatchesWrap"),
  pastResultFilter: document.querySelector("#pastResultFilter"),
  pastSortFilter: document.querySelector("#pastSortFilter"),
  pastOpponentSearch: document.querySelector("#pastOpponentSearch"),
  pastTournamentFilter: document.querySelector("#pastTournamentFilter"),
  exportPastCsvButton: document.querySelector("#exportPastCsvButton"),
  pastMatchesMeta: document.querySelector("#pastMatchesMeta"),
  opponentBreakdownWrap: document.querySelector("#opponentBreakdownWrap"),
  headToHeadWrap: document.querySelector("#headToHeadWrap")
};

const state = {
  teamId: null,
  seedMatchId: null,
  teamNameHint: null,
  profile: null,
  pastTournamentSignature: null,
  pendingOpponentId: null
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
    return String(iso || "");
  }
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "n/a";
  }

  return `${num.toFixed(1)}%`;
}

function statusPillClass(status) {
  if (status === "live") return "live";
  if (status === "upcoming") return "upcoming";
  return "complete";
}

function resultClass(result) {
  if (result === "win") return "win-left";
  if (result === "loss") return "win-right";
  return "even";
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

function buildBackLink(apiBase) {
  const url = new URL(window.location.href);
  const fromMatch = url.searchParams.get("match");
  if (fromMatch) {
    const matchUrl = new URL("./match.html", window.location.href);
    matchUrl.searchParams.set("id", fromMatch);
    matchUrl.searchParams.set("api", apiBase);
    const gameNumber = url.searchParams.get("game_number");
    if (gameNumber) {
      matchUrl.searchParams.set("game", gameNumber);
    }
    elements.backLink.href = matchUrl.toString();
    elements.backLink.textContent = "Back to Match";
    return;
  }

  const scheduleUrl = new URL("./schedule.html", window.location.href);
  scheduleUrl.searchParams.set("api", apiBase);
  elements.backLink.href = scheduleUrl.toString();
  elements.backLink.textContent = "Back to Schedule";
}

function matchDetailUrl(matchId, apiBase) {
  const url = new URL("./match.html", window.location.href);
  url.searchParams.set("id", matchId);
  url.searchParams.set("api", apiBase);
  return url.toString();
}

function teamDetailUrl({
  teamId,
  teamName,
  game,
  apiBase,
  matchId = null,
  opponentId = null
}) {
  if (!teamId) {
    return null;
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

  return url.toString();
}

function seriesScoreLabel(row) {
  if (row?.scoreLabel) {
    return row.scoreLabel;
  }

  const own = Number(row?.ownScore);
  const opp = Number(row?.oppScore);
  if (Number.isFinite(own) && Number.isFinite(opp)) {
    return `${own}-${opp}`;
  }

  return "n/a";
}

function resultLabel(row) {
  const normalized = String(row?.result || "").toLowerCase();
  if (normalized === "win") return "W";
  if (normalized === "loss") return "L";
  if (normalized === "draw") return "D";
  return "n/a";
}

function parseTimestamp(iso) {
  const value = Date.parse(String(iso || ""));
  return Number.isFinite(value) ? value : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function relativeStartLabel(iso) {
  const ts = parseTimestamp(iso);
  if (!ts) {
    return "n/a";
  }

  const deltaMs = ts - Date.now();
  if (deltaMs <= 0) {
    return "started";
  }

  const totalMinutes = Math.max(1, Math.round(deltaMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) {
    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  return `"${normalized.replaceAll("\"", "\"\"")}"`;
}

function safeFileToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensurePastTournamentOptions(rows = []) {
  if (!elements.pastTournamentFilter) {
    return;
  }

  const tournaments = Array.from(
    new Set(
      rows
        .map((row) => String(row?.tournament || "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
  const signature = tournaments.join("||");
  if (state.pastTournamentSignature === signature) {
    return;
  }

  state.pastTournamentSignature = signature;
  const previous = elements.pastTournamentFilter.value || "all";
  elements.pastTournamentFilter.innerHTML = [
    `<option value="all">All</option>`,
    ...tournaments.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
  ].join("");
  elements.pastTournamentFilter.value = tournaments.includes(previous) ? previous : "all";
}

function exportPastMatchesCsv(profile) {
  if (!profile) {
    return;
  }

  const { rows } = buildPastRows(profile);
  if (!rows.length) {
    elements.statusText.textContent = "No past matches to export for current filters.";
    return;
  }

  const header = ["Date (ISO)", "Date (Local)", "Opponent", "Result", "Score", "Tournament", "Match ID", "Opponent ID"];
  const body = rows.map((row) => [
    row.startAt || "",
    dateTimeLabel(row.startAt),
    row.opponentName || "Unknown",
    resultLabel(row),
    seriesScoreLabel(row),
    row.tournament || "Unknown",
    row.matchId || "",
    row.opponentId || ""
  ]);
  const csv = [header, ...body].map((line) => line.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const teamToken = safeFileToken(profile.name || profile.id || "team");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  anchor.href = url;
  anchor.download = `${teamToken}-past-matches-${stamp}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  elements.statusText.textContent = `Exported ${rows.length} past matches to CSV.`;
}

function buildPastRows(profile) {
  const allRows = Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice() : [];
  const resultFilter = elements.pastResultFilter?.value || "all";
  const sortMode = elements.pastSortFilter?.value || "newest";
  const tournamentFilter = elements.pastTournamentFilter?.value || "all";
  const opponentSearch = String(elements.pastOpponentSearch?.value || "")
    .trim()
    .toLowerCase();

  let rows = allRows;
  if (resultFilter !== "all") {
    rows = rows.filter((row) => String(row?.result || "").toLowerCase() === resultFilter);
  }

  if (opponentSearch) {
    rows = rows.filter((row) => String(row?.opponentName || "").toLowerCase().includes(opponentSearch));
  }

  if (tournamentFilter !== "all") {
    rows = rows.filter((row) => String(row?.tournament || "") === tournamentFilter);
  }

  rows = rows
    .slice()
    .sort((left, right) =>
      sortMode === "oldest" ? parseTimestamp(left.startAt) - parseTimestamp(right.startAt) : parseTimestamp(right.startAt) - parseTimestamp(left.startAt)
    );

  return {
    rows,
    total: allRows.length
  };
}

function renderFormTimeline(profile) {
  const rows = Array.isArray(profile?.recentMatches) ? profile.recentMatches.slice(0, 12) : [];
  if (elements.formTimelineMeta) {
    elements.formTimelineMeta.textContent = rows.length
      ? `${rows.length} recent series in current window`
      : "No completed series in the current window";
  }

  if (!elements.formTimelineWrap) {
    return;
  }

  if (!rows.length) {
    elements.formTimelineWrap.innerHTML = `<div class="empty">Form timeline appears once completed matches are available.</div>`;
    return;
  }

  elements.formTimelineWrap.innerHTML = `
    <div class="form-timeline">
      ${rows
        .map((row) => {
          const tone = resultClass(row.result);
          const marker = resultLabel(row);
          const label = `${marker} ${seriesScoreLabel(row)} vs ${row.opponentName || "Unknown"} · ${dateTimeLabel(row.startAt)}`;
          return `<span class="timeline-chip ${tone}" title="${escapeHtml(label)}">${marker} ${seriesScoreLabel(row)}</span>`;
        })
        .join("")}
    </div>
  `;
}

function pastMatchRowMarkup(row, profile, apiBase) {
  const opponentUrl = teamDetailUrl({
    teamId: row.opponentId,
    teamName: row.opponentName,
    game: row.game || profile.game,
    apiBase,
    matchId: row.matchId,
    opponentId: state.teamId
  });
  const opponentLabel = opponentUrl
    ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
    : (row.opponentName || "Unknown");

  return `
    <tr>
      <td>${dateTimeLabel(row.startAt)}</td>
      <td>${opponentLabel}</td>
      <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
      <td>${seriesScoreLabel(row)}</td>
      <td>${row.tournament || "Unknown"}</td>
      <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
    </tr>
  `;
}

function insightCard(label, value, note = null) {
  return `
    <article class="upcoming-card">
      <p class="tempo-label">${label}</p>
      <p class="tempo-value">${value}</p>
      ${note ? `<p class="meta-text">${note}</p>` : ""}
    </article>
  `;
}

function renderPerformanceInsights(profile) {
  const rows = Array.isArray(profile?.recentMatches) ? profile.recentMatches : [];
  if (!elements.performanceInsightsWrap) {
    return;
  }

  if (!rows.length) {
    if (elements.performanceMetaText) {
      elements.performanceMetaText.textContent = "No completed matches yet";
    }
    elements.performanceInsightsWrap.innerHTML = `<div class="empty">Performance insights appear once completed matches are available.</div>`;
    return;
  }

  const total = rows.length;
  const mapWins = rows.reduce((sum, row) => sum + Number(row.ownScore || 0), 0);
  const mapLosses = rows.reduce((sum, row) => sum + Number(row.oppScore || 0), 0);
  const avgMapsPerSeries = (mapWins + mapLosses) / Math.max(1, total);
  const avgMargin = rows.reduce((sum, row) => sum + (Number(row.ownScore || 0) - Number(row.oppScore || 0)), 0) / Math.max(1, total);
  const closeSeries = rows.filter((row) => Math.abs(Number(row.ownScore || 0) - Number(row.oppScore || 0)) <= 1).length;
  const deciders = rows.filter((row) => {
    const mapsPlayed = Number(row.ownScore || 0) + Number(row.oppScore || 0);
    const bestOf = Number(row.bestOf || 0);
    return bestOf > 1 && mapsPlayed >= bestOf;
  }).length;
  const cleanWins = rows.filter((row) => row.result === "win" && Number(row.oppScore || 0) === 0).length;
  const gotSwept = rows.filter((row) => row.result === "loss" && Number(row.ownScore || 0) === 0).length;
  const scorelineCounts = new Map();
  for (const row of rows) {
    const key = `${resultLabel(row)} ${seriesScoreLabel(row)}`;
    scorelineCounts.set(key, Number(scorelineCounts.get(key) || 0) + 1);
  }
  const topScorelines = Array.from(scorelineCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  if (elements.performanceMetaText) {
    elements.performanceMetaText.textContent = `Computed from ${rows.length} most recent completed series`;
  }

  elements.performanceInsightsWrap.innerHTML = `
    <div class="upcoming-grid">
      ${insightCard("Avg Maps / Series", avgMapsPerSeries.toFixed(2))}
      ${insightCard("Avg Map Margin", avgMargin.toFixed(2), "Positive means stronger map control")}
      ${insightCard("Close Series Rate", formatPercent((closeSeries / Math.max(1, total)) * 100))}
      ${insightCard("Decider Rate", formatPercent((deciders / Math.max(1, total)) * 100))}
      ${insightCard("Clean Wins", String(cleanWins), "Series won without dropping a map")}
      ${insightCard("Got Swept", String(gotSwept), "Series losses with 0 map wins")}
    </div>
    <article class="upcoming-note top-space">
      <p class="meta-text strong">Frequent Scorelines</p>
      <div class="form-timeline">
        ${
          topScorelines.length
            ? topScorelines
                .map(
                  ([label, count]) =>
                    `<span class="timeline-chip">${escapeHtml(label)} · ${count}</span>`
                )
                .join("")
            : `<span class="meta-text">No scoreline distribution available.</span>`
        }
      </div>
    </article>
  `;
}

function renderSummary(profile) {
  const summary = profile.summary || {};
  elements.teamSummaryWrap.innerHTML = [
    { label: "Team", value: profile.name || profile.id },
    { label: "Game", value: String(profile.game || "lol").toUpperCase() },
    { label: "Series Record", value: `${summary.wins ?? 0}-${summary.losses ?? 0}${summary.draws ? `-${summary.draws}` : ""}` },
    { label: "Series Win Rate", value: formatPercent(summary.seriesWinRatePct) },
    { label: "Map Record", value: `${summary.mapWins ?? 0}-${summary.mapLosses ?? 0}` },
    { label: "Map Win Rate", value: formatPercent(summary.mapWinRatePct) },
    { label: "Streak", value: summary.streakLabel || "n/a" },
    { label: "Recent Form", value: summary.formLast5 || "n/a" }
  ]
    .map(
      (row) => `
        <article class="upcoming-card">
          <p class="tempo-label">${row.label}</p>
          <p class="tempo-value">${row.value}</p>
        </article>
      `
    )
    .join("");
}

function renderRecentMatches(profile, apiBase) {
  const rows = Array.isArray(profile.recentMatches) ? profile.recentMatches : [];
  if (!rows.length) {
    elements.recentMatchesWrap.innerHTML = `<div class="empty">No recent matches found for this team.</div>`;
    return;
  }

  elements.recentMatchesWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Score</th>
            <th>Opponent</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => {
                const opponentUrl = teamDetailUrl({
                  teamId: row.opponentId,
                  teamName: row.opponentName,
                  game: row.game || profile.game,
                  apiBase,
                  matchId: row.matchId,
                  opponentId: state.teamId
                });
                const opponentLabel = opponentUrl
                  ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
                  : (row.opponentName || "Unknown");
                return `
                <tr>
                  <td>${dateTimeLabel(row.startAt)}</td>
                  <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
                  <td>${seriesScoreLabel(row)}</td>
                  <td>${opponentLabel}</td>
                  <td>${row.tournament || "Unknown"}</td>
                  <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                </tr>
              `;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderUpcomingMatches(profile, apiBase) {
  const rows = Array.isArray(profile.upcomingMatches) ? profile.upcomingMatches : [];
  if (!rows.length) {
    elements.upcomingMatchesWrap.innerHTML = `<div class="empty">No upcoming matches on file.</div>`;
    return;
  }

  elements.upcomingMatchesWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Start</th>
            <th>Starts In</th>
            <th>Status</th>
            <th>Opponent</th>
            <th>Format</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const opponentUrl = teamDetailUrl({
                teamId: row.opponentId,
                teamName: row.opponentName,
                game: row.game || profile.game,
                apiBase,
                matchId: row.matchId,
                opponentId: state.teamId
              });
              const opponentLabel = opponentUrl
                ? `<a class="team-link" href="${opponentUrl}">${row.opponentName || "Unknown"}</a>`
                : (row.opponentName || "Unknown");
              return `
                <tr>
                  <td>${dateTimeLabel(row.startAt)}</td>
                  <td>${relativeStartLabel(row.startAt)}</td>
                  <td><span class="pill ${statusPillClass(row.status)}">${row.status}</span></td>
                  <td>${opponentLabel}</td>
                  <td>BO${row.bestOf || 1}</td>
                  <td>${row.tournament || "Unknown"}</td>
                  <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPastMatches(profile, apiBase) {
  ensurePastTournamentOptions(Array.isArray(profile?.recentMatches) ? profile.recentMatches : []);
  const { rows, total } = buildPastRows(profile);
  if (elements.pastMatchesMeta) {
    elements.pastMatchesMeta.textContent = `Showing ${rows.length} of ${total} past matches`;
  }

  if (!total) {
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">No past matches found for this team.</div>`;
    return;
  }

  if (!rows.length) {
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">No matches match the selected filters.</div>`;
    return;
  }

  elements.opponentBreakdownWrap.innerHTML = `
    <div class="lane-table-wrap">
      <table class="lane-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Result</th>
            <th>Score</th>
            <th>Tournament</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => pastMatchRowMarkup(row, profile, apiBase))
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildOpponentOptions(profile) {
  const table = new Map();
  const add = (id, name) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || normalizedId === String(state.teamId || "")) {
      return;
    }

    const current = table.get(normalizedId);
    const label = String(name || "").trim() || current?.name || `Team ${normalizedId}`;
    table.set(normalizedId, {
      id: normalizedId,
      name: label
    });
  };

  const recentRows = Array.isArray(profile?.recentMatches) ? profile.recentMatches : [];
  const upcomingRows = Array.isArray(profile?.upcomingMatches) ? profile.upcomingMatches : [];
  const breakdownRows = Array.isArray(profile?.opponentBreakdown) ? profile.opponentBreakdown : [];
  for (const row of recentRows) {
    add(row?.opponentId, row?.opponentName);
  }
  for (const row of upcomingRows) {
    add(row?.opponentId, row?.opponentName);
  }
  for (const row of breakdownRows) {
    add(row?.opponentId, row?.opponentName);
  }
  if (profile?.headToHead?.opponentId) {
    add(profile.headToHead.opponentId, profile.headToHead.opponentName);
  }

  return Array.from(table.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function syncOpponentSelect(profile) {
  if (!elements.opponentSelect) {
    return;
  }

  const currentValue = String(elements.opponentSelect.value || state.pendingOpponentId || "").trim();
  const options = buildOpponentOptions(profile);
  if (currentValue && !options.some((option) => option.id === currentValue)) {
    const fallbackName = profile?.headToHead?.opponentId === currentValue
      ? profile?.headToHead?.opponentName
      : null;
    options.unshift({
      id: currentValue,
      name: fallbackName || `Team ${currentValue}`
    });
  }

  const markup = [
    `<option value="">All opponents</option>`,
    ...options.map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name)}</option>`)
  ].join("");
  elements.opponentSelect.innerHTML = markup;

  const hasCurrent = currentValue && options.some((option) => option.id === currentValue);
  const selectedValue = hasCurrent ? currentValue : "";
  elements.opponentSelect.value = selectedValue;
  state.pendingOpponentId = selectedValue || null;
}

function renderHeadToHead(profile, apiBase) {
  const h2h = profile.headToHead;
  if (!h2h) {
    elements.headToHeadWrap.innerHTML = `<div class="empty">Select an opponent from Team Filters to load direct head-to-head history.</div>`;
    return;
  }

  const rows = Array.isArray(h2h.recentMatches) ? h2h.recentMatches.slice() : [];
  const ordered = rows.slice().sort((left, right) => parseTimestamp(right.startAt) - parseTimestamp(left.startAt));
  const mapWins = ordered.reduce((sum, row) => sum + Number(row?.ownScore || 0), 0);
  const mapLosses = ordered.reduce((sum, row) => sum + Number(row?.oppScore || 0), 0);
  const totalMaps = mapWins + mapLosses;
  const mapWinRate = totalMaps > 0 ? (mapWins / totalMaps) * 100 : null;
  const avgMapsPerSeries = ordered.length > 0 ? totalMaps / ordered.length : null;
  const recentMomentum = ordered
    .slice(0, 5)
    .map((row) => resultLabel(row))
    .join("");
  const lastMeeting = ordered[0] || null;
  const opponentUrl = teamDetailUrl({
    teamId: h2h.opponentId,
    teamName: h2h.opponentName,
    game: profile.game,
    apiBase,
    opponentId: state.teamId
  });
  const opponentLabel = opponentUrl
    ? `<a class="team-link" href="${opponentUrl}">${h2h.opponentName || h2h.opponentId || "Unknown"}</a>`
    : (h2h.opponentName || h2h.opponentId || "Unknown");

  elements.headToHeadWrap.innerHTML = `
    <article class="upcoming-note">
      <p class="meta-text">Opponent: ${opponentLabel}</p>
      <p class="meta-text">Matches ${h2h.matches ?? 0} · W ${h2h.wins ?? 0} · L ${h2h.losses ?? 0} · D ${h2h.draws ?? 0}</p>
    </article>
    <div class="upcoming-grid">
      <article class="upcoming-card">
        <p class="tempo-label">Series Win Rate</p>
        <p class="tempo-value">${formatPercent(
          Number(h2h.matches || 0) > 0 ? (Number(h2h.wins || 0) / Number(h2h.matches || 0)) * 100 : null
        )}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Map Win Rate</p>
        <p class="tempo-value">${formatPercent(mapWinRate)}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Map Differential</p>
        <p class="tempo-value">${mapWins - mapLosses}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Avg Maps / Series</p>
        <p class="tempo-value">${avgMapsPerSeries === null ? "n/a" : avgMapsPerSeries.toFixed(2)}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Recent Momentum</p>
        <p class="tempo-value">${recentMomentum || "n/a"}</p>
      </article>
      <article class="upcoming-card">
        <p class="tempo-label">Last Meeting</p>
        <p class="tempo-value">${lastMeeting ? `${resultLabel(lastMeeting)} ${seriesScoreLabel(lastMeeting)}` : "n/a"}</p>
        <p class="meta-text">${lastMeeting ? dateTimeLabel(lastMeeting.startAt) : ""}</p>
      </article>
    </div>
    ${ordered.length
      ? `<div class="lane-table-wrap">
          <table class="lane-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Result</th>
                <th>Score</th>
                <th>Tournament</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${ordered
                .map(
                  (row) => `
                    <tr>
                      <td>${dateTimeLabel(row.startAt)}</td>
                      <td class="${resultClass(row.result)}">${resultLabel(row)}</td>
                      <td>${seriesScoreLabel(row)}</td>
                      <td>${row.tournament || "Unknown"}</td>
                      <td><a class="table-link" href="${matchDetailUrl(row.matchId, apiBase)}">Open</a></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>`
      : `<div class="empty">No direct meetings found with this opponent.</div>`}
  `;
}

function buildTeamRequestUrl() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const url = new URL(`/v1/teams/${encodeURIComponent(state.teamId)}`, apiBase);
  const game = elements.gameSelect.value;
  const opponent = String(elements.opponentSelect?.value || "").trim();
  const limit = elements.limitSelect.value;

  if (game) url.searchParams.set("game", game);
  if (opponent) url.searchParams.set("opponent_id", opponent);
  if (limit) url.searchParams.set("limit", limit);
  if (state.seedMatchId) url.searchParams.set("seed_match_id", state.seedMatchId);
  if (state.teamNameHint) url.searchParams.set("team_name", state.teamNameHint);

  return url.toString();
}

async function loadTeamProfile() {
  const apiBase = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
  updateNav(apiBase);
  buildBackLink(apiBase);

  try {
    elements.statusText.textContent = "Loading team profile...";
    const response = await fetch(buildTeamRequestUrl());
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || "API request failed.");
    }

    const profile = payload.data;
    state.profile = profile;
    elements.teamTitle.textContent = `${profile.name} · ${String(profile.game || "lol").toUpperCase()}`;
    elements.teamMetaText.textContent = `Updated ${dateTimeLabel(profile.generatedAt)} · Team ID ${profile.id}`;
    syncOpponentSelect(profile);
    renderSummary(profile);
    renderPerformanceInsights(profile);
    renderFormTimeline(profile);
    renderRecentMatches(profile, apiBase);
    renderUpcomingMatches(profile, apiBase);
    renderPastMatches(profile, apiBase);
    renderHeadToHead(profile, apiBase);
    elements.statusText.textContent = "Team profile synced.";
  } catch (error) {
    state.profile = null;
    state.pastTournamentSignature = null;
    elements.statusText.textContent = `Error: ${error.message}`;
    elements.teamTitle.textContent = `Error loading team: ${error.message}`;
    elements.teamMetaText.textContent = "";
    if (elements.performanceMetaText) {
      elements.performanceMetaText.textContent = "";
    }
    if (elements.formTimelineMeta) {
      elements.formTimelineMeta.textContent = "";
    }
    if (elements.pastMatchesMeta) {
      elements.pastMatchesMeta.textContent = "";
    }
    if (elements.pastTournamentFilter) {
      elements.pastTournamentFilter.innerHTML = `<option value="all">All</option>`;
      elements.pastTournamentFilter.value = "all";
    }
    elements.teamSummaryWrap.innerHTML = `<div class="empty">Unable to load team snapshot.</div>`;
    if (elements.performanceInsightsWrap) {
      elements.performanceInsightsWrap.innerHTML = `<div class="empty">Unable to load performance insights.</div>`;
    }
    if (elements.formTimelineWrap) {
      elements.formTimelineWrap.innerHTML = `<div class="empty">Unable to load form timeline.</div>`;
    }
    elements.recentMatchesWrap.innerHTML = `<div class="empty">Unable to load recent matches.</div>`;
    elements.upcomingMatchesWrap.innerHTML = `<div class="empty">Unable to load upcoming matches.</div>`;
    elements.opponentBreakdownWrap.innerHTML = `<div class="empty">Unable to load past matches.</div>`;
    elements.headToHeadWrap.innerHTML = `<div class="empty">Unable to load head-to-head data.</div>`;
  }
}

function installEvents() {
  elements.refreshButton.addEventListener("click", loadTeamProfile);
  elements.saveButton.addEventListener("click", () => {
    const value = elements.apiBaseInput.value.trim() || DEFAULT_API_BASE;
    saveApiBase(value);
    elements.statusText.textContent = "API base saved locally.";
  });
  elements.gameSelect.addEventListener("change", loadTeamProfile);
  elements.limitSelect.addEventListener("change", loadTeamProfile);
  if (elements.opponentSelect) {
    elements.opponentSelect.addEventListener("change", () => {
      state.pendingOpponentId = String(elements.opponentSelect.value || "").trim() || null;
      loadTeamProfile();
    });
  }
  if (elements.pastResultFilter) {
    elements.pastResultFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastSortFilter) {
    elements.pastSortFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastOpponentSearch) {
    elements.pastOpponentSearch.addEventListener("input", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.pastTournamentFilter) {
    elements.pastTournamentFilter.addEventListener("change", () => {
      if (state.profile) {
        renderPastMatches(state.profile, elements.apiBaseInput.value.trim() || DEFAULT_API_BASE);
      }
    });
  }
  if (elements.exportPastCsvButton) {
    elements.exportPastCsvButton.addEventListener("click", () => {
      exportPastMatchesCsv(state.profile);
    });
  }
}

function boot() {
  const url = new URL(window.location.href);
  const teamId = url.searchParams.get("id");
  if (!teamId) {
    elements.teamTitle.textContent = "Missing team id.";
    elements.statusText.textContent = "Add ?id=<team-id> to the URL.";
    return;
  }

  state.teamId = teamId;
  state.seedMatchId = url.searchParams.get("match");
  state.teamNameHint = url.searchParams.get("team_name");

  const apiBase = url.searchParams.get("api") || readApiBase();
  elements.apiBaseInput.value = apiBase;

  const game = url.searchParams.get("game");
  if (game) {
    elements.gameSelect.value = game;
  }

  const opponent = url.searchParams.get("opponent") || url.searchParams.get("opponent_id");
  if (opponent) {
    state.pendingOpponentId = opponent;
    if (elements.opponentSelect) {
      elements.opponentSelect.innerHTML = [
        `<option value="">All opponents</option>`,
        `<option value="${escapeHtml(opponent)}">Team ${escapeHtml(opponent)}</option>`
      ].join("");
      elements.opponentSelect.value = opponent;
    }
  } else if (elements.opponentSelect) {
    elements.opponentSelect.value = "";
  }

  const limit = url.searchParams.get("limit");
  if (limit && ["5", "10", "15", "20"].includes(limit)) {
    elements.limitSelect.value = limit;
  } else {
    elements.limitSelect.value = "5";
  }

  if (elements.pastResultFilter) {
    elements.pastResultFilter.value = "all";
  }
  if (elements.pastSortFilter) {
    elements.pastSortFilter.value = "newest";
  }
  if (elements.pastOpponentSearch) {
    elements.pastOpponentSearch.value = "";
  }
  if (elements.pastTournamentFilter) {
    elements.pastTournamentFilter.innerHTML = `<option value="all">All</option>`;
    elements.pastTournamentFilter.value = "all";
  }
  state.pastTournamentSignature = null;

  installEvents();
  loadTeamProfile();
}

boot();
