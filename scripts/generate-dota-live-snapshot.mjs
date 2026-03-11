import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "assets", "provider-snapshots", "dota-live.json");
const outputDir = path.dirname(outputPath);

async function main() {
  process.env.ESPORTS_DATA_MODE = "provider";
  process.env.PULSEBOARD_DOTA_LIVE_SNAPSHOT_URL = "";
  process.env.PULSEBOARD_DOTA_RESULTS_SNAPSHOT_URL = "";

  const store = await import(`../api/src/data/mockStore.js?dotaLiveSnapshot=${Date.now()}`);
  const rows = await store.listLiveMatches({
    game: "dota2",
    region: undefined,
    followedOnly: false,
    userId: null,
    dotaTiers: [1, 2, 3, 4],
    lolTiers: undefined,
    useCanonicalFallback: false
  });

  await fs.mkdir(outputDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote Dota live snapshot with ${rows.length} rows to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
