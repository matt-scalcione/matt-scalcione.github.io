# Contributing

Pulseboard is the only active product in this repository.

- Static site files live at the repo root.
- The API lives in [`api/`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api).
- Run `npm run verify` before opening a PR.
- When frontend behavior changes need to show up immediately in production, bump the relevant asset version strings in the HTML pages.
- GitHub Pages publishes only the curated `dist-pages/` artifact built by `npm run build:pages`; do not commit `dist-pages/`.
- Use [`AI_HANDOFF.md`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/AI_HANDOFF.md) as the detailed project handoff and architecture reference.
