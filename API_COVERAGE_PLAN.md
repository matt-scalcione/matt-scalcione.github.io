# API Coverage Plan

## Objective

Increase practical data coverage for the live Pulseboard API, starting with the weakest user-facing gaps and building toward a more stable multi-provider model.

## Current Priority Order

1. Team identity and profile coverage
2. Dota live resilience
3. Canonical identity mapping across providers
4. Scheduled backfills for durable surfaces
5. Provider health gating and inferred live state

## Phase 1: Team Identity and Profile Coverage

### Goal

Make `/v1/teams/:id` reliable even when callers only have a team id and no extra provider hints.

### Problems

- LoL schedule rows often use match-side ids like `lol_left_<matchId>` instead of long-lived team ids.
- some generated URLs only include `id`, which makes team pages depend on fragile hints
- cross-surface team identity is still too dependent on provider-specific naming

### Work

- infer team name and seed match id from current live/schedule/results rows
- derive Riot seed match ids from LoL match-side team ids when possible
- include `team_name` and `match` in generated team URLs where source rows are known
- add regression coverage for inferred team context

### Acceptance

- sitemap-generated team URLs resolve without manual hints
- team pages opened from schedule/results rows resolve consistently
- `/v1/teams/:id` no longer fails just because `team_name` is absent

## Phase 2: Dota Live Resilience

### Goal

Reduce the frequency of empty Dota live coverage during upstream gaps.

### Work

- strengthen STRATZ live query coverage and parsing
- keep OpenDota as the main live fallback
- preserve Steam as a sparse live backup
- improve snapshot fallback freshness and merge rules
- prefer last-known-good live state over dropping to zero when coverage is degraded

### Acceptance

- Dota live drops to zero less often during provider outages
- provider diagnostics show clearer handoff between live sources

## Phase 3: Canonical Identity Mapping

### Goal

Create stable internal ids for teams, tournaments, and series across Riot, Liquipedia, OpenDota, STRATZ, and Steam.

### Work

- add canonical alias tables for teams and tournaments
- map provider ids and normalized names to one canonical entity
- use canonical ids in team, schedule, and results joins where practical

### Acceptance

- fewer duplicate entities across providers
- cleaner cross-provider team history and H2H joins

## Phase 4: Scheduled Backfills

### Goal

Make schedule, results, team profiles, and match details less dependent on live upstream availability.

### Work

- backfill results on a regular cadence
- backfill team profiles for high-priority teams
- backfill match details for current and recent series
- keep canonical Postgres state warm for the highest-value pages

### Acceptance

- recent pro pages resolve from canonical storage even after provider misses
- team and match detail coverage improves without requiring user traffic first

## Phase 5: Provider Health Gating

### Goal

Make runtime provider selection react to degraded sources automatically.

### Work

- track provider freshness, row count, error rate, and latency
- gate handoff decisions on provider health, not just nominal priority
- infer live state when schedule timing strongly suggests a series should be active

### Acceptance

- fewer blank or obviously stale states during short provider failures
- diagnostics make clear why a given provider was chosen
