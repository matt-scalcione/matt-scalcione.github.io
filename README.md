# Pulseboard (GitHub Pages + API)

This repo now contains:

- Static site (GitHub Pages) at repo root.
- API service under [`api/`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api).

## 1. Deploy The API (Render)

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Select this repo. Render will detect [`render.yaml`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/render.yaml).
4. Create the service. Wait until status is **Live**.
5. In GitHub repo settings, add secrets:
   - `RENDER_API_KEY`
   - `RENDER_SERVICE_ID` (from Render service settings)
6. Run workflow **Deploy API to Render** (or push changes under `api/`).
7. Copy your API URL (example: `https://pulseboard-api.onrender.com`).
8. Verify with:
   - `https://YOUR_API_URL/health`
   - `https://YOUR_API_URL/v1/live-matches?game=lol`

## 2. Point The Site To Deployed API

Edit [`site-config.js`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/site-config.js):

```js
window.PULSEBOARD_API_BASE = "https://YOUR_API_URL";
```

Commit and push. GitHub Pages will then call your hosted API instead of localhost.

## 3. Publish GitHub Pages

In GitHub repo settings:

1. Open **Settings** -> **Pages**.
2. Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`.
4. Save.

Your site URL will be:

- `https://matt-scalcione.github.io/`
