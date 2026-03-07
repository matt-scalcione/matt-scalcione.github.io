const inputBase = process.argv[2] || process.env.PULSEBOARD_API_BASE || "http://localhost:4000";

function normalizeApiBase(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid API base: ${value}`);
  }
}

function formatStatus(label, value) {
  return `${label.padEnd(24)} ${value}`;
}

async function main() {
  const apiBase = normalizeApiBase(inputBase);
  const response = await fetch(`${apiBase}/v1/provider-coverage`);
  if (!response.ok) {
    throw new Error(`Coverage request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const report = payload?.data;
  if (!report) {
    throw new Error("Coverage response did not contain data.");
  }

  const dota = report.dota || {};
  const lol = report.lol || {};

  console.log(`API Base: ${apiBase}`);
  console.log(`Generated: ${report.generatedAt || "n/a"}`);
  console.log(`Mode: ${report.providerMode || "unknown"}`);
  console.log("");
  console.log("[Dota]");
  console.log(formatStatus("STRATZ live enabled", String(Boolean(dota?.stratz?.liveEnabled))));
  console.log(formatStatus("STRATZ token", String(Boolean(dota?.stratz?.tokenConfigured))));
  console.log(formatStatus("STRATZ query source", dota?.stratz?.liveQuerySource || "missing"));
  console.log(formatStatus("STRATZ live rows", String(dota?.stratz?.liveRows || 0)));
  console.log(formatStatus("OpenDota live rows", String(dota?.openDota?.liveRows || 0)));
  console.log(formatStatus("OpenDota result rows", String(dota?.openDota?.resultRows || 0)));
  console.log(formatStatus("Liquipedia rows", String(dota?.liquipedia?.scheduleRows || 0)));
  console.log(formatStatus("Synthetic promotions", String(dota?.effectiveLiveCoverage?.syntheticPromotions || 0)));
  console.log(formatStatus("Effective live rows", String(dota?.effectiveLiveCoverage?.effectiveLiveRows || 0)));
  console.log("");
  console.log("[LoL]");
  console.log(formatStatus("Live rows", String(lol?.liveRows || 0)));
  console.log(formatStatus("Schedule rows", String(lol?.scheduleRows || 0)));
  console.log(formatStatus("Result rows", String(lol?.resultRows || 0)));
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
