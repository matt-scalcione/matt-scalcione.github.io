import { readJsonBody, getUserId, truthy } from "./http/request.js";
import { applyCorsHeaders, sendJson } from "./http/response.js";
import {
  addFollow,
  deleteFollowById,
  getMatchDetail,
  getProviderCoverageReport,
  getTeamProfile,
  getNotificationPreferences,
  listFollows,
  listLiveMatches,
  listResults,
  listSchedule,
  upsertNotificationPreferences
} from "./data/mockStore.js";

function splitPath(pathname) {
  return pathname.split("/").filter(Boolean);
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
  return {
    data: rows,
    meta: {
      count: rows.length,
      generatedAt: new Date().toISOString()
    }
  };
}

function buildCollectionResponse(rows) {
  return {
    data: rows,
    meta: {
      count: rows.length,
      generatedAt: new Date().toISOString()
    }
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

function parseDotaTiers(urlObj) {
  const raw = urlObj.searchParams.get("dota_tiers");
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
      response: errorResponse(400, "bad_request", "dota_tiers must be a comma-separated list using 1,2,3,4.")
    };
  }

  return {
    ok: true,
    value: Array.from(new Set(tiers))
  };
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
    const parsedTiers = parseDotaTiers(urlObj);
    const userId = getUserId(normalizedHeaders, urlObj);

    if (!parsedTiers.ok) {
      return parsedTiers.response;
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
      dotaTiers: parsedTiers.value
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
    const parsedTiers = parseDotaTiers(urlObj);

    if (!dateRange.ok) {
      return dateRange.response;
    }

    if (!parsedTiers.ok) {
      return parsedTiers.response;
    }

    const rows = await listSchedule({
      game,
      region,
      dateFrom: dateRange.value.dateFrom,
      dateTo: dateRange.value.dateTo,
      dotaTiers: parsedTiers.value
    });

    return okResponse(buildCollectionResponse(rows));
  }

  if (pathname === "/v1/results") {
    if (normalizedMethod !== "GET") {
      return methodNotAllowed(["GET"]);
    }

    const game = urlObj.searchParams.get("game") || undefined;
    const region = urlObj.searchParams.get("region") || undefined;
    const dateRange = parseDateRange(urlObj);
    const parsedTiers = parseDotaTiers(urlObj);

    if (!dateRange.ok) {
      return dateRange.response;
    }

    if (!parsedTiers.ok) {
      return parsedTiers.response;
    }

    const rows = await listResults({
      game,
      region,
      dateFrom: dateRange.value.dateFrom,
      dateTo: dateRange.value.dateTo,
      dotaTiers: parsedTiers.value
    });

    return okResponse(buildCollectionResponse(rows));
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
