import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalBackfillTargets } from "../src/data/mockStore.js";

describe("canonical backfill", () => {
  it("selects a broader prioritized set of match and team targets", () => {
    const nowMs = Date.parse("2026-03-13T02:00:00.000Z");
    const plan = buildCanonicalBackfillTargets({
      liveRows: [
        {
          id: "dota_live_top",
          game: "dota2",
          status: "live",
          competitiveTier: 1,
          startAt: "2026-03-13T01:40:00.000Z",
          teams: {
            left: { id: "1", name: "Alpha" },
            right: { id: "2", name: "Beta" }
          }
        }
      ],
      scheduleRows: [
        {
          id: "lol_upcoming_near",
          game: "lol",
          status: "upcoming",
          competitiveTier: 1,
          startAt: "2026-03-13T02:20:00.000Z",
          teams: {
            left: { id: "3", name: "Gamma" },
            right: { id: "4", name: "Delta" }
          }
        },
        {
          id: "dota_upcoming_later",
          game: "dota2",
          status: "upcoming",
          competitiveTier: 2,
          startAt: "2026-03-13T08:00:00.000Z",
          teams: {
            left: { id: "5", name: "Epsilon" },
            right: { id: "1", name: "Alpha" }
          }
        }
      ],
      resultRows: [
        {
          id: "lol_result_recent",
          game: "lol",
          status: "completed",
          competitiveTier: 1,
          endAt: "2026-03-13T01:20:00.000Z",
          teams: {
            left: { id: "6", name: "Zeta" },
            right: { id: "7", name: "Eta" }
          }
        },
        {
          id: "dota_result_recent",
          game: "dota2",
          status: "completed",
          competitiveTier: 2,
          endAt: "2026-03-12T23:30:00.000Z",
          teams: {
            left: { id: "8", name: "Theta" },
            right: { id: "9", name: "Iota" }
          }
        }
      ],
      matchLimit: 4,
      teamLimit: 6,
      nowMs
    });

    assert.deepEqual(
      plan.matchTargets.map((target) => target.matchId),
      ["dota_live_top", "lol_upcoming_near", "lol_result_recent", "dota_upcoming_later"]
    );
    assert.deepEqual(
      plan.teamTargets.map((target) => target.teamId),
      ["1", "2", "3", "4", "6", "7"]
    );
  });
});
