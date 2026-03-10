import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LolEsportsProvider,
  normalizeMatchSummary,
  resolveRiotEventState
} from "../src/providers/lol/lolEsportsProvider.js";

function relativeIso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function buildEvent({
  id = "match_1",
  state = null,
  startTime = relativeIso(0),
  bestOf = 3,
  leftWins = 0,
  rightWins = 0,
  leftOutcome = null,
  rightOutcome = null,
  games = null
} = {}) {
  return {
    id,
    type: "match",
    state,
    startTime,
    league: {
      name: "Test League",
      slug: "lck"
    },
    match: {
      id,
      strategy: {
        count: bestOf
      },
      teams: [
        {
          id: "left_team",
          name: "Left Team",
          result: {
            gameWins: leftWins,
            outcome: leftOutcome
          }
        },
        {
          id: "right_team",
          name: "Right Team",
          result: {
            gameWins: rightWins,
            outcome: rightOutcome
          }
        }
      ],
      games
    }
  };
}

describe("resolveRiotEventState", () => {
  it("treats future completed 0-0 schedule rows as unstarted", () => {
    const state = resolveRiotEventState({
      scheduleState: "completed",
      bestOf: 3,
      teams: buildEvent({
        leftWins: 0,
        rightWins: 0
      }).match.teams,
      startTime: "2026-03-07T13:00:00Z",
      nowMs: Date.parse("2026-03-07T12:00:00Z")
    });

    assert.equal(state, "unstarted");
  });

  it("treats partial series scores as in progress even when schedule says completed", () => {
    const state = resolveRiotEventState({
      scheduleState: "completed",
      bestOf: 3,
      teams: buildEvent({
        leftWins: 1,
        rightWins: 0
      }).match.teams,
      startTime: "2026-03-07T10:00:00Z",
      nowMs: Date.parse("2026-03-07T12:00:00Z")
    });

    assert.equal(state, "inProgress");
  });

  it("treats stale partial series scores as completed once the series window is long past", () => {
    const state = resolveRiotEventState({
      scheduleState: "completed",
      bestOf: 3,
      teams: buildEvent({
        leftWins: 1,
        rightWins: 0
      }).match.teams,
      startTime: "2026-03-03T10:00:00Z",
      nowMs: Date.parse("2026-03-07T12:00:00Z")
    });

    assert.equal(state, "completed");
  });

  it("keeps decisive scorelines completed", () => {
    const state = resolveRiotEventState({
      scheduleState: "completed",
      bestOf: 3,
      teams: buildEvent({
        leftWins: 2,
        rightWins: 1,
        leftOutcome: "win",
        rightOutcome: "loss"
      }).match.teams,
      startTime: "2026-03-07T08:00:00Z",
      nowMs: Date.parse("2026-03-07T12:00:00Z")
    });

    assert.equal(state, "completed");
  });
});

describe("normalizeMatchSummary", () => {
  it("downgrades bogus completed rows to upcoming", () => {
    const summary = normalizeMatchSummary(
      buildEvent({
        id: "future_match",
        state: "completed",
        startTime: relativeIso(2 * 60 * 60 * 1000),
        leftWins: 0,
        rightWins: 0
      })
    );

    assert.ok(summary);
    assert.equal(summary.status, "upcoming");
    assert.deepEqual(summary.seriesScore, { left: 0, right: 0 });
  });

  it("keeps partial BO3 scorelines live", () => {
    const summary = normalizeMatchSummary(
      buildEvent({
        id: "live_series",
        state: "completed",
        startTime: relativeIso(-2 * 60 * 60 * 1000),
        leftWins: 1,
        rightWins: 0
      })
    );

    assert.ok(summary);
    assert.equal(summary.status, "live");
    assert.equal(summary.bestOf, 3);
  });

  it("classifies major leagues as top-tier and attaches Riot source metadata", () => {
    const summary = normalizeMatchSummary(
      buildEvent({
        id: "top_tier_lol"
      })
    );

    assert.ok(summary);
    assert.equal(summary.competitiveTier, 1);
    assert.equal(summary.source?.provider, "riot");
    assert.equal(summary.source?.leagueSlug, "lck");
  });

  it("classifies lower regional leagues below the default pro filter", () => {
    const summary = normalizeMatchSummary({
      ...buildEvent({
        id: "regional_lol"
      }),
      league: {
        name: "LRN",
        slug: "lrn"
      }
    });

    assert.ok(summary);
    assert.equal(summary.competitiveTier, 4);
  });
});

describe("LolEsportsProvider.fetchLiveMatches", () => {
  it("merges schedule-derived live rows when getLive undercounts", async () => {
    class StubProvider extends LolEsportsProvider {
      async fetchPersisted(operation) {
        if (operation === "getLive") {
          return {
            data: {
              schedule: {
                events: []
              }
            }
          };
        }

        if (operation === "getSchedule") {
          return {
            data: {
              schedule: {
                events: [
                  buildEvent({
                    id: "schedule_live",
                    state: "completed",
                    startTime: relativeIso(-2 * 60 * 60 * 1000),
                    leftWins: 1,
                    rightWins: 0
                  })
                ],
                pages: {}
              }
            }
          };
        }

        throw new Error(`Unexpected operation ${operation}`);
      }
    }

    const provider = new StubProvider({ timeoutMs: 1000 });
    const rows = await provider.fetchLiveMatches();

    assert.equal(rows.length, 1);
    assert.equal(rows[0].providerMatchId, "schedule_live");
    assert.equal(rows[0].status, "live");
  });
});
