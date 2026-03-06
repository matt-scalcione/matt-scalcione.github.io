const DEFAULT_SITE_ORIGIN = "https://matt-scalcione.github.io";

function isLoopbackHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin() {
  const configured =
    normalizeOrigin(window.PULSEBOARD_SITE_ORIGIN) ||
    normalizeOrigin(window.PULSEBOARD_CONFIG?.siteOrigin) ||
    normalizeOrigin(window.PULSEBOARD_CONFIG?.origin);
  if (configured) {
    return configured;
  }

  if (isLoopbackHost(window.location.hostname)) {
    return window.location.origin;
  }

  return DEFAULT_SITE_ORIGIN;
}

export function toAbsoluteSiteUrl(pathOrUrl = "/") {
  const raw = String(pathOrUrl || "/").trim() || "/";
  try {
    const resolved = new URL(raw, resolveSiteOrigin());
    return resolved.toString();
  } catch {
    return new URL("/", resolveSiteOrigin()).toString();
  }
}

function upsertMeta({ selector, attrName, attrValue, content }) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attrName, attrValue);
    document.head.append(node);
  }

  node.setAttribute("content", String(content || ""));
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.append(node);
  }

  node.setAttribute("href", href);
}

function sanitizeText(value, fallback = "Pulseboard") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  return text.replace(/\s+/g, " ").slice(0, 180);
}

export function inferRobotsDirective({ allowedQueryParams = [] } = {}) {
  if (isLoopbackHost(window.location.hostname)) {
    return "noindex,nofollow";
  }

  const url = new URL(window.location.href);
  const blockedParams = new Set(["api", "stream"]);
  for (const blocked of blockedParams) {
    if (url.searchParams.has(blocked)) {
      return "noindex,follow";
    }
  }

  const allowed = new Set(allowedQueryParams.map((key) => String(key)));
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      return "noindex,follow";
    }
  }

  return "index,follow";
}

export function buildCanonicalPath({
  pathname = window.location.pathname,
  allowedQueryParams = []
} = {}) {
  const cleanPathname = String(pathname || "/").startsWith("/")
    ? String(pathname || "/")
    : `/${String(pathname || "")}`;

  const current = new URL(window.location.href);
  const allowed = new Set(allowedQueryParams.map((key) => String(key)));
  const nextParams = new URLSearchParams();

  for (const key of allowed) {
    const value = current.searchParams.get(key);
    if (value !== null && value !== "") {
      nextParams.set(key, value);
    }
  }

  const query = nextParams.toString();
  return `${cleanPathname}${query ? `?${query}` : ""}`;
}

export function applySeo({
  title,
  description,
  canonicalPath,
  robots,
  ogType = "website"
}) {
  const safeTitle = sanitizeText(title, "Pulseboard");
  const safeDescription = sanitizeText(
    description,
    "Live esports scores, series context, and match detail for League of Legends and Dota 2."
  );
  const canonicalUrl = toAbsoluteSiteUrl(canonicalPath || window.location.pathname);
  const safeRobots = sanitizeText(robots, "index,follow").toLowerCase();

  document.title = safeTitle;
  upsertCanonical(canonicalUrl);
  upsertMeta({
    selector: 'meta[name="description"]',
    attrName: "name",
    attrValue: "description",
    content: safeDescription
  });
  upsertMeta({
    selector: 'meta[name="robots"]',
    attrName: "name",
    attrValue: "robots",
    content: safeRobots
  });
  upsertMeta({
    selector: 'meta[property="og:site_name"]',
    attrName: "property",
    attrValue: "og:site_name",
    content: "Pulseboard"
  });
  upsertMeta({
    selector: 'meta[property="og:type"]',
    attrName: "property",
    attrValue: "og:type",
    content: sanitizeText(ogType, "website")
  });
  upsertMeta({
    selector: 'meta[property="og:title"]',
    attrName: "property",
    attrValue: "og:title",
    content: safeTitle
  });
  upsertMeta({
    selector: 'meta[property="og:description"]',
    attrName: "property",
    attrValue: "og:description",
    content: safeDescription
  });
  upsertMeta({
    selector: 'meta[property="og:url"]',
    attrName: "property",
    attrValue: "og:url",
    content: canonicalUrl
  });
  upsertMeta({
    selector: 'meta[name="twitter:card"]',
    attrName: "name",
    attrValue: "twitter:card",
    content: "summary_large_image"
  });
  upsertMeta({
    selector: 'meta[name="twitter:title"]',
    attrName: "name",
    attrValue: "twitter:title",
    content: safeTitle
  });
  upsertMeta({
    selector: 'meta[name="twitter:description"]',
    attrName: "name",
    attrValue: "twitter:description",
    content: safeDescription
  });
}

export function setJsonLd(id, data) {
  const safeId = String(id || "default").trim() || "default";
  const selector = `script[type="application/ld+json"][data-seo-id="${safeId}"]`;
  const existing = document.head.querySelector(selector);

  if (!data) {
    if (existing) {
      existing.remove();
    }
    return;
  }

  const payload = JSON.stringify(data);
  if (existing) {
    existing.textContent = payload;
    return;
  }

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-seo-id", safeId);
  script.textContent = payload;
  document.head.append(script);
}

export function gameLabel(game) {
  const value = String(game || "").toLowerCase();
  if (value === "lol") {
    return "League of Legends";
  }
  if (value === "dota2") {
    return "Dota 2";
  }
  return "Esports";
}

export function normalizeGameKey(value) {
  const key = String(value || "").toLowerCase().trim();
  if (key === "lol" || key === "leagueoflegends") {
    return "lol";
  }
  if (key === "dota" || key === "dota2") {
    return "dota2";
  }
  return null;
}
