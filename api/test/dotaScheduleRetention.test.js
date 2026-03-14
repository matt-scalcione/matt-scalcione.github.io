import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeRetainedDotaScheduleRows } from "../src/data/mockStore.js";

describe("mergeRetainedDotaScheduleRows", () => {
  it("drops a retained Dota schedule row when the provider reuses the same slot for a new matchup", () => {
    const freshRows = [
      {
        id: "dota_lp_sched_fresh",
        providerMatchId: "liquipedia_1773486000",
        game: "dota2",
        tournament: "PGL Wallachia S7 - Playoffs",
        startAt: "2026-03-14T11:00:00.000Z",
        updatedAt: "2026-03-14T05:06:43.224Z",
        teams: {
          left: { id: "2163", name: "Team Liquid" },
          right: { id: "9303484", name: "HEROIC" }
        },
        source: {
          provider: "liquipedia",
          provenance: {
            delivery: "provider_feed"
          }
        }
      }
    ];
    const previousRows = [
      {
        id: "dota_lp_sched_retained",
        providerMatchId: "liquipedia_1773486000",
        game: "dota2",
        tournament: "PGL Wallachia S7 - Playoffs",
        startAt: "2026-03-14T11:00:00.000Z",
        updatedAt: "2026-03-13T18:11:25.124Z",
        retainedFromScheduleCache: true,
        teams: {
          left: { id: "7119388", name: "Team Spirit" },
          right: { id: "9303484", name: "HEROIC" }
        },
        source: {
          provider: "liquipedia",
          provenance: {
            delivery: "retained_cache"
          }
        }
      }
    ];

    const merged = mergeRetainedDotaScheduleRows(freshRows, previousRows);

    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.teams?.left?.name, "Team Liquid");
    assert.equal(merged[0]?.teams?.right?.name, "HEROIC");
    assert.equal(Boolean(merged[0]?.retainedFromScheduleCache), false);
  });
});
