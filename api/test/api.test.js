import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeRequest } from "../src/app.js";

describe("health", () => {
  it("returns status ok", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/health"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.status, "ok");
    assert.equal(result.payload.service, "esports-live-api");
  });
});

describe("live matches", () => {
  it("lists live matches", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/live-matches"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.payload.data));
    assert.ok(result.payload.data.length >= 1);
  });

  it("filters matches by game", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/live-matches?game=dota2"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.payload.data.every((match) => match.game === "dota2"));
  });

  it("requires user when followed_only=true", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/live-matches?followed_only=true"
    });

    assert.equal(result.statusCode, 400);
  });

  it("validates dota_tiers query", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/live-matches?game=dota2&dota_tiers=7"
    });

    assert.equal(result.statusCode, 400);
  });
});

describe("match detail", () => {
  it("returns match detail for known match", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/matches/lol_lta_2026_w2_fly_tl"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.id, "lol_lta_2026_w2_fly_tl");
  });

  it("accepts optional game query selector", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/matches/lol_lta_2026_w2_fly_tl?game=1"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.id, "lol_lta_2026_w2_fly_tl");
  });

  it("validates match game query selector", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/matches/lol_lta_2026_w2_fly_tl?game=0"
    });

    assert.equal(result.statusCode, 400);
  });

  it("returns 404 for unknown match", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/matches/does_not_exist"
    });

    assert.equal(result.statusCode, 404);
  });
});

describe("team profile", () => {
  it("returns team profile with recent matches", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/teams/team_t1?game=lol&limit=5"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.id, "team_t1");
    assert.ok(Array.isArray(result.payload.data.recentMatches));
    assert.ok(result.payload.data.recentMatches.length <= 5);
  });

  it("validates team profile limit query", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/teams/team_t1?game=lol&limit=30"
    });

    assert.equal(result.statusCode, 400);
  });

  it("accepts seed context and team name hint", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/teams/team_fly?game=lol&seed_match_id=lol_lta_2026_w2_fly_tl&team_name=FlyQuest&limit=5"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.id, "team_fly");
    assert.equal(result.payload.data.name, "FlyQuest");
  });

  it("falls back to team_name when team id history is sparse", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/teams/nonexistent_team_id?game=lol&team_name=Cloud9&limit=5"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.name, "Cloud9");
    assert.ok(result.payload.data.recentMatches.length >= 1);
  });

  it("keeps recentMatches populated even when opponent filter is provided", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/teams/team_c9?game=lol&opponent_id=team_t1&limit=5"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.payload.data.recentMatches));
    assert.ok(result.payload.data.recentMatches.length >= 1);
  });
});

describe("schedule", () => {
  it("lists schedule matches", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/schedule"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.payload.data));
    assert.ok(result.payload.data.length >= 1);
  });

  it("filters schedule by region", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/schedule?region=kr"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.payload.data.every((match) => match.region === "kr"));
  });

  it("returns bad request for invalid date range", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/schedule?date_from=2026-03-06T00:00:00Z&date_to=2026-03-04T00:00:00Z"
    });

    assert.equal(result.statusCode, 400);
  });

  it("validates dota tier query on schedule", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/schedule?game=dota2&dota_tiers=1,5"
    });

    assert.equal(result.statusCode, 400);
  });
});

describe("results", () => {
  it("lists completed matches", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/results"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.payload.data.length >= 1);
    assert.ok(result.payload.data.every((match) => match.status === "completed"));
  });

  it("filters results by game", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/results?game=dota2"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(result.payload.data.every((match) => match.game === "dota2"));
  });
});

describe("provider coverage", () => {
  it("returns provider coverage metadata", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/provider-coverage"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.payload.data.dota.stratz.provider, "stratz");
    assert.equal(result.payload.data.dota.liquipedia.apiOnly, true);
  });
});

describe("notification preferences", () => {
  it("gets and updates preferences", async () => {
    const getInitial = await routeRequest({
      method: "GET",
      url: "/v1/notification-preferences?user_id=test-user"
    });

    assert.equal(getInitial.statusCode, 200);
    assert.equal(getInitial.payload.data.userId, "test-user");

    const putResult = await routeRequest({
      method: "PUT",
      url: "/v1/notification-preferences",
      body: {
        userId: "test-user",
        webPush: true,
        emailDigest: true,
        swingAlerts: true,
        matchStart: false,
        matchFinal: true
      }
    });

    assert.equal(putResult.statusCode, 200);
    assert.equal(putResult.payload.data.webPush, true);
    assert.equal(putResult.payload.data.matchStart, false);
  });
});

describe("follows", () => {
  it("creates, lists, and deletes a follow", async () => {
    const createResult = await routeRequest({
      method: "POST",
      url: "/v1/follows",
      body: {
        userId: "test-user",
        entityType: "team",
        entityId: "team_gen"
      }
    });

    assert.equal(createResult.statusCode, 201);
    assert.ok(createResult.payload.data.id);

    const followId = createResult.payload.data.id;

    const listResult = await routeRequest({
      method: "GET",
      url: "/v1/follows?user_id=test-user"
    });

    assert.equal(listResult.statusCode, 200);
    assert.ok(listResult.payload.data.some((row) => row.id === followId));

    const deleteResult = await routeRequest({
      method: "DELETE",
      url: `/v1/follows/${followId}?user_id=test-user`
    });

    assert.equal(deleteResult.statusCode, 204);
  });
});
