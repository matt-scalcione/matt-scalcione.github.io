import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("canonicalStore", () => {
  it("derives a stable canonical key for Dota series snapshots", async () => {
    const module = await import(`../src/storage/canonicalStore.js?test=key-${Date.now()}`);
    const key = module.canonicalStorageMatchId({
      id: "dota_lp_sched_123",
      game: "dota2",
      tournament: "PGL Wallachia Season 7",
      startAt: "2026-03-11T18:35:00.000Z",
      teams: {
        left: { name: "PARIVISION" },
        right: { name: "Tundra Esports" }
      }
    });

    assert.equal(
      key,
      "dota_series_pglwallachiaseason7_parivision_tundraesports_2026031118"
    );
  });

  it("derives a stable canonical key for team profile queries", async () => {
    const module = await import(`../src/storage/canonicalStore.js?test=profile-key-${Date.now()}`);
    const key = module.canonicalTeamProfileKey("team_t1", {
      game: "lol",
      opponentId: "team_gen",
      limit: 5,
      seedMatchId: "lol_lck_2026_w2_t1_gen",
      teamNameHint: "T1"
    });

    assert.equal(typeof key, "string");
    assert.equal(key.length, 64);
  });

  it("stays disabled cleanly when DATABASE_URL is not configured", async () => {
    const previousEnabled = process.env.CANONICAL_STORE_ENABLED;
    const previousDatabaseUrl = process.env.DATABASE_URL;

    process.env.CANONICAL_STORE_ENABLED = "0";
    delete process.env.DATABASE_URL;

    try {
      const module = await import(`../src/storage/canonicalStore.js?test=${Date.now()}`);
      const diagnostics = module.getCanonicalStoreDiagnostics();
      const rows = await module.loadCanonicalMatchCollection({
        surface: "results",
        game: "dota2"
      });
      const profile = await module.loadCanonicalTeamProfile({
        teamId: "team_t1",
        options: {
          game: "lol",
          limit: 5
        }
      });
      const result = await module.persistCanonicalMatchCollection({
        surface: "live",
        rows: []
      });
      const profileResult = await module.persistCanonicalTeamProfile({
        teamId: "team_t1",
        options: {
          game: "lol",
          limit: 5
        },
        profile: {
          id: "team_t1",
          game: "lol",
          name: "T1"
        }
      });

      assert.equal(diagnostics.enabled, false);
      assert.equal(diagnostics.backend, "disabled");
      assert.deepEqual(rows, []);
      assert.equal(profile, null);
      assert.equal(result.enabled, false);
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "disabled");
      assert.equal(profileResult.enabled, false);
      assert.equal(profileResult.skipped, true);
      assert.equal(profileResult.reason, "disabled");
    } finally {
      if (previousEnabled === undefined) {
        delete process.env.CANONICAL_STORE_ENABLED;
      } else {
        process.env.CANONICAL_STORE_ENABLED = previousEnabled;
      }

      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
