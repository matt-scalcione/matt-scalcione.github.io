import { createHash } from "node:crypto";
import { fetchJson, fetchText } from "../shared/http.js";

const LIQUIPEDIA_API_URL =
  process.env.LIQUIPEDIA_DOTA_API_URL ||
  process.env.LIQUIDPEDIA_DOTA_API_URL ||
  "https://liquipedia.net/dota2/api.php?action=parse&page=Liquipedia:Matches&prop=text&formatversion=2&format=json";
const LIQUIPEDIA_MATCHES_PAGE_URL =
  process.env.LIQUIPEDIA_DOTA_MATCHES_PAGE_URL ||
  "https://liquipedia.net/dota2/Liquipedia:Matches";
const LIQUIPEDIA_MATCHES_RENDER_URL =
  process.env.LIQUIPEDIA_DOTA_MATCHES_RENDER_URL ||
  "https://liquipedia.net/dota2/index.php?title=Liquipedia:Matches&action=render";
const LIQUIPEDIA_MATCHES_OUTPUT_URL =
  process.env.LIQUIPEDIA_DOTA_MATCHES_OUTPUT_URL ||
  "https://liquipedia.net/dota2/index.php?title=Liquipedia:Matches&output=1";
const LIQUIPEDIA_USER_AGENT =
  process.env.LIQUIDPEDIA_USER_AGENT || "Pulseboard/1.0 (https://matt-scalcione.github.io)";
const LIQUIPEDIA_SCHEDULE_LOOKBACK_MS = Number.parseInt(
  process.env.LIQUIPEDIA_DOTA_SCHEDULE_LOOKBACK_MS || String(2 * 60 * 60 * 1000),
  10
);
const LIQUIPEDIA_API_CACHE_MS = Math.max(
  30000,
  Number.parseInt(process.env.LIQUIPEDIA_DOTA_API_CACHE_MS || "30000", 10)
);

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const input = String(value || "");
  const named = {
    amp: "&",
    quot: "\"",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " "
  };

  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    const lower = String(entity).toLowerCase();
    if (lower in named) {
      return named[lower];
    }
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return full;
  });
}

function stripTags(value) {
  return normalizeWhitespace(decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ")));
}

function cleanLiquipediaName(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(String(value || "").replace(/\s*\(page does not exist\)\s*$/i, ""))
  );
}

function normalizeTeamKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function canonicalDotaTournamentKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/season\s+(\d+)/g, "s$1")
    .replace(/\bgroup stage\b/g, "")
    .replace(/\bplayoffs?\b/g, "")
    .replace(/\bround\s+\d+\b/g, "")
    .replace(/\bday\s+\d+\b/g, "")
    .replace(/\bclosed qualifier\b/g, "qualifier")
    .replace(/\bopen qualifier\b/g, "qualifier")
    .replace(/\bqualifier\b/g, "qualifier")
    .replace(/\bphase\s+\d+\b/g, "")
    .replace(/\bweek\s+\d+\b/g, "")
    .replace(/\b\d{4}(?:-\d{2,4})?\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function absoluteLiquipediaUrl(path) {
  if (!path) {
    return null;
  }
  const decodedPath = decodeHtmlEntities(String(path));
  if (/^https?:\/\//i.test(decodedPath)) {
    return decodedPath;
  }
  return `https://liquipedia.net${decodedPath.startsWith("/") ? decodedPath : `/${decodedPath}`}`;
}

function extractDivBlocks(html, className) {
  const marker = `<div class="${className}"`;
  const blocks = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf(marker, cursor);
    if (start === -1) {
      break;
    }

    let depth = 0;
    let position = start;
    while (position < html.length) {
      const nextOpen = html.indexOf("<div", position);
      const nextClose = html.indexOf("</div>", position);
      if (nextOpen === -1 && nextClose === -1) {
        position = html.length;
        break;
      }

      if (nextOpen !== -1 && (nextOpen < nextClose || nextClose === -1)) {
        depth += 1;
        position = nextOpen + 4;
        continue;
      }

      depth -= 1;
      position = nextClose + 6;
      if (depth === 0) {
        blocks.push(html.slice(start, position));
        cursor = position;
        break;
      }
    }

    if (position >= html.length) {
      break;
    }
  }

  return blocks;
}

function firstMatch(value, pattern) {
  const match = String(value || "").match(pattern);
  return match ? match[1] : null;
}

function extractTeamEntries(headerHtml) {
  const entries = [];
  const pattern =
    /<span class="name"[^>]*>\s*<a href="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/span>/gi;

  let match;
  while ((match = pattern.exec(String(headerHtml || "")))) {
    entries.push({
      href: absoluteLiquipediaUrl(match[1]),
      title: cleanLiquipediaName(stripTags(match[2])),
      shortName: cleanLiquipediaName(stripTags(match[3]))
    });
  }

  return entries;
}

function extractWatchOptions(blockHtml) {
  const linksSection = firstMatch(
    blockHtml,
    /<div class="match-info-links">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
  );
  if (!linksSection) {
    return [];
  }

  const options = [];
  const pattern = /<a href="([^"]+)"[^>]*title="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = pattern.exec(linksSection))) {
    const url = absoluteLiquipediaUrl(match[1]);
    const title = cleanLiquipediaName(stripTags(match[2]));
    if (!url || /[?&]redlink=1\b/i.test(url) || /\/index\.php\?title=Match:/i.test(url) || /\/Match:/i.test(url)) {
      continue;
    }
    const provider = /twitch/i.test(url)
      ? "twitch"
      : /youtube/i.test(url)
        ? "youtube"
        : /kick/i.test(url)
          ? "kick"
          : "stream";
    options.push({
      id: `${provider}_${options.length + 1}`,
      locale: "global",
      label: title || "Watch",
      shortLabel: provider === "youtube" ? "YouTube" : provider === "twitch" ? "Twitch" : provider === "kick" ? "Kick" : "Stream",
      provider,
      watchUrl: url,
      startedAt: null,
      startMillis: null,
      endMillis: null
    });
  }

  return options;
}

function selectPrimaryWatchUrl(watchOptions, tournamentHref) {
  if (Array.isArray(watchOptions) && watchOptions.length > 0) {
    return watchOptions[0].watchUrl || tournamentHref || null;
  }

  return tournamentHref || null;
}

function inferCompetitiveTier(tournamentName, tournamentTierMap) {
  const canonical = canonicalDotaTournamentKey(tournamentName);
  const normalized = String(tournamentName || "").toLowerCase();
  const tier1Patterns = [
    /dreamleague/,
    /pgl wallachia/,
    /esl one/,
    /blast slam/,
    /the international/,
    /riyadh masters/,
    /fissure universe/,
    /betboom dacha/
  ];
  const tier2Patterns = [/cct /, /\bcct\b/, /epl/, /ultras dota pro league/, /res regional/];
  const tier3Patterns = [/destiny league/, /space league/, /national/, /showmatch/];

  const heuristicTier = tier1Patterns.some((pattern) => pattern.test(normalized))
    ? 1
    : tier2Patterns.some((pattern) => pattern.test(normalized))
      ? 2
      : tier3Patterns.some((pattern) => pattern.test(normalized))
        ? 3
        : 2;

  if (canonical && tournamentTierMap.has(canonical)) {
    const mappedTier = Number(tournamentTierMap.get(canonical));
    return Number.isInteger(mappedTier) ? Math.min(mappedTier, heuristicTier) : heuristicTier;
  }

  return heuristicTier;
}

function resolveKnownTeamId(teamName, href, teamIdMap) {
  const normalizedName = normalizeTeamKey(teamName);
  if (normalizedName && teamIdMap.has(normalizedName)) {
    return teamIdMap.get(normalizedName);
  }

  let slugSource = decodeHtmlEntities(String(href || "").trim());
  if (slugSource.includes("title=")) {
    try {
      const parsed = new URL(slugSource, "https://liquipedia.net");
      const title = parsed.searchParams.get("title");
      if (title) {
        slugSource = title;
      }
    } catch {
      slugSource = String(href || "");
    }
  }

  const slug = String(slugSource || teamName || "team")
    .split("/")
    .pop()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `dota_lp_team_${slug}`;
}

function parseBestOf(scoreholderHtml) {
  const label = firstMatch(scoreholderHtml, /<span class="match-info-header-scoreholder-lower">\((Bo\d+)\)<\/span>/i);
  if (!label) {
    return 3;
  }
  const parsed = Number.parseInt(label.replace(/[^0-9]/g, ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}

function inferMatchStatus(blockHtml, { leftScore, rightScore }) {
  if (/data-finished="finished"/i.test(String(blockHtml || ""))) {
    return "completed";
  }

  return leftScore > 0 || rightScore > 0 ? "live" : "upcoming";
}

function stableScheduleId({ timestamp, leftName, rightName, tournamentName }) {
  const seed = [timestamp, leftName, rightName, tournamentName].join("|");
  const digest = createHash("sha1").update(seed).digest("hex").slice(0, 12);
  return `dota_lp_sched_${digest}`;
}

export function parseLiquipediaMatchesHtml(
  html,
  { knownTeamIds = new Map(), tournamentTierMap = new Map(), nowMs = Date.now() } = {}
) {
  const blocks = extractDivBlocks(String(html || ""), "match-info");
  const rows = [];

  for (const block of blocks) {
    const timestampSeconds = Number.parseInt(firstMatch(block, /data-timestamp="(\d+)"/i) || "", 10);
    if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) {
      continue;
    }

    const headerHtml = firstMatch(block, /<div class="match-info-header">([\s\S]*?)<\/div>\s*<div class="match-info-tournament">/i);
    const teams = extractTeamEntries(headerHtml);
    if (teams.length < 2) {
      continue;
    }

    const scoreValues = Array.from(
      String(headerHtml || "").matchAll(/<span class="match-info-header-scoreholder-score">([^<]+)<\/span>/gi)
    ).map((match) => Number.parseInt(stripTags(match[1]), 10));
    const leftScore = Number.isInteger(scoreValues[0]) ? scoreValues[0] : 0;
    const rightScore = Number.isInteger(scoreValues[1]) ? scoreValues[1] : 0;
    const bestOf = parseBestOf(headerHtml);

    const tournamentName =
      cleanLiquipediaName(
        stripTags(
          firstMatch(
            block,
            /<span class="match-info-tournament-name">\s*<a[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/a>\s*<\/span>/i
          )
        )
      ) || "Dota 2";
    const tournamentHref = absoluteLiquipediaUrl(
      firstMatch(block, /<span class="match-info-tournament-name">\s*<a href="([^"]+)"/i)
    );
    const watchOptions = extractWatchOptions(block);
    const status = inferMatchStatus(block, { leftScore, rightScore });
    const startAt = new Date(timestampSeconds * 1000).toISOString();
    const competitiveTier = inferCompetitiveTier(tournamentName, tournamentTierMap);
    const leftName = cleanLiquipediaName(teams[0].title || teams[0].shortName || "Radiant");
    const rightName = cleanLiquipediaName(teams[1].title || teams[1].shortName || "Dire");

    rows.push({
      id: stableScheduleId({
        timestamp: timestampSeconds,
        leftName,
        rightName,
        tournamentName
      }),
      providerMatchId: `liquipedia_${timestampSeconds}`,
      sourceMatchId: null,
      game: "dota2",
      region: "global",
      tournament: tournamentName,
      tournamentUrl: tournamentHref,
      competitiveTier,
      status,
      startAt,
      updatedAt: new Date(nowMs).toISOString(),
      bestOf,
      seriesScore: {
        left: leftScore,
        right: rightScore
      },
      teams: {
        left: {
          id: resolveKnownTeamId(leftName, teams[0].href, knownTeamIds),
          name: leftName,
          shortName: teams[0].shortName || leftName,
          sourceUrl: teams[0].href || null
        },
        right: {
          id: resolveKnownTeamId(rightName, teams[1].href, knownTeamIds),
          name: rightName,
          shortName: teams[1].shortName || rightName,
          sourceUrl: teams[1].href || null
        }
      },
      keySignal: "provider_schedule",
      watchUrl: selectPrimaryWatchUrl(watchOptions, tournamentHref),
      watchOptions,
      source: {
        provider: "liquipedia",
        page: "Liquipedia:Matches"
      }
    });
  }

  return rows;
}

export class LiquipediaDotaScheduleProvider {
  constructor({ timeoutMs = 15000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.scheduleCache = {
      fetchedAt: 0,
      html: "",
      error: null
    };
  }

  extractParseHtml(payload) {
    const direct = payload?.parse?.text;
    if (typeof direct === "string") {
      return direct;
    }

    if (direct && typeof direct === "object" && typeof direct["*"] === "string") {
      return direct["*"];
    }

    return "";
  }

  async fetchFallbackHtml() {
    const fallbackTargets = [LIQUIPEDIA_MATCHES_RENDER_URL, LIQUIPEDIA_MATCHES_PAGE_URL, LIQUIPEDIA_MATCHES_OUTPUT_URL];
    const fallbackHeaders = {
      "user-agent": LIQUIPEDIA_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9"
    };
    const errors = [];

    for (const url of fallbackTargets) {
      try {
        const html = await fetchText(url, {
          timeoutMs: this.timeoutMs,
          headers: fallbackHeaders
        });
        if (html && html.includes("match-info")) {
          return html;
        }

        errors.push(`No usable Dota schedule markup from ${url}`);
      } catch (error) {
        errors.push(error?.message || String(error));
      }
    }

    throw new Error(errors.join(" | "));
  }

  async fetchScheduleHtml() {
    const ageMs = Date.now() - this.scheduleCache.fetchedAt;
    if (ageMs <= LIQUIPEDIA_API_CACHE_MS && this.scheduleCache.html) {
      return this.scheduleCache.html;
    }

    const headers = {
      "user-agent": LIQUIPEDIA_USER_AGENT,
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9"
    };

    let html = "";
    let lastError = null;

    try {
      const payload = await fetchJson(LIQUIPEDIA_API_URL, {
        timeoutMs: this.timeoutMs,
        headers
      });
      html = this.extractParseHtml(payload);
      if (!html || !html.includes("match-info")) {
        throw new Error("Liquipedia parse API returned no usable Dota schedule markup.");
      }
    } catch (error) {
      lastError = error;
      html = await this.fetchFallbackHtml();
      if (!html || !html.includes("match-info")) {
        const detail = error?.message || String(error);
        throw new Error(`Liquipedia HTML fallback returned no usable Dota schedule markup after ${detail}`);
      }
    }

    this.scheduleCache = {
      fetchedAt: Date.now(),
      html,
      error: lastError ? (lastError?.message || String(lastError)) : null
    };

    return html;
  }

  async fetchScheduleMatches({ knownRows = [], allowedTiers = [1, 2, 3, 4] } = {}) {
    const html = await this.fetchScheduleHtml();

    const teamIdMap = new Map();
    const tournamentTierMap = new Map();

    for (const row of Array.isArray(knownRows) ? knownRows : []) {
      if (row?.game !== "dota2") {
        continue;
      }

      const leftName = row?.teams?.left?.name;
      const rightName = row?.teams?.right?.name;
      if (leftName && row?.teams?.left?.id) {
        teamIdMap.set(normalizeTeamKey(leftName), String(row.teams.left.id));
      }
      if (rightName && row?.teams?.right?.id) {
        teamIdMap.set(normalizeTeamKey(rightName), String(row.teams.right.id));
      }
      if (row?.tournament && typeof row?.competitiveTier === "number") {
        tournamentTierMap.set(canonicalDotaTournamentKey(row.tournament), row.competitiveTier);
      }
    }

    return parseLiquipediaMatchesHtml(html, {
      knownTeamIds: teamIdMap,
      tournamentTierMap
    })
      .filter((row) => row.status !== "completed")
      .filter((row) => {
        const startMs = Date.parse(String(row?.startAt || ""));
        if (Number.isNaN(startMs)) {
          return false;
        }

        if (row.status === "live") {
          return true;
        }

        return startMs >= Date.now() - LIQUIPEDIA_SCHEDULE_LOOKBACK_MS;
      })
      .filter((row) =>
        !Array.isArray(allowedTiers) || allowedTiers.length === 0
          ? true
          : allowedTiers.includes(Number(row.competitiveTier))
      );
  }
}
