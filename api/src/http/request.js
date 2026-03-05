export async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function getUserId(headers, urlObj, body = null) {
  return (
    headers["x-user-id"] ||
    urlObj.searchParams.get("user_id") ||
    (body && body.userId) ||
    null
  );
}

export function truthy(value) {
  return value === "1" || value === "true" || value === true;
}
