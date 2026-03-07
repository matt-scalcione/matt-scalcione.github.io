import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
