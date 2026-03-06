import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SITE_ORIGIN = "https://matt-scalcione.github.io";
const rootDir = process.cwd();

function normalizeOrigin(raw, fallback = DEFAULT_SITE_ORIGIN) {
  const value = String(raw || "").trim();
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

function canonicalFromHtml(html) {
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || null;
}

function metaContent(html, name, attr = "name") {
  const escapedName = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${escapedName}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match?.[1] || null;
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function parseLocEntries(xml) {
  const entries = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  let match = regex.exec(xml);
  while (match) {
    entries.push(decodeXmlEntities(match[1]));
    match = regex.exec(xml);
  }
  return entries;
}

function fileExists(absPath) {
  return fs
    .access(absPath)
    .then(() => true)
    .catch(() => false);
}

function formatErrors(errors) {
  return errors.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
}

async function validateHtmlPages(siteOrigin) {
  const errors = [];
  const pages = [
    { file: "index.html", robotsShouldInclude: "index", expectedCanonicalPath: "/index.html" },
    { file: "schedule.html", robotsShouldInclude: "index", expectedCanonicalPath: "/schedule.html" },
    { file: "follows.html", robotsShouldInclude: "noindex", expectedCanonicalPath: "/follows.html" },
    { file: "team.html", robotsShouldInclude: "noindex", expectedCanonicalPath: "/team.html" },
    { file: "match.html", robotsShouldInclude: "noindex", expectedCanonicalPath: "/match.html" }
  ];

  for (const page of pages) {
    const absPath = path.resolve(rootDir, page.file);
    const html = await fs.readFile(absPath, "utf8");

    const description = metaContent(html, "description");
    if (!description || description.trim().length < 25) {
      errors.push(`${page.file}: missing or too-short meta description`);
    }

    const robots = metaContent(html, "robots");
    if (!robots) {
      errors.push(`${page.file}: missing robots meta`);
    } else if (!robots.toLowerCase().includes(page.robotsShouldInclude)) {
      errors.push(`${page.file}: robots meta must include "${page.robotsShouldInclude}"`);
    }

    const canonical = canonicalFromHtml(html);
    if (!canonical) {
      errors.push(`${page.file}: missing canonical link`);
      continue;
    }

    try {
      const canonicalUrl = new URL(canonical);
      if (canonicalUrl.origin !== siteOrigin) {
        errors.push(`${page.file}: canonical origin must be ${siteOrigin}, got ${canonicalUrl.origin}`);
      }
      if (canonicalUrl.pathname !== page.expectedCanonicalPath) {
        errors.push(
          `${page.file}: canonical path must be ${page.expectedCanonicalPath}, got ${canonicalUrl.pathname}`
        );
      }
    } catch {
      errors.push(`${page.file}: canonical is not a valid absolute URL`);
    }
  }

  return errors;
}

async function validateRobots(siteOrigin) {
  const errors = [];
  const robotsPath = path.resolve(rootDir, "robots.txt");
  const robots = await fs.readFile(robotsPath, "utf8");
  const requiredLines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /follows.html",
    "Disallow: /*?api=",
    "Disallow: /*&api=",
    "Disallow: /*?stream=",
    "Disallow: /*&stream=",
    `Sitemap: ${siteOrigin}/sitemap.xml`
  ];

  for (const line of requiredLines) {
    if (!robots.includes(line)) {
      errors.push(`robots.txt: missing line "${line}"`);
    }
  }

  return errors;
}

async function validateSitemap(siteOrigin) {
  const errors = [];
  const sitemapPath = path.resolve(rootDir, "sitemap.xml");
  const xml = await fs.readFile(sitemapPath, "utf8");
  const locEntries = parseLocEntries(xml);

  if (locEntries.length < 8) {
    errors.push(`sitemap.xml: expected at least 8 URLs, found ${locEntries.length}`);
  }

  const seen = new Set();
  const blockedParams = new Set(["api", "stream", "opponent", "opponent_id", "h2h_limit"]);
  const allowedPaths = new Set(["/index.html", "/schedule.html", "/match.html", "/team.html"]);

  for (const raw of locEntries) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      errors.push(`sitemap.xml: invalid URL in <loc>: ${raw}`);
      continue;
    }

    if (url.origin !== siteOrigin) {
      errors.push(`sitemap.xml: URL origin must be ${siteOrigin}, got ${url.origin}`);
    }

    if (!allowedPaths.has(url.pathname)) {
      errors.push(`sitemap.xml: unsupported path "${url.pathname}" in URL ${raw}`);
    }

    const key = url.toString();
    if (seen.has(key)) {
      errors.push(`sitemap.xml: duplicate URL ${raw}`);
    } else {
      seen.add(key);
    }

    for (const param of url.searchParams.keys()) {
      if (blockedParams.has(param)) {
        errors.push(`sitemap.xml: blocked query param "${param}" appears in URL ${raw}`);
      }
    }

    if (url.pathname === "/match.html" && !url.searchParams.get("id")) {
      errors.push(`sitemap.xml: match URL missing id param: ${raw}`);
    }
    if (url.pathname === "/team.html" && !url.searchParams.get("id")) {
      errors.push(`sitemap.xml: team URL missing id param: ${raw}`);
    }
  }

  const mustHave = [
    `${siteOrigin}/index.html`,
    `${siteOrigin}/schedule.html`
  ];
  for (const required of mustHave) {
    if (!seen.has(required)) {
      errors.push(`sitemap.xml: missing required URL ${required}`);
    }
  }

  // File existence checks for mapped static pages.
  for (const mappedPath of allowedPaths) {
    const fileName = mappedPath.slice(1);
    if (!(await fileExists(path.resolve(rootDir, fileName)))) {
      errors.push(`sitemap.xml: mapped file does not exist for path ${mappedPath}`);
    }
  }

  return errors;
}

async function main() {
  const siteOrigin = normalizeOrigin(process.env.PULSEBOARD_SITE_ORIGIN, DEFAULT_SITE_ORIGIN);
  const errors = [];

  const htmlErrors = await validateHtmlPages(siteOrigin);
  errors.push(...htmlErrors);

  const robotsErrors = await validateRobots(siteOrigin);
  errors.push(...robotsErrors);

  const sitemapErrors = await validateSitemap(siteOrigin);
  errors.push(...sitemapErrors);

  if (errors.length > 0) {
    console.error(`SEO check failed with ${errors.length} issue(s):\n${formatErrors(errors)}`);
    process.exitCode = 1;
    return;
  }

  console.log("SEO check passed: canonical, robots, and sitemap validations are healthy.");
}

main().catch((error) => {
  console.error(`SEO check script failed unexpectedly: ${error?.message || error}`);
  process.exitCode = 1;
});

