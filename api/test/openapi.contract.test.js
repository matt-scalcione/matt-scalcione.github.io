import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeRequest } from "../src/app.js";

const openApiPath = new URL("../openapi.yaml", import.meta.url);

function assertMatchSummary(row) {
  assert.equal(typeof row.id, "string");
  assert.equal(typeof row.game, "string");
  assert.equal(typeof row.region, "string");
  assert.equal(typeof row.tournament, "string");
  assert.equal(typeof row.status, "string");
  assert.equal(typeof row.startAt, "string");
  assert.equal(typeof row.teams?.left?.name, "string");
  assert.equal(typeof row.teams?.right?.name, "string");
  assert.equal(typeof row.seriesScore?.left, "number");
  assert.equal(typeof row.seriesScore?.right, "number");
}

describe("openapi coverage", () => {
  it("documents required endpoint paths", () => {
    const spec = readFileSync(openApiPath, "utf8");

    const requiredPaths = [
      "/health:",
      "/v1/live-matches:",
      "/v1/schedule:",
      "/v1/results:",
      "/v1/provider-coverage:",
      "/v1/matches/{id}:",
      "/v1/teams/{id}:",
      "/v1/stream/matches/{id}:",
      "/v1/follows:",
      "/v1/follows/{id}:",
      "/v1/notification-preferences:"
    ];

    for (const pathKey of requiredPaths) {
      assert.ok(spec.includes(pathKey), `Missing path in openapi spec: ${pathKey}`);
    }
  });
});

describe("contract checks", () => {
  it("live matches response shape matches contract expectations", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/live-matches"
    });

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.payload.data));
    assert.equal(typeof result.payload.meta.count, "number");
    assert.equal(typeof result.payload.meta.generatedAt, "string");

    if (result.payload.data.length > 0) {
      assertMatchSummary(result.payload.data[0]);
    }
  });

  it("schedule and results return collection metadata", async () => {
    const schedule = await routeRequest({
      method: "GET",
      url: "/v1/schedule"
    });
    const results = await routeRequest({
      method: "GET",
      url: "/v1/results"
    });

    assert.equal(schedule.statusCode, 200);
    assert.equal(results.statusCode, 200);
    assert.equal(typeof schedule.payload.meta.count, "number");
    assert.equal(typeof results.payload.meta.count, "number");
  });

  it("notification preferences shape matches contract expectations", async () => {
    const result = await routeRequest({
      method: "GET",
      url: "/v1/notification-preferences?user_id=demo-user"
    });

    assert.equal(result.statusCode, 200);
    assert.equal(typeof result.payload.data.userId, "string");
    assert.equal(typeof result.payload.data.webPush, "boolean");
    assert.equal(typeof result.payload.data.emailDigest, "boolean");
    assert.equal(typeof result.payload.data.swingAlerts, "boolean");
    assert.equal(typeof result.payload.data.matchStart, "boolean");
    assert.equal(typeof result.payload.data.matchFinal, "boolean");
    assert.equal(typeof result.payload.data.updatedAt, "string");
  });
});
