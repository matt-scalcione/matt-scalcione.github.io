import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSeriesScore } from "../src/providers/dota/openDotaProvider.js";

describe("normalizeSeriesScore", () => {
  it("uses provided series wins when present", () => {
    const score = normalizeSeriesScore({
      leftWins: 2,
      rightWins: 1,
      radiantWin: true
    });

    assert.deepEqual(score, { left: 2, right: 1 });
  });

  it("falls back to winner when series wins are missing", () => {
    const score = normalizeSeriesScore({
      leftWins: null,
      rightWins: null,
      radiantWin: false
    });

    assert.deepEqual(score, { left: 0, right: 1 });
  });

  it("falls back to 0:0 when no score signal exists", () => {
    const score = normalizeSeriesScore({
      leftWins: undefined,
      rightWins: undefined,
      radiantWin: undefined
    });

    assert.deepEqual(score, { left: 0, right: 0 });
  });
});
