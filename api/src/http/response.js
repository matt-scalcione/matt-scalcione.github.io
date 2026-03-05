export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

export function applyCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Id");
  res.setHeader("Access-Control-Max-Age", "300");
}

export function notFound(res, message = "Not Found") {
  sendJson(res, 404, {
    error: {
      code: "not_found",
      message
    }
  });
}

export function badRequest(res, message) {
  sendJson(res, 400, {
    error: {
      code: "bad_request",
      message
    }
  });
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, {
    error: {
      code: "method_not_allowed",
      message: "Method not allowed."
    }
  });
}
