import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const routesModuleUrl = pathToFileURL(path.join(repoRoot, "routes.js")).href;

const originalWindow = globalThis.window;

function setWindowLocation(href) {
  const current = new URL(href);
  globalThis.window = {
    location: {
      href: current.toString(),
      origin: current.origin
    },
    PULSEBOARD_CONFIG: {
      usePrettyRoutes: false
    }
  };
}

try {
  setWindowLocation("http://127.0.0.1:4173/index.html?api=http%3A%2F%2F127.0.0.1%3A4001");
  const { applyRouteContext, buildMatchUrl, buildTeamUrl } = await import(`${routesModuleUrl}?verify=${Date.now()}`);

  const matchUrl = new URL(buildMatchUrl({ matchId: "lol_lta_2026_w2_fly_tl" }));
  assert.equal(
    matchUrl.searchParams.get("api"),
    "http://127.0.0.1:4001",
    "buildMatchUrl should preserve the active api query parameter"
  );

  const teamUrl = new URL(
    buildTeamUrl({
      teamId: "team_tl",
      game: "lol",
      matchId: "lol_lta_2026_w2_fly_tl",
      teamName: "Team Liquid"
    })
  );
  assert.equal(
    teamUrl.searchParams.get("api"),
    "http://127.0.0.1:4001",
    "buildTeamUrl should preserve the active api query parameter"
  );

  const explicitApiUrl = applyRouteContext(new URL("./schedule.html", "http://127.0.0.1:4173/index.html"), {
    apiBase: "https://example.test"
  });
  assert.equal(
    explicitApiUrl.searchParams.get("api"),
    "https://example.test",
    "applyRouteContext should allow an explicit api override"
  );
} finally {
  globalThis.window = originalWindow;
}
