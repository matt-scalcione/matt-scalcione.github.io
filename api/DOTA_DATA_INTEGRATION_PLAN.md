# Dota Data Integration Plan (Executed)

Note:

- This document covers the OpenDota-first integration work that has already been completed.
- The current forward-looking architecture for free live Dota coverage now lives in:
  - [DOTA_FREE_LIVE_PROVIDER_PLAN.md](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api/DOTA_FREE_LIVE_PROVIDER_PLAN.md)

This plan tracks how Dota 2 data is integrated into Pulseboard with parity to the League of Legends match experience.

## Goals

- Connect a reliable Dota API source for live and completed pro data.
- Normalize Dota payloads into the same frontend contract shape used by LoL pages.
- Ensure match detail pages render rich game context (series + map-level telemetry).
- Keep fallback behavior resilient so provider IDs do not 404 when detail payloads are incomplete.
- Extend team pages to include deeper recent-history coverage for Dota.

## Data Source

- Primary provider: OpenDota (`/live`, `/proMatches`, `/matches/:id`, `/heroes`).
- Existing source already connected for list endpoints; this plan closes rich-detail and resilience gaps.

## Execution Checklist

- [x] Confirmed existing OpenDota connectivity in provider and store layers.
- [x] Added/expanded Dota detail normalization to include frontend-rich fields:
  - `gameNavigation`, `seriesGames`, `selectedGame`
  - `playerEconomy`, `teamEconomyTotals`
  - `goldLeadSeries`, `leadTrend`, `momentum`
  - `objectiveTimeline`, `objectiveControl`, `objectiveBreakdown`, `objectiveRuns`
  - `pulseCard`, `edgeMeter`, `tempoSnapshot`, `dataConfidence`
  - `liveTicker`, `keyMoments`, `combatBursts`, `goldMilestones`
  - `seriesHeader`, `seriesProgress`, `seriesProjection`
  - `teamDraft`, `watchGuide`, `prediction`, baseline matchup blocks
- [x] Added hero-id -> hero-name mapping cache via OpenDota `/heroes` for readable player/draft rows.
- [x] Added robust match-detail fallback in data store for provider Dota IDs when detail fetch fails.
- [x] Added extended Dota results-history merge for team profiles (improves last-match availability).
- [x] Expanded Dota provider tests for rich detail normalization.
- [x] Run full API test suite and validate deployment behavior.
- [x] Push to `main` to trigger API redeploy.

## Validation Criteria

- Dota match detail endpoint returns non-empty payload for provider IDs seen on live/results pages.
- Dota detail payload contains all core sections used by `match.js` renderers.
- Team profile endpoint can return richer Dota recent-history entries in provider mode.
- Existing API tests pass and new Dota provider tests pass.

## Follow-Up (Next Iteration)

- Add optional secondary Dota source for schedule/upcoming series metadata if needed.
- Improve Dota role inference by combining lane + net worth + historical role priors.
- Add Dota-specific objective labels/weights tuning for edge/prediction cards.
- Add deterministic fixture tests for fallback detail generation path.
