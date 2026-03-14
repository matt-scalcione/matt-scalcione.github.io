import { ensureWorkspaceUserId } from "./workspace-user.js";

const DEFAULT_TIMEOUT_MS = 8000;
const RECENT_WATCHLIST_ACTION_KEY = "pulseboard.watchlistRecentAction";
const RECENT_WATCHLIST_ACTION_MAX_AGE_MS = 10 * 60 * 1000;

function normalizeFollowRows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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
      throw new Error(payload?.error?.message || "Watchlist request failed.");
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

export function resolveWatchlistUserId({ fallback = "", sourceUrl } = {}) {
  return ensureWorkspaceUserId({
    fallback,
    sourceUrl
  });
}

export async function fetchWatchlistRows(apiBase, { userId = resolveWatchlistUserId() } = {}) {
  if (!userId) {
    return [];
  }
  const payload = await requestJson(
    `${apiBase}/v1/follows?user_id=${encodeURIComponent(userId)}`
  );
  return normalizeFollowRows(payload);
}

export async function addTeamToWatchlist(
  apiBase,
  teamId,
  { userId = resolveWatchlistUserId(), displayName = "", game = "" } = {}
) {
  if (!teamId) {
    throw new Error("Team id is required.");
  }
  const payload = await requestJson(`${apiBase}/v1/follows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      entityType: "team",
      entityId: teamId,
      displayName,
      game
    })
  });
  return payload?.data || null;
}

export async function removeWatchlistFollow(apiBase, followId, { userId = resolveWatchlistUserId() } = {}) {
  if (!followId) {
    throw new Error("Follow id is required.");
  }
  await requestJson(
    `${apiBase}/v1/follows/${encodeURIComponent(followId)}?user_id=${encodeURIComponent(userId)}`,
    {
      method: "DELETE"
    }
  );
}

function normalizeCanonicalTeamId(value) {
  return String(value || "").trim().toLowerCase();
}

export function findTeamFollow(rows = [], { teamId = "", canonicalTeamId = "" } = {}) {
  const normalizedTeamId = String(teamId || "").trim();
  const normalizedCanonicalTeamId = normalizeCanonicalTeamId(canonicalTeamId);
  if (!normalizedTeamId && !normalizedCanonicalTeamId) {
    return null;
  }

  return (Array.isArray(rows) ? rows : []).find(
    (row) => {
      if (row?.entityType !== "team") {
        return false;
      }

      const rowTeamId = String(row?.entityId || "").trim();
      const rowCanonicalTeamId = normalizeCanonicalTeamId(row?.canonicalEntityId);
      return (
        (normalizedTeamId && rowTeamId === normalizedTeamId) ||
        (normalizedCanonicalTeamId && rowCanonicalTeamId === normalizedCanonicalTeamId)
      );
    }
  ) || null;
}

export function summarizeWatchlistFollow(row, { fallbackName = "Team" } = {}) {
  const displayName = String(row?.displayName || fallbackName || row?.entityId || "Team").trim() || "Team";
  const opponentName = String(row?.signalOpponentName || "").trim();
  const tournament = String(row?.signalTournament || "").trim();
  const state = String(row?.signalState || "").trim().toLowerCase();

  if (state === "live") {
    if (opponentName) {
      return `Watching ${displayName} live vs ${opponentName}.`;
    }
    if (tournament) {
      return `Watching ${displayName} live in ${tournament}.`;
    }
    return `Watching ${displayName} live.`;
  }

  if (state === "upcoming") {
    if (opponentName) {
      return `Watching ${displayName}. Up next vs ${opponentName}.`;
    }
    if (tournament) {
      return `Watching ${displayName}. Next in ${tournament}.`;
    }
    return `Watching ${displayName}.`;
  }

  if (state === "recent") {
    if (opponentName) {
      return `Watching ${displayName}. Recent final vs ${opponentName}.`;
    }
    if (tournament) {
      return `Watching ${displayName}. Recent final from ${tournament}.`;
    }
    return `Watching ${displayName}.`;
  }

  return `Watching ${displayName}.`;
}

export function rememberRecentWatchlistAction(action, row = {}) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!normalizedAction) {
    return;
  }

  safeLocalStorageSet(
    RECENT_WATCHLIST_ACTION_KEY,
    JSON.stringify({
      action: normalizedAction,
      entityType: String(row?.entityType || "team").trim() || "team",
      entityId: String(row?.entityId || "").trim() || null,
      canonicalEntityId: String(row?.canonicalEntityId || "").trim() || null,
      displayName: String(row?.displayName || row?.displayNameHint || "").trim() || null,
      signalState: String(row?.signalState || "").trim() || null,
      signalLabel: String(row?.signalLabel || "").trim() || null,
      signalOpponentName: String(row?.signalOpponentName || "").trim() || null,
      signalTournament: String(row?.signalTournament || "").trim() || null,
      signalAt: String(row?.signalAt || "").trim() || null,
      liveMatchId: String(row?.liveMatchId || "").trim() || null,
      nextMatchId: String(row?.nextMatchId || "").trim() || null,
      recentMatchId: String(row?.recentMatchId || "").trim() || null,
      game: String(row?.game || row?.gameHint || "").trim() || null,
      savedAt: new Date().toISOString()
    })
  );
}

export function readRecentWatchlistAction({ maxAgeMs = RECENT_WATCHLIST_ACTION_MAX_AGE_MS } = {}) {
  const raw = safeLocalStorageGet(RECENT_WATCHLIST_ACTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const savedAtMs = Date.parse(String(parsed?.savedAt || ""));
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > maxAgeMs) {
      safeLocalStorageRemove(RECENT_WATCHLIST_ACTION_KEY);
      return null;
    }
    return parsed;
  } catch {
    safeLocalStorageRemove(RECENT_WATCHLIST_ACTION_KEY);
    return null;
  }
}

export function clearRecentWatchlistAction() {
  safeLocalStorageRemove(RECENT_WATCHLIST_ACTION_KEY);
}
