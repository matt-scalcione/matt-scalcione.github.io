import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDotaSeriesPerspectivesFromTeamMatches } from "../src/data/mockStore.js";

describe("buildDotaSeriesPerspectivesFromTeamMatches", () => {
  it("adds a resolvable result detail id when no OpenDota series id exists", () => {
    const rows = [
      {
        match_id: 101,
        start_time: 1_000,
        duration: 2_000,
        leagueid: 77,
        league_name: "Test League",
        opposing_team_id: 22,
        opposing_team_name: "Opposition",
        radiant: true,
        radiant_win: true
      }
    ];

    const [row] = buildDotaSeriesPerspectivesFromTeamMatches(rows, {
      teamId: "11",
      teamName: "Example Team"
    });

    assert.equal(row.matchId, "dota_team_series_11_22_77_1000000");
    assert.equal(row.detailMatchId, "dota_od_result_101");
    assert.equal(row.sourceMatchId, "101");
  });

  it("prefers a resolvable OpenDota series detail id when series_id exists", () => {
    const rows = [
      {
        match_id: 202,
        start_time: 2_000,
        duration: 2_000,
        leagueid: 88,
        league_name: "Another League",
        series_id: 303,
        opposing_team_id: 44,
        opposing_team_name: "Rivals",
        radiant: false,
        radiant_win: true
      }
    ];

    const [row] = buildDotaSeriesPerspectivesFromTeamMatches(rows, {
      teamId: "33",
      teamName: "Another Team"
    });

    assert.equal(row.detailMatchId, "dota_od_series_303");
    assert.equal(row.sourceMatchId, "202");
  });
});
