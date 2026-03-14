# Match Shell Control Plan

Status: complete

Goal:
- make the mobile match shell controls feel premium, calm, and coherent
- keep the match itself visually primary
- separate "selected" state from "live" state so the game tray never clashes

Problems addressed:
- watch controls were oversized and stole attention from the match
- the `S / G1 / G2 / G3` tray mixed selection and live state into conflicting fills
- mobile prev/next arrows looked cheap and vertically off-center
- the top control area did not read like one connected control system

Plan:
1. Shrink the watch actions into compact utility chips with logos, short names, and small status text.
2. Make watchlist access a small utility pill instead of a dominant full-width button.
3. Rebuild the game tray so:
   - selected uses a neutral elevated slate state
   - live uses the red live convention as a separate accent
   - selected live uses both without becoming a muddy red block
4. Rebuild arrow controls to match the tray and center their icons cleanly on mobile.
5. Tune spacing and surface styling so the shell controls feel integrated with the score hero and lower game panel.

Implementation notes:
- watch controls now use compact chips instead of large cards
- watchlist count is integrated into the watchlist control
- game pills now use independent `is-selected` and `is-live` states
- arrow controls use the same dark-slate control language as the tray
- mobile spacing and font sizes were retuned for narrow phones
