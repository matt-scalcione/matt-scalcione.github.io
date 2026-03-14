import { ensureWorkspaceUserId } from "./workspace-user.js";

const DEFAULT_TIMEOUT_MS = 8000;

function normalizeFollowRows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
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
