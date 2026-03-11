import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalPrewarmTargets } from "../src/data/mockStore.js";

describe("canonical prewarm", () => {
  it("prioritizes live and near-term matches and dedupes team targets", () => {
    const nowMs = Date.parse("2026-03-11T20:00:00.000Z");
    const plan = buildCanonicalPrewarmTargets({
      liveRows: [
        {
          id: "dota_live_top",
          game: "dota2",
          status: "live",
          competitiveTier: 1,
          startAt: "2026-03-11T19:45:00.000Z",
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
          startAt: "2026-03-11T20:20:00.000Z",
          teams: {
            left: { id: "3", name: "Gamma" },
            right: { id: "4", name: "Delta" }
          }
        },
        {
          id: "lol_upcoming_far",
          game: "lol",
          status: "upcoming",
          competitiveTier: 3,
          startAt: "2026-03-12T09:00:00.000Z",
          teams: {
            left: { id: "1", name: "Alpha" },
            right: { id: "5", name: "Epsilon" }
          }
        }
      ],
      resultRows: [
        {
          id: "lol_result_recent",
          game: "lol",
          status: "completed",
          competitiveTier: 1,
          endAt: "2026-03-11T19:30:00.000Z",
          teams: {
            left: { id: "6", name: "Zeta" },
            right: { id: "7", name: "Eta" }
          }
        }
      ],
      matchLimit: 3,
      teamLimit: 5,
      nowMs
    });

    assert.deepEqual(
      plan.matchTargets.map((target) => target.matchId),
      ["dota_live_top", "lol_upcoming_near", "lol_result_recent"]
    );
    assert.deepEqual(
      plan.teamTargets.map((target) => target.teamId),
      ["1", "2", "3", "4", "6"]
    );
  });
});
