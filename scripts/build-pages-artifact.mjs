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
  "data-provenance.js",
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
  "runtime-status.js",
  "schedule.js",
  "seo.js",
  "site-config.js",
  "site-header.js",
  "sitemap.xml",
  "styles.css",
  "team-logos.generated.js",
  "team-logos.js",
  "team.js",
  "watchlist-client.js",
  "workspace-user.js"
];

const publicDirectories = ["assets"];

const referencedAssetPattern = /(?:src|href)=["'](\.\/[^"']+)["']/g;
const referencedImportPattern =
  /(?:from\s+["'](\.\/[^"']+)["'])|(?:import\s*\(\s*["'](\.\/[^"']+)["']\s*\))|(?:import\s+["'](\.\/[^"']+)["'])/g;

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

function normalizeReferenceTarget(value) {
  return String(value || "")
    .trim()
    .replace(/[#?].*$/, "");
}

async function collectFiles(dirPath, extensions, acc = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, extensions, acc);
      continue;
    }
    if (extensions.has(path.extname(entry.name))) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function collectReferences(content, pattern) {
  const refs = [];
  for (const match of content.matchAll(pattern)) {
    const value = match[1] || match[2] || match[3] || "";
    const normalized = normalizeReferenceTarget(value);
    if (normalized.startsWith("./")) {
      refs.push(normalized);
    }
  }
  return refs;
}

async function verifyArtifactReferences() {
  const candidateFiles = await collectFiles(outputDir, new Set([".html", ".js"]));
  const missing = [];

  for (const filePath of candidateFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const references = [
      ...collectReferences(content, referencedAssetPattern),
      ...collectReferences(content, referencedImportPattern)
    ];

    for (const reference of references) {
      const resolvedPath = path.resolve(path.dirname(filePath), reference);
      try {
        await fs.access(resolvedPath);
      } catch {
        missing.push({
          filePath,
          reference
        });
      }
    }
  }

  if (missing.length > 0) {
    const lines = missing
      .map(({ filePath, reference }) => `${path.relative(outputDir, filePath)} -> ${reference}`)
      .join("\n");
    throw new Error(`Pages artifact is missing referenced files:\n${lines}`);
  }
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

  await verifyArtifactReferences();

  process.stdout.write(`Built Pages artifact in ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
