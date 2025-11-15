# OPS Contract for Codex

1. Never commit /estate (built output). GitHub Actions deploys the build.
2. Vite config must use: base='/estate/'.
3. React Router must use basename '/estate'.
4. Postbuild step must create SPA fallback: copy estate/index.html -> estate/404.html.
5. Always use @vitejs/plugin-legacy with Safari targets ['iOS >= 12','Safari >= 12'].
6. No manifest loaders, no cache-busting edits in index.html.
7. index.html must contain one loader: <script type="module" src="/src/main.tsx"></script>
8. Preboot rescue script stays.
9. All PRs must pass CI verify.
