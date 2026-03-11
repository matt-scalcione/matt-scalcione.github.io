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

describe("LoL detail fallback", () => {
  it("builds a summary-based LoL detail page when Riot detail is unavailable", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousLiveSnapshotUrl = process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_URL;
    const previousScheduleSnapshotUrl = process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL;
    const previousResultsSnapshotUrl = process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL;

    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_URL = "https://snapshot.test/lol-live.json";
    process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL = "https://snapshot.test/lol-schedule.json";
    process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL = "https://snapshot.test/lol-results.json";

    const generatedAt = new Date().toISOString();
    const matchId = "lol_riot_test_sched_1";

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("esports-api.lolesports.com")) {
        return {
          ok: false,
          status: 503
        };
      }

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: {
                  "*": '<div class="match-info"></div>'
                }
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

      if (target === "https://snapshot.test/lol-live.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: []
            };
          }
        };
      }

      if (target === "https://snapshot.test/lol-results.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: []
            };
          }
        };
      }

      if (target === "https://snapshot.test/lol-schedule.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: [
                {
                  id: matchId,
                  providerMatchId: "provider_1",
                  game: "lol",
                  region: "eu",
                  tournament: "EMEA Masters",
                  status: "upcoming",
                  startAt: "2026-03-13T13:00:00.000Z",
                  bestOf: 3,
                  seriesScore: {
                    left: 0,
                    right: 0
                  },
                  teams: {
                    left: {
                      id: "team_left_1",
                      name: "Team Left"
                    },
                    right: {
                      id: "team_right_1",
                      name: "Team Right"
                    }
                  },
                  source: {
                    provider: "riot",
                    providerLabel: "Riot"
                  }
                }
              ]
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
      const store = await import(`${moduleUrl}?lolDetailFallback=${Date.now()}`);
      const detail = await store.getMatchDetail(matchId, {
        gameNumber: 2
      });

      assert.ok(detail);
      assert.equal(detail.id, matchId);
      assert.equal(detail.status, "upcoming");
      assert.equal(detail.selectedGame.number, 2);
      assert.equal(detail.selectedGame.state, "unstarted");
      assert.equal(detail.gameNavigation.selectedGameNumber, 2);
      assert.equal(detail.seriesGames.length, 3);
      assert.equal(detail.dataConfidence.telemetry, "fallback");
      assert.equal(detail.preMatchInsights.watchOptions[0].url, "https://lolesports.com/");
      assert.equal(detail.source.provider, "riot");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("PULSEBOARD_LOL_LIVE_SNAPSHOT_URL", previousLiveSnapshotUrl);
      restoreEnv("PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL", previousScheduleSnapshotUrl);
      restoreEnv("PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL", previousResultsSnapshotUrl);
    }
  });
});
