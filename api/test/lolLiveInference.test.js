import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeLolScheduleRowsForLive } from "../src/data/mockStore.js";

describe("lol live inference", () => {
  it("promotes overdue LoL schedule rows into inferred live rows", () => {
    const rows = canonicalizeLolScheduleRowsForLive([
      {
        id: "lol_sched_1",
        game: "lol",
        status: "upcoming",
        bestOf: 3,
        startAt: "2026-03-14T02:20:00.000Z",
        teams: {
          left: { id: "l_1", name: "T1" },
          right: { id: "r_1", name: "Gen.G" }
        },
        source: {
          provider: "riot"
        }
      }
    ], {
      nowMs: Date.parse("2026-03-14T02:40:00.000Z")
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "live");
    assert.equal(rows[0].keySignal, "provider_schedule_started");
    assert.equal(rows[0].source?.provenance?.delivery, "schedule_inferred_live");
  });

  it("does not infer rows that are already covered by live or results", () => {
    const scheduleRows = [
      {
        id: "lol_sched_live_duplicate",
        providerMatchId: "riot_match_1",
        game: "lol",
        status: "live",
        bestOf: 3,
        startAt: "2026-03-14T02:20:00.000Z",
        teams: {
          left: { name: "T1" },
          right: { name: "Gen.G" }
        }
      },
      {
        id: "lol_sched_result_duplicate",
        providerMatchId: "riot_match_2",
        game: "lol",
        status: "upcoming",
        bestOf: 3,
        startAt: "2026-03-14T02:00:00.000Z",
        teams: {
          left: { name: "HLE" },
          right: { name: "DK" }
        }
      }
    ];

    const rows = canonicalizeLolScheduleRowsForLive(scheduleRows, {
      liveRows: [
        {
          id: "lol_live_1",
          providerMatchId: "riot_match_1",
          game: "lol",
          status: "live"
        }
      ],
      resultRows: [
        {
          id: "lol_result_1",
          providerMatchId: "riot_match_2",
          game: "lol",
          status: "completed"
        }
      ],
      nowMs: Date.parse("2026-03-14T02:40:00.000Z")
    });

    assert.deepEqual(rows, []);
  });
});
