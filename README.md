# Pulseboard (GitHub Pages + API)

This repo contains:

- The Pulseboard static site at repo root.
- The Pulseboard API under [`api/`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api).

Legacy side projects have been removed from the root workflow so this repository stays focused on the scoreboard product.

## 1. Deploy The API (Render)

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select this repo. Render will detect [`render.yaml`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/render.yaml).
4. Create the service. Wait until status is **Live**.
5. In GitHub repo settings, add secrets:
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID` (from Render service settings)
6. Run workflow **Deploy API to Render** or push changes to `main` that touch `api/`, `render.yaml`, or the workflow itself.
7. Copy your API URL (example: `https://pulseboard-api.onrender.com`).
8. Verify with:
   - `https://YOUR_API_URL/health`
   - `https://YOUR_API_URL/v1/live-matches?game=lol`

## 2. Point The Site To Deployed API

Edit [`site-config.js`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/site-config.js):

```js
window.PULSEBOARD_API_BASE = "https://YOUR_API_URL";
```

Commit and push. GitHub Pages will then call your hosted API instead of localhost.

## 3. Publish GitHub Pages

GitHub Pages is deployed by the workflow in [`.github/workflows/pages.yml`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/.github/workflows/pages.yml).

The workflow:

1. Regenerates `sitemap.xml`
2. Publishes a Dota schedule snapshot for provider fallback
3. Runs SEO validation
4. Builds a Pages artifact with `node scripts/build-pages-artifact.mjs`
5. Uploads only the public site files in `dist-pages/`

Your site URL will be:

- `https://matt-scalcione.github.io/`

Local verification:

- `npm run verify`
- `npm run build:pages`

## 4. SEO Sitemap Automation

- Sitemap is generated from live API data via [`scripts/generate-sitemap.mjs`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/scripts/generate-sitemap.mjs).
- Run locally:
  - `node scripts/generate-sitemap.mjs`
- SEO validation checks (canonical + robots + sitemap):
  - `node scripts/seo-check.mjs`
- The Pages workflow also regenerates sitemap automatically:
  - On every push to `main`
  - Every 6 hours (scheduled run)
  - Deploy is blocked if SEO checks fail
- Default policy excludes match/team detail URLs unless `PULSEBOARD_INDEX_DETAIL_PAGES=true`

## 5. Game Hubs

- LoL hub: `https://matt-scalcione.github.io/lol.html`
- Dota 2 hub: `https://matt-scalcione.github.io/dota2.html`
- Provider admin: `https://matt-scalcione.github.io/providers.html`
- Hubs include:
  - Live cards
  - Upcoming preview templates
  - Recent recap templates
  - Tournament radar

## 6. Route Mode

Default link mode is query-style (SEO-safe for GitHub Pages 404 behavior):

- `match.html?id=...`
- `team.html?id=...`

To force pretty route links, set in [`site-config.js`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/site-config.js):

```js
window.PULSEBOARD_CONFIG = {
  ...window.PULSEBOARD_CONFIG,
  usePrettyRoutes: true
};
```

## 7. Detail Page Indexing Policy

By default, detail pages are kept non-indexed for crawler safety on static hosting:

```js
window.PULSEBOARD_CONFIG = {
  ...window.PULSEBOARD_CONFIG,
  indexDetailPages: false
};
```

To enable indexing for `/match.html?id=...` and `/team.html?id=...`, set:

```js
window.PULSEBOARD_CONFIG = {
  ...window.PULSEBOARD_CONFIG,
  indexDetailPages: true
};
```
