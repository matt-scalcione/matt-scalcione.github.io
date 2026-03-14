import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dotaAliasCandidateScore,
  enrichDotaDetailWithStratz,
  mergeDotaDetailWithFallbackContext,
  mergeDotaDetailContexts,
  mergeDotaRowsForSurface,
  sameDotaSeriesForAlias,
  stabilizePersistedMatchDetail
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

  it("keeps richer alias telemetry while merging fallback detail context", () => {
    const aliasDetail = {
      id: "dota_od_series_1073262",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      startAt: "2026-03-11T15:10:29.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      seriesScore: { left: 0, right: 1 },
      sourceMatchId: "8724788453",
      source: {
        provider: "opendota"
      },
      freshness: {
        source: "opendota",
        status: "partial",
        updatedAt: "2026-03-11T15:20:00.000Z"
      },
      selectedGame: {
        number: 2,
        state: "inProgress",
        telemetryStatus: "basic",
        snapshot: {
          left: { kills: 15 },
          right: { kills: 12 }
        },
        watchUrl: null,
        watchOptions: [],
        startedAt: "2026-03-11T15:10:29.000Z"
      },
      seriesGames: [
        {
          number: 1,
          state: "completed",
          winnerTeamId: "8291895",
          watchUrl: null,
          watchOptions: []
        },
        {
          number: 2,
          state: "inProgress",
          watchUrl: null,
          watchOptions: []
        }
      ],
      preMatchInsights: {
        watchOptions: []
      }
    };

    const fallbackDetail = {
      id: "dota_lp_sched_example",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Round 5",
      status: "live",
      bestOf: 3,
      startAt: "2026-03-11T13:30:00.000Z",
      teams: {
        left: { id: "9572001", name: "PARIVISION" },
        right: { id: "8291895", name: "Tundra Esports" }
      },
      seriesScore: { left: 0, right: 1 },
      watchUrl: "https://www.twitch.tv/pgl_dota2",
      watchOptions: [
        {
          provider: "twitch",
          watchUrl: "https://www.twitch.tv/pgl_dota2"
        }
      ],
      preMatchInsights: {
        watchOptions: [
          {
            label: "PGL Dota 2",
            url: "https://www.twitch.tv/pgl_dota2",
            note: "Official stream."
          }
        ]
      },
      watchGuide: {
        venue: "PGL Wallachia S7 - Round 5",
        streamUrl: "https://www.twitch.tv/pgl_dota2",
        streamLabel: "Official stream",
        status: "live"
      },
      teamForm: {
        left: { recentMatches: [{ id: "left_recent_1" }] },
        right: { recentMatches: [{ id: "right_recent_1" }] }
      },
      headToHead: {
        total: 2
      },
      prediction: {
        confidence: "medium"
      },
      selectedGame: {
        number: 2,
        state: "inProgress",
        watchUrl: "https://www.twitch.tv/pgl_dota2",
        watchOptions: [
          {
            provider: "twitch",
            watchUrl: "https://www.twitch.tv/pgl_dota2"
          }
        ],
        startedAt: "2026-03-11T14:25:00.000Z"
      },
      seriesGames: [
        {
          number: 1,
          state: "completed",
          winnerTeamId: "8291895",
          watchUrl: "https://www.twitch.tv/pgl_dota2",
          watchOptions: [
            {
              provider: "twitch",
              watchUrl: "https://www.twitch.tv/pgl_dota2"
            }
          ]
        },
        {
          number: 2,
          state: "inProgress",
          watchUrl: "https://www.twitch.tv/pgl_dota2",
          watchOptions: [
            {
              provider: "twitch",
              watchUrl: "https://www.twitch.tv/pgl_dota2"
            }
          ]
        },
        {
          number: 3,
          state: "unstarted",
          watchUrl: "https://www.twitch.tv/pgl_dota2",
          watchOptions: [
            {
              provider: "twitch",
              watchUrl: "https://www.twitch.tv/pgl_dota2"
            }
          ]
        }
      ]
    };

    const merged = mergeDotaDetailContexts(aliasDetail, fallbackDetail);

    assert.equal(merged.source?.provider, "opendota");
    assert.equal(merged.bestOf, 3);
    assert.equal(merged.tournament, "PGL Wallachia S7 - Round 5");
    assert.equal(merged.startAt, "2026-03-11T13:30:00.000Z");
    assert.equal(merged.watchUrl, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.selectedGame.snapshot.left.kills, 15);
    assert.equal(merged.selectedGame.watchUrl, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.seriesGames.length, 3);
    assert.equal(merged.seriesGames[1].watchUrl, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.preMatchInsights.watchOptions[0].url, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.watchGuide.streamUrl, "https://www.twitch.tv/pgl_dota2");
    assert.equal(merged.teamForm.left.recentMatches.length, 1);
    assert.equal(merged.headToHead.total, 2);
    assert.equal(merged.prediction.confidence, "medium");
  });

  it("uses a fast non-enriched fallback merge for direct detail support", async () => {
    const baseDetail = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      teams: {
        left: { id: "7119388", name: "BetBoom Team" },
        right: { id: "10000001", name: "Team Yandex" }
      }
    };
    let receivedOptions = null;

    const merged = await mergeDotaDetailWithFallbackContext(baseDetail, baseDetail.id, {
      fallbackContextTimeoutMs: 50,
      fallbackLoader: async (_matchId, loaderOptions) => {
        receivedOptions = loaderOptions;
        return {
          ...baseDetail,
          tournament: "PGL Wallachia S7 - Playoffs",
          bestOf: 3
        };
      }
    });

    assert.equal(receivedOptions?.skipEnrichment, true);
    assert.equal(merged.bestOf, 3);
    assert.equal(merged.tournament, "PGL Wallachia S7 - Playoffs");
  });

  it("merges richer alias fallback context into a weaker direct Dota detail", async () => {
    const baseDetail = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      bestOf: 1,
      seriesScore: { left: 0, right: 0 },
      teams: {
        left: { id: "2163", name: "Team Liquid" },
        right: { id: "7119388", name: "Team Spirit" }
      }
    };

    const merged = await mergeDotaDetailWithFallbackContext(baseDetail, baseDetail.id, {
      fallbackContextTimeoutMs: 50,
      aliasResolver: async () => "dota_lp_sched_e9d74c65ae84",
      fallbackLoader: async (matchId, loaderOptions) => {
        assert.equal(loaderOptions?.skipEnrichment, true);
        if (matchId === "dota_lp_sched_e9d74c65ae84") {
          return {
            ...baseDetail,
            id: matchId,
            tournament: "PGL Wallachia S7 - Playoffs",
            bestOf: 3,
            seriesScore: { left: 1, right: 1 },
            watchUrl: "https://www.twitch.tv/pgl_dota2"
          };
        }
        return {
          ...baseDetail,
          id: matchId
        };
      }
    });

    assert.equal(merged.bestOf, 3);
    assert.equal(merged.tournament, "PGL Wallachia S7 - Playoffs");
    assert.deepEqual(merged.seriesScore, { left: 1, right: 1 });
    assert.equal(merged.watchUrl, "https://www.twitch.tv/pgl_dota2");
  });

  it("does not block direct detail on a slow fallback support loader", async () => {
    const baseDetail = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "League 19435",
      status: "live",
      teams: {
        left: { id: "7119388", name: "BetBoom Team" },
        right: { id: "10000001", name: "Team Yandex" }
      }
    };
    const startedAt = Date.now();

    const merged = await mergeDotaDetailWithFallbackContext(baseDetail, baseDetail.id, {
      fallbackContextTimeoutMs: 20,
      fallbackLoader: async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ...baseDetail,
              tournament: "Slow fallback tournament"
            });
          }, 120);
        })
    });

    assert.strictEqual(merged, baseDetail);
    assert.ok(Date.now() - startedAt < 100);
  });

  it("does not block OpenDota detail on slow telemetry enrichment", async () => {
    const baseDetail = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Playoffs",
      status: "live",
      sourceMatchId: "8729999999",
      teams: {
        left: { id: "7119388", name: "BetBoom Team" },
        right: { id: "10000001", name: "Team Yandex" }
      },
      selectedGame: {
        number: 2,
        state: "inProgress",
        sourceMatchId: "8729999999"
      }
    };
    const startedAt = Date.now();

    const merged = await enrichDotaDetailWithStratz(baseDetail, {
      telemetryTimeoutMs: 20,
      telemetryLoader: async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ...baseDetail,
              pulseCard: {
                title: "slow telemetry"
              }
            });
          }, 120);
        })
    });

    assert.strictEqual(merged, baseDetail);
    assert.ok(Date.now() - startedAt < 100);
  });

  it("preserves completed-game winners when a later live refresh is weaker", () => {
    const previousDetail = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Playoffs",
      status: "live",
      bestOf: 3,
      startAt: "2026-03-14T15:00:00.000Z",
      teams: {
        left: { id: "7119388", name: "Team Spirit" },
        right: { id: "2163", name: "Team Liquid" }
      },
      seriesScore: { left: 1, right: 1 },
      selectedGame: {
        number: 2,
        state: "completed",
        winnerTeamId: "7119388",
        sourceMatchId: "987654321",
        durationMinutes: 43,
        snapshot: {
          left: { kills: 39, gold: 122199 },
          right: { kills: 13, gold: 71168 }
        }
      },
      seriesGames: [
        {
          number: 1,
          state: "completed",
          winnerTeamId: "2163",
          sourceMatchId: "987654320",
          durationMinutes: 40
        },
        {
          number: 2,
          state: "completed",
          winnerTeamId: "7119388",
          sourceMatchId: "987654321",
          durationMinutes: 43
        },
        {
          number: 3,
          state: "inProgress",
          sourceMatchId: "987654322"
        }
      ],
      topPerformers: [{ name: "mitaka" }]
    };

    const weakerRefresh = {
      id: "dota_od_series_1074484",
      game: "dota2",
      tournament: "PGL Wallachia S7 - Playoffs",
      status: "live",
      bestOf: 3,
      startAt: "2026-03-14T15:00:00.000Z",
      teams: {
        left: { id: "7119388", name: "Team Spirit" },
        right: { id: "2163", name: "Team Liquid" }
      },
      seriesScore: { left: 1, right: 1 },
      selectedGame: {
        number: 2,
        state: "completed",
        snapshot: {
          left: { kills: 0, gold: null },
          right: { kills: 0, gold: null }
        }
      },
      seriesGames: [
        {
          number: 1,
          state: "completed",
          winnerTeamId: "2163"
        },
        {
          number: 2,
          state: "completed"
        },
        {
          number: 3,
          state: "inProgress"
        }
      ],
      topPerformers: []
    };

    const stabilized = stabilizePersistedMatchDetail(previousDetail, weakerRefresh);

    assert.equal(stabilized.selectedGame?.winnerTeamId, "7119388");
    assert.equal(stabilized.selectedGame?.sourceMatchId, "987654321");
    assert.equal(stabilized.selectedGame?.durationMinutes, 43);
    assert.deepEqual(stabilized.selectedGame?.snapshot, previousDetail.selectedGame.snapshot);
    assert.equal(
      stabilized.seriesGames?.find((game) => Number(game?.number) === 2)?.winnerTeamId,
      "7119388"
    );
    assert.equal(
      stabilized.seriesGames?.find((game) => Number(game?.number) === 2)?.sourceMatchId,
      "987654321"
    );
  });
});
