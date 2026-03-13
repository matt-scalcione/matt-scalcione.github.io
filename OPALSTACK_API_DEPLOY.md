# Opalstack API Deploy

Use this when the Pulseboard frontend stays on GitHub Pages and only the API is hosted on Opalstack.

## One-command update

From repo root:

```bash
./scripts/deploy-opalstack-api.sh \
  pulseboard_prod@opal10.opalstack.com \
  https://api.pulseboard.mindpointdesign.opalstacked.com/health
```

What it does:
- syncs [`api/`](/Users/admin/Documents/GitHub/matt-scalcione.github.io/api) into `~/apps/pulseboard-api/app` on Opalstack
- runs `npm install` remotely
- restarts the Opalstack app
- checks the public health endpoint

## Defaults

The script assumes:
- shell target: `pulseboard_prod@opal10.opalstack.com`
- app name: `pulseboard-api`
- remote app root: `~/apps/pulseboard-api`
- remote code directory: `~/apps/pulseboard-api/app`

If any of those change, override them:

```bash
OPALSTACK_APP_NAME=pulseboard-api \
OPALSTACK_REMOTE_ROOT=~/apps/pulseboard-api \
OPALSTACK_REMOTE_APP=~/apps/pulseboard-api/app \
./scripts/deploy-opalstack-api.sh pulseboard_prod@opal10.opalstack.com
```

## First-time requirements

Before the script is useful, Opalstack must already have:
- a shell user
- a Node.js application named `pulseboard-api`
- a PostgreSQL database and user
- a `start` script that loads `~/.env.production`
- `HOST=127.0.0.1` and `PORT=5119` in that env file

The frontend is already configured to call:
- [site-config.js](/Users/admin/Documents/GitHub/matt-scalcione.github.io/site-config.js)
  - `https://api.pulseboard.mindpointdesign.opalstacked.com`

## If deploy fails

Check the remote logs:

```bash
ssh pulseboard_prod@opal10.opalstack.com
tail -n 100 ~/logs/apps/pulseboard-api/error.log
tail -n 100 ~/logs/apps/pulseboard-api/console.log
```

Check the public endpoints:

```bash
curl https://api.pulseboard.mindpointdesign.opalstacked.com/health
curl https://api.pulseboard.mindpointdesign.opalstacked.com/v1/provider-diagnostics
```
