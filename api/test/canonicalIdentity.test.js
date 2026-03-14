import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalSeriesEntityId,
  canonicalTournamentEntityId
} from "../src/data/mockStore.js";

describe("canonical runtime identity", () => {
  it("derives the same Dota series id across provider variants", () => {
    const liquipediaRow = {
      id: "dota_lp_sched_example",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Round 5",
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      }
    };
    const openDotaSeriesRow = {
      id: "dota_od_series_1073262",
      game: "dota2",
      tournament: "League 19435",
      startAt: "2026-03-11T15:10:29.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      }
    };

    assert.equal(canonicalSeriesEntityId(liquipediaRow), canonicalSeriesEntityId(openDotaSeriesRow));
  });

  it("normalizes Dota tournament variants to the same canonical id", () => {
    const left = canonicalTournamentEntityId("PGL Wallachia Season 7 - Round 5", {
      game: "dota2"
    });
    const right = canonicalTournamentEntityId("PGL Wallachia S7", {
      game: "dota2"
    });

    assert.equal(left, right);
    assert.equal(left, "dota2:tournament:pglwallachias7");
  });
});
