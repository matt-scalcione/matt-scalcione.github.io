import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "dist-pages");

const publicFiles = [
  ".nojekyll",
  "404.html",
  "index.html",
  "schedule.html",
  "match.html",
  "team.html",
  "follows.html",
  "lol.html",
  "dota2.html",
  "providers.html",
  "logos.html",
  "api-config.js",
  "dota-heroes.generated.js",
  "dota-heroes.js",
  "follows.js",
  "hub.js",
  "loading.js",
  "logos-admin.js",
  "main.js",
  "match.js",
  "providers-admin.js",
  "robots.txt",
  "routes.js",
  "schedule.js",
  "seo.js",
  "site-config.js",
  "sitemap.xml",
  "styles.css",
  "team-logos.generated.js",
  "team-logos.js",
  "team.js"
];

const publicDirectories = ["assets"];

async function ensureCopied(relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const targetPath = path.join(outputDir, relativePath);
  const stat = await fs.stat(sourcePath);

  if (stat.isDirectory()) {
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      filter: (source) => path.basename(source) !== ".DS_Store"
    });
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  for (const relativePath of publicFiles) {
    await ensureCopied(relativePath);
  }

  for (const relativePath of publicDirectories) {
    await ensureCopied(relativePath);
  }

  process.stdout.write(`Built Pages artifact in ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
