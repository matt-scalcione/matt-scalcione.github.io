const STATUS_TTL_MS = 60 * 1000;
const diagnosticsCache = new Map();

function nowMs() {
  return Date.now();
}

function cacheKey(apiBase) {
  return String(apiBase || "").trim() || "__default__";
}

function levelRank(level) {
  switch (String(level || "").toLowerCase()) {
    case "down":
      return 4;
    case "degraded":
    case "stale":
      return 3;
    case "warming":
      return 2;
    case "healthy":
      return 1;
    case "empty":
    default:
      return 0;
  }
}

function toneForLevel(level) {
  switch (String(level || "").toLowerCase()) {
    case "down":
    case "degraded":
    case "stale":
      return "degraded";
    case "warming":
      return "warming";
    case "healthy":
      return "live";
    case "empty":
    default:
      return "neutral";
  }
}

function gameHealthLabel(gameKey) {
  return String(gameKey || "").toLowerCase() === "dota" ? "Dota 2" : "LoL";
}

function summarizeLiveHealth(liveHealth) {
  const health = liveHealth && typeof liveHealth === "object" ? liveHealth : {};
  const entries = Object.entries(health);
  if (!entries.length) {
    return {
      title: "Live signal",
      value: "Unknown",
      detail: "Runtime diagnostics are unavailable right now.",
      tone: "neutral"
    };
  }

  const ranked = entries
    .map(([game, state]) => ({
      game,
      level: String(state?.level || "empty").toLowerCase(),
      fallbackRecommended: Boolean(state?.fallbackRecommended),
      usableProviders: Number(state?.usableProviders || 0)
    }))
    .sort((left, right) => levelRank(right.level) - levelRank(left.level));
  const top = ranked[0];

  if (ranked.some((entry) => entry.level === "down" || entry.level === "degraded" || entry.level === "stale")) {
    const degradedGames = ranked
      .filter((entry) => entry.level === "down" || entry.level === "degraded" || entry.level === "stale")
      .map((entry) => gameHealthLabel(entry.game))
      .join(" · ");
    return {
      title: "Live signal",
      value: "Degraded",
      detail: degradedGames ? `${degradedGames} need fallback or retry coverage.` : "One or more live providers are degraded.",
      tone: "degraded"
    };
  }

  if (ranked.some((entry) => entry.level === "healthy" && entry.usableProviders > 0)) {
    const healthyGames = ranked
      .filter((entry) => entry.level === "healthy" && entry.usableProviders > 0)
      .map((entry) => gameHealthLabel(entry.game))
      .join(" · ");
    return {
      title: "Live signal",
      value: "Healthy",
      detail: healthyGames ? `${healthyGames} are serving usable live rows.` : "Live providers are healthy.",
      tone: "live"
    };
  }

  if (ranked.every((entry) => entry.level === "empty")) {
    return {
      title: "Live signal",
      value: "Quiet right now",
      detail: "Live providers are healthy, but there are no active rows at the moment.",
      tone: "neutral"
    };
  }

  return {
    title: "Live signal",
    value: top.level === "warming" ? "Warming" : "Monitoring",
    detail: "Runtime diagnostics are active and tracking live coverage.",
    tone: toneForLevel(top.level)
  };
}

function summarizeCanonicalStore(canonicalStore) {
  const store = canonicalStore && typeof canonicalStore === "object" ? canonicalStore : {};
  const hasError = Boolean(store.lastInitError || store.lastPersistError);
  const collections = Array.isArray(store.trackedCollections) ? store.trackedCollections.length : 0;
  const details = Array.isArray(store.trackedDetails) ? store.trackedDetails.length : 0;
  const profiles = Array.isArray(store.trackedProfiles) ? store.trackedProfiles.length : 0;

  return {
    title: "Canonical sync",
    value: hasError ? "Degraded" : "Healthy",
    detail: hasError
      ? String(store.lastPersistError || store.lastInitError || "Canonical persistence needs attention.")
      : `${collections} collections · ${details} details · ${profiles} profiles cached.`,
    tone: hasError ? "degraded" : "live"
  };
}

function summarizeBackfill(data) {
  const recent = Array.isArray(data?.canonicalBackfill?.recentBackfills)
    ? data.canonicalBackfill.recentBackfills
    : [];
  const last = recent[0] || null;
  if (last) {
    const matchSummary = `${Number(last.matchSuccesses || 0)}/${Number(last.matchAttempts || 0)} matches`;
    const teamSummary = `${Number(last.teamSuccesses || 0)}/${Number(last.teamAttempts || 0)} teams`;
    return {
      title: "Backfill",
      value: last.failures?.length ? "Partial" : "Running clean",
      detail: `${matchSummary} · ${teamSummary}${last.durationMs ? ` · ${Math.round(last.durationMs / 1000)}s` : ""}`,
      tone: last.failures?.length ? "warming" : "neutral"
    };
  }

  return {
    title: "Backfill",
    value: data?.canonicalBackfillEnabled ? "Enabled" : "Off",
    detail: data?.canonicalBackfillEnabled
      ? "Background detail and team warming is enabled."
      : "Background backfill is not enabled.",
    tone: data?.canonicalBackfillEnabled ? "neutral" : "warming"
  };
}

function summarizeMode(data) {
  const mode = String(data?.mode || "unknown").trim().toLowerCase();
  const prewarm = Boolean(data?.canonicalPrewarmEnabled);
  const backfill = Boolean(data?.canonicalBackfillEnabled);
  const modeLabel = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "Unknown";
  return {
    title: "Runtime mode",
    value: modeLabel,
    detail: `${prewarm ? "Prewarm on" : "Prewarm off"} · ${backfill ? "Backfill on" : "Backfill off"}`,
    tone: "neutral"
  };
}

function renderCard(card) {
  return `
    <article class="runtime-card tone-${card.tone}">
      <p class="runtime-card-label">${card.title}</p>
      <p class="runtime-card-value">${card.value}</p>
      <p class="runtime-card-detail">${card.detail}</p>
    </article>
  `;
}

export function buildRuntimeStatusSummary(data) {
  return [
    summarizeLiveHealth(data?.liveHealth),
    summarizeCanonicalStore(data?.canonicalStore),
    summarizeBackfill(data),
    summarizeMode(data)
  ];
}

export async function fetchRuntimeStatus(apiBase, { timeoutMs = 5000 } = {}) {
  const key = cacheKey(apiBase);
  const current = diagnosticsCache.get(key);
  const now = nowMs();
  if (current?.data && now - current.fetchedAt < STATUS_TTL_MS) {
    return current.data;
  }
  if (current?.promise) {
    return current.promise;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetch(`${String(apiBase || "").replace(/\/$/, "")}/v1/provider-diagnostics`, {
    signal: controller.signal,
    headers: {
      Accept: "application/json"
    }
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Diagnostics request failed.");
      }
      const data = payload?.data || {};
      diagnosticsCache.set(key, {
        data,
        fetchedAt: nowMs(),
        promise: null
      });
      return data;
    })
    .finally(() => {
      clearTimeout(timeout);
      const snapshot = diagnosticsCache.get(key);
      if (snapshot?.promise) {
        diagnosticsCache.set(key, {
          data: snapshot.data || null,
          fetchedAt: snapshot.fetchedAt || 0,
          promise: null
        });
      }
    });

  diagnosticsCache.set(key, {
    data: current?.data || null,
    fetchedAt: current?.fetchedAt || 0,
    promise
  });
  return promise;
}

export async function loadRuntimeStatusPanel(container, apiBase, {
  eyebrow = "Data status",
  title = "Runtime trust",
  emptyMessage = "Runtime diagnostics are unavailable right now."
} = {}) {
  if (!container) {
    return;
  }

  try {
    const data = await fetchRuntimeStatus(apiBase);
    const cards = buildRuntimeStatusSummary(data);
    container.innerHTML = `
      <div class="runtime-panel-head">
        <div>
          <p class="runtime-panel-kicker">${eyebrow}</p>
          <h2>${title}</h2>
        </div>
        <p class="runtime-panel-note">Public system posture for live rows, canonical sync, and background warming.</p>
      </div>
      <div class="runtime-grid">
        ${cards.map(renderCard).join("")}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `
      <div class="runtime-panel-head">
        <div>
          <p class="runtime-panel-kicker">${eyebrow}</p>
          <h2>${title}</h2>
        </div>
        <p class="runtime-panel-note">${emptyMessage}</p>
      </div>
    `;
  }
}

export async function loadRuntimeStatusInline(container, apiBase) {
  if (!container) {
    return;
  }

  try {
    const data = await fetchRuntimeStatus(apiBase);
    const cards = buildRuntimeStatusSummary(data);
    container.innerHTML = cards
      .slice(0, 3)
      .map(
        (card) => `
          <span class="match-inline-status tone-${card.tone}" title="${card.detail}">
            <strong>${card.title}</strong>
            <span>${card.value}</span>
          </span>
        `
      )
      .join("");
  } catch {
    container.innerHTML = "";
  }
}
