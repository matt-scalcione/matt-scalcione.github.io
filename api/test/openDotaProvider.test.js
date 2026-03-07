import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
