# Dota Provider Activation Checklist

This is the operational checklist for turning on the free Dota provider stack safely.

## Goal

Activate:

1. `STRATZ` as primary Dota live source
2. `OpenDota` as fallback/history source
3. `Liquipedia API` as schedule/meta source

Then verify the active routing with Pulseboard's coverage tools.

## Files already in place

- API-only Liquipedia schedule provider:
  - [/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/liquipediaScheduleProvider.js](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/liquipediaScheduleProvider.js)
- STRATZ provider scaffold:
  - [/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/src/providers/dota/stratzProvider.js)
- Coverage endpoint:
  - `GET /v1/provider-coverage`
- Coverage admin page:
  - [https://matt-scalcione.github.io/providers.html](https://matt-scalcione.github.io/providers.html)

## 1. Prepare local env

Use:

- [/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/.env.example](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/.env.example)

Minimum Dota activation variables:

- `STRATZ_API_TOKEN`

Important:

- The repo now ships bundled default STRATZ live and detail queries.
- Raw STRATZ payloads are normalized into Pulseboard's Dota contract before reaching the frontend.

## 2. Prepare Render env

Render blueprint already includes the keys in:

- [/Users/admin/Documents/GitHub/matt-scalcione.github.io/render.yaml](/Users/admin/Documents/GitHub/matt-scalcione.github.io/render.yaml)

Set these in Render:

- `STRATZ_API_TOKEN`

Also keep:

- `ESPORTS_DATA_MODE=hybrid`
- `PROVIDER_TIMEOUT_MS=15000`

## 3. Verify locally

Run:

```bash
cd /Users/admin/Documents/GitHub/matt-scalcione.github.io/api
npm test
npm run providers:check
```

Expected:

- tests pass
- `STRATZ live enabled true` once the token is present
- Dota live rows appear if STRATZ is returning coverage

## 4. Verify production API

Check:

- `/health`
- `/v1/live-matches?game=dota2&dota_tiers=1,2,3,4`
- `/v1/provider-coverage`

Expected:

- `dota.stratz.liveEnabled = true`
- `dota.stratz.liveRows > 0` when STRATZ has current coverage
- `dota.effectiveLiveCoverage.effectiveLiveRows` reflects STRATZ + fallback merge

## 5. Verify production UI

Open:

- [https://matt-scalcione.github.io/providers.html](https://matt-scalcione.github.io/providers.html)
- [https://matt-scalcione.github.io/dota2.html](https://matt-scalcione.github.io/dota2.html)

What to verify:

1. provider admin shows STRATZ enabled
2. Dota live rows increase when matches are active
3. Dota live cards no longer depend only on synthetic schedule promotion

## 6. Current hard boundary

The remaining unfinished part is not provider routing.

It is this:

- mapping real STRATZ live/match payloads into the full Pulseboard Dota match-detail contract

That work should begin only after:

1. token is configured
2. live query is proven in production
3. exact official query/result shape is available

## 7. Immediate next implementation once STRATZ is active

1. capture real STRATZ live payloads
2. write normalizers for:
   - kills
   - net worth / gold
   - towers
   - barracks
   - Roshan
   - player rows
   - respawn / buyback if exposed
3. upgrade `fetchMatchDetail()` to return normalized Pulseboard detail instead of `null`
