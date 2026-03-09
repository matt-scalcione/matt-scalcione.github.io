import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const scriptsDir = path.join(repoRoot, "scripts");

async function listFiles(dirPath, matcher) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && matcher(entry.name))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function runNodeCheck(filePath) {
  execFileSync(process.execPath, ["--check", filePath], {
    stdio: "inherit"
  });
}

async function main() {
  const rootJavaScript = await listFiles(
    repoRoot,
    (name) => name.endsWith(".js") || name.endsWith(".cjs") || name.endsWith(".mjs")
  );
  const scriptFiles = await listFiles(
    scriptsDir,
    (name) => name.endsWith(".js") || name.endsWith(".cjs") || name.endsWith(".mjs")
  );

  for (const filePath of [...rootJavaScript, ...scriptFiles]) {
    runNodeCheck(filePath);
  }

  execFileSync(process.execPath, [path.join(scriptsDir, "seo-check.mjs")], {
    stdio: "inherit"
  });
  execFileSync(process.execPath, [path.join(scriptsDir, "verify-route-context.mjs")], {
    stdio: "inherit"
  });
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
