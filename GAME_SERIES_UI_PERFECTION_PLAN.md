## Game and Series UI Perfection Plan

Status: completed

### Goals
- Make the match center feel like one coherent product across upcoming, live, and completed states.
- Fix the mobile watch action flow so saving a team is obvious and stable.
- Rebuild the game and series navigator so it reads as one control system instead of mixed pills and mismatched buttons.
- Keep the red live convention, but remove the rest of the competing color noise.
- Preserve mobile-first behavior and only improve desktop where it does not harm mobile.

### Workstreams
1. Match shell action rail
- Replace the cramped multi-button row with a dedicated watch rail.
- Separate transient watch feedback from primary actions.
- Keep `Open watchlist` available, but make it secondary to team watch actions.

2. Game and series navigation system
- Wrap the selector controls in a single tray.
- Unify series/game pills and prev/next controls under one dark-slate visual language.
- Use one strong selected state, one clear live state, and quieter neutral states for completed and upcoming maps.

3. State card polish
- Bring series setup/final and game context cards into the same dark match-center surface language.
- Remove pale utility-card leftovers where they broke the flow.

4. State QA matrix
- Upcoming series
- Live series
- Live game
- Completed series
- Completed game

### Completed outcomes
- Mobile watch actions now render as a proper two-team watch rail with a separate watchlist row and dedicated feedback area.
- The game and series selector now sits inside a unified control shell with coordinated pills and arrow controls.
- Selected, live, completed, and upcoming states now share a more disciplined color system.
- Series setup/final and game context surfaces are closer to the same dark-slate system as the top shell.
- Real mobile render checks were run against upcoming and completed match states, and the control-system pass was tuned from those results.
