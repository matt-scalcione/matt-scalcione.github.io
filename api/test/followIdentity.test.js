import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addFollow,
  matchTeamFollowAgainstRow,
  resolveCanonicalFollowTeamId
} from "../src/data/mockStore.js";

describe("follow identity", () => {
  it("derives canonical team ids for numeric Dota follows", () => {
    const canonicalId = resolveCanonicalFollowTeamId("8879077");
    assert.equal(canonicalId, "dota2:id:8879077");
  });

  it("stores canonicalEntityId on team follows", () => {
    const follow = addFollow({
      userId: `test-follow-${Date.now()}`,
      entityType: "team",
      entityId: "8879077"
    });

    assert.equal(follow.canonicalEntityId, "dota2:id:8879077");
  });

  it("matches follows against canonical team ids on rows", () => {
    const matched = matchTeamFollowAgainstRow(
      {
        entityType: "team",
        entityId: "8879077",
        canonicalEntityId: "dota2:id:8879077"
      },
      {
        game: "dota2",
        teams: {
          left: { id: "dota_lp_team_titan", name: "Titan Strikers" },
          right: { id: "8936613", name: "Arcane Raiders" }
        },
        identity: {
          teams: {
            left: "dota2:id:8879077",
            right: "dota2:id:8936613"
          }
        }
      }
    );

    assert.equal(matched, true);
  });
});
