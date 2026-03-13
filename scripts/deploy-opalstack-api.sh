#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy-opalstack-api.sh SHELL_USER@HOST [HEALTH_URL]

Example:
  scripts/deploy-opalstack-api.sh \
    pulseboard_prod@opal10.opalstack.com \
    https://api.pulseboard.mindpointdesign.opalstacked.com/health

Environment overrides:
  OPALSTACK_APP_NAME      Default: pulseboard-api
  OPALSTACK_REMOTE_ROOT   Default: ~/apps/<app-name>
  OPALSTACK_REMOTE_APP    Default: <remote-root>/app

What it does:
  1. Rsyncs local api/ to the remote app directory
  2. Runs npm install on the remote app
  3. Restarts the Opalstack app
  4. Optionally checks the public health URL
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 1
fi

TARGET="$1"
HEALTH_URL="${2:-}"
APP_NAME="${OPALSTACK_APP_NAME:-pulseboard-api}"
REMOTE_ROOT="${OPALSTACK_REMOTE_ROOT:-~/apps/$APP_NAME}"
REMOTE_APP="${OPALSTACK_REMOTE_APP:-$REMOTE_ROOT/app}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_API_DIR="$REPO_ROOT/api/"

echo "Syncing $LOCAL_API_DIR to $TARGET:$REMOTE_APP/"
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.env*' \
  --exclude '.DS_Store' \
  "$LOCAL_API_DIR" "$TARGET:$REMOTE_APP/"

echo "Installing dependencies and restarting $APP_NAME on $TARGET"
ssh "$TARGET" "bash -lc '
  set -euo pipefail
  source scl_source enable nodejs20
  cd $REMOTE_APP
  npm install
  $REMOTE_ROOT/stop || true
  $REMOTE_ROOT/start
'"

if [[ -n "$HEALTH_URL" ]]; then
  echo "Checking health: $HEALTH_URL"
  curl --fail --silent --show-error "$HEALTH_URL"
  echo
fi

echo "Deploy complete."
