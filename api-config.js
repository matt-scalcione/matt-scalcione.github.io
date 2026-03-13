const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_BASE = "https://api.pulseboard.mindpointdesign.opalstacked.com";
const API_STORAGE_KEY = "pulseboard.apiBase";
const DEPRECATED_API_BASES = new Set([
  "https://pulseboard-api-drq0.onrender.com",
  "https://pulseboard-api.onrender.com"
]);

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

function canonicalApiBase(value) {
  const normalized = normalizeApiBase(value);
  if (!normalized) {
    return null;
  }

  if (DEPRECATED_API_BASES.has(normalized)) {
    return configuredGlobalApiBase() || DEFAULT_PRODUCTION_API_BASE;
  }

  return normalized;
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
  const queryApi = canonicalApiBase(url.searchParams.get("api"));
  if (queryApi) {
    return queryApi;
  }

  const storedApi = canonicalApiBase(localStorage.getItem(API_STORAGE_KEY));
  if (storedApi) {
    return storedApi;
  }

  return fallbackApiBaseForHost();
}
