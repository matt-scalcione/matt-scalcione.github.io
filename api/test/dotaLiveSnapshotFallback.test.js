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

describe("Dota live snapshot fallback", () => {
  it("uses the published Dota live snapshot when OpenDota live fails", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousDotaLiveSnapshotUrl = process.env.PULSEBOARD_DOTA_LIVE_SNAPSHOT_URL;
    const previousLolLiveSnapshotUrl = process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_URL;
    const previousLolScheduleSnapshotUrl = process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL;
    const previousLolResultsSnapshotUrl = process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL;
    const previousPublicBase = process.env.PULSEBOARD_PUBLIC_BASE;
    const previousStratzToken = process.env.STRATZ_API_TOKEN;
    const previousSteamKey = process.env.STEAM_WEB_API_KEY;

    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.PULSEBOARD_PUBLIC_BASE = "";
    process.env.PULSEBOARD_DOTA_LIVE_SNAPSHOT_URL =
      "https://matt-scalcione.github.io/assets/provider-snapshots/dota-live.json";
    process.env.PULSEBOARD_LOL_LIVE_SNAPSHOT_URL = "";
    process.env.PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL = "";
    process.env.PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL = "";
    process.env.STRATZ_API_TOKEN = "";
    process.env.STEAM_WEB_API_KEY = "";

    const generatedAt = new Date().toISOString();

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("api.opendota.com/api/live")) {
        return {
          ok: false,
          status: 503
        };
      }

      if (target.includes("api.opendota.com/api/proMatches")) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

      if (target.includes("api.opendota.com/api/leagues")) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }

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

      if (target === "https://matt-scalcione.github.io/assets/provider-snapshots/dota-live.json") {
        return {
          ok: true,
          async json() {
            return {
              generatedAt,
              rows: [
                {
                  id: "dota_od_snapshot_live_1",
                  providerMatchId: "snapshot_live_1",
                  game: "dota2",
                  region: "global",
                  tournament: "PGL Wallachia Season 7",
                  competitiveTier: 1,
                  status: "live",
                  startAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
                  updatedAt: generatedAt,
                  bestOf: 3,
                  gameNumber: 1,
                  currentGame: 1,
                  seriesScore: {
                    left: 1,
                    right: 0
                  },
                  teams: {
                    left: {
                      id: "7554",
                      name: "PARIVISION"
                    },
                    right: {
                      id: "6069",
                      name: "Tundra Esports"
                    }
                  }
                }
              ]
            };
          }
        };
      }

      if (
        target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-live.json" ||
        target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-schedule.json" ||
        target === "https://matt-scalcione.github.io/assets/provider-snapshots/lol-results.json"
      ) {
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

      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/data/mockStore.js"
      ).href;
      const store = await import(`${moduleUrl}?dotaLiveSnapshotFallback=${Date.now()}`);
      const [liveRows, coverage] = await Promise.all([
        store.listLiveMatches({
          game: "dota2",
          region: undefined,
          followedOnly: false,
          userId: null,
          dotaTiers: [1, 2, 3, 4],
          lolTiers: undefined,
          useCanonicalFallback: false
        }),
        store.getProviderCoverageReport()
      ]);

      assert.equal(liveRows.length, 1);
      assert.equal(
        liveRows[0].source.snapshotUrl,
        "https://matt-scalcione.github.io/assets/provider-snapshots/dota-live.json"
      );
      assert.equal(liveRows[0].quality.summary, "Snapshot fallback active");
      assert.equal(liveRows[0].quality.level, "warn");
      assert.equal(coverage.dota.openDota.liveSnapshotRows, 1);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("PULSEBOARD_DOTA_LIVE_SNAPSHOT_URL", previousDotaLiveSnapshotUrl);
      restoreEnv("PULSEBOARD_LOL_LIVE_SNAPSHOT_URL", previousLolLiveSnapshotUrl);
      restoreEnv("PULSEBOARD_LOL_SCHEDULE_SNAPSHOT_URL", previousLolScheduleSnapshotUrl);
      restoreEnv("PULSEBOARD_LOL_RESULTS_SNAPSHOT_URL", previousLolResultsSnapshotUrl);
      restoreEnv("PULSEBOARD_PUBLIC_BASE", previousPublicBase);
      restoreEnv("STRATZ_API_TOKEN", previousStratzToken);
      restoreEnv("STEAM_WEB_API_KEY", previousSteamKey);
    }
  });
});
