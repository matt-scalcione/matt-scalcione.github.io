function isLoopbackHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function shouldUsePrettyRoutes() {
  const fromConfig = window.PULSEBOARD_CONFIG?.usePrettyRoutes;
  if (typeof fromConfig === "boolean") {
    return fromConfig;
  }

  if (typeof window.PULSEBOARD_USE_PRETTY_ROUTES === "boolean") {
    return window.PULSEBOARD_USE_PRETTY_ROUTES;
  }

  return !isLoopbackHost(window.location.hostname);
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function decodeToken(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function appendIfPresent(params, key, value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

export function buildMatchUrl({ matchId, gameNumber = null } = {}) {
  const id = String(matchId || "").trim();
  const game = parsePositiveInt(gameNumber);
  if (!id) {
    return new URL("./match.html", window.location.href).toString();
  }

  if (shouldUsePrettyRoutes()) {
    const path = game
      ? `/match/${encodeURIComponent(id)}/game/${encodeURIComponent(String(game))}`
      : `/match/${encodeURIComponent(id)}`;
    return new URL(path, window.location.origin).toString();
  }

  const url = new URL("./match.html", window.location.href);
  url.searchParams.set("id", id);
  if (game) {
    url.searchParams.set("game", String(game));
  }
  return url.toString();
}

export function buildTeamUrl({
  teamId,
  game = null,
  matchId = null,
  gameNumber = null,
  opponentId = null,
  teamName = null
} = {}) {
  const id = String(teamId || "").trim();
  if (!id) {
    return new URL("./team.html", window.location.href).toString();
  }

  const base = shouldUsePrettyRoutes()
    ? new URL(`/team/${encodeURIComponent(id)}`, window.location.origin)
    : new URL("./team.html", window.location.href);

  if (!shouldUsePrettyRoutes()) {
    base.searchParams.set("id", id);
  }

  appendIfPresent(base.searchParams, "game", game);
  appendIfPresent(base.searchParams, "match", matchId);
  appendIfPresent(base.searchParams, "opponent", opponentId);
  appendIfPresent(base.searchParams, "team_name", teamName);

  const normalizedGameNumber = parsePositiveInt(gameNumber);
  if (normalizedGameNumber) {
    base.searchParams.set("game_number", String(normalizedGameNumber));
  }

  return base.toString();
}

export function parseMatchRoute(urlLike = window.location.href) {
  const url = new URL(String(urlLike), window.location.origin);
  let id = String(url.searchParams.get("id") || "").trim();
  let gameNumber = parsePositiveInt(url.searchParams.get("game"));

  if (!id) {
    const matched = String(url.pathname || "").match(/\/match\/([^/]+)(?:\/game\/(\d+))?\/?$/i);
    if (matched) {
      id = decodeToken(matched[1]);
      if (!gameNumber) {
        gameNumber = parsePositiveInt(matched[2]);
      }
    }
  }

  return {
    id: id || null,
    gameNumber
  };
}

export function parseTeamRoute(urlLike = window.location.href) {
  const url = new URL(String(urlLike), window.location.origin);
  let id = String(url.searchParams.get("id") || "").trim();

  if (!id) {
    const matched = String(url.pathname || "").match(/\/team\/([^/]+)\/?$/i);
    if (matched) {
      id = decodeToken(matched[1]);
    }
  }

  return {
    id: id || null,
    game: String(url.searchParams.get("game") || "").trim() || null,
    matchId: String(url.searchParams.get("match") || "").trim() || null,
    teamName: String(url.searchParams.get("team_name") || "").trim() || null,
    opponent: String(url.searchParams.get("opponent") || url.searchParams.get("opponent_id") || "").trim() || null,
    gameNumber: parsePositiveInt(url.searchParams.get("game_number")),
    limit: String(url.searchParams.get("limit") || "").trim() || null,
    api: String(url.searchParams.get("api") || "").trim() || null
  };
}

