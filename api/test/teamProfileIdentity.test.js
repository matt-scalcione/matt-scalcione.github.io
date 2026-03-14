import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveTeamProfileIdentityContext,
  deriveTeamProfileSeedContext
} from "../src/data/mockStore.js";

describe("deriveTeamProfileSeedContext", () => {
  it("infers team name and seed match id from collection rows", () => {
    const context = deriveTeamProfileSeedContext("lol_left_115740063459902697", {
      game: "lol",
      scheduleRows: [
        {
          id: "lol_riot_115740063459902697",
          updatedAt: "2026-03-14T02:07:33.329Z",
          teams: {
            left: { id: "lol_left_115740063459902697", name: "VARREL YOUTH" },
            right: { id: "lol_right_115740063459902697", name: "L Guide Gaming" }
          }
        }
      ]
    });

    assert.equal(context.teamName, "VARREL YOUTH");
    assert.equal(context.seedMatchId, "lol_riot_115740063459902697");
  });

  it("derives a Riot seed match id from LoL match-side team ids when no rows are available", () => {
    const context = deriveTeamProfileSeedContext("lol_right_116130368700936068", {
      game: "lol"
    });

    assert.equal(context.teamName, null);
    assert.equal(context.seedMatchId, "lol_riot_116130368700936068");
  });

  it("prefers explicit team context over inferred values", () => {
    const context = deriveTeamProfileSeedContext("lol_left_115740063459902697", {
      game: "lol",
      seedMatchId: "lol_riot_explicit",
      teamNameHint: "Explicit Team",
      scheduleRows: [
        {
          id: "lol_riot_115740063459902697",
          updatedAt: "2026-03-14T02:07:33.329Z",
          teams: {
            left: { id: "lol_left_115740063459902697", name: "VARREL YOUTH" },
            right: { id: "lol_right_115740063459902697", name: "L Guide Gaming" }
          }
        }
      ]
    });

    assert.equal(context.teamName, "Explicit Team");
    assert.equal(context.seedMatchId, "lol_riot_explicit");
  });

  it("expands team aliases across provider ids when rows share the same team name", () => {
    const context = deriveTeamProfileIdentityContext("dota_lp_team_heroic", {
      game: "dota2",
      scheduleRows: [
        {
          id: "dota_sched_heroic_1",
          teams: {
            left: { id: "dota_lp_team_heroic", name: "HEROIC" },
            right: { id: "dota_lp_team_tundra", name: "Tundra Esports" }
          }
        }
      ],
      resultsRows: [
        {
          id: "dota_result_heroic_1",
          teams: {
            left: { id: "9303484", name: "Heroic" },
            right: { id: "8291895", name: "Tundra Esports" }
          }
        }
      ]
    });

    assert.equal(context.teamName, "HEROIC");
    assert.equal(context.seedMatchId, "dota_sched_heroic_1");
    assert.deepEqual(new Set(context.teamIds), new Set(["dota_lp_team_heroic", "9303484"]));
    assert.deepEqual(context.teamNames, ["HEROIC"]);
  });
});
