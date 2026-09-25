#!/usr/bin/env bash
# Sobe next start a partir das cópias de .next compiladas no mesmo path.
set -euo pipefail
GIT_DIR="${GIT_DIR:-/workspace/.git}"
STORE="${STORE:-/tmp/geom-next}"
ENV_FILE="${ENV_FILE:-/workspace/.env.local}"

start_one() {
  local name="$1" sha="$2" port="$3"
  local rundir="/tmp/geom-run-$name"
  rm -rf "$rundir"
  mkdir -p "$rundir"
  git --git-dir="$GIT_DIR" archive "$sha" | tar -x -C "$rundir"
  ln -sfn /workspace/node_modules "$rundir/node_modules"
  cp "$ENV_FILE" "$rundir/.env.local"
  rm -rf "$rundir/.next"
  cp -a "$STORE/$name/.next" "$rundir/.next"
  echo "start $name :$port sha=$sha"
  (
    cd "$rundir"
    export NODE_ENV=production
    export NEXT_TELEMETRY_DISABLED=1
    export NODE_OPTIONS=--openssl-legacy-provider
    exec npx next start -p "$port" -H 127.0.0.1
  )
}

case "${1:-}" in
  base-same) start_one base-same "$(cat "$STORE/base-same/SHA")" "${2:-3020}" ;;
  head-same) start_one head-same "$(cat "$STORE/head-same/SHA")" "${2:-3021}" ;;
  base-alt) start_one base-alt "$(cat "$STORE/base-alt/SHA")" "${2:-3022}" ;;
  *) echo "usage: $0 base-same|head-same|base-alt [port]"; exit 2 ;;
esac
