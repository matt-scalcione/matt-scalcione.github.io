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

describe("SteamWebApiDotaProvider", () => {
  it("reports disabled capabilities when no Steam key is configured", async () => {
    const previousSteamWebApiKey = process.env.STEAM_WEB_API_KEY;
    const previousSteamApiKey = process.env.STEAM_API_KEY;
    delete process.env.STEAM_WEB_API_KEY;
    delete process.env.STEAM_API_KEY;

    try {
      const moduleUrl = pathToFileURL(
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/steamWebApiProvider.js"
      ).href;
      const { SteamWebApiDotaProvider } = await import(`${moduleUrl}?disabled=${Date.now()}`);
      const provider = new SteamWebApiDotaProvider();
      const capabilities = provider.getCapabilities();

      assert.equal(capabilities.provider, "steam");
      assert.equal(capabilities.keyConfigured, false);
      assert.equal(capabilities.liveEnabled, false);
      assert.equal(capabilities.detailEnabled, false);
    } finally {
      restoreEnv("STEAM_WEB_API_KEY", previousSteamWebApiKey);
      restoreEnv("STEAM_API_KEY", previousSteamApiKey);
    }
  });

  it("normalizes Steam live rows when configured", async () => {
    const originalFetch = global.fetch;
    const previousSteamWebApiKey = process.env.STEAM_WEB_API_KEY;
    const previousSteamApiKey = process.env.STEAM_API_KEY;
    const previousSteamBaseUrl = process.env.STEAM_WEB_API_BASE_URL;
    const previousSteamAppId = process.env.STEAM_WEB_API_APP_ID;

    process.env.STEAM_WEB_API_KEY = "test-steam-key";
    delete process.env.STEAM_API_KEY;
    process.env.STEAM_WEB_API_BASE_URL = "https://api.steampowered.test";
    process.env.STEAM_WEB_API_APP_ID = "570";

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/GetLeagueListing/")) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                leagues: [
                  {
                    leagueid: 15444,
                    name: "DreamLeague Season 28",
                    tier: "1"
                  }
                ]
              }
            };
          }
        };
      }

      if (target.includes("/GetLiveLeagueGames/")) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                games: [
                  {
                    match_id: 8123456789,
                    series_id: 120045,
                    league_id: 15444,
                    start_time: 1772899200,
                    last_update_time: 1772899500,
                    series_type: 1,
                    radiant_series_wins: 1,
                    dire_series_wins: 0,
                    radiant_team: {
                      team_id: 2163,
                      team_name: "Team Liquid",
                      team_tag: "TL"
                    },
                    dire_team: {
                      team_id: 7119388,
                      team_name: "Team Spirit",
                      team_tag: "TS"
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
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/steamWebApiProvider.js"
      ).href;
      const { SteamWebApiDotaProvider } = await import(`${moduleUrl}?live=${Date.now()}`);
      const provider = new SteamWebApiDotaProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchLiveMatches({
        allowedTiers: [1, 2, 3, 4]
      });

      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "dota_steam_120045");
      assert.equal(rows[0].status, "live");
      assert.equal(rows[0].tournament, "DreamLeague Season 28");
      assert.equal(rows[0].competitiveTier, 1);
      assert.equal(rows[0].teams.left.id, "2163");
      assert.equal(rows[0].teams.left.shortName, "TL");
      assert.equal(rows[0].teams.right.name, "Team Spirit");
      assert.deepEqual(rows[0].seriesScore, { left: 1, right: 0 });
      assert.equal(rows[0].source.provider, "steam");
      assert.equal(rows[0].freshness.source, "steam_web_api");
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STEAM_WEB_API_KEY", previousSteamWebApiKey);
      restoreEnv("STEAM_API_KEY", previousSteamApiKey);
      restoreEnv("STEAM_WEB_API_BASE_URL", previousSteamBaseUrl);
      restoreEnv("STEAM_WEB_API_APP_ID", previousSteamAppId);
    }
  });

  it("drops generic league-number rows so pub lobbies do not surface as pro matches", async () => {
    const originalFetch = global.fetch;
    const previousSteamWebApiKey = process.env.STEAM_WEB_API_KEY;
    const previousSteamApiKey = process.env.STEAM_API_KEY;
    const previousSteamBaseUrl = process.env.STEAM_WEB_API_BASE_URL;
    const previousSteamAppId = process.env.STEAM_WEB_API_APP_ID;

    process.env.STEAM_WEB_API_KEY = "test-steam-key";
    delete process.env.STEAM_API_KEY;
    process.env.STEAM_WEB_API_BASE_URL = "https://api.steampowered.test";
    process.env.STEAM_WEB_API_APP_ID = "570";

    global.fetch = async (url) => {
      const target = String(url);
      if (target.includes("/GetLeagueListing/")) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                leagues: [
                  {
                    leagueid: 19001,
                    name: "League 19001"
                  }
                ]
              }
            };
          }
        };
      }

      if (target.includes("/GetLiveLeagueGames/")) {
        return {
          ok: true,
          async json() {
            return {
              result: {
                games: [
                  {
                    match_id: 9001,
                    series_id: 9001,
                    league_id: 19001,
                    start_time: 1772899200,
                    last_update_time: 1772899500,
                    radiant_team: {
                      team_name: "Radiant"
                    },
                    dire_team: {
                      team_name: "Dire"
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
        "/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/steamWebApiProvider.js"
      ).href;
      const { SteamWebApiDotaProvider } = await import(`${moduleUrl}?generic=${Date.now()}`);
      const provider = new SteamWebApiDotaProvider({ timeoutMs: 1000 });
      const rows = await provider.fetchLiveMatches({
        allowedTiers: [1, 2, 3, 4]
      });

      assert.deepEqual(rows, []);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STEAM_WEB_API_KEY", previousSteamWebApiKey);
      restoreEnv("STEAM_API_KEY", previousSteamApiKey);
      restoreEnv("STEAM_WEB_API_BASE_URL", previousSteamBaseUrl);
      restoreEnv("STEAM_WEB_API_APP_ID", previousSteamAppId);
    }
  });
});
