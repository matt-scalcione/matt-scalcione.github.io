const WORKSPACE_USER_KEY = "pulseboard.workspaceUserId";

export function normalizeWorkspaceUserId(value) {
  return String(value || "").trim();
}

export function readStoredWorkspaceUserId() {
  try {
    return normalizeWorkspaceUserId(localStorage.getItem(WORKSPACE_USER_KEY));
  } catch {
    return "";
  }
}

export function saveWorkspaceUserId(value) {
  const normalized = normalizeWorkspaceUserId(value);
  try {
    if (!normalized) {
      localStorage.removeItem(WORKSPACE_USER_KEY);
      return "";
    }
    localStorage.setItem(WORKSPACE_USER_KEY, normalized);
    return normalized;
  } catch {
    return normalized;
  }
}

export function resolveWorkspaceUserId({ fallback = "", sourceUrl = window.location.href } = {}) {
  try {
    const url = new URL(String(sourceUrl), window.location.origin);
    const queryUser = normalizeWorkspaceUserId(
      url.searchParams.get("user") || url.searchParams.get("user_id")
    );
    if (queryUser) {
      saveWorkspaceUserId(queryUser);
      return queryUser;
    }
  } catch {
    // Ignore malformed source URLs and fall through to storage.
  }

  return readStoredWorkspaceUserId() || normalizeWorkspaceUserId(fallback);
}

export function workspaceUserLabel(userId) {
  const normalized = normalizeWorkspaceUserId(userId);
  return normalized || "No workspace";
}
