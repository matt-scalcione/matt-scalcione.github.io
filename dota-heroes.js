import { DOTA_HERO_MANIFEST } from "./dota-heroes.generated.js";

export { DOTA_HERO_MANIFEST };

export function normalizeDotaHeroKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveLocalDotaHeroMeta(heroName) {
  const key = normalizeDotaHeroKey(heroName);
  if (!key) {
    return null;
  }
  return DOTA_HERO_MANIFEST?.byName?.[key] || null;
}
