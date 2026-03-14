## Watchlist Product Plan

### Goal
- Make `Watch this team` on match and team pages behave like a real user feature.
- Replace the current raw `user ID` / workspace mental model with one personal watchlist saved automatically on the current device.
- Make the follows page answer three questions clearly:
  - Who am I watching?
  - Who is live or up next?
  - What notifications will I get?

### Problems To Fix
- Match and team pages expose watch actions without clear saved state.
- Clicking watch actions depends on a hidden implementation detail: a raw `userId`.
- The follows page is built like an operator console, not a user-facing watchlist.
- The page prioritizes plumbing (`User ID`, `API Base`, `Manual Add`) over useful watchlist information.
- The live desk still leaks the same raw `user ID` model for followed-only filtering.

### Target UX

#### Identity
- Every browser gets one automatic local watchlist identity.
- No explicit setup step is required before saving a team.
- The user sees simple language like `Saved on this device`, not raw IDs.

#### Match and Team Pages
- Top buttons show real watch state:
  - `Watch Team Liquid`
  - `Watching Team Liquid`
- Clicking a watch button saves or removes that team immediately.
- The page always offers one secondary action:
  - `Open watchlist`

#### Follows Page
- Lead with the watchlist itself, not debug controls.
- Primary sections:
  - `Live now`
  - `Up next`
  - `Recently finished`
  - `All watched teams`
  - `Alert rules`
- Secondary operator surfaces like API base remain available only as technical tools.
- Empty states explain the actual flow:
  - save teams from match and team pages
  - Pulseboard keeps them on this device

#### Live Desk
- `Followed teams only` uses the same automatic watchlist identity.
- The live page should not require a raw `User ID`.

### Implementation Order
1. Replace manual workspace identity with automatic watchlist identity and shared helpers.
2. Make match and team watch actions stateful and toggleable.
3. Rebuild follows page information architecture around real watchlist states.
4. Align live-desk followed-only behavior with the same identity model.
5. Verify on mobile first, then desktop.

### Completion Criteria
- A user can save a team from a match page without any setup.
- A user can save a team from a team page without any setup.
- A user can open the follows page and immediately understand:
  - who is being watched
  - which watched teams are live
  - which watched teams are next
  - what alert rules are enabled
- The live desk can filter to followed teams without exposing raw IDs.
