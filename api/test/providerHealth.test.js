import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessProviderStateHealth } from "../src/data/mockStore.js";

describe("provider health", () => {
  it("treats success with zero rows as healthy but empty", () => {
    const health = assessProviderStateHealth({
      status: "success",
      rows: [],
      fetchedAt: Date.parse("2026-03-14T02:50:00.000Z"),
      lastOutcome: "success",
      rateLimitedUntil: 0
    }, {
      nowMs: Date.parse("2026-03-14T02:50:10.000Z"),
      cacheMs: 30_000
    });

    assert.equal(health.level, "healthy");
    assert.equal(health.reason, "empty_success");
    assert.equal(health.empty, true);
    assert.equal(health.usable, false);
  });

  it("treats cached rate-limited rows as degraded but usable", () => {
    const health = assessProviderStateHealth({
      status: "success",
      rows: [{ id: "match_1" }],
      fetchedAt: Date.parse("2026-03-14T02:50:00.000Z"),
      lastOutcome: "rate-limited-cache",
      rateLimitedUntil: Date.parse("2026-03-14T02:51:00.000Z")
    }, {
      nowMs: Date.parse("2026-03-14T02:50:10.000Z"),
      cacheMs: 30_000
    });

    assert.equal(health.level, "degraded");
    assert.equal(health.usable, true);
    assert.equal(health.reason, "rate_limited_cache");
  });

  it("treats provider errors with no rows as down", () => {
    const health = assessProviderStateHealth({
      status: "error",
      rows: [],
      fetchedAt: Date.parse("2026-03-14T02:50:00.000Z"),
      lastOutcome: "error",
      rateLimitedUntil: 0
    }, {
      nowMs: Date.parse("2026-03-14T02:50:10.000Z"),
      cacheMs: 30_000
    });

    assert.equal(health.level, "down");
    assert.equal(health.usable, false);
    assert.equal(health.reason, "error");
  });
});
