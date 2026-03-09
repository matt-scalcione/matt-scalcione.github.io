import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  LiquipediaDotaScheduleProvider,
  parseLiquipediaMatchesHtml
} from "../src/providers/dota/liquipediaScheduleProvider.js";

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

const sampleMatchHtml = `
<div class="match-info">
  <span class="match-info-countdown">
    <span class="timer-object" data-format="full" data-timestamp="1772899200">March 7, 2026 - 18:00 EET</span>
  </span>
  <div class="match-info-header">
    <div class="match-info-header-opponent match-info-header-opponent-left">
      <div class="block-team flipped">
        <span class="name"><a href="/dota2/Team_Liquid" title="Team Liquid">Liquid</a></span>
      </div>
    </div>
    <div class="match-info-header-scoreholder">
      <span class="match-info-header-scoreholder-scorewrapper">
        <span class="match-info-header-scoreholder-upper">
          <span class="match-info-header-scoreholder-score">0</span>
          <span class="match-info-header-scoreholder-divider">:</span>
          <span class="match-info-header-scoreholder-score">0</span>
        </span>
        <span class="match-info-header-scoreholder-lower">(Bo3)</span>
      </span>
    </div>
    <div class="match-info-header-opponent">
      <div class="block-team">
        <span class="name"><a href="/dota2/index.php?title=Cloud_Rising&amp;action=edit&amp;redlink=1" title="Cloud Rising (page does not exist)">CR</a></span>
      </div>
    </div>
  </div>
  <div class="match-info-tournament">
    <span class="match-info-tournament-wrapper">
      <span class="match-info-tournament-name">
        <a href="/dota2/PGL/Wallachia/7/Group_Stage#Round_1" title="PGL/Wallachia/7/Group Stage">
          <span>PGL Wallachia S7 - Round 1</span>
        </a>
      </span>
    </span>
  </div>
  <div class="match-info-links">
    <div>
      <a href="/dota2/index.php?title=Match:ID_foo&amp;action=edit&amp;redlink=1" class="new" title="Match:ID foo (page does not exist)">
        <div>+ Details</div>
      </a>
    </div>
    <div>
      <a href="/dota2/Special:Stream/twitch/PGL_Dota2" title="Special:Stream/twitch/PGL Dota2">
        <div>Watch now</div>
      </a>
    </div>
    <div>
      <a href="/dota2/Special:Stream/youtube/PGL/wjldm2iu318" title="Special:Stream/youtube/PGL/wjldm2iu318">
        <div>Watch now</div>
      </a>
    </div>
  </div>
</div>`;

function withTimestamp(html, timestampSeconds) {
  return html.replace(/data-timestamp="\d+"/, `data-timestamp="${timestampSeconds}"`);
}

function withScore(html, leftScore, rightScore) {
  return html.replace(
    /<span class="match-info-header-scoreholder-upper">[\s\S]*?<\/span>\s*<span class="match-info-header-scoreholder-lower">/i,
    `<span class="match-info-header-scoreholder-upper">
          <span class="match-info-header-scoreholder-score">${leftScore}</span>
          <span class="match-info-header-scoreholder-divider">:</span>
          <span class="match-info-header-scoreholder-score">${rightScore}</span>
        </span>
        <span class="match-info-header-scoreholder-lower">`
  );
}

function withFinished(html) {
  return html.replace('data-format="full"', 'data-format="full" data-finished="finished"');
}

describe("parseLiquipediaMatchesHtml", () => {
  it("normalizes upcoming rows, cleans redlinks, and keeps only usable stream links", () => {
    const rows = parseLiquipediaMatchesHtml(sampleMatchHtml, {
      knownTeamIds: new Map([["teamliquid", "team_liq"]]),
      tournamentTierMap: new Map(),
      nowMs: Date.parse("2026-03-07T14:00:00.000Z")
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].bestOf, 3);
    assert.equal(rows[0].competitiveTier, 1);
    assert.equal(rows[0].teams.left.id, "team_liq");
    assert.equal(rows[0].teams.right.id, "dota_lp_team_cloud_rising");
    assert.equal(rows[0].teams.right.name, "Cloud Rising");
    assert.equal(rows[0].watchUrl, "https://liquipedia.net/dota2/Special:Stream/twitch/PGL_Dota2");
    assert.deepEqual(
      rows[0].watchOptions.map((option) => option.provider),
      ["twitch", "youtube"]
    );
  });

  it("marks finished scored rows as completed instead of live", () => {
    const rows = parseLiquipediaMatchesHtml(withFinished(withScore(sampleMatchHtml, 2, 1)), {
      knownTeamIds: new Map(),
      tournamentTierMap: new Map(),
      nowMs: Date.parse("2026-03-07T20:30:00.000Z")
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "completed");
  });
});

describe("LiquipediaDotaScheduleProvider", () => {
  it("uses the API-only parse payload, caches it, and preserves premium-tier heuristics over weaker known mappings", async () => {
    const originalFetch = global.fetch;
    let fetchCalls = 0;
    const futureTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
    const freshHtml = sampleMatchHtml.replace("1772899200", String(futureTimestamp));
    const html = `${freshHtml}
    <div class="match-info">
      <span class="match-info-countdown">
        <span class="timer-object" data-format="full" data-timestamp="1772600000">March 4, 2026 - 06:53 EET</span>
      </span>
      <div class="match-info-header">
        <div class="match-info-header-opponent match-info-header-opponent-left">
          <div class="block-team flipped"><span class="name"><a href="/dota2/Old_A" title="Old A">Old A</a></span></div>
        </div>
        <div class="match-info-header-scoreholder">
          <span class="match-info-header-scoreholder-scorewrapper">
            <span class="match-info-header-scoreholder-upper">
              <span class="match-info-header-scoreholder-score">0</span>
              <span class="match-info-header-scoreholder-divider">:</span>
              <span class="match-info-header-scoreholder-score">0</span>
            </span>
            <span class="match-info-header-scoreholder-lower">(Bo3)</span>
          </span>
        </div>
        <div class="match-info-header-opponent">
          <div class="block-team"><span class="name"><a href="/dota2/Old_B" title="Old B">Old B</a></span></div>
        </div>
      </div>
      <div class="match-info-tournament">
        <span class="match-info-tournament-wrapper">
          <span class="match-info-tournament-name"><a href="/dota2/Old/Event" title="Old/Event"><span>Old Event</span></a></span>
        </span>
      </div>
      <div class="match-info-links"></div>
    </div>`;

    global.fetch = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        async json() {
          return {
            parse: {
              text: {
                "*": html
              }
            }
          };
        }
      };
    };

    try {
      const provider = new LiquipediaDotaScheduleProvider({ timeoutMs: 1000 });
      const firstRows = await provider.fetchScheduleMatches({
        knownRows: [
          {
            game: "dota2",
            tournament: "PGL Wallachia S7 - Round 1",
            competitiveTier: 2,
            teams: {
              left: { id: "team_liq", name: "Team Liquid" },
              right: { id: "team_other", name: "Other" }
            }
          }
        ]
      });
      const secondRows = await provider.fetchScheduleMatches({
        knownRows: []
      });

      assert.equal(fetchCalls, 1);
      assert.equal(firstRows.length, 1);
      assert.equal(secondRows.length, 1);
      assert.equal(firstRows[0].tournament, "PGL Wallachia S7 - Round 1");
      assert.equal(firstRows[0].competitiveTier, 1);
      assert.equal(firstRows[0].teams.left.id, "team_liq");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("falls back to the public matches page when the parse API is rate-limited", async () => {
    const originalFetch = global.fetch;
    let apiCalls = 0;
    let renderCalls = 0;
    let pageCalls = 0;
    const futureTimestamp = Math.floor((Date.now() + 90 * 60 * 1000) / 1000);
    const html = withTimestamp(sampleMatchHtml, futureTimestamp);

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/api.php?action=parse&page=Liquipedia:Matches")) {
        apiCalls += 1;
        return {
          ok: false,
          status: 429
        };
      }

      if (target === "https://liquipedia.net/dota2/index.php?title=Liquipedia:Matches&action=render") {
        renderCalls += 1;
        return {
          ok: false,
          status: 429
        };
      }

      if (target === "https://liquipedia.net/dota2/Liquipedia:Matches") {
        pageCalls += 1;
        return {
          ok: true,
          async text() {
            return html;
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const provider = new LiquipediaDotaScheduleProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchScheduleMatches();

      assert.equal(apiCalls, 1);
      assert.equal(renderCalls, 1);
      assert.equal(pageCalls, 1);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "upcoming");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("uses the action=render fallback before the full page fetch", async () => {
    const originalFetch = global.fetch;
    let apiCalls = 0;
    let renderCalls = 0;
    let pageCalls = 0;
    const futureTimestamp = Math.floor((Date.now() + 90 * 60 * 1000) / 1000);
    const html = withTimestamp(sampleMatchHtml, futureTimestamp);

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/api.php?action=parse&page=Liquipedia:Matches")) {
        apiCalls += 1;
        return {
          ok: false,
          status: 429
        };
      }

      if (target === "https://liquipedia.net/dota2/index.php?title=Liquipedia:Matches&action=render") {
        renderCalls += 1;
        return {
          ok: true,
          async text() {
            return html;
          }
        };
      }

      if (target === "https://liquipedia.net/dota2/Liquipedia:Matches") {
        pageCalls += 1;
        return {
          ok: true,
          async text() {
            return html;
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const provider = new LiquipediaDotaScheduleProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchScheduleMatches();

      assert.equal(apiCalls, 1);
      assert.equal(renderCalls, 1);
      assert.equal(pageCalls, 0);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "upcoming");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("retains live rows even after the default schedule lookback window", async () => {
    const originalFetch = global.fetch;
    const liveTimestamp = Math.floor((Date.now() - 3 * 60 * 60 * 1000) / 1000);
    const liveHtml = withTimestamp(withScore(sampleMatchHtml, 1, 0), liveTimestamp);

    global.fetch = async () => {
      return {
        ok: true,
        async json() {
          return {
            parse: {
              text: {
                "*": liveHtml
              }
            }
          };
        }
      };
    };

    try {
      const provider = new LiquipediaDotaScheduleProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchScheduleMatches();

      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, "live");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("filters out finished scored rows from the Liquipedia page", async () => {
    const originalFetch = global.fetch;
    const completedTimestamp = Math.floor((Date.now() - 45 * 60 * 1000) / 1000);
    const html = withTimestamp(withFinished(withScore(sampleMatchHtml, 2, 1)), completedTimestamp);

    global.fetch = async () => {
      return {
        ok: true,
        async json() {
          return {
            parse: {
              text: {
                "*": html
              }
            }
          };
        }
      };
    };

    try {
      const provider = new LiquipediaDotaScheduleProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchScheduleMatches();

      assert.equal(rows.length, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("mockStore Dota upcoming detail fallback", () => {
  it("resolves upcoming Liquipedia schedule ids into match detail with watch context", async () => {
    const originalFetch = global.fetch;
    const futureTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
    const futureHtml = sampleMatchHtml.replace("1772899200", String(futureTimestamp));
    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: futureHtml
              }
            };
          }
        };
      }

      if (
        target.endsWith("/live") ||
        target.endsWith("/proMatches") ||
        target.endsWith("/leagues") ||
        target.endsWith("/teams")
      ) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    const previousMode = process.env.ESPORTS_DATA_MODE;
    process.env.ESPORTS_DATA_MODE = "provider";

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?liquipediaScheduleTest=${Date.now()}`);
      const scheduleRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });

      assert.equal(scheduleRows.length, 1);
      assert.equal(scheduleRows[0].id.startsWith("dota_lp_sched_"), true);

      const detail = await store.getMatchDetail(scheduleRows[0].id);
      assert.ok(detail);
      assert.equal(detail.status, "upcoming");
      assert.equal(detail.selectedGame.state, "unstarted");
      assert.equal(detail.watchGuide.streamUrl, "https://liquipedia.net/dota2/Special:Stream/twitch/PGL_Dota2");
      assert.equal(detail.selectedGame.watchOptions.length, 2);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
    }
  });

  it("backfills Dota team profiles from team-specific OpenDota history when schedule ids are Liquipedia-derived", async () => {
    const originalFetch = global.fetch;
    const futureTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
    const futureHtml = sampleMatchHtml.replace("1772899200", String(futureTimestamp));
    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: futureHtml
              }
            };
          }
        };
      }

      if (target.endsWith("/live") || target.endsWith("/proMatches") || target.endsWith("/leagues")) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      if (target.endsWith("/teams")) {
        return {
          ok: true,
          async json() {
            return [
              {
                team_id: 2163,
                name: "Team Liquid",
                tag: "Liquid"
              },
              {
                team_id: 8255888,
                name: "Cloud Rising",
                tag: "CR"
              }
            ];
          }
        };
      }

      if (target.endsWith("/teams/2163/matches")) {
        return {
          ok: true,
          async json() {
            return [
              {
                match_id: 1001,
                radiant_win: true,
                radiant_score: 30,
                dire_score: 15,
                radiant: false,
                duration: 2080,
                start_time: 1772370355,
                leagueid: 19269,
                league_name: "DreamLeague Season 28",
                opposing_team_id: 8255888,
                opposing_team_name: "Cloud Rising"
              },
              {
                match_id: 1002,
                radiant_win: false,
                radiant_score: 12,
                dire_score: 28,
                radiant: false,
                duration: 2150,
                start_time: 1772366096,
                leagueid: 19269,
                league_name: "DreamLeague Season 28",
                opposing_team_id: 8255888,
                opposing_team_name: "Cloud Rising"
              }
            ];
          }
        };
      }

      if (target.endsWith("/teams/8255888/matches")) {
        return {
          ok: true,
          async json() {
            return [
              {
                match_id: 1001,
                radiant_win: true,
                radiant_score: 30,
                dire_score: 15,
                radiant: true,
                duration: 2080,
                start_time: 1772370355,
                leagueid: 19269,
                league_name: "DreamLeague Season 28",
                opposing_team_id: 2163,
                opposing_team_name: "Team Liquid"
              },
              {
                match_id: 1002,
                radiant_win: false,
                radiant_score: 12,
                dire_score: 28,
                radiant: true,
                duration: 2150,
                start_time: 1772366096,
                leagueid: 19269,
                league_name: "DreamLeague Season 28",
                opposing_team_id: 2163,
                opposing_team_name: "Team Liquid"
              }
            ];
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    const previousMode = process.env.ESPORTS_DATA_MODE;
    process.env.ESPORTS_DATA_MODE = "provider";

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?liquipediaProfileTest=${Date.now()}`);
      const scheduleRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });
      const row = scheduleRows[0];
      assert.equal(row.teams.left.id, "2163");
      const profile = await store.getTeamProfile(row.teams.left.id, {
        game: "dota2",
        seedMatchId: row.id,
        teamNameHint: row.teams.left.name,
        opponentId: row.teams.right.id,
        limit: 5
      });

      assert.ok(profile);
      assert.equal(profile.name, "Team Liquid");
      assert.equal(profile.recentMatches.length >= 1, true);
      assert.equal(profile.recentMatches[0].scoreLabel, "1-1");
      assert.equal(profile.headToHead.matches, 1);

      const detail = await store.getMatchDetail(row.id);
      assert.ok(detail);
      assert.ok(detail.teamForm);
      assert.equal(detail.teamForm.left.teamId, "2163");
      assert.ok(detail.preMatchInsights);
      assert.ok(Array.isArray(detail.preMatchInsights.watchOptions));
      assert.equal(detail.preMatchInsights.teamForm.left.teamId, "2163");
      assert.equal(detail.headToHead.total, 1);
      assert.equal(detail.prediction.modelVersion, "fallback-dota-v2");
      assert.equal(
        Number((detail.prediction.leftWinPct + detail.prediction.rightWinPct).toFixed(1)),
        100
      );
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
    }
  });

  it("promotes overdue Dota schedule rows into live when no live provider row exists yet", async () => {
    const originalFetch = global.fetch;
    const delayedTimestamp = Math.floor((Date.now() - 45 * 60 * 1000) / 1000);
    const delayedHtml = sampleMatchHtml.replace("1772899200", String(delayedTimestamp));

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: delayedHtml
              }
            };
          }
        };
      }

      if (
        target.endsWith("/live") ||
        target.endsWith("/proMatches") ||
        target.endsWith("/leagues") ||
        target.endsWith("/teams")
      ) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    const previousMode = process.env.ESPORTS_DATA_MODE;
    process.env.ESPORTS_DATA_MODE = "provider";

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?liquipediaLateLiveTest=${Date.now()}`);
      const liveRows = await store.listLiveMatches({
        game: "dota2",
        region: undefined,
        followedOnly: false,
        userId: null,
        dotaTiers: [1, 2, 3, 4]
      });
      const scheduleRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });
      const matchId = scheduleRows[0]?.id;
      const detail = await store.getMatchDetail(matchId);

      assert.equal(liveRows.length, 1);
      assert.equal(liveRows[0].status, "live");
      assert.equal(scheduleRows[0].status, "live");
      assert.equal(detail.status, "live");
      assert.equal(detail.selectedGame.state, "inProgress");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
    }
  });

  it("keeps previously opened Dota schedule detail available after the source row disappears", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousCacheMs = process.env.PROVIDER_CACHE_MS;
    const futureTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);
    const futureHtml = sampleMatchHtml.replace("1772899200", String(futureTimestamp));
    let phase = "present";

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: phase === "present" ? futureHtml : ""
              }
            };
          }
        };
      }

      if (
        target.endsWith("/live") ||
        target.endsWith("/proMatches") ||
        target.endsWith("/leagues") ||
        target.endsWith("/teams")
      ) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.PROVIDER_CACHE_MS = "0";

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?liquipediaStaleDetailTest=${Date.now()}`);
      const scheduleRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });
      const matchId = scheduleRows[0]?.id;

      const first = await store.getMatchDetail(matchId);
      assert.ok(first);
      assert.equal(first.id, matchId);
      assert.equal(first.status, "upcoming");

      await new Promise((resolve) => setTimeout(resolve, 5));
      phase = "missing";
      const second = await store.getMatchDetail(matchId);

      assert.ok(second);
      assert.equal(second.id, matchId);
      assert.equal(second.selectedGame.state, "unstarted");
      assert.equal(second.selectedGame.watchOptions.length, 2);
      assert.equal(["stale_cache", "degraded"].includes(String(second.freshness.status)), true);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("PROVIDER_CACHE_MS", previousCacheMs);
    }
  });

  it("retains recently seen Dota schedule rows when Liquipedia temporarily drops a live series", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousCache = process.env.PROVIDER_CACHE_MS;
    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.PROVIDER_CACHE_MS = "0";

    const futureTimestamp = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
    const firstHtml = sampleMatchHtml.replace("1772899200", String(futureTimestamp));
    let scheduleFetchCount = 0;

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("liquipedia.net/dota2/api.php")) {
        scheduleFetchCount += 1;
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: {
                  "*": scheduleFetchCount === 1 ? firstHtml : ""
                }
              }
            };
          }
        };
      }

      if (
        target.endsWith("/live") ||
        target.endsWith("/proMatches") ||
        target.endsWith("/leagues") ||
        target.endsWith("/teams")
      ) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?retainSchedule=${Date.now()}`);

      const firstRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });
      assert.equal(firstRows.length, 1);
      assert.equal(firstRows[0].teams.left.name, "Team Liquid");
      assert.equal(firstRows[0].teams.right.name, "Cloud Rising");

      await store.refreshProviderCaches(["dotaSchedule"]);

      const secondRows = await store.listSchedule({
        game: "dota2",
        region: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        dotaTiers: [1, 2, 3, 4]
      });
      assert.equal(secondRows.length, 1);
      assert.equal(secondRows[0].teams.left.name, "Team Liquid");
      assert.equal(secondRows[0].teams.right.name, "Cloud Rising");
      assert.equal(secondRows[0].status, "live");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("PROVIDER_CACHE_MS", previousCache);
    }
  });
});
