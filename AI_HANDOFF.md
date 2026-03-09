# Pulseboard AI Handoff

Last updated: 2026-03-08 (America/New_York)
Repo: `/Users/admin/Documents/GitHub/matt-scalcione.github.io`

## 1. Source of truth

This repo is the only repo that matters for the live product.

Do not use:
- `/Users/admin/Documents/Roblox/...`

That older Roblox repo was used temporarily and should be treated as obsolete. The live site and live API now run from this GitHub Pages repo.

Live surfaces:
- Frontend (GitHub Pages): [https://matt-scalcione.github.io](https://matt-scalcione.github.io)
- API (Render): [https://pulseboard-api-drq0.onrender.com](https://pulseboard-api-drq0.onrender.com)

## 2. Product intent

Pulseboard is a mobile-first esports live scores product focused on:
- League of Legends
- Dota 2
- future expansion later

Primary user jobs:
- find what is live now
- find what is scheduled next
- see final results quickly
- open a series or map and understand what is happening without watching
- evaluate upcoming matches using team form, H2H, and prediction context
- follow teams and alerts

UX constraints that are not optional:
- mobile-first is the primary target
- desktop must still look good
- top-of-page chrome must stay compact on mobile
- toolbar/navigation must exist on every page
- pages should get to working content quickly
- do not add decorative hero content that consumes the first screen on mobile

## 3. High-level architecture

This repo contains both the static frontend and the API.

### Frontend
Static HTML/JS/CSS lives at repo root.

Main pages:
- `/index.html` - Live Desk
- `/schedule.html` - Schedule & Results
- `/match.html` - Match Center
- `/team.html` - Team Hub
- `/follows.html` - Watchlist & Alerts
- `/lol.html` - LoL Hub
- `/dota2.html` - Dota Hub
- `/providers.html` - provider diagnostics UI
- `/logos.html` - logo QA/admin UI

Primary frontend files:
- `/main.js`
- `/schedule.js`
- `/match.js`
- `/team.js`
- `/follows.js`
- `/styles.css`
- `/routes.js`
- `/site-config.js`
- `/loading.js`

### API
Node API lives in `/api`.

Primary API files:
- `/api/src/server.js`
- `/api/src/app.js`
- `/api/src/data/mockStore.js`
- `/api/src/providers/lol/lolEsportsProvider.js`
- `/api/src/providers/dota/openDotaProvider.js`
- `/api/src/providers/dota/liquipediaScheduleProvider.js`
- `/api/src/providers/dota/stratzProvider.js`
- `/api/openapi.yaml`

The API is not just mock data anymore. `mockStore.js` is the central orchestration layer for:
- provider precedence
- cache persistence
- stale-while-revalidate behavior
- fallback detail generation
- team profile generation
- diagnostics

## 4. Deployment model

### Frontend deploy
GitHub Pages serves from `main` / repo root.

### API deploy
Render deploys from `/api` via `/render.yaml`.

Current Render blueprint highlights:
- Node 20
- `ESPORTS_DATA_MODE=hybrid`
- `PROVIDER_CACHE_MS=30000`
- `PROVIDER_TIMEOUT_MS=15000`
- `LIQUIPEDIA_DOTA_API_CACHE_MS=30000`
- `STRATZ_API_TOKEN` configured manually in Render env

## 5. Important development rule: cache-bust frontend assets

The frontend HTML files reference JS/CSS using query-string versions, for example:
- `match.js?v=...`
- `team.js?v=...`
- `styles.css?v=...`

When changing frontend behavior that must show up immediately in production, update the corresponding version string in the page HTML. Otherwise Safari and GitHub Pages clients can keep stale bundles.

Files commonly requiring version bumps:
- `/index.html`
- `/schedule.html`
- `/match.html`
- `/team.html`
- `/follows.html`
- sometimes `/lol.html`, `/dota2.html`, `/providers.html`, `/logos.html`

## 6. Current route model

The site uses query-style routes, not pretty-path SPA routing.

Examples:
- `/match.html?id=lol_riot_...`
- `/match.html?id=dota_od_series_...&game=2`
- `/team.html?id=9232161&game=dota2&team_name=Team%20Spirit`

Routing helpers:
- `/routes.js`

Do not invent alternative route formats casually. Use `buildMatchUrl(...)` and `buildTeamUrl(...)` patterns.

## 7. Important identifier taxonomy

This matters a lot.

### LoL
- `lol_riot_*`
  - canonical Riot-backed match/series IDs

### Dota
- `dota_od_series_*`
  - canonical OpenDota series summaries
  - preferred stable Dota match detail IDs when available
- `dota_od_result_*`
  - single-map completed OpenDota result IDs
- `dota_lp_sched_*`
  - Liquipedia schedule-derived synthetic IDs
  - valid for upcoming schedule detail fallback
  - can age out unless preserved/resolved by store logic
- `dota_stratz_*`
  - STRATZ detail-oriented match IDs
  - used for telemetry enrichment / direct STRATZ match detail
- `dota_team_series_*`
  - synthetic team-history grouping IDs built from team match history
  - these are **not** canonical match page IDs
  - they must not be linked directly to `/match.html?id=...`
  - team profiles now attach:
    - `detailMatchId`
    - `sourceMatchId`
  - frontend should use `detailMatchId` when present

## 8. Current production/provider state

As of the latest check, production provider coverage looked like this:

- Dota STRATZ
  - token configured: true
  - live enabled: true
  - detail enabled: true
  - live rows: 0
- Dota OpenDota
  - live rows: 1
  - result rows: 30
- Dota Liquipedia
  - API-only mode: true
  - schedule rows: 21
- Effective Dota live coverage
  - merged live rows: 1

Implication:
- STRATZ detail enrichment is active
- STRATZ live discovery is still not returning live pro rows
- Dota live list discovery still depends on:
  - OpenDota
  - Liquipedia
- Dota detail enrichment uses STRATZ when a concrete match ID is known

Production check endpoint:
- `GET /v1/provider-coverage`

## 9. Dota provider strategy and current limits

### What is working
- Liquipedia API-only schedule for future Dota matches
- OpenDota live/results/history fallback
- STRATZ detail enrichment when match IDs can be resolved
- Dota team form and H2H backfill from team-specific OpenDota history
- Dota hero assets are local and available

### What is not working yet
- STRATZ live pro-match discovery returns empty arrays in production
- because of that, Dota live series discovery is not STRATZ-first yet

### Most likely reason
The STRATZ token appears accepted, but the account likely lacks the exact live discovery entitlement/path we need.

Observed behavior:
- GraphQL requests succeed
- no live rows are returned across several query shapes
- likely account/entitlement issue rather than local request formatting

### What needs to happen with STRATZ
You still need STRATZ to clarify or enable:
- full API-user/live access for the token
- the correct GraphQL path/query for active pro Dota live matches
- whether any allowlisting or account flag is required for live pro discovery

### Where STRATZ code lives
- `/api/src/providers/dota/stratzProvider.js`
- `/api/src/providers/dota/queries/stratzLive.graphql`
- `/api/src/providers/dota/queries/stratzMatchDetail.graphql`
- `/api/test/stratzProvider.test.js`

## 10. Recent important Dota fixes

These are worth understanding before touching Dota again.

### STRATZ snapshot / enrichment fixes
Recent commits:
- `5e69366` - STRATZ Dota detail normalization
- `fb52249` - preserve Dota side orientation in STRATZ merge
- `06724ec` - propagate STRATZ winners into selected map detail
- `384328d` - show Dota basic telemetry on match pages
- `243843a` - fix stale Dota live map selection and STRATZ snapshots
- `84f5463` - stop stale STRATZ enrichment on live Dota maps
- `b2307d0` - prefer player kill totals in STRATZ snapshots
- `2494c84` - polish Dota pending map UX and minimap

What they solved:
- selected live map no longer inherits previous-map telemetry incorrectly
- STRATZ/OpenDota left-right team orientation is preserved
- completed STRATZ maps propagate winners correctly
- Dota match pages render `basic` telemetry instead of hiding most of the page
- pending current maps no longer fake old-map data
- map-only fallback is used when trend data is missing but structure/map state exists
- player kill totals are derived from players if top-level STRATZ kill fields are bogus zeroes

### Dota hero assets
Local hero assets now exist.

Files:
- `/assets/heroes/dota2/icons`
- `/assets/heroes/dota2/portraits`
- `/dota-heroes.generated.js`
- `/dota-heroes.js`
- `/scripts/sync-dota-heroes.mjs`

Match pages use local Dota hero art now.

### Team recent-match link fix
Recent commit:
- `8839555` - fix team recent match detail links

Problem:
- team recent Dota matches sometimes used synthetic `dota_team_series_*` IDs that the match endpoint could not resolve

Fix:
- API team-history rows now include `detailMatchId` and `sourceMatchId`
- team/match page links prefer `detailMatchId`

Files:
- `/api/src/data/mockStore.js`
- `/api/test/mockStore.test.js`
- `/team.js`
- `/match.js`

## 11. Performance and reliability architecture

This was a major focus and should not be regressed.

### Frontend fail-fast behavior
Main pages have browser-side timeouts and stale-request protection:
- `/main.js`
- `/schedule.js`
- `/match.js`
- `/team.js`
- `/follows.js`

Behavior:
- fail fast instead of hanging forever
- ignore stale slower responses
- schedule/results load independently where possible

### API caching and warmers
The API uses restart-safe cache persistence and stale-while-revalidate patterns.

Important files:
- `/api/src/data/mockStore.js`
- `/api/src/server.js`
- `/api/src/app.js`

Key behavior:
- provider list caches are persisted to `.runtime/provider-cache.json`
- match detail caches are persisted
- team profile caches are persisted
- warmers run after startup and on intervals
- cached rows/details can be returned immediately while provider refresh happens in background

Diagnostics:
- `GET /v1/provider-diagnostics`
- `GET /v1/request-diagnostics`
- `GET /v1/data-diagnostics`
- `GET /v1/provider-coverage`

Internal pages:
- `/diagnostics.html`
- `/providers.html`
- `/logos.html`
- `/ops.html`

These are useful for local/admin debugging, but user-facing work should not depend on them.

## 12. Testing and verification

### Frontend syntax
Run from repo root:
```bash
node --check main.js
node --check schedule.js
node --check match.js
node --check team.js
node --check follows.js
```

### API tests
```bash
npm --prefix api test
```

### Useful API checks
```bash
curl 'https://pulseboard-api-drq0.onrender.com/health'
curl 'https://pulseboard-api-drq0.onrender.com/v1/provider-coverage'
curl 'https://pulseboard-api-drq0.onrender.com/v1/live-matches?game=dota2&dota_tiers=1,2,3,4'
curl 'https://pulseboard-api-drq0.onrender.com/v1/schedule?game=dota2&dota_tiers=1,2,3,4'
curl 'https://pulseboard-api-drq0.onrender.com/v1/results?game=dota2&dota_tiers=1,2,3,4'
```

### Local useful scripts
Repo root:
- `npm run heroes:dota:sync`
- `npm run logos:sync`
- `npm run seo:sitemap`
- `npm run seo:check`

API:
- `npm --prefix api run providers:check`

## 13. Frontend product/UX rules

These are based on explicit user feedback and should be treated as binding product constraints.

### Global
- mobile-first is the priority
- desktop should still look good
- top areas must stay compact on mobile
- navigation/toolbar should exist on every page
- do not let headers/heroes push working content below the fold

### Discovery pages
- Live Desk, Schedule, and Watchlist should get the user into content quickly
- avoid giant explanatory hero surfaces on mobile
- empty states must explain whether filters are active
- hidden carry-over filters across pages are not acceptable

### Match pages
- live pages should prioritize following the game
- upcoming pages should prioritize matchup context, timing, watch info, form, H2H, prediction
- completed pages should prioritize result + recap
- series and individual game tabs should be clearly separated conceptually
- if telemetry is degraded, say so clearly instead of implying fake precision

### Team pages
- recent matches must open valid match detail pages
- opponent names should be clickable
- archive/H2H should feel editorial, not like utility tables only

## 14. Known pitfalls

### 1. Using the wrong repo
Do not make product changes in the old Roblox repo.

### 2. Forgetting cache-busts
If frontend JS/CSS changes are not showing up, check the `?v=` strings in HTML files.

### 3. Linking synthetic IDs directly
Do not link `dota_team_series_*` directly as match page IDs.
Use `detailMatchId` when present.

### 4. Confusing live discovery with detail enrichment
For Dota:
- live discovery != detail enrichment
- production currently uses:
  - OpenDota/Liquipedia to discover live/upcoming rows
  - STRATZ to enrich detail when a match ID can be resolved

### 5. Assuming “no match visible” means backend has no data
Several bugs came from hidden filter state or client-side rendering issues.
Always verify the public API before concluding the provider is missing the match.

## 15. Current priority recommendations for the next AI

### Highest value
1. Finish STRATZ live discovery once STRATZ confirms entitlement/query path.
2. Continue tightening Dota live page parity with LoL.
3. Keep refining mobile-first UX without re-introducing oversized top chrome.

### Good next Dota tasks
- when STRATZ discovery is available, switch Dota live discovery to STRATZ-first
- validate against real live pro series end-to-end
- expand richer Dota live surfaces from STRATZ payloads
- continue Dota-specific stat framing:
  - net worth
  - LH/DN
  - GPM/XPM
  - towers
  - barracks/rax
  - Roshan

### Good next UX tasks
- keep improving mobile schedule/results scannability
- tighten match page top stack and live-state clarity
- preserve toolbar/nav on all pages while keeping it compact on mobile

## 16. If you need to debug a user report quickly

Use this order:
1. verify the public API directly
2. determine whether the issue is:
   - provider data missing
   - API normalization bug
   - stale Render deploy
   - frontend render bug
   - stale browser bundle / missing cache-bust
3. if frontend issue, inspect the specific page JS and corresponding HTML version string
4. if API issue, inspect `mockStore.js` first, then the underlying provider file

## 17. Short current status summary

- Live repo is correct and is the only one that matters.
- Frontend and API both live in this repo.
- Major speed/cache hardening is already in place and should be preserved.
- Dota is materially improved:
  - better schedule/results/team history/detail enrichment
  - local hero assets
  - STRATZ detail integration active
- Main remaining Dota blocker is STRATZ live discovery entitlement/query support.
- Team recent-match link bug for Dota synthetic rows was fixed by routing those rows to real detail IDs.

