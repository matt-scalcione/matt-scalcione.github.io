import http from "node:http";
import { createRequestHandler } from "./app.js";
import { warmProviderCaches } from "./data/mockStore.js";

const port = Number.parseInt(process.env.PORT || "4000", 10);
const host = process.env.HOST || "0.0.0.0";
const warmerEnabled = String(process.env.API_WARMER_ENABLED || "1").trim() !== "0";
const warmerIntervalMs = Number.parseInt(process.env.API_WARMER_INTERVAL_MS || "35000", 10);
const warmerInitialDelayMs = Number.parseInt(process.env.API_WARMER_INITIAL_DELAY_MS || "1500", 10);

const server = http.createServer(createRequestHandler());

async function runWarmCycle(reason = "interval") {
  try {
    const result = await warmProviderCaches();
    if (result?.skipped) {
      return;
    }

    const summary = Array.isArray(result?.providers)
      ? result.providers.map((provider) => `${provider.label}:${provider.lastOutcome}`).join(" ")
      : "";
    // eslint-disable-next-line no-console
    console.log(
      `[warmer] ${reason} completed in ${Number(result?.durationMs || 0).toFixed(1)}ms${summary ? ` ${summary}` : ""}`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[warmer] ${reason} failed${error?.message ? ` ${error.message}` : ""}`);
  }
}

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`esports-live-api listening at http://${host}:${port}`);

  if (warmerEnabled) {
    setTimeout(() => {
      void runWarmCycle("startup");
    }, Math.max(0, warmerInitialDelayMs));
    setInterval(() => {
      void runWarmCycle("interval");
    }, Math.max(1000, warmerIntervalMs));
  }
});
