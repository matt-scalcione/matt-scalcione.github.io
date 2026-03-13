import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_SITE_ORIGIN = "https://matt-scalcione.github.io";
const DEFAULT_API_BASE = "https://api.pulseboard.mindpointdesign.opalstacked.com";
const STATIC_LASTMOD = new Date().toISOString().slice(0, 10);
const MAX_MATCH_URLS = 800;
const MAX_TEAM_URLS = 500;

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeOrigin(raw, fallback) {
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

function normalizeApiBase(raw, fallback) {
  const value = String(raw || "").trim();
  if (!value) {
    return fallback;
  }

  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function isoDate(value, fallback = STATIC_LASTMOD) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function toUrlEntryXml(entry) {
  const parts = [
    `    <loc>${xmlEscape(entry.loc)}</loc>`,
    `    <lastmod>${xmlEscape(entry.lastmod || STATIC_LASTMOD)}</lastmod>`,
    `    <changefreq>${xmlEscape(entry.changefreq || "daily")}</changefreq>`,
    `    <priority>${xmlEscape(String(entry.priority ?? "0.5"))}</priority>`
  ];
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

async function fetchCollection(apiBase, endpoint, query = "") {
  const url = `${apiBase}${endpoint}${query ? `?${query}` : ""}`;
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed ${endpoint}: ${payload?.error?.message || response.status}`);
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

function appendStaticEntries(entries, siteOrigin) {
  entries.push(
    { loc: `${siteOrigin}/index.html`, lastmod: STATIC_LASTMOD, changefreq: "always", priority: "1.0" },
    { loc: `${siteOrigin}/index.html?title=lol`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.95" },
    { loc: `${siteOrigin}/index.html?title=dota2`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.95" },
    { loc: `${siteOrigin}/lol.html`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.92" },
    { loc: `${siteOrigin}/dota2.html`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.92" },
    { loc: `${siteOrigin}/schedule.html`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.9" },
    { loc: `${siteOrigin}/schedule.html?view=schedule`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.85" },
    { loc: `${siteOrigin}/schedule.html?view=results`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.85" },
    { loc: `${siteOrigin}/schedule.html?title=lol`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.88" },
    { loc: `${siteOrigin}/schedule.html?title=dota2`, lastmod: STATIC_LASTMOD, changefreq: "hourly", priority: "0.88" }
  );
}

function addMatchEntries(entries, siteOrigin, rows) {
  const matchRows = rows
    .filter((row) => row && row.id)
    .slice(0, MAX_MATCH_URLS);

  for (const row of matchRows) {
    const status = String(row?.status || "").toLowerCase();
    const priority = status === "live" ? "0.92" : status === "upcoming" ? "0.86" : "0.82";
    const changefreq = status === "live" ? "hourly" : status === "upcoming" ? "daily" : "weekly";
    entries.push({
      loc: `${siteOrigin}/match.html?id=${encodeURIComponent(String(row.id))}`,
      lastmod: isoDate(row.updatedAt || row.startAt),
      changefreq,
      priority
    });
  }
}

function addTeamEntries(entries, siteOrigin, rows) {
  const seen = new Set();
  const teamEntries = [];

  for (const row of rows) {
    const game = String(row?.game || "").trim();
    const stamp = isoDate(row?.updatedAt || row?.startAt);
    const teams = [row?.teams?.left, row?.teams?.right];
    for (const team of teams) {
      const teamId = String(team?.id || "").trim();
      if (!teamId) {
        continue;
      }

      const params = new URLSearchParams();
      params.set("id", teamId);
      if (game) {
        params.set("game", game);
      }
      const loc = `${siteOrigin}/team.html?${params.toString()}`;
      if (seen.has(loc)) {
        continue;
      }
      seen.add(loc);
      teamEntries.push({
        loc,
        lastmod: stamp,
        changefreq: "daily",
        priority: "0.74"
      });
      if (teamEntries.length >= MAX_TEAM_URLS) {
        break;
      }
    }
    if (teamEntries.length >= MAX_TEAM_URLS) {
      break;
    }
  }

  entries.push(...teamEntries);
}

function dedupeEntries(entries) {
  const byLoc = new Map();
  for (const entry of entries) {
    const loc = String(entry?.loc || "").trim();
    if (!loc) {
      continue;
    }

    const existing = byLoc.get(loc);
    if (!existing) {
      byLoc.set(loc, entry);
      continue;
    }

    const existingStamp = Date.parse(existing.lastmod || "");
    const nextStamp = Date.parse(entry.lastmod || "");
    if (Number.isFinite(nextStamp) && (!Number.isFinite(existingStamp) || nextStamp > existingStamp)) {
      existing.lastmod = entry.lastmod;
    }

    if (Number(entry.priority) > Number(existing.priority)) {
      existing.priority = entry.priority;
    }
  }

  return Array.from(byLoc.values());
}

async function main() {
  const siteOrigin = normalizeOrigin(process.env.PULSEBOARD_SITE_ORIGIN, DEFAULT_SITE_ORIGIN);
  const apiBase = normalizeApiBase(process.env.PULSEBOARD_API_BASE, DEFAULT_API_BASE);
  const indexDetailPages = toBoolean(process.env.PULSEBOARD_INDEX_DETAIL_PAGES, false);

  const now = Date.now();
  const from = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({ date_from: from, date_to: to }).toString();

  const [liveRows, scheduleRows, resultRows] = await Promise.all([
    fetchCollection(apiBase, "/v1/live-matches"),
    fetchCollection(apiBase, "/v1/schedule", query),
    fetchCollection(apiBase, "/v1/results", query)
  ]);

  const allRows = [...liveRows, ...scheduleRows, ...resultRows];
  const entries = [];
  appendStaticEntries(entries, siteOrigin);
  if (indexDetailPages) {
    addMatchEntries(entries, siteOrigin, allRows);
    addTeamEntries(entries, siteOrigin, allRows);
  }

  const finalEntries = dedupeEntries(entries);
  finalEntries.sort((left, right) => {
    const l = String(left.loc || "");
    const r = String(right.loc || "");
    return l.localeCompare(r);
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...finalEntries.map(toUrlEntryXml),
    "</urlset>",
    ""
  ].join("\n");

  const outputPath = path.resolve(process.cwd(), "sitemap.xml");
  await fs.writeFile(outputPath, xml, "utf8");
  console.log(
    `Generated sitemap.xml with ${finalEntries.length} URLs (${liveRows.length} live, ${scheduleRows.length} schedule, ${resultRows.length} results, indexDetailPages=${indexDetailPages}).`
  );
}

main().catch((error) => {
  console.error(`Sitemap generation failed: ${error?.message || error}`);
  process.exitCode = 1;
});
