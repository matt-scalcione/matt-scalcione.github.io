import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';
const CDN_BASE = 'https://cdn.cloudflare.steamstatic.com';
const ICON_DIR = join(ROOT_DIR, 'assets', 'heroes', 'dota2', 'icons');
const PORTRAIT_DIR = join(ROOT_DIR, 'assets', 'heroes', 'dota2', 'portraits');
const OUTPUT_JS_PATH = join(ROOT_DIR, 'dota-heroes.generated.js');

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugFromRow(row) {
  return String(row?.name || '')
    .replace(/^npc_dota_hero_/, '')
    .trim();
}

async function download(url, path) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Pulseboard/1.0' } });
  if (!response.ok) {
    throw new Error(`Failed download ${url}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, buffer);
}

async function main() {
  mkdirSync(ICON_DIR, { recursive: true });
  mkdirSync(PORTRAIT_DIR, { recursive: true });

  const response = await fetch(HERO_STATS_URL, { headers: { 'User-Agent': 'Pulseboard/1.0' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch Dota hero stats: ${response.status}`);
  }

  const rows = await response.json();
  const sorted = Array.isArray(rows) ? rows.slice().sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0)) : [];
  const byId = {};
  const byName = {};

  for (const row of sorted) {
    const id = String(row?.id || '').trim();
    const slug = slugFromRow(row);
    const localizedName = String(row?.localized_name || '').trim();
    const engineName = String(row?.name || '').trim();
    if (!id || !slug || !localizedName) {
      continue;
    }

    const iconRemote = `${CDN_BASE}${String(row?.icon || '').replace(/\?$/, '')}`;
    const portraitRemote = `${CDN_BASE}${String(row?.img || '').replace(/\?$/, '')}`;
    const iconFilename = `${slug}-${id}-icon.png`;
    const portraitFilename = `${slug}-${id}-portrait.png`;
    const iconPath = join(ICON_DIR, iconFilename);
    const portraitPath = join(PORTRAIT_DIR, portraitFilename);
    await download(iconRemote, iconPath);
    await download(portraitRemote, portraitPath);

    const record = {
      id,
      name: localizedName,
      slug,
      engineName,
      iconUrl: `./assets/heroes/dota2/icons/${iconFilename}`,
      portraitUrl: `./assets/heroes/dota2/portraits/${portraitFilename}`
    };

    byId[id] = record;
    for (const alias of [localizedName, engineName, slug.replace(/_/g, ' ')]) {
      const key = normalizeKey(alias);
      if (key) {
        byName[key] = record;
      }
    }
  }

  const manifest = {
    updatedAt: new Date().toISOString(),
    count: Object.keys(byId).length,
    byId,
    byName
  };

  writeFileSync(OUTPUT_JS_PATH, `export const DOTA_HERO_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`, 'utf8');
  console.log(`Synced ${manifest.count} Dota heroes`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
