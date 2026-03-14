import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldUseCanonicalLiveFallbackForGame } from "../src/data/mockStore.js";

describe("live canonical fallback decision", () => {
  it("uses canonical fallback for LoL when the live provider is degraded and no live rows are present", () => {
    const result = shouldUseCanonicalLiveFallbackForGame({
      targetGame: "lol",
      rows: [],
      providerStates: [
        {
          status: "error",
          rows: []
        }
      ]
    });

    assert.equal(result, true);
  });

  it("does not use canonical fallback when the provider succeeds with zero live rows", () => {
    const result = shouldUseCanonicalLiveFallbackForGame({
      targetGame: "lol",
      rows: [],
      providerStates: [
        {
          status: "success",
          rows: []
        }
      ]
    });

    assert.equal(result, false);
  });

  it("uses canonical Dota live fallback when live providers are degraded and merged live rows are empty", () => {
    const result = shouldUseCanonicalLiveFallbackForGame({
      targetGame: "dota2",
      rows: [],
      providerStates: [
        {
          status: "error",
          rows: []
        },
        {
          status: "success",
          rows: []
        }
      ],
      scheduleState: {
        status: "success",
        rows: []
      }
    });

    assert.equal(result, true);
  });
});
