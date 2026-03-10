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

describe("LoL snapshot fallback", () => {
  it("uses published LoL snapshots when Riot schedule endpoints fail and labels degraded rows", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    process.env.ESPORTS_DATA_MODE = "provider";

    const generatedAt = new Date().toISOString();
    const overdueStartAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("esports-api.lolesports.com")) {
        return {
          ok: false,
          status: 503
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

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return {
              parse: {
                text: {
                  "*": ""
                }
              }
            };
          }
        };
      }

      if (target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-live.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: [
                {
                  id: "lol_riot_snapshot_live_1",
                  providerMatchId: "snapshot_live_1",
                  game: "lol",
                  region: "emea",
                  tournament: "EMEA Masters",
                  status: "live",
                  startAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                  updatedAt: generatedAt,
                  bestOf: 3,
                  seriesScore: {
                    left: 1,
                    right: 0
                  },
                  teams: {
                    left: {
                      id: "lol_team_fnc",
                      name: "Fnatic"
                    },
                    right: {
                      id: "lol_team_g2",
                      name: "G2 Esports"
                    }
                  }
                }
              ]
            };
          }
        };
      }

      if (target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-schedule.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: [
                {
                  id: "lol_riot_snapshot_schedule_1",
                  providerMatchId: "snapshot_schedule_1",
                  game: "lol",
                  region: "na",
                  tournament: "LTA North",
                  status: "upcoming",
                  startAt: overdueStartAt,
                  updatedAt: generatedAt,
                  bestOf: 3,
                  seriesScore: {
                    left: 0,
                    right: 0
                  },
                  teams: {
                    left: {
                      id: "lol_team_tl",
                      name: "Team Liquid"
                    },
                    right: {
                      id: "lol_team_c9",
                      name: "Cloud9"
                    }
                  }
                }
              ]
            };
          }
        };
      }

      if (target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-results.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: [
                {
                  id: "lol_riot_snapshot_result_1",
                  providerMatchId: "snapshot_result_1",
                  game: "lol",
                  region: "kr",
                  tournament: "LCK",
                  status: "completed",
                  startAt: "2026-03-09T15:00:00.000Z",
                  endAt: "2026-03-09T17:05:00.000Z",
                  bestOf: 3,
                  winnerTeamId: "lol_team_t1",
                  seriesScore: {
                    left: 2,
                    right: 0
                  },
                  teams: {
                    left: {
                      id: "lol_team_t1",
                      name: "T1"
                    },
                    right: {
                      id: "lol_team_hle",
                      name: "Hanwha Life Esports"
                    }
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
      const store = await import(`${moduleUrl}?lolSnapshotFallback=${Date.now()}`);
      const [liveRows, scheduleRows, resultRows, coverage] = await Promise.all([
        store.listLiveMatches({
          game: "lol",
          region: undefined,
          followedOnly: false,
          userId: null,
          dotaTiers: [1, 2, 3, 4]
        }),
        store.listSchedule({
          game: "lol",
          region: undefined,
          dateFrom: undefined,
          dateTo: undefined,
          dotaTiers: [1, 2, 3, 4]
        }),
        store.listResults({
          game: "lol",
          region: undefined,
          dateFrom: undefined,
          dateTo: undefined,
          dotaTiers: [1, 2, 3, 4]
        }),
        store.getProviderCoverageReport()
      ]);

      assert.equal(liveRows.length, 1);
      assert.equal(liveRows[0].source.snapshotUrl, "https://matt-scalcione.github.io/assets/provider-snapshots/lol-live.json");
      assert.equal(liveRows[0].quality.summary, "Snapshot fallback active");
      assert.equal(liveRows[0].quality.level, "warn");

      assert.equal(scheduleRows.length, 1);
      assert.equal(scheduleRows[0].source.snapshotUrl, "https://matt-scalcione.github.io/assets/provider-snapshots/lol-schedule.json");
      assert.equal(scheduleRows[0].quality.summary, "Start time passed; awaiting provider confirmation");
      assert.equal(scheduleRows[0].quality.level, "degraded");

      assert.equal(resultRows.length, 1);
      assert.equal(resultRows[0].source.snapshotUrl, "https://matt-scalcione.github.io/assets/provider-snapshots/lol-results.json");
      assert.equal(resultRows[0].quality.summary, "Snapshot fallback active");
      assert.equal(resultRows[0].quality.level, "warn");

      assert.equal(coverage.lol.liveSnapshotRows, 1);
      assert.equal(coverage.lol.scheduleSnapshotRows, 1);
      assert.equal(coverage.lol.resultSnapshotRows, 1);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
    }
  });
});
