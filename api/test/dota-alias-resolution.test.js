import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dotaAliasCandidateScore,
  mergeDotaRowsForSurface,
  sameDotaSeriesForAlias
} from "../src/data/mockStore.js";

describe("dota alias matching", () => {
  it("matches liquipedia schedule rows with OpenDota placeholder leagues for the same live series", () => {
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

    assert.equal(sameDotaSeriesForAlias(liquipediaRow, openDotaSeriesRow), true);
  });

  it("prefers richer OpenDota series candidates over raw live rows", () => {
    const reference = {
      id: "dota_lp_sched_example",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Round 5",
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      }
    };
    const liveCandidate = {
      id: "dota_od_live_8724788453",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      seriesScore: { left: 0, right: 0 },
      sourceMatchId: "8724788453"
    };
    const seriesCandidate = {
      id: "dota_od_series_1073262",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 3,
      seriesScore: { left: 0, right: 1 },
      sourceMatchId: "8724788453"
    };

    assert.ok(
      dotaAliasCandidateScore(seriesCandidate, reference) > dotaAliasCandidateScore(liveCandidate, reference)
    );
  });

  it("keeps the higher-priority live source but enriches it with richer alias data", () => {
    const stratzRow = {
      id: "dota_stratz_live_1",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      seriesScore: { left: 0, right: 0 },
      source: {
        provider: "stratz"
      }
    };
    const openDotaRow = {
      id: "dota_od_series_1073262",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Round 5",
      status: "live",
      bestOf: 3,
      startAt: "2026-03-11T15:10:29.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      seriesScore: { left: 0, right: 1 },
      sourceMatchId: "8724788453",
      source: {
        provider: "opendota"
      }
    };

    const merged = mergeDotaRowsForSurface(stratzRow, openDotaRow, {
      surface: "live"
    });

    assert.equal(merged.source?.provider, "stratz");
    assert.equal(merged.bestOf, 3);
    assert.deepEqual(merged.seriesScore, { left: 0, right: 1 });
    assert.equal(merged.tournament, "PGL Wallachia S7 - Round 5");
  });

  it("enriches live rows with schedule watch data for the same series", () => {
    const liveRow = {
      id: "dota_stratz_live_1",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      source: {
        provider: "stratz"
      }
    };
    const scheduleRow = {
      id: "dota_lp_sched_example",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Round 5",
      status: "upcoming",
      bestOf: 3,
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      watchUrl: "https://www.twitch.tv/pgl_dota2",
      watchOptions: [
        {
          provider: "twitch",
          watchUrl: "https://www.twitch.tv/pgl_dota2"
        }
      ],
      source: {
        provider: "liquipedia"
      }
    };

    const merged = mergeDotaRowsForSurface(liveRow, scheduleRow, {
      surface: "live"
    });

    assert.equal(merged.source?.provider, "stratz");
    assert.equal(merged.watchUrl, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.bestOf, 3);
    assert.equal(merged.tournament, "PGL Wallachia S7 - Round 5");
  });
});
