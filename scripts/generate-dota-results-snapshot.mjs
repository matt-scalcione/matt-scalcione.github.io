import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "assets", "provider-snapshots", "dota-results.json");
const outputDir = path.dirname(outputPath);
const DEFAULT_API_BASE = "https://api.pulseboard.mindpointdesign.opalstacked.com";

function normalizeApiBase(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_API_BASE;
}

async function readExistingSnapshotRows() {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

async function fetchRowsFromApi(maxRows) {
  const apiBase = normalizeApiBase(process.env.PULSEBOARD_API_BASE);
  const url = new URL("/v1/results", `${apiBase}/`);
  url.searchParams.set("game", "dota2");
  url.searchParams.set("dota_tiers", "1,2,3,4");
  url.searchParams.set("limit", String(maxRows));

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API fallback request failed (${response.status})`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.slice(0, maxRows);
}

async function fetchRowsFromProvider(maxRows) {
  const { OpenDotaProvider } = await import("../api/src/providers/dota/openDotaProvider.js");

  const provider = new OpenDotaProvider({
    timeoutMs: Number.parseInt(process.env.PROVIDER_TIMEOUT_MS || "15000", 10)
  });

  return provider.fetchRecentResults({
    allowedTiers: [1, 2, 3, 4],
    maxRows
  });
}

async function main() {
  const maxRows = Number.parseInt(process.env.DOTA_RESULTS_SNAPSHOT_MAX_ROWS || "40", 10);
  let rows = [];
  let source = "OpenDota provider";

  try {
    rows = await fetchRowsFromProvider(maxRows);
  } catch (providerError) {
    process.stderr.write(
      `[snapshot] Dota results provider fetch failed: ${providerError?.stack || providerError}\n`
    );
    try {
      rows = await fetchRowsFromApi(maxRows);
      source = "Pulseboard API fallback";
    } catch (apiError) {
      process.stderr.write(
        `[snapshot] Dota results API fallback failed: ${apiError?.stack || apiError}\n`
      );
      rows = await readExistingSnapshotRows();
      source = "existing snapshot fallback";
      if (!rows.length) {
        throw providerError;
      }
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows
  };
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Wrote Dota results snapshot with ${rows.length} rows to ${outputPath} via ${source}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
