import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annotateEntitySource,
  compareSourcePriority,
  getSourcePolicyCatalog,
  summarizeSourceUsage
} from "../src/domain/sourcePolicy.js";

describe("sourcePolicy", () => {
  it("marks synthetic Dota live rows as derived schedule promotions", () => {
    const row = annotateEntitySource({
      id: "dota_lp_sched_123",
      game: "dota2",
      status: "live",
      keySignal: "provider_schedule_started",
      source: {
        provider: "liquipedia"
      }
    });

    assert.equal(row.source.provider, "liquipedia");
    assert.equal(row.source.provenance.surface, "live");
    assert.equal(row.source.provenance.delivery, "synthetic_live");
    assert.equal(row.source.provenance.ownership, "derived");
    assert.equal(row.source.provenance.derivedFromSurface, "schedule");
  });

  it("prefers STRATZ over OpenDota for Dota live rows", () => {
    const stratzRow = {
      id: "dota_stratz_1",
      game: "dota2",
      status: "live",
      teams: {
        left: { id: "1", name: "Alpha" },
        right: { id: "2", name: "Beta" }
      },
      source: {
        provider: "stratz"
      }
    };
    const openDotaRow = {
      id: "dota_od_live_1",
      game: "dota2",
      status: "live",
      teams: {
        left: { id: "1", name: "Alpha" },
        right: { id: "2", name: "Beta" }
      },
      source: {
        provider: "opendota"
      }
    };

    assert.equal(compareSourcePriority(stratzRow, openDotaRow, { surface: "live" }) > 0, true);
  });

  it("summarizes provider usage across a collection", () => {
    const summary = summarizeSourceUsage([
      {
        id: "lol_riot_1",
        game: "lol",
        status: "live",
        source: {
          provider: "riot"
        }
      },
      {
        id: "dota_lp_sched_123",
        game: "dota2",
        status: "live",
        keySignal: "provider_schedule_started",
        source: {
          provider: "liquipedia"
        }
      }
    ], {
      surface: "live"
    });

    assert.equal(summary.total, 2);
    assert.equal(summary.syntheticRows, 1);
    assert.equal(summary.providers.some((provider) => provider.provider === "riot"), true);
    assert.equal(summary.providers.some((provider) => provider.provider === "liquipedia"), true);
  });

  it("publishes the Dota source policy catalog with DLTV as experimental", () => {
    const catalog = getSourcePolicyCatalog();
    const dltv = catalog.dota2.live.find((provider) => provider.provider === "dltv");

    assert.ok(dltv);
    assert.equal(dltv.experimental, true);
    assert.equal(dltv.disabledByDefault, true);
    assert.equal(dltv.ownership, "experimental");
  });
});
