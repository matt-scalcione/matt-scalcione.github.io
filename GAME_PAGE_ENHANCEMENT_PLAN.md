# Game Page Enhancement Plan

## Goal
Make the game and series detail pages feel as coherent below the fold as they do at the top, with a mobile-first structure that stays clear in live, upcoming, degraded, and completed states.

This plan focuses on `/match.html` and the rendering/state logic in `/match.js` and `/styles.css`.

## Review Summary

### 1. State-specific pages still look too similar
The current page shell adapts, but the content stack is still too uniform across very different match states:

- live rich game
- live series with no game telemetry
- upcoming series
- completed game
- completed series

That creates poor information hierarchy. Upcoming pages still expose too much analysis chrome, and degraded live pages still look like a full live command center even when the source data is mostly synthetic.

### 2. Low-value modules remain visible too high in the page
Sampled current states show repeated low-signal modules near the top:

- `Stats` showing symmetrical 50/50 or no-sample reads
- `Recent Meetings` blocks with no sample
- matchup/team cards that add little when the provider has not delivered enough evidence

This makes the lower half of the page feel generated rather than editorial.

### 3. The page still repeats status in too many places
On several game and series states, the same information is repeated in:

- the score shell
- the game explorer/context band
- the overview bridge
- the games path block

The core information is right, but it is still over-explained.

### 4. Mobile chrome is cleaner than before, but still too noisy
The mobile pages still carry too many utility signals in the first few sections:

- `Collapse section`
- short labels like `ST`, `SG`
- `More (n)`
- trust/runtime stack items that compete with match data

The page reads as functional, but not yet as calm and intentional as DLTV-style detail pages.

### 5. Trust/runtime data is useful but too prominent
The runtime/trust strip is valuable, but on game pages it still competes with the actual match read. It should remain accessible without taking prime screen space away from score, game path, and real match content.

## Target Product Rules

1. Mobile first
- The first 2 mobile folds should answer:
  - who is playing
  - what state the series/game is in
  - what the next useful action is
  - what the most important current evidence is

2. One best representation
- If the score shell explains it, do not restate it below unless the lower section adds a new decision or interpretation.

3. State-driven pages
- Upcoming, degraded, live, and completed pages should not share the same default section stack.

4. Hide weak modules by default
- If a panel has no meaningful sample, do not promote it.
- Empty or low-confidence analytics should be demoted to optional secondary sections.

5. Trust without clutter
- Coverage/source health should be visible, but not treated like a primary content module.

## Phase 1: State-Driven Information Architecture

### A. Define five primary page modes

1. `live_rich_game`
- Real per-game telemetry available
- default stack:
  - score shell
  - game explorer
  - live overview
  - feed
  - timeline
  - players/stats

2. `live_series_degraded`
- Series is live, but no real game telemetry
- default stack:
  - score shell
  - game path
  - concise series status
  - watch/source note
  - only one low-confidence analysis block

3. `upcoming_series`
- default stack:
  - score shell
  - start/watch/setup
  - one concise edge/read block
  - lineups/history behind secondary disclosure

4. `completed_game`
- default stack:
  - score shell
  - result recap
  - key moments
  - players
  - stats

5. `completed_series`
- default stack:
  - score shell
  - series result path
  - final recap
  - players/stats/history

### Implementation
- add explicit page-mode resolver in `/match.js`
- map each mode to:
  - visible groups
  - default-open sections
  - hidden sections
  - mobile section order

## Phase 2: First-Fold Cleanup

### A. Demote trust/runtime
- move detailed trust/runtime content out of the first shell stack
- keep a compact inline status chip or one-line disclosure
- expand to full diagnostics only on demand

### B. Reduce redundant bridge panels
- series overview bridge should not repeat shell facts already visible above
- game overview bridge should exist only when it adds recap/story, not second-scoreboard content

### C. Simplify the game explorer
- keep the explorer focused on:
  - active game
  - series score
  - map path
- remove repeated labels already present in the shell

## Phase 3: Evidence Gating

### A. Suppress weak analysis by default
Hide or demote these when the sample is weak:

- 50/50 matchup cards with no meaningful variance
- no-sample H2H blocks
- repeated team-form cards with empty/noisy reads
- placeholder draft/control/economy tables on thin data

### B. Replace with concise evidence notes
Examples:

- `No reliable map-level telemetry yet`
- `History sample too thin to separate these teams`
- `Provider has series status, but not live map detail`

This keeps the page honest without filling it with low-value cards.

## Phase 4: Lower-Page Consolidation

### A. Merge overlapping game modules
- `Map Desk`, `Feed`, `Alerts`, `Signals`, `Milestones`, and `Forecast` should behave like one live desk system, not six separate products

### B. Merge overlapping series modules
- `Stats`, `History`, `Lineups`, and `Games` should each have one clear role:
  - `Games`: path and outcomes
  - `Stats`: current edge or evidence
  - `History`: prior meetings / recent form
  - `Lineups`: personnel only

### C. Remove zero-value helper copy
- strip low-signal helper lines, secondary subtitles, and repeated “desk” copy in lower panels

## Phase 5: Mobile-Specific Polish

### A. Reduce section chrome
- remove or simplify:
  - `Collapse section`
  - letter-coded short labels
  - noisy counter pills when they add no decision value

### B. Tighten secondary sections
- use shorter headers
- fewer chips
- smaller metadata rows
- less dead space between panels

### C. Make `More` truly secondary
- `More` should contain deeper context, not core reading path sections

## Phase 6: QA Matrix

Every pass should be checked against these states:

1. live game with rich telemetry
2. live series with synthetic/degraded coverage
3. upcoming series
4. completed game
5. completed series

For each state, verify:

- first 2 mobile folds tell the story clearly
- no major repeated facts
- low-confidence modules are demoted
- the most useful next action is obvious

## Recommended Execution Order

1. add explicit page-mode resolver and per-mode visibility rules
2. demote trust/runtime and simplify the first fold
3. gate weak analytics by sample quality
4. consolidate lower game modules
5. consolidate lower series modules
6. run the five-state mobile QA sweep

## Acceptance Criteria

- upcoming pages feel like setup/watch pages, not pseudo-live desks
- degraded live pages are honest and concise, not over-instrumented
- live rich game pages prioritize the actual live desk
- completed pages prioritize result and recap over utility chrome
- mobile pages keep a coherent editorial rhythm from top to bottom
