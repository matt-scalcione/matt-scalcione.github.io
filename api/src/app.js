import { readJsonBody, getUserId, truthy } from "./http/request.js";
import { applyCorsHeaders, sendJson } from "./http/response.js";
import { summarizeSourceUsage } from "./domain/sourcePolicy.js";
import {
  acknowledgeAlertOutboxItems,
  addFollow,
  getAlertOutbox,
  getAlertPreview,
  deleteFollowById,
  getMatchDetail,
  getProviderDiagnostics,
  getProviderCoverageReport,
  getTeamProfile,
  getNotificationPreferences,
  listFollows,
  listLiveMatches,
  listResults,
  listSchedule,
  refreshProviderCaches,
  upsertNotificationPreferences
} from "./data/mockStore.js";

const slowRouteMs = Number.parseInt(process.env.API_SLOW_ROUTE_MS || "750", 10);
const logAllRequests = String(process.env.API_LOG_REQUESTS || "").trim() === "1";
const requestHistoryLimit = Number.parseInt(process.env.API_REQUEST_HISTORY_LIMIT || "80", 10);
const requestHistory = [];

function splitPath(pathname) {
  return pathname.split("/").filter(Boolean);
}

function pushBounded(list, entry, limit = requestHistoryLimit) {
  list.push(entry);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function errorResponse(statusCode, code, message, extraHeaders = {}) {
  return {
    statusCode,
    headers: extraHeaders,
    payload: {
      error: {
        code,
        message
      }
    }
  };
}

function noContentResponse(statusCode = 204) {
  return {
    statusCode,
    headers: {},
    payload: null
  };
}

function okResponse(payload, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers,
    payload
  };
}

function methodNotAllowed(allowedMethods) {
  return errorResponse(405, "method_not_allowed", "Method not allowed.", {
    Allow: allowedMethods.join(", ")
  });
}

function buildLiveMatchesResponse(rows) {
  return buildCollectionResponse(rows, {
    surface: "live"
  });
}

function buildCollectionResponse(rows, { surface } = {}) {
  return {
    data: rows,
    meta: {
      count: rows.length,
      generatedAt: new Date().toISOString(),
      sourceSummary: summarizeSourceUsage(rows, {
        surface
      })
    }
  };
}

function requestLogLine({ method, pathname, statusCode, durationMs }) {
  return `[api] ${method} ${pathname} -> ${statusCode} in ${durationMs.toFixed(1)}ms`;
}

function applyTimingHeaders(res, durationMs) {
  const rounded = Math.max(0, Math.round(durationMs));
  res.setHeader("X-Response-Time-Ms", String(rounded));
  res.setHeader("Server-Timing", `app;dur=${rounded}`);
}

function maybeLogRequestTiming({ method, pathname, statusCode, durationMs }) {
  if (logAllRequests || durationMs >= slowRouteMs || statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.warn(requestLogLine({ method, pathname, statusCode, durationMs }));
  }
}

function recordRequestTiming({ method, pathname, statusCode, durationMs }) {
  pushBounded(requestHistory, {
    timestamp: new Date().toISOString(),
    method,
    pathname,
    statusCode,
    durationMs,
    slow: durationMs >= slowRouteMs
  });
}

function finalizeRequestTiming({ method, pathname, statusCode, durationMs }) {
  maybeLogRequestTiming({ method, pathname, statusCode, durationMs });
  recordRequestTiming({ method, pathname, statusCode, durationMs });
}

function getRequestDiagnostics() {
  const recent = requestHistory.slice().reverse();
  const routeSummary = new Map();

  for (const entry of requestHistory) {
    if (!routeSummary.has(entry.pathname)) {
      routeSummary.set(entry.pathname, {
        pathname: entry.pathname,
        count: 0,
        slowCount: 0,
        errorCount: 0,
        totalDurationMs: 0,
        maxDurationMs: 0
      });
    }

    const target = routeSummary.get(entry.pathname);
    target.count += 1;
    target.totalDurationMs += entry.durationMs;
    target.maxDurationMs = Math.max(target.maxDurationMs, entry.durationMs);
    if (entry.slow) target.slowCount += 1;
    if (entry.statusCode >= 500) target.errorCount += 1;
  }

  const routes = Array.from(routeSummary.values())
    .map((row) => ({
      ...row,
      avgDurationMs: row.count > 0 ? row.totalDurationMs / row.count : 0
    }))
    .sort((left, right) => {
      if (right.slowCount !== left.slowCount) return right.slowCount - left.slowCount;
      return right.avgDurationMs - left.avgDurationMs;
    });

  return {
    slowRouteMs,
    requestHistoryLimit,
    totalRequests: requestHistory.length,
    slowRequests: requestHistory.filter((entry) => entry.slow).length,
    errorRequests: requestHistory.filter((entry) => entry.statusCode >= 500).length,
    recent,
    routes
  };
}

function parseDateQueryValue(value, queryName) {
  if (!value) {
    return { ok: true, value: undefined };
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return {
      ok: false,
      response: errorResponse(
        400,
        "bad_request",
        `${queryName} must be a valid date string (ISO-8601 recommended).`
      )
    };
  }

  return { ok: true, value: timestamp };
}

function parseDateRange(urlObj) {
  const fromResult = parseDateQueryValue(urlObj.searchParams.get("date_from"), "date_from");
  if (!fromResult.ok) {
    return fromResult;
  }

  const toResult = parseDateQueryValue(urlObj.searchParams.get("date_to"), "date_to");
  if (!toResult.ok) {
    return toResult;
  }

  if (
    typeof fromResult.value === "number" &&
    typeof toResult.value === "number" &&
    fromResult.value > toResult.value
  ) {
    return {
      ok: false,
      response: errorResponse(400, "bad_request", "date_from cannot be greater than date_to.")
    };
  }

  return {
    ok: true,
    value: {
      dateFrom: fromResult.value,
      dateTo: toResult.value
    }
  };
}

function parseTierQuery(urlObj, queryName) {
  const raw = urlObj.searchParams.get(queryName);
  if (!raw) {
    return { ok: true, value: undefined };
  }

  const tiers = raw
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((tier) => Number.isInteger(tier));

  if (tiers.length === 0 || tiers.some((tier) => tier < 1 || tier > 4)) {
    return {
      ok: false,
      response: errorResponse(
        400,
        "bad_request",
        `${queryName} must be a comma-separated list using 1,2,3,4.`
      )
    };
  }

  return {
    ok: true,
    value: Array.from(new Set(tiers))
  };
}

function parseDotaTiers(urlObj) {
  return parseTierQuery(urlObj, "dota_tiers");
}

function parseLolTiers(urlObj) {
  return parseTierQuery(urlObj, "lol_tiers");
}

function parseBooleanValue(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return fallback;
}

function parseMatchGameNumber(urlObj) {
  const raw = urlObj.searchParams.get("game");
  if (!raw) {
    return { ok: true, value: undefined };
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    return {
      ok: false,
      response: errorResponse(400, "bad_request", "game must be an integer between 1 and 9.")
    };
  }

  return { ok: true, value: parsed };
}

function parseProviderRefreshBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: true, value: [] };
  }

  const rawProviders = body.providers;
  if (rawProviders === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(rawProviders)) {
    return {
      ok: false,
      response: errorResponse(400, "bad_request", "providers must be an array of provider keys.")
    };
  }

  return {
    ok: true,
    value: rawProviders
  };
}

function parseTeamHistoryLimit(urlObj) {
  const raw = urlObj.searchParams.get("limit");
  if (!raw) {
    return { ok: true, value: 5 };
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return {
      ok: false,
      response: errorResponse(400, "bad_request", "limit must be an integer between 1 and 20.")
    };
  }

  return { ok: true, value: parsed };
}

function isMatchStreamPath(pathParts) {
  return pathParts[0] === "v1" && pathParts[1] === "stream" && pathParts[2] === "matches" && pathParts.length === 4;
}

function streamSnapshotKey(detail) {
  return JSON.stringify({
    status: detail?.status,
    freshness: detail?.freshness?.updatedAt,
    seriesScore: detail?.seriesScore,
    selectedGame: detail?.selectedGame?.number,
    telemetryCounts: detail?.selectedGame?.telemetryCounts || null,
    keyMoments: Array.isArray(detail?.keyMoments) ? detail.keyMoments.length : 0,
    liveTicker: Array.isArray(detail?.liveTicker) ? detail.liveTicker.length : 0,
    objectiveTimeline: Array.isArray(detail?.objectiveTimeline) ? detail.objectiveTimeline.length : 0,
    combatBursts: Array.isArray(detail?.combatBursts) ? detail.combatBursts.length : 0,
    goldMilestones: Array.isArray(detail?.goldMilestones) ? detail.goldMilestones.length : 0
  });
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function handleMatchStream(req, res, { matchId, gameNumber }) {
  const streamHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  };

  for (const [name, value] of Object.entries(streamHeaders)) {
    res.setHeader(name, value);
  }

  res.writeHead(200);
  res.write("retry: 4000\n\n");

  let closed = false;
  let lastKey = null;

  const emitSnapshot = async () => {
    if (closed) {
      return;
    }

    try {
      const detail = await getMatchDetail(matchId, {
        gameNumber
      });

      if (!detail) {
        writeSseEvent(res, "notice", {
          code: "not_found",
          message: `Match '${matchId}' not found.`
        });
        return;
      }

      const nextKey = streamSnapshotKey(detail);
      if (nextKey === lastKey) {
        return;
      }

      lastKey = nextKey;
      writeSseEvent(res, "match", {
        data: detail,
        meta: {
          emittedAt: new Date().toISOString()
        }
      });
    } catch {
      writeSseEvent(res, "notice", {
        code: "stream_error",
        message: "Unable to refresh match snapshot."
      });
    }
  };

  const pollInterval = setInterval(emitSnapshot, 5000);
  const keepAliveInterval = setInterval(() => {
    if (!closed) {
      res.write(": keep-alive\n\n");
    }
  }, 20000);

  req.on("close", () => {
    closed = true;
    clearInterval(pollInterval);
    clearInterval(keepAliveInterval);
  });

  await emitSnapshot();
}

export async function routeRequest({
  method = "GET",
  url = "/",
  headers = {},
  body = null
}) {
  const normalizedMethod = method.toUpperCase();
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  const urlObj = new URL(url, "http://localhost");
  const pathname = urlObj.pathname;
  const pathParts = splitPath(pathname);

  if (pathname === "/health") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return okResponse({
      status: "ok",
      service: "esports-live-api",
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === "/v1/live-matches") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const game = urlObj.searchParams.get("game") || undefined;
    const region = urlObj.searchParams.get("region") || undefined;
    const followedOnly = truthy(urlObj.searchParams.get("followed_only"));
    const parsedDotaTiers = parseDotaTiers(urlObj);
    const parsedLolTiers = parseLolTiers(urlObj);
    const userId = getUserId(normalizedHeaders, urlObj);

    if (!parsedDotaTiers.ok) {
      return parsedDotaTiers.response;
    }

    if (!parsedLolTiers.ok) {
      return parsedLolTiers.response;
    }

    if (followedOnly && !userId) {
      return errorResponse(
        400,
        "bad_request",
        "user_id query parameter or x-user-id header is required when followed_only is true."
      );
    }

    const rows = await listLiveMatches({
      game,
      region,
      followedOnly,
      userId,
      dotaTiers: parsedDotaTiers.value,
      lolTiers: parsedLolTiers.value
    });

    return okResponse(buildLiveMatchesResponse(rows));
  }

  if (pathname === "/v1/schedule") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const game = urlObj.searchParams.get("game") || undefined;
    const region = urlObj.searchParams.get("region") || undefined;
    const dateRange = parseDateRange(urlObj);
    const parsedDotaTiers = parseDotaTiers(urlObj);
    const parsedLolTiers = parseLolTiers(urlObj);

    if (!dateRange.ok) {
      return dateRange.response;
    }

    if (!parsedDotaTiers.ok) {
      return parsedDotaTiers.response;
    }

    if (!parsedLolTiers.ok) {
      return parsedLolTiers.response;
    }

    const rows = await listSchedule({
      game,
      region,
      dateFrom: dateRange.value.dateFrom,
      dateTo: dateRange.value.dateTo,
      dotaTiers: parsedDotaTiers.value,
      lolTiers: parsedLolTiers.value
    });

    return okResponse(buildCollectionResponse(rows, {
      surface: "schedule"
    }));
  }

  if (pathname === "/v1/results") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const game = urlObj.searchParams.get("game") || undefined;
    const region = urlObj.searchParams.get("region") || undefined;
    const dateRange = parseDateRange(urlObj);
    const parsedDotaTiers = parseDotaTiers(urlObj);
    const parsedLolTiers = parseLolTiers(urlObj);

    if (!dateRange.ok) {
      return dateRange.response;
    }

    if (!parsedDotaTiers.ok) {
      return parsedDotaTiers.response;
    }

    if (!parsedLolTiers.ok) {
      return parsedLolTiers.response;
    }

    const rows = await listResults({
      game,
      region,
      dateFrom: dateRange.value.dateFrom,
      dateTo: dateRange.value.dateTo,
      dotaTiers: parsedDotaTiers.value,
      lolTiers: parsedLolTiers.value
    });

    return okResponse(buildCollectionResponse(rows, {
      surface: "results"
    }));
  }

  if (pathname === "/v1/provider-coverage") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const report = await getProviderCoverageReport();
    return okResponse({
      data: report
    });
  }

  if (pathname === "/v1/provider-diagnostics") {
    if (normalizedMethod === "GET") {
      return okResponse({
        data: getProviderDiagnostics()
      });
    }

    if (normalizedMethod === "POST") {
      const parsedBody = parseProviderRefreshBody(body);
      if (!parsedBody.ok) {
        return parsedBody.response;
      }

      const result = await refreshProviderCaches(parsedBody.value);
      return okResponse({
        data: result
      });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (pathname === "/v1/request-diagnostics") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    return okResponse({
      data: getRequestDiagnostics()
    });
  }

  if (pathParts[0] === "v1" && pathParts[1] === "matches" && pathParts.length === 3) {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const matchId = pathParts[2];
    const parsedGame = parseMatchGameNumber(urlObj);
    if (!parsedGame.ok) {
      return parsedGame.response;
    }

    const detail = await getMatchDetail(matchId, {
      gameNumber: parsedGame.value
    });

    if (!detail) {
      return errorResponse(404, "not_found", `Match '${matchId}' not found.`);
    }

    return okResponse({
      data: detail
    });
  }

  if (pathParts[0] === "v1" && pathParts[1] === "teams" && pathParts.length === 3) {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const teamId = pathParts[2];
    const game = urlObj.searchParams.get("game") || undefined;
    const opponentId = urlObj.searchParams.get("opponent_id") || undefined;
    const seedMatchId = urlObj.searchParams.get("seed_match_id") || undefined;
    const teamNameHint = urlObj.searchParams.get("team_name") || undefined;
    const parsedLimit = parseTeamHistoryLimit(urlObj);
    if (!parsedLimit.ok) {
      return parsedLimit.response;
    }

    const profile = await getTeamProfile(teamId, {
      game,
      opponentId,
      seedMatchId,
      teamNameHint,
      limit: parsedLimit.value
    });

    if (!profile) {
      return errorResponse(404, "not_found", `Team '${teamId}' not found.`);
    }

    return okResponse({
      data: profile
    });
  }

  if (pathname === "/v1/follows") {
    if (normalizedMethod === "GET") {
      const userId = getUserId(normalizedHeaders, urlObj);
      if (!userId) {
        return errorResponse(
          400,
          "bad_request",
          "user_id query parameter or x-user-id header is required."
        );
      }

      return okResponse({
        data: listFollows(userId)
      });
    }

    if (normalizedMethod === "POST") {
      if (body === undefined) {
        return errorResponse(400, "bad_request", "Invalid JSON body.");
      }

      const userId = getUserId(normalizedHeaders, urlObj, body);
      const entityType = body?.entityType;
      const entityId = body?.entityId;

      if (!userId || !entityType || !entityId) {
        return errorResponse(400, "bad_request", "userId, entityType, and entityId are required.");
      }

      const follow = addFollow({ userId, entityType, entityId });
      return okResponse(
        {
          data: follow
        },
        201
      );
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (pathname === "/v1/notification-preferences") {
    if (normalizedMethod === "GET") {
      const userId = getUserId(normalizedHeaders, urlObj);
      if (!userId) {
        return errorResponse(
          400,
          "bad_request",
          "user_id query parameter or x-user-id header is required."
        );
      }

      return okResponse({
        data: getNotificationPreferences(userId)
      });
    }

    if (normalizedMethod === "PUT") {
      if (body === undefined) {
        return errorResponse(400, "bad_request", "Invalid JSON body.");
      }

      const userId = getUserId(normalizedHeaders, urlObj, body);
      if (!userId) {
        return errorResponse(400, "bad_request", "userId is required.");
      }

      const next = upsertNotificationPreferences({
        userId,
        webPush: parseBooleanValue(body?.webPush, false),
        emailDigest: parseBooleanValue(body?.emailDigest, false),
        swingAlerts: parseBooleanValue(body?.swingAlerts, false),
        matchStart: parseBooleanValue(body?.matchStart, true),
        matchFinal: parseBooleanValue(body?.matchFinal, true)
      });

      return okResponse({
        data: next
      });
    }

    return methodNotAllowed(["GET", "PUT"]);
  }

  if (pathname === "/v1/alerts-preview") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const userId = getUserId(normalizedHeaders, urlObj);
    if (!userId) {
      return errorResponse(
        400,
        "bad_request",
        "user_id query parameter or x-user-id header is required."
      );
    }

    return okResponse({
      data: await getAlertPreview(userId)
    });
  }

  if (pathname === "/v1/alert-outbox") {
    if (normalizedMethod === "GET") {
      const userId = getUserId(normalizedHeaders, urlObj);
      if (!userId) {
        return errorResponse(
          400,
          "bad_request",
          "user_id query parameter or x-user-id header is required."
        );
      }

      return okResponse({
        data: await getAlertOutbox(userId)
      });
    }

    if (normalizedMethod === "POST") {
      if (body === undefined) {
        return errorResponse(400, "bad_request", "Invalid JSON body.");
      }

      const userId = getUserId(normalizedHeaders, urlObj, body);
      if (!userId) {
        return errorResponse(400, "bad_request", "userId is required.");
      }

      return okResponse({
        data: acknowledgeAlertOutboxItems(userId, body?.alertIds)
      });
    }

    return methodNotAllowed(["GET", "POST"]);
  }

  if (pathParts[0] === "v1" && pathParts[1] === "follows" && pathParts.length === 3) {
    if (normalizedMethod !== "DELETE") {
      return methodNotAllowed(["DELETE"]);
    }

    const followId = pathParts[2];
    const userId = getUserId(normalizedHeaders, urlObj);
    if (!userId) {
      return errorResponse(400, "bad_request", "user_id query parameter or x-user-id header is required.");
    }

    const deleted = deleteFollowById(followId, userId);
    if (!deleted) {
      return errorResponse(404, "not_found", `Follow '${followId}' not found for user.`);
    }

    return noContentResponse();
  }

  return errorResponse(404, "not_found", "Not Found");
}

export function createRequestHandler() {
  return async function requestHandler(req, res) {
    const method = req.method || "GET";
    const url = req.url || "/";
    const headers = req.headers || {};
    const urlObj = new URL(url, "http://localhost");
    const pathParts = splitPath(urlObj.pathname);
    const requestStartedAt = performance.now();

    applyCorsHeaders(res);

    if (method.toUpperCase() === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (isMatchStreamPath(pathParts)) {
      if (method.toUpperCase() !== "GET") {
        const disallowed = methodNotAllowed(["GET"]);
        for (const [name, value] of Object.entries(disallowed.headers || {})) {
          res.setHeader(name, value);
        }
        sendJson(res, disallowed.statusCode, disallowed.payload);
        return;
      }

      const parsedGame = parseMatchGameNumber(urlObj);
      if (!parsedGame.ok) {
        sendJson(res, parsedGame.response.statusCode, parsedGame.response.payload);
        return;
      }

      const matchId = pathParts[3];
      await handleMatchStream(req, res, {
        matchId,
        gameNumber: parsedGame.value
      });
      return;
    }

    let body = null;
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      body = await readJsonBody(req);
    }

    const result = await routeRequest({
      method,
      url,
      headers,
      body
    });

    const durationMs = performance.now() - requestStartedAt;
    applyTimingHeaders(res, durationMs);
    finalizeRequestTiming({
      method,
      pathname: urlObj.pathname,
      statusCode: result.statusCode,
      durationMs
    });

    for (const [name, value] of Object.entries(result.headers || {})) {
      res.setHeader(name, value);
    }

    if (result.statusCode === 204) {
      res.writeHead(204);
      res.end();
      return;
    }

    sendJson(res, result.statusCode, result.payload);
  };
}
