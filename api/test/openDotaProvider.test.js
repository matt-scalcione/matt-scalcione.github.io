import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OpenDotaProvider,
  buildSeriesSummaries,
  normalizeMatchDetail,
  normalizeSeriesScore
} from "../src/providers/dota/openDotaProvider.js";

describe("normalizeSeriesScore", () => {
  it("uses provided series wins when present", () => {
    const score = normalizeSeriesScore({
      leftWins: 2,
      rightWins: 1,
      radiantWin: true
    });

    assert.deepEqual(score, { left: 2, right: 1 });
  });

  it("falls back to winner when series wins are missing", () => {
    const score = normalizeSeriesScore({
      leftWins: null,
      rightWins: null,
      radiantWin: false
    });

    assert.deepEqual(score, { left: 0, right: 1 });
  });

  it("falls back to 0:0 when no score signal exists", () => {
    const score = normalizeSeriesScore({
      leftWins: undefined,
      rightWins: undefined,
      radiantWin: undefined
    });

    assert.deepEqual(score, { left: 0, right: 0 });
  });
});

describe("buildSeriesSummaries", () => {
  it("groups map rows into a completed BO3 series using series_id", () => {
    const rows = [
      {
        match_id: 1001,
        series_id: 5001,
        series_type: 1,
        leagueid: 77,
        league_name: "Wallachia",
        start_time: 1_700_000_000,
        duration: 2100,
        radiant_team_id: 10,
        dire_team_id: 20,
        radiant_name: "Aurora",
        dire_name: "MOUZ",
        radiant_win: true
      },
      {
        match_id: 1002,
        series_id: 5001,
        series_type: 1,
        leagueid: 77,
        league_name: "Wallachia",
        start_time: 1_700_002_600,
        duration: 2200,
        radiant_team_id: 20,
        dire_team_id: 10,
        radiant_name: "MOUZ",
        dire_name: "Aurora",
        radiant_win: false
      },
      {
        match_id: 1003,
        series_id: 5001,
        series_type: 1,
        leagueid: 77,
        league_name: "Wallachia",
        start_time: 1_700_005_300,
        duration: 2000,
        radiant_team_id: 20,
        dire_team_id: 10,
        radiant_name: "MOUZ",
        dire_name: "Aurora",
        radiant_win: true
      }
    ];

    const summaries = buildSeriesSummaries(rows, new Map([[77, 1]]));

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].id, "dota_od_series_5001");
    assert.equal(summaries[0].bestOf, 3);
    assert.equal(summaries[0].status, "completed");
    assert.deepEqual(summaries[0].seriesScore, { left: 2, right: 1 });
    assert.equal(summaries[0].winnerTeamId, summaries[0].teams.left.id);
  });

  it("keeps recent incomplete series live", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const rows = [
      {
        match_id: 2001,
        series_id: 6001,
        series_type: 1,
        leagueid: 88,
        league_name: "DreamLeague",
        start_time: nowSeconds - 3600,
        duration: 2100,
        radiant_team_id: 30,
        dire_team_id: 40,
        radiant_name: "Team A",
        dire_name: "Team B",
        radiant_win: true
      }
    ];

    const summaries = buildSeriesSummaries(rows, new Map([[88, 2]]));

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].status, "live");
    assert.equal(summaries[0].bestOf, 3);
    assert.deepEqual(summaries[0].seriesScore, { left: 1, right: 0 });
  });

  it("keeps split BO3 series live between maps when the last map ended recently", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const rows = [
      {
        match_id: 3001,
        series_id: 7001,
        series_type: 1,
        leagueid: 99,
        league_name: "Wallachia",
        start_time: nowSeconds - 9500,
        duration: 2800,
        radiant_team_id: 50,
        dire_team_id: 60,
        radiant_name: "Team Falcons",
        dire_name: "Team Spirit",
        radiant_win: true
      },
      {
        match_id: 3002,
        series_id: 7001,
        series_type: 1,
        leagueid: 99,
        league_name: "Wallachia",
        start_time: nowSeconds - 4700,
        duration: 3030,
        radiant_team_id: 60,
        dire_team_id: 50,
        radiant_name: "Team Spirit",
        dire_name: "Team Falcons",
        radiant_win: true
      }
    ];

    const summaries = buildSeriesSummaries(rows, new Map([[99, 1]]));

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].status, "live");
    assert.equal(summaries[0].bestOf, 3);
    assert.deepEqual(summaries[0].seriesScore, { left: 1, right: 1 });
  });
});

describe("OpenDotaProvider selected game winner propagation", () => {
  it("propagates completed map winners into selectedGame for series detail", async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const target = String(url);
      if (target.endsWith("/proMatches")) {
        return {
          ok: true,
          async json() {
            return [
              {
                match_id: 1001,
                series_id: 5001,
                series_type: 1,
                leagueid: 77,
                league_name: "Wallachia",
                start_time: 1_700_000_000,
                duration: 2100,
                radiant_team_id: 10,
                dire_team_id: 20,
                radiant_name: "Aurora",
                dire_name: "MOUZ",
                radiant_win: true
              },
              {
                match_id: 1002,
                series_id: 5001,
                series_type: 1,
                leagueid: 77,
                league_name: "Wallachia",
                start_time: 1_700_002_600,
                duration: 2200,
                radiant_team_id: 20,
                dire_team_id: 10,
                radiant_name: "MOUZ",
                dire_name: "Aurora",
                radiant_win: false
              }
            ];
          }
        };
      }
      if (target.endsWith("/live")) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }
      if (target.endsWith("/leagues")) {
        return {
          ok: true,
          async json() {
            return [{ leagueid: 77, tier: "premium", name: "Wallachia" }];
          }
        };
      }
      if (target.endsWith("/heroStats")) {
        return {
          ok: true,
          async json() {
            return [];
          }
        };
      }
      if (target.endsWith("/matches/1002")) {
        return {
          ok: true,
          async json() {
            return {
              match_id: 1002,
              leagueid: 77,
              league: { name: "Wallachia" },
              start_time: 1_700_002_600,
              duration: 2200,
              series_type: 1,
              radiant_series_wins: 1,
              dire_series_wins: 1,
              radiant_team: { team_id: 20, name: "MOUZ" },
              dire_team: { team_id: 10, name: "Aurora" },
              radiant_win: false,
              radiant_score: 22,
              dire_score: 30,
              players: []
            };
          }
        };
      }
      throw new Error(`Unexpected fetch ${target}`);
    };

    try {
      const provider = new OpenDotaProvider({ timeoutMs: 1000 });
      const detail = await provider.fetchMatchDetail("dota_od_series_5001", { gameNumber: 2 });
      assert.ok(detail);
      assert.equal(detail.selectedGame.number, 2);
      assert.equal(detail.selectedGame.state, "completed");
      assert.equal(detail.selectedGame.winnerTeamId, detail.teams.left.id);
      assert.equal(detail.seriesGames[1].winnerTeamId, detail.teams.left.id);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("normalizeMatchDetail", () => {
  it("builds rich Dota detail fields used by match page", () => {
    const payload = {
      match_id: 987654321,
      leagueid: 112233,
      league: { name: "DreamLeague S26" },
      start_time: 1_700_000_000,
      duration: 2100,
      series_type: 1,
      radiant_series_wins: 1,
      dire_series_wins: 1,
      radiant_win: true,
      radiant_score: 32,
      dire_score: 25,
      radiant_team: {
        team_id: 111,
        name: "Team Radiant"
      },
      dire_team: {
        team_id: 222,
        name: "Team Dire"
      },
      objectives: [
        { time: 620, type: "CHAT_MESSAGE_TOWER_KILL", team: 2 },
        { time: 1410, type: "CHAT_MESSAGE_ROSHAN_KILL", team: 2 },
        { time: 1520, type: "CHAT_MESSAGE_BARRACKS_KILL", team: 2 }
      ],
      radiant_gold_adv: [0, 300, 600, -1400, -2200, -1800, 1200],
      players: [
        {
          player_slot: 0,
          account_id: 1,
          name: "Carry One",
          hero_id: 1,
          lane_role: 1,
          kills: 10,
          deaths: 2,
          assists: 8,
          last_hits: 260,
          net_worth: 22100,
          gold_per_min: 645,
          xp_per_min: 710,
          level: 25,
          item_0: 1,
          item_1: 2,
          item_2: 3,
          item_3: 4,
          item_4: 5,
          item_5: 6
        },
        {
          player_slot: 128,
          account_id: 2,
          name: "Carry Two",
          hero_id: 2,
          lane_role: 1,
          kills: 7,
          deaths: 4,
          assists: 11,
          last_hits: 238,
          net_worth: 20500,
          gold_per_min: 598,
          xp_per_min: 640,
          level: 23,
          item_0: 1,
          item_1: 2,
          item_2: 3,
          item_3: 4,
          item_4: 0,
          item_5: 0
        }
      ],
      picks_bans: [
        { team: 0, is_pick: true, hero_id: 1, order: 1 },
        { team: 1, is_pick: true, hero_id: 2, order: 2 }
      ]
    };

    const detail = normalizeMatchDetail(
      payload,
      "dota_od_live_987654321",
      new Map([[112233, 1]]),
      new Map([
        [1, "Anti-Mage"],
        [2, "Axe"]
      ]),
      {
        requestedGameNumber: 2
      }
    );

    assert.ok(detail);
    assert.equal(detail.id, "dota_od_live_987654321");
    assert.equal(detail.game, "dota2");
    assert.equal(detail.competitiveTier, 1);

    assert.ok(detail.gameNavigation);
    assert.ok(Array.isArray(detail.gameNavigation.availableGames));
    assert.ok(detail.gameNavigation.availableGames.length >= 3);
    assert.equal(detail.gameNavigation.selectedGameNumber, 2);

    assert.ok(detail.selectedGame);
    assert.equal(detail.selectedGame.number, 2);
    assert.ok(detail.selectedGame.snapshot);

    assert.ok(Array.isArray(detail.goldLeadSeries));
    assert.equal(detail.goldLeadSeries.length, 7);
    assert.ok(detail.leadTrend);
    assert.equal(typeof detail.leadTrend.finalLead, "number");

    assert.ok(detail.playerEconomy);
    assert.ok(Array.isArray(detail.playerEconomy.left));
    assert.ok(Array.isArray(detail.playerEconomy.right));
    assert.ok(detail.playerEconomy.left.length >= 1);
    assert.ok(detail.playerEconomy.right.length >= 1);
    assert.equal(detail.playerEconomy.left[0].champion, "Anti-Mage");

    assert.ok(detail.teamEconomyTotals);
    assert.ok(detail.objectiveControl);
    assert.ok(detail.objectiveBreakdown);
    assert.ok(Array.isArray(detail.objectiveTimeline));
    assert.ok(detail.objectiveTimeline.length >= 1);

    assert.ok(detail.seriesProgress);
    assert.equal(detail.seriesProgress.bestOf, 3);
    assert.ok(detail.pulseCard);
    assert.ok(detail.edgeMeter);
    assert.ok(detail.dataConfidence);

    assert.ok(Array.isArray(detail.liveTicker));
    assert.ok(Array.isArray(detail.keyMoments));
  });

  it("marks requested game as missing and falls back to nearest available game", () => {
    const payload = {
      match_id: 123456789,
      leagueid: 9988,
      start_time: 1_700_000_500,
      duration: 1200,
      series_type: 1,
      radiant_series_wins: 1,
      dire_series_wins: 0,
      radiant_score: 8,
      dire_score: 7,
      radiant_team: { team_id: 10, name: "A" },
      dire_team: { team_id: 20, name: "B" },
      objectives: [],
      radiant_gold_adv: [0, 200, 400],
      players: []
    };

    const detail = normalizeMatchDetail(payload, "dota_od_live_123456789", new Map(), new Map(), {
      requestedGameNumber: 5
    });

    assert.ok(detail);
    assert.equal(detail.gameNavigation.requestedGameNumber, 5);
    assert.equal(detail.gameNavigation.requestedMissing, true);
    assert.equal(detail.selectedGame.number, 3);
  });
});

describe("OpenDotaProvider.fetchMatchDetail", () => {
  it("hydrates synthetic live series detail from the selected map and preserves series-side orientation", async () => {
    const provider = new OpenDotaProvider({ timeoutMs: 50 });
    const originalFetch = global.fetch;
    const nowSeconds = Math.floor(Date.now() / 1000);

    global.fetch = async (url) => {
      const value = String(url);
      if (value.endsWith("/proMatches")) {
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

      if (value.endsWith("/live")) {
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

      if (value.endsWith("/leagues")) {
        return new Response(
          JSON.stringify([{ leagueid: 77, tier: "premium" }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (value.endsWith("/heroes")) {
        return new Response(
          JSON.stringify([
            { id: 1, localized_name: "Anti-Mage" },
            { id: 2, localized_name: "Axe" }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (value.endsWith("/matches/1002")) {
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
            objectives: [
              { time: 600, type: "CHAT_MESSAGE_ROSHAN_KILL", team: 1 },
              { time: 700, type: "CHAT_MESSAGE_TOWER_KILL", team: 1 }
            ],
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

      throw new Error(`Unexpected fetch URL: ${value}`);
    };

    try {
      const detail = await provider.fetchMatchDetail("dota_od_series_5001");
      assert.ok(detail);
      assert.equal(detail.status, "live");
      assert.equal(detail.selectedGame.number, 2);
      assert.equal(detail.selectedGame.state, "inProgress");
      assert.equal(detail.selectedGame.telemetryStatus, "basic");
      assert.deepEqual(detail.seriesScore, { left: 1, right: 0 });
      assert.equal(detail.teams.left.name, "Alpha");
      assert.equal(detail.teams.right.name, "Beta");
      assert.equal(detail.selectedGame.snapshot.left.kills, 15);
      assert.equal(detail.selectedGame.snapshot.right.kills, 12);
      assert.equal(detail.objectiveControl.left.barons, 1);
      assert.equal(detail.playerEconomy.left[0].team, "left");
      assert.ok(detail.playerEconomy.left.some((row) => row.name === "Alpha Core" && row.champion === "Anti-Mage"));
      assert.equal(detail.seriesGames[1].sourceMatchId, "1002");
      assert.deepEqual(detail.selectedGame.sideSummary, ["Alpha Dire", "Beta Radiant"]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns a pending current-game view when a live series has no current map payload yet", async () => {
    const provider = new OpenDotaProvider({ timeoutMs: 50 });
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      const value = String(url);
      if (value.endsWith("/proMatches")) {
        return new Response(
          JSON.stringify([
            {
              match_id: 2001,
              series_id: 6001,
              series_type: 1,
              leagueid: 88,
              league_name: "Draft League",
              start_time: Math.floor(Date.now() / 1000) - 1800,
              duration: 1900,
              radiant_team_id: 30,
              dire_team_id: 40,
              radiant_name: "Gamma",
              dire_name: "Delta",
              radiant_win: true
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (value.endsWith("/live")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (value.endsWith("/leagues")) {
        return new Response(JSON.stringify([{ leagueid: 88, tier: "pro" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (value.endsWith("/heroes")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      throw new Error(`Unexpected fetch URL: ${value}`);
    };

    try {
      const detail = await provider.fetchMatchDetail("dota_od_series_6001");
      assert.ok(detail);
      assert.equal(detail.status, "live");
      assert.equal(detail.selectedGame.number, 2);
      assert.equal(detail.selectedGame.state, "inProgress");
      assert.equal(detail.selectedGame.telemetryStatus, "pending");
      assert.equal(detail.playerEconomy.left.length, 0);
      assert.equal(detail.playerEconomy.right.length, 0);
      assert.equal(detail.goldLeadSeries.length, 0);
      assert.equal(detail.objectiveTimeline.length, 0);
      assert.equal(detail.seriesGames[0].winnerTeamId, "30");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
