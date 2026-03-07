# Dota Free Live Data Plan

This plan defines the best no-budget path to materially improve Dota 2 live coverage on Pulseboard.

It replaces the old assumption that `OpenDota + Liquipedia` can fully cover live Dota. They cannot.

## Objective

Build the strongest free Dota stack possible for:

- future schedule
- upcoming match context
- team history
- player history
- past results
- live status
- live map stats
- live player rows
- objective flow
- minimap/state rendering

without committing to a paid provider first.

## Verified Constraints

These constraints were checked against current primary sources:

- STRATZ positions its API as free and GraphQL-based.
  - Source: [STRATZ API](https://stratz.com/api)
  - Source: [STRATZ site](https://stratz.com/)
- Liquipedia explicitly forbids automated access to non-API HTML pages.
  - Source: [Liquipedia API Terms](https://liquipedia.net/api-terms-of-use)
- Liquipedia MediaWiki API is free but rate-limited.
  - `1 request per 2 seconds`
  - `action=parse` no more than `1 request per 30 seconds`
  - Source: [Liquipedia API Terms](https://liquipedia.net/api-terms-of-use)
- OpenDota is usable for free, but rate-limited and best treated as secondary coverage, not primary live telemetry.
  - Source: [OpenDota API docs](https://www.opendota.com/api)
- GRID Open Access exists for free non-commercial / early-stage access and currently advertises Dota 2 real-time match statistics and events.
  - Source: [GRID Open Access](https://grid.gg/open-access/)
  - Source: [GRID Get Access](https://grid.gg/get-access/)

## Target Free Stack

### Primary live provider

- `STRATZ`

Use STRATZ as the first-choice live telemetry source for Dota.

Reason:

- best free candidate for real live Dota depth
- token-based instead of paid-by-default
- far more plausible than OpenDota for:
  - live kills
  - player rows
  - net worth / economy
  - objective state
  - richer match detail

### Secondary / fallback provider

- `OpenDota`

Use OpenDota for:

- recent results
- team history
- map detail fallback
- hero metadata
- live fallback when it does have the match

Do not treat OpenDota as the source of truth for live Dota.

### Schedule / tournament / stream metadata

- `Liquipedia API only`

Use Liquipedia only through allowed API paths.

Use it for:

- future schedule
- tournament structure
- watch links
- stage labels
- roster context when needed

Stop relying on HTML scraping.

### Parallel application track

- `GRID Open Access`

Apply in parallel.

If approved, use GRID selectively where it improves:

- official tournament coverage
- real-time match/event reliability
- structured official Dota event data

Do not block the STRATZ build on GRID approval.

## Architecture Decision

Do not force one provider across every Dota page state.

Use provider split by problem:

1. `STRATZ` for live telemetry
2. `OpenDota` for recent/history/post-match fallback
3. `Liquipedia API` for schedule/meta/watch links
4. `GRID Open Access` as an optional official override layer if approved

## Required Changes

### 1. Provider layer split

Refactor Dota into clearer providers:

- `/api/src/providers/dota/stratzProvider.js`
- `/api/src/providers/dota/openDotaProvider.js`
- `/api/src/providers/dota/liquipediaScheduleProvider.js`

Current problem:

- too much Dota logic is still centered on OpenDota assumptions

Target:

- STRATZ owns live
- OpenDota owns history/fallback
- Liquipedia owns future schedule/meta

### 2. Canonical Dota series model

Keep one normalized model for Dota series and maps regardless of source:

- `id`
- `providerMatchId`
- `sourceMatchId`
- `status`
- `startAt`
- `endAt`
- `bestOf`
- `seriesScore`
- `teams`
- `seriesGames`
- `selectedGame`
- `watchGuide`
- `preMatchInsights`
- `playerEconomy`
- `teamEconomyTotals`
- `objectiveTimeline`
- `objectiveControl`
- `goldLeadSeries`
- `liveTicker`
- `freshness`
- `dataConfidence`

The frontend should never need to care whether the source was STRATZ, OpenDota, Liquipedia, or GRID.

### 3. Provider precedence rules

For Dota:

- `live match list`
  - STRATZ first
  - OpenDota fallback
  - overdue scheduled Liquipedia rows promoted to live only if both providers miss them

- `match detail`
  - STRATZ first for live maps
  - OpenDota first for completed maps if richer
  - fallback merged detail when neither provides full telemetry

- `schedule`
  - Liquipedia API first
  - GRID Open Access overlay if approved

- `team history`
  - OpenDota first
  - STRATZ supplement if stronger player/match context is available

## Execution Plan

### Phase 1. Compliance and credentials

1. Add `STRATZ_API_TOKEN` support to the API.
2. Remove the assumption that Liquipedia HTML scraping is acceptable.
3. Keep Liquipedia requests within documented limits and cache aggressively.
4. Add attribution handling for Liquipedia-derived schedule/meta rows.
5. Submit GRID Open Access application.

Exit criteria:

- STRATZ token works in local and Render envs
- no Dota data path depends on non-API Liquipedia HTML scraping

### Phase 2. STRATZ live-provider scaffold

1. Create `/api/src/providers/dota/stratzProvider.js`
2. Implement:
   - live series list fetch
   - match detail fetch
   - team lookup helpers if exposed
3. Save tested GraphQL queries/mutations used by Pulseboard in code comments or a provider note.
4. Add provider cache with the same store discipline used by current providers.

Important:

- Do not guess the STRATZ schema in application code.
- Use the GraphQL explorer/schema with token and only commit tested query shapes.

Exit criteria:

- a live Dota series currently missing from OpenDota can still appear with real telemetry through STRATZ

### Phase 3. Merge STRATZ into store routing

Update `/api/src/data/mockStore.js`:

1. add STRATZ provider state caches
2. add live-row merge logic
3. add detail-provider precedence
4. add freshness/source labeling
5. keep fallback generation only as last resort

Target behavior:

- if STRATZ has a live Dota match, Pulseboard uses STRATZ
- OpenDota remains available for fallback/history
- fallback detail is only used when both providers miss telemetry

### Phase 4. Live telemetry parity for Dota pages

Once STRATZ detail works, map its fields into the existing Dota frontend contract:

- `playerEconomy`
- `teamEconomyTotals`
- `goldLeadSeries`
- `objectiveTimeline`
- `objectiveControl`
- `liveTicker`
- `selectedGame.snapshot`
- `teamDraft` if available
- `topPerformers`
- `seriesPlayerTrends`

Front-end targets already exist:

- live feed
- player tracker
- game command center
- upcoming matchup cards
- minimap
- completed recap

The work is mostly provider normalization, not a UI redesign.

### Phase 5. Dota minimap reliability

Current minimap already supports Dota structures.

Upgrade path:

1. if STRATZ gives exact live hero positions:
   - render hero icons on map
2. if it does not:
   - keep structures-only map
   - do not fake player movement

Exactness rule:

- hero positions only render if backed by real telemetry

### Phase 6. Dota player-history layer

Do not create a new player page until data support is real.

First extend current pages:

- add Dota player metrics in tracker:
  - LH/DN
  - GPM
  - XPM
  - role/hero continuity
- populate `seriesPlayerTrends` for completed multi-map Dota series
- expose top-performer / player trend cards on completed series

Then, only after data is stable:

- create `/player.html` if needed

### Phase 7. Prediction upgrade

Current Dota prediction is still heuristic.

Improve it in two layers:

1. `fallback / no-budget model`
   - team recent series win rate
   - map win rate
   - form momentum
   - H2H
   - opponent strength approximation

2. `live-aware model`
   - if live telemetry exists:
     - gold lead
     - kills
     - tower/rax state
     - Roshan control
     - map duration

Keep prediction clearly labeled as heuristic until enough historical data exists.

### Phase 8. Observability and QA

Add explicit monitoring for Dota coverage:

- STRATZ live-hit rate
- OpenDota fallback rate
- fallback-detail rate
- Liquipedia schedule freshness
- unresolved team IDs
- missing stream links
- match-page telemetry status by provider

Add admin/reporting views for:

- live series with no telemetry
- schedule rows using synthetic live promotion
- team rows still using Liquipedia synthetic IDs

## Immediate Build Order

This is the order to execute now:

1. Add STRATZ token support and provider scaffold.
2. Replace Liquipedia HTML scraping with allowed API usage.
3. Route Dota live list through STRATZ first.
4. Route live Dota detail through STRATZ first.
5. Normalize STRATZ detail into current match-page contract.
6. Populate Dota `seriesPlayerTrends`.
7. Add monitoring for Dota coverage gaps.
8. Apply for GRID Open Access in parallel.

## Deliverables

The implementation is done when these are true:

1. A currently live Dota pro series missing from OpenDota still appears on Pulseboard with real live stats.
2. Upcoming Dota schedule is API-compliant and no longer depends on scraped HTML.
3. Dota match pages show:
   - real live state when available
   - meaningful degraded state when not
4. Completed Dota series expose richer player trends across maps.
5. Team/profile linking is stable across schedule, match, and team pages.

## Non-Goals

These are not part of the free-first plan:

- paying for PandaScore/Abios/Goalserve now
- forcing LoL into the same live-data strategy
- inventing estimated live stats when no source provides them

## Recommendation

The highest-quality free move is:

1. `STRATZ` now
2. `GRID Open Access` application in parallel
3. `OpenDota` as fallback/history
4. `Liquipedia API` only for schedule/meta, not scraped HTML

That is the strongest free Dota path available for Pulseboard.
