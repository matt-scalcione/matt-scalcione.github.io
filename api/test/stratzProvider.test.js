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
                      level: 14,
                      respawnTimer: 0,
                      playbackData: {
                        positionEvents: [{ time: 1200, x: -4200, y: -3800 }],
                        goldEvents: [
                          { time: 600, networth: 8100, networthDifference: 1200, goldPerMinute: 540 },
                          { time: 1200, networth: 12400, networthDifference: 2600, goldPerMinute: 620 }
                        ]
                      }
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
                      level: 13,
                      respawnTimer: 18,
                      playbackData: {
                        positionEvents: [{ time: 1200, x: 3800, y: 4100 }],
                        goldEvents: [
                          { time: 600, networth: 7600, networthDifference: 1200, goldPerMinute: 510 },
                          { time: 1200, networth: 11800, networthDifference: 2600, goldPerMinute: 590 }
                        ]
                      }
                    }
                  ],
                  radiantScore: 4,
                  direScore: 3,
                  playbackData: {
                    buildingEvents: [
                      { time: 720, type: "TOWER", isAlive: false, isRadiant: false, indexId: 1 }
                    ],
                    roshanEvents: [
                      { time: 1020, isAlive: false, respawnTimer: 480 }
                    ],
                    radiantScore: [
                      { time: 600, score: 2 },
                      { time: 1200, score: 4 }
                    ],
                    direScore: [
                      { time: 600, score: 1 },
                      { time: 1200, score: 3 }
                    ],
                    pickBans: [
                      { isPick: true, heroId: 8, order: 1, isRadiant: true, position: "pos1" },
                      { isPick: true, heroId: 19, order: 2, isRadiant: false, position: "pos1" }
                    ]
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
      assert.equal(detail?.selectedGame?.telemetryStatus, "rich");
      assert.equal(detail?.playerEconomy?.left?.length, 1);
      assert.equal(detail?.playerEconomy?.right?.length, 1);
      assert.equal(detail?.selectedGame?.snapshot?.left?.kills, 4);
      assert.equal(detail?.selectedGame?.snapshot?.right?.kills, 3);
      assert.equal(detail?.pulseCard?.title, "STRATZ live detail active");
      assert.equal(detail?.goldLeadSeries?.length, 2);
      assert.equal(detail?.objectiveTimeline?.length, 2);
      assert.equal(detail?.combatBursts?.length, 1);
      assert.equal(detail?.teamDraft?.left?.[0]?.champion, "Juggernaut");
      assert.equal(detail?.playerEconomy?.left?.[0]?.x, -4200);
      assert.equal(detail?.playerEconomy?.right?.[0]?.isDead, true);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_MATCH_DETAIL_QUERY", previousDetailQuery);
    }
  });

  it("normalizes completed STRATZ match payloads without regressing to scheduled state", async () => {
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
                  id: 902,
                  matchId: 902,
                  didRadiantWin: true,
                  durationSeconds: 2334,
                  startDateTime: 1772899200,
                  endDateTime: 1772901534,
                  towerStatusRadiant: 3,
                  towerStatusDire: 0,
                  barracksStatusRadiant: 7,
                  barracksStatusDire: 0,
                  league: {
                    name: "PGL Wallachia",
                    tier: 1
                  },
                  radiantTeam: {
                    id: 1,
                    name: "Team Falcons"
                  },
                  direTeam: {
                    id: 2,
                    name: "Team Spirit"
                  },
                  radiantTeamId: 1,
                  direTeamId: 2,
                  radiantKills: 31,
                  direKills: 18,
                  players: [
                    {
                      isRadiant: true,
                      steamAccount: { name: "skiter" },
                      hero: { id: 8, displayName: "Juggernaut" },
                      kills: 10,
                      deaths: 2,
                      assists: 9,
                      numLastHits: 402,
                      numDenies: 14,
                      goldPerMinute: 755,
                      experiencePerMinute: 822,
                      level: 25,
                      networth: 28800,
                      item0Id: 1,
                      item1Id: 2,
                      item2Id: 3
                    },
                    {
                      isRadiant: false,
                      steamAccount: { name: "Yatoro" },
                      hero: { id: 41, displayName: "Faceless Void" },
                      kills: 5,
                      deaths: 6,
                      assists: 4,
                      numLastHits: 310,
                      numDenies: 8,
                      goldPerMinute: 560,
                      experiencePerMinute: 640,
                      level: 21,
                      networth: 19000,
                      item0Id: 4,
                      item1Id: 5,
                      item2Id: 6
                    }
                  ]
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
      const { StratzProvider } = await import(`${moduleUrl}?completed=${Date.now()}`);
      const provider = new StratzProvider({ timeoutMs: 1000 });
      const detail = await provider.fetchMatchDetail("902");

      assert.equal(detail?.status, "completed");
      assert.equal(detail?.selectedState, "completed");
      assert.equal(detail?.selectedGame?.state, "completed");
      assert.equal(detail?.selectedGame?.label, "Completed game.");
      assert.equal(detail?.winnerTeamId, "1");
      assert.equal(detail?.selectedGame?.winnerTeamId, "1");
      assert.equal(detail?.selectedGame?.title, "Game 1");
      assert.equal(detail?.playerEconomy?.left?.[0]?.cs, 402);
      assert.equal(detail?.playerEconomy?.left?.[0]?.denies, 14);
      assert.equal(detail?.playerEconomy?.left?.[0]?.itemCount, 3);
      assert.equal(detail?.objectiveControl?.left?.towers, 11);
      assert.equal(detail?.objectiveControl?.left?.inhibitors, 6);
      assert.equal(detail?.selectedGame?.snapshot?.left?.kills, 31);
      assert.equal(detail?.selectedGame?.snapshot?.right?.kills, 18);
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

  it("reorients STRATZ telemetry to the series team order for OpenDota live series detail", async () => {
    const originalFetch = global.fetch;
    const previousMode = process.env.ESPORTS_DATA_MODE;
    const previousToken = process.env.STRATZ_API_TOKEN;
    const previousDetailQuery = process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY;

    process.env.ESPORTS_DATA_MODE = "provider";
    process.env.STRATZ_API_TOKEN = "test-token";
    process.env.STRATZ_DOTA_MATCH_DETAIL_QUERY = "query MatchDetail { match(id: $id) { id } }";

    const nowSeconds = Math.floor(Date.now() / 1000);

    global.fetch = async (url) => {
      const target = String(url);

      if (target.includes("api.stratz.com/graphql")) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                live: {
                  match: {
                    matchId: 1002,
                    status: "LIVE",
                    bestOf: 3,
                    startDateTime: nowSeconds - 120,
                    lastUpdateDateTime: nowSeconds - 5,
                    radiantSeriesWins: 0,
                    direSeriesWins: 1,
                    league: {
                      name: "Test League",
                      tier: 1
                    },
                    radiantTeam: {
                      id: 20,
                      name: "Beta"
                    },
                    direTeam: {
                      id: 10,
                      name: "Alpha"
                    },
                    radiantScore: 12,
                    direScore: 15,
                    players: [
                      {
                        isRadiant: true,
                        steamAccount: { name: "Beta Core" },
                        hero: { id: 2, displayName: "Axe" },
                        kills: 4,
                        deaths: 3,
                        assists: 2,
                        numLastHits: 100,
                        numDenies: 6,
                        networth: 10500,
                        goldPerMinute: 500,
                        experiencePerMinute: 480,
                        level: 14,
                        respawnTimer: 0,
                        playbackData: {
                          positionEvents: [{ time: 900, x: 2200, y: 1800 }],
                          goldEvents: [{ time: 900, networth: 10500, networthDifference: -1800, goldPerMinute: 500 }]
                        }
                      },
                      {
                        isRadiant: false,
                        steamAccount: { name: "Alpha Core" },
                        hero: { id: 1, displayName: "Anti-Mage" },
                        kills: 6,
                        deaths: 1,
                        assists: 4,
                        numLastHits: 140,
                        numDenies: 10,
                        networth: 12300,
                        goldPerMinute: 620,
                        experiencePerMinute: 580,
                        level: 15,
                        respawnTimer: 0,
                        playbackData: {
                          positionEvents: [{ time: 900, x: -2100, y: -1700 }],
                          goldEvents: [{ time: 900, networth: 12300, networthDifference: -1800, goldPerMinute: 620 }]
                        }
                      }
                    ],
                    playbackData: {
                      buildingEvents: [
                        { time: 700, type: "TOWER", isAlive: false, isRadiant: true, indexId: 1 }
                      ],
                      radiantScore: [{ time: 900, score: 12 }],
                      direScore: [{ time: 900, score: 15 }]
                    }
                  }
                }
              }
            };
          }
        };
      }

      if (target.endsWith("/proMatches")) {
        return new Response(
          JSON.stringify([
            {
              match_id: 1001,
              series_id: 5001,
              series_type: 1,
              leagueid: 77,
              league_name: "Test League",
              start_time: nowSeconds - 1800,
              duration: 2100,
              radiant_team_id: 10,
              dire_team_id: 20,
              radiant_name: "Alpha",
              dire_name: "Beta",
              radiant_win: true
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (target.endsWith("/live")) {
        return new Response(
          JSON.stringify([
            {
              match_id: 1002,
              series_id: 5001,
              league_id: 0,
              activate_time: nowSeconds - 120,
              last_update_time: nowSeconds - 5,
              team_id_radiant: 20,
              team_id_dire: 10,
              team_name_radiant: "Beta",
              team_name_dire: "Alpha",
              radiant_score: 12,
              dire_score: 15
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (target.endsWith("/leagues")) {
        return new Response(JSON.stringify([{ leagueid: 77, tier: "premium" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (target.endsWith("/heroes")) {
        return new Response(
          JSON.stringify([
            { id: 1, localized_name: "Anti-Mage" },
            { id: 2, localized_name: "Axe" }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (target.endsWith("/matches/1002")) {
        return new Response(
          JSON.stringify({
            match_id: 1002,
            leagueid: 77,
            league: { name: "Test League" },
            start_time: nowSeconds - 120,
            duration: 900,
            series_type: 1,
            radiant_score: 12,
            dire_score: 15,
            tower_status_radiant: 1023,
            tower_status_dire: 2047,
            barracks_status_radiant: 63,
            barracks_status_dire: 63,
            radiant_team: { team_id: 20, name: "Beta" },
            dire_team: { team_id: 10, name: "Alpha" },
            objectives: [{ time: 700, type: "CHAT_MESSAGE_TOWER_KILL", team: 1 }],
            radiant_gold_adv: [-400, -900, -1800],
            players: [
              {
                player_slot: 0,
                account_id: 2,
                name: "Beta Core",
                hero_id: 2,
                lane_role: 1,
                kills: 4,
                deaths: 3,
                assists: 2,
                last_hits: 100,
                denies: 6,
                net_worth: 10500,
                gold_per_min: 500,
                xp_per_min: 480,
                level: 14
              },
              {
                player_slot: 128,
                account_id: 1,
                name: "Alpha Core",
                hero_id: 1,
                lane_role: 1,
                kills: 6,
                deaths: 1,
                assists: 4,
                last_hits: 140,
                denies: 10,
                net_worth: 12300,
                gold_per_min: 620,
                xp_per_min: 580,
                level: 15
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (target.includes("liquipedia.net/dota2/api.php")) {
        return {
          ok: true,
          async json() {
            return { parse: { text: "" } };
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
      const store = await import(`${moduleUrl}?stratzMerge=${Date.now()}`);
      const detail = await store.getMatchDetail("dota_od_series_5001");

      assert.equal(detail?.teams?.left?.name, "Alpha");
      assert.equal(detail?.teams?.right?.name, "Beta");
      assert.equal(detail?.selectedGame?.state, "inProgress");
      assert.equal(detail?.selectedGame?.snapshot?.left?.kills, 15);
      assert.equal(detail?.selectedGame?.snapshot?.right?.kills, 12);
      assert.equal(detail?.playerEconomy?.left?.[0]?.name, "Alpha Core");
      assert.equal(detail?.playerEconomy?.left?.[0]?.team, "left");
      assert.equal(detail?.playerEconomy?.right?.[0]?.name, "Beta Core");
      assert.equal(detail?.playerEconomy?.right?.[0]?.team, "right");
      assert.equal(detail?.goldLeadSeries?.length, 3);
      assert.equal(detail?.goldLeadSeries?.[0]?.lead, 400);
      assert.equal(detail?.goldLeadSeries?.[2]?.lead, 1800);
      assert.equal(detail?.objectiveTimeline?.[0]?.team, "left");
      assert.equal(detail?.objectiveControl?.left?.towers, 1);
      assert.equal(detail?.objectiveControl?.right?.towers, 0);
    } finally {
      global.fetch = originalFetch;
      restoreEnv("ESPORTS_DATA_MODE", previousMode);
      restoreEnv("STRATZ_API_TOKEN", previousToken);
      restoreEnv("STRATZ_DOTA_MATCH_DETAIL_QUERY", previousDetailQuery);
    }
  });
});
