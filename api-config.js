const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_BASE = "https://esports-live-api.onrender.com";
const API_STORAGE_KEY = "pulseboard.apiBase";

function isLoopbackHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizeApiBase(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function configuredGlobalApiBase() {
  const fromVar = normalizeApiBase(window.PULSEBOARD_API_BASE);
  if (fromVar) {
    return fromVar;
  }

  const fromConfig = normalizeApiBase(window.PULSEBOARD_CONFIG?.apiBase);
  if (fromConfig) {
    return fromConfig;
  }

  return null;
}

function fallbackApiBaseForHost() {
  if (isLoopbackHost(window.location.hostname)) {
    return DEFAULT_LOCAL_API_BASE;
  }

  return configuredGlobalApiBase() || DEFAULT_PRODUCTION_API_BASE;
}

export function resolveInitialApiBase() {
  const url = new URL(window.location.href);
  const queryApi = normalizeApiBase(url.searchParams.get("api"));
  if (queryApi) {
    return queryApi;
  }

  const storedApi = normalizeApiBase(localStorage.getItem(API_STORAGE_KEY));
  if (storedApi) {
    return storedApi;
  }

  return fallbackApiBaseForHost();
}
