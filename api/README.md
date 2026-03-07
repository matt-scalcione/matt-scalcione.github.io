# esports-live-api

Dependency-light API scaffold for LoL + Dota 2 live scores.

## Run

```bash
cd /Users/admin/Documents/GitHub/matt-scalcione.github.io/api
npm start
```

Default address:
- `http://0.0.0.0:4000`

## Development Mode

```bash
cd /Users/admin/Documents/GitHub/matt-scalcione.github.io/api
npm run dev
```

## Test

```bash
cd /Users/admin/Documents/GitHub/matt-scalcione.github.io/api
npm test
```

## Implemented Endpoints

- `GET /health`
- `GET /v1/live-matches`
  - query: `game`, `region`, `dota_tiers`, `followed_only`, `user_id`
- `GET /v1/matches/:id`
- `GET /v1/schedule`
  - query: `game`, `region`, `dota_tiers`, `date_from`, `date_to`
- `GET /v1/results`
  - query: `game`, `region`, `dota_tiers`, `date_from`, `date_to`
- `GET /v1/provider-coverage`
- `GET /v1/follows?user_id=...`
- `POST /v1/follows`
- `DELETE /v1/follows/:id?user_id=...`
- `GET /v1/notification-preferences?user_id=...`
- `PUT /v1/notification-preferences`

OpenAPI spec:
- `services/api/openapi.yaml`

## Sample Requests

```bash
curl "http://localhost:4000/v1/live-matches?game=lol"
curl "http://localhost:4000/v1/matches/lol_lta_2026_w2_fly_tl"
curl "http://localhost:4000/v1/live-matches?followed_only=true&user_id=demo-user"
curl "http://localhost:4000/v1/schedule?game=lol&date_from=2026-03-04T00:00:00Z"
curl "http://localhost:4000/v1/results?game=dota2"
curl "http://localhost:4000/v1/live-matches?game=dota2&dota_tiers=1,2,3,4"
```

Create follow:

```bash
curl -X POST "http://localhost:4000/v1/follows" \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user","entityType":"team","entityId":"team_gen"}'
```

Update notification preferences:

```bash
curl -X PUT "http://localhost:4000/v1/notification-preferences" \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user","webPush":true,"emailDigest":true,"swingAlerts":false,"matchStart":true,"matchFinal":true}'
```

## Data Mode

Environment variable `ESPORTS_DATA_MODE` controls source behavior:
- `mock`: fixtures only
- `hybrid` (default): real LoL + real Dota (pro tiers) where available, fixture fallback on provider errors
- `live`: same as hybrid, reserved for future stricter non-fallback behavior

Optional provider settings:
- `PROVIDER_CACHE_MS` (default `30000`)
- `PROVIDER_TIMEOUT_MS` (default `15000`)
- `OPENDOTA_BASE_URL` (default `https://api.opendota.com/api`)
- `LOL_ESPORTS_API_BASE_URL` (default `https://esports-api.lolesports.com/persisted/gw`)
- `LOL_ESPORTS_API_KEY` (defaults to the public LoL esports web key)
- `LOL_ESPORTS_LOCALE` (default `en-US`)
- `DOTA_TIERS` (default `1,2,3,4`)
- `LIQUIPEDIA_DOTA_API_URL` (default `action=parse` endpoint for `Liquipedia:Matches`)
- `LIQUIPEDIA_DOTA_API_CACHE_MS` (default `30000`)
- `STRATZ_GRAPHQL_URL` (default `https://api.stratz.com/graphql`)
- `STRATZ_API_TOKEN`
- `STRATZ_DOTA_LIVE_QUERY`
- `STRATZ_DOTA_MATCH_DETAIL_QUERY`

Dota provider precedence:
1. `STRATZ` for live telemetry when configured
2. `OpenDota` for live/results/history fallback
3. `Liquipedia API` for future schedule and watch metadata

Use `GET /v1/provider-coverage` to inspect which Dota provider path is active.

## Deploy (Render)

This repo includes a Render blueprint at:

- [`/render.yaml`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/render.yaml)

Render service settings from blueprint:
- root directory: `api`
- build: `npm install`
- start: `npm start`
- health check: `/health`

After deploy, set the site API URL in:
- [`/site-config.js`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/site-config.js)
