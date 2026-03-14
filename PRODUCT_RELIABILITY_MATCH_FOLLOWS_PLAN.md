# Product Reliability, Match QA, and Follows Plan

## Goal
Make Pulseboard feel like one coherent product instead of a strong top shell sitting on top of separate tools. The next product pass should improve user trust, keep the match center disciplined on mobile, and turn follows into a real watchlist product rather than an admin page.

## Track 1: Production Reliability + Trust

### Problem
- The API exposes strong diagnostics, but the public site does not explain system state clearly.
- Trust language varies by page: snapshot, fallback, degraded, provider, and freshness cues are present, but not unified.
- Users can tell when a row is odd, but they cannot easily tell whether the system is healthy overall.

### Build
1. Add a shared public runtime status model backed by `/v1/provider-diagnostics`.
2. Render a trust/status panel on the live desk, schedule, and follows pages.
3. Render a compact trust strip on match detail pages so the lower page stays connected to the score shell.
4. Normalize public trust terms:
   - `Live signal`
   - `Quiet right now`
   - `Degraded`
   - `Canonical sync`
   - `Backfill`
5. Keep row-level provenance and quality notices, but make the page-level trust state easier to understand first.

### Acceptance
- Live, schedule, and follows each show a stable public trust panel.
- Match detail shows a compact trust read tied to the current match payload.
- A healthy-but-empty live state does not look like an outage.
- Canonical persistence/backfill errors show as degraded instead of failing silently.

## Track 2: Mobile Match Center QA

### Problem
- The top of the match page is strong, but lower sections still drift into “module stack” behavior.
- Mobile trust and watchlist actions are not integrated into the shell.
- Some lower sections still feel like utilities instead of one continuous desk.

### Build
1. Add mobile-safe trust and watchlist actions directly in the match shell.
2. Keep the first mobile folds focused on:
   - score shell
   - live/data trust
   - game/series navigator
   - one clean next action
3. Remove any remaining repeated state/status text where the shell already says it better.
4. Verify live game, completed game, live series, completed series, and upcoming series with real mobile renders.

### Acceptance
- Mobile match pages expose watchlist and trust state without adding a second hero.
- The first 1 to 2 folds remain compact across live, completed, and upcoming states.
- Lower sections do not re-announce status already shown in the shell.

## Track 3: Notifications / Follows Productization

### Problem
- The follows page works, but it still feels like a control panel.
- Follow rows lead with raw IDs instead of human labels or match context.
- Follows are not integrated deeply enough into match/team pages.
- The active workspace user is not a stable first-class concept across pages.

### Build
1. Persist one workspace user across live, follows, and detail pages.
2. Enrich team follows with:
   - display name
   - game
   - current signal state
   - next/live/recent match context
3. Productize the follows page:
   - `Workspace`
   - `Attention Now`
   - `Queue`
   - `Watchlist`
   - `Rules`
4. Add direct follow actions on match and team pages using the saved workspace user.
5. Keep manual entity-id entry available, but demote it to advanced setup instead of making it the primary workflow.

### Acceptance
- The saved workspace user survives refresh and cross-page navigation.
- Match and team pages can add the current team to the watchlist without going to the follows page first.
- Team follow cards show human-readable labels and match context, not just raw IDs.
- The follows page reads like a watchlist product rather than an internal admin surface.

## Delivery Order
1. Shared runtime trust model
2. Shared workspace-user model
3. Enriched follows API payloads
4. Follows page productization
5. Match and team page watchlist/trust integration
6. Mobile match-state QA and final cleanup

## Done When
- Public trust states are visible and coherent.
- Mobile match pages keep the same quality below the fold as they do at the top.
- Follows, match, and team pages are connected by one stable workspace/watchlist model.
