import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe("StratzProvider", () => {
  it("reports disabled capabilities when no token or query is configured", async () => {
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousLiveQuery = process.env.STRATZ_DOTA_LIVE_QUERY;
    const previousDetailQuery = process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY;
    delete process.env.STRATZ_API_TOKEN;
    delete process.env.STRATZ_DOTA_LIVE_QUERY;
    delete process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY;

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js"
      ).href;
      const { StratzProvider } = await import(`${moduleUrl}?disabled=${Date.now()}`);
      const provider = new StratzProvider();
      const capabilities = provider.getCapabilities();

      assert.equal(capabilities.tokenConfigured, false);
      assert.equal(capabilities.liveEnabled, false);
      assert.equal(capabilities.detailEnabled, false);
    } finally {
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_LIVE_QUERY", previousLiveQuery);
      restoreEnv("STRATZ_DOTA_MATCH_DETAIL_QUERY", previousDetailQuery);
    }
  });

  it("normalizes STRATZ live rows when configured", async () => {
    const originalFetch = global.fetch;
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousLiveQuery = process.env.STRATZ_DOTA_LIVE_QUERY;

    process.env.STRATZ_API_TOKEN = "test-token";
    process.env.STRATZ_DOTA_LIVE_QUERY = "query LiveMatches { liveMatches { id } }";

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("api.stratz.com/graphql")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                liveMatches: [
                  {
                    id: 901,
                    matchId: 901,
                    status: "LIVE",
                    bestOf: 3,
                    startDateTime: 1772899200,
                    lastUpdateDateTime: 1772899500,
                    radiantSeriesWins: 1,
                    direSeriesWins: 0,
                    league: {
                      name: "DreamLeague Season 28"
                    },
                    radiantTeam: {
                      id: 2163,
                      name: "Team Liquid"
                    },
                    direTeam: {
                      id: 39,
                      name: "BetBoom Team"
                    }
                  }
                ]
              }
            };
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js"
      ).href;
      const { StratzProvider } = await import(`${moduleUrl}?live=${Date.now()}`);
      const provider = new StratzProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchLiveMatches({
        allowedTiers: [1, 2, 3, 4]
      });

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "dota_stratz_901");
      assert.equal(rows[0].status, "live");
      assert.equal(rows[0].teams.left.id, "2163");
      assert.equal(rows[0].teams.right.name, "BetBoom Team");
      assert.equal(rows[0].competitiveTier, 1);
      assert.equal(rows[0].seriesScore.left, 1);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_LIVE_QUERY", previousLiveQuery);
    }
  });

  it("can load the live query from a file path instead of an inline env value", async () => {
    const originalFetch = global.fetch;
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousLiveQuery = process.env.STRATZ_DOTA_LIVE_QUERY;
    const previousLiveQueryFile = process.env.STRATZ_DOTA_LIVE_QUERY_FILE;
    const tempDir = mkdtempSync(join(tmpdir(), "pulseboard-stratz-"));
    const queryFile = join(tempDir, "live.graphql");

    writeFileSync(queryFile, "query LiveMatches { liveMatches { id } }\n", "utf8");
    process.env.STRATZ_API_TOKEN = "test-token";
    delete process.env.STRATZ_DOTA_LIVE_QUERY;
    process.env.STRATZ_DOTA_LIVE_QUERY_FILE = queryFile;

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("api.stratz.com/graphql")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                liveMatches: []
              }
            };
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js"
      ).href;
      const { StratzProvider } = await import(`${moduleUrl}?fileQuery=${Date.now()}`);
      const provider = new StratzProvider({ timeoutMs: 1000 });
      const capabilities = provider.getCapabilities();

      assert.equal(capabilities.liveQueryConfigured, true);
      assert.equal(capabilities.liveQuerySource, "file");

      const rows = await provider.fetchLiveMatches();
      assert.deepEqual(rows, []);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_LIVE_QUERY", previousLiveQuery);
      restoreEnv("STRATZ_DOTA_LIVE_QUERY_FILE", previousLiveQueryFile);
    }
  });

  it("normalizes raw STRATZ detail payloads into the frontend contract", async () => {
    const originalFetch = global.fetch;
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousDetailQuery = process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY;

    process.env.STRATZ_API_TOKEN = "test-token";
    process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY = "query MatchDetail { match(id: $id) { id } }";

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("api.stratz.com/graphql")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                match: {
                  id: 901,
                  matchId: 901,
                  seriesId: 901,
                  status: "LIVE",
                  bestOf: 3,
                  startDateTime: 1772899200,
                  lastUpdateDateTime: 1772899500,
                  radiantSeriesWins: 1,
                  direSeriesWins: 0,
                  league: {
                    name: "DreamLeague Season 28",
                    tier: 1
                  },
                  radiantTeam: {
                    id: 2163,
                    name: "Team Liquid"
                  },
                  direTeam: {
                    id: 39,
                    name: "BetBoom Team"
                  },
                  radiantPlayers: [
                    {
                      isRadiant: true,
                      steamAccount: {
                        name: "miCKe"
                      },
                      hero: {
                        id: 8,
                        displayName: "Juggernaut"
                      },
                      kills: 4,
                      deaths: 1,
                      assists: 3,
                      networth: 12400,
                      goldPerMinute: 620,
                      experiencePerMinute: 710,
                      lastHits: 185,
                      denies: 12,
                      level: 14
                    }
                  ],
                  direPlayers: [
                    {
                      isRadiant: false,
                      steamAccount: {
                        name: "gpk~"
                      },
                      hero: {
                        id: 19,
                        displayName: "Sven"
                      },
                      kills: 3,
                      deaths: 2,
                      assists: 4,
                      networth: 11800,
                      goldPerMinute: 590,
                      experiencePerMinute: 680,
                      lastHits: 170,
                      denies: 9,
                      level: 13
                    }
                  ],
                  radiantScore: 4,
                  direScore: 3,
                  radiantTowerKills: 2,
                  direTowerKills: 1
                }
              }
            };
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js"
      ).href;
      const { StratzProvider } = await import(`${moduleUrl}?detail=${Date.now()}`);
      const provider = new StratzProvider({ timeoutMs: 1000 });
      const detail = await provider.fetchMatchDetail("dota_stratz_901", {
        gameNumber: 2
      });

      assert.equal(detail?.game, "dota2");
      assert.equal(detail?.id, "dota_stratz_901");
      assert.equal(detail?.status, "live");
      assert.equal(detail?.selectedGame?.number, 2);
      assert.equal(detail?.selectedGame?.telemetryStatus, "basic");
      assert.equal(detail?.playerEconomy?.left?.length, 1);
      assert.equal(detail?.playerEconomy?.right?.length, 1);
      assert.equal(detail?.selectedGame?.snapshot?.left?.kills, 4);
      assert.equal(detail?.selectedGame?.snapshot?.right?.kills, 3);
      assert.equal(detail?.dataConfidence?.telemetry, "provider_basic");
      assert.equal(detail?.pulseCard?.title, "STRATZ live detail active");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_MATCH_DETAIL_QUERY", previousDetailQuery);
    }
  });
});

describe("mockStore STRATZ routing", () => {
  it("prefers STRATZ live rows for Dota when configured", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousLiveQuery = process.env.STRATZ_DOTA_LIVE_QUERY;

    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.STRATZ_API_TOKEN = "test-token";
    process.env.STRATZ_DOTA_LIVE_QUERY = "query LiveMatches { liveMatches { id } }";

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("api.stratz.com/graphql")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                liveMatches: [
                  {
                    id: 901,
                    matchId: 901,
                    status: "LIVE",
                    bestOf: 3,
                    startDateTime: 1772899200,
                    lastUpdateDateTime: 1772899500,
                    radiantSeriesWins: 1,
                    direSeriesWins: 0,
                    league: {
                      name: "DreamLeague Season 28"
                    },
                    radiantTeam: {
                      id: 2163,
                      name: "Team Liquid"
                    },
                    direTeam: {
                      id: 39,
                      name: "BetBoom Team"
                    }
                  }
                ]
              }
            };
          }
        };
      }

      if (
        target.includes("api.opendota.com/api/live") ||
        target.includes("api.opendota.com/api/proMatches") ||
        target.includes("api.opendota.com/api/leagues")
      ) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: ""
              }
            };
          }
        };
      }

      if (target.includes("esports-api.lolesports.com")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                schedule: {
                  events: [],
                  pages: {
                    older: null,
                    newer: null
                  }
                }
              }
            };
          }
        };
      }

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?stratzRouting=${Date.now()}`);
      const rows = await store.listLiveMatches({
        game: "dota2",
        region: undefined,
        followedOnly: false,
        userId: null,
        dotaTiers: [1, 2, 3, 4]
      });

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "dota_stratz_901");
      assert.equal(rows[0].teams.left.name, "Team Liquid");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_LIVE_QUERY", previousLiveQuery);
    }
  });
});
