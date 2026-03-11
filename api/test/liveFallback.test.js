import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterCanonicalFallbackRowsBySurface } from "../src/data/mockStore.js";

describe("live canonical fallback", () => {
  it("keeps only recent canonical live rows for the live surface", () => {
    const nowMs = Date.parse("2026-03-11T20:00:00.000Z");
    const rows = [
      {
        id: "dota_live_recent",
        game: "dota2",
        status: "live",
        source: {
          canonicalObservedAt: "2026-03-11T19:57:30.000Z"
        }
      },
      {
        id: "dota_live_stale",
        game: "dota2",
        status: "live",
        source: {
          canonicalObservedAt: "2026-03-11T19:40:00.000Z"
        }
      },
      {
        id: "dota_completed_recent",
        game: "dota2",
        status: "completed",
        source: {
          canonicalObservedAt: "2026-03-11T19:59:00.000Z"
        }
      }
    ];

    const filtered = filterCanonicalFallbackRowsBySurface(rows, {
      surface: "live",
      nowMs,
      liveMaxAgeMs: 5 * 60 * 1000
    });

    assert.deepEqual(filtered.map((row) => row.id), ["dota_live_recent"]);
  });

  it("passes through non-live surfaces unchanged", () => {
    const rows = [
      {
        id: "dota_result_1",
        game: "dota2",
        status: "completed"
      }
    ];

    const filtered = filterCanonicalFallbackRowsBySurface(rows, {
      surface: "results"
    });

    assert.deepEqual(filtered, rows);
  });
});
