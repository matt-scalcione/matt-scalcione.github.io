import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "assets", "provider-snapshots", "lol-results.json");
const outputDir = path.dirname(outputPath);

async function main() {
  const { LolEsportsProvider } = await import("../api/src/providers/lol/lolEsportsProvider.js");

  const provider = new LolEsportsProvider({
    timeoutMs: Number.parseInt(process.env.PROVIDER_TIMEOUT_MS || "15000", 10)
  });
  const rows = await provider.fetchRecentResults({
    maxRows: Number.parseInt(process.env.LOL_RESULTS_SNAPSHOT_MAX_ROWS || "40", 10)
  });

  await fs.mkdir(outputDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote LoL results snapshot with ${rows.length} rows to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
