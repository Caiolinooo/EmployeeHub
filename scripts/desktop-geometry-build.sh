#!/usr/bin/env bash
# Compila BASE e HEAD no MESMO path absoluto (/tmp/geom-compile),
# depois BASE de novo noutro path (/tmp/geom-compile-alt) para o experimento de glifo.
set -euo pipefail
GIT_DIR="${GIT_DIR:-/workspace/.git}"
BASE_SHA="${BASE_SHA:-71bd3534955a1478ecd31af3fef9aa662ead34bd}"
HEAD_SHA="${HEAD_SHA:-$(git --git-dir="$GIT_DIR" rev-parse HEAD)}"
COMPILE="/tmp/geom-compile"
COMPILE_ALT="/tmp/geom-compile-alt"
STORE="/tmp/geom-next"
ENV_FILE="${ENV_FILE:-/workspace/.env.local}"

extract_sha() {
  local dest="$1" sha="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  git --git-dir="$GIT_DIR" archive "$sha" | tar -x -C "$dest"
  ln -sfn /workspace/node_modules "$dest/node_modules"
  cp "$ENV_FILE" "$dest/.env.local"
  printf '\nNEXT_TELEMETRY_DISABLED=1\n' >> "$dest/.env.local"
}

build_at() {
  local dest="$1"
  (
    cd "$dest"
    export NODE_ENV=production
    export NEXT_TELEMETRY_DISABLED=1
    export NODE_OPTIONS=--openssl-legacy-provider
    npx next build
  )
}

mkdir -p "$STORE"

echo "== BASE $BASE_SHA at $COMPILE =="
extract_sha "$COMPILE" "$BASE_SHA"
build_at "$COMPILE"
rm -rf "$STORE/base-same"
mkdir -p "$STORE/base-same"
cp -a "$COMPILE/.next" "$STORE/base-same/.next"
cp -a "$COMPILE/package.json" "$COMPILE/next.config.js" "$STORE/base-same/" 2>/dev/null || true
printf '%s\n' "$BASE_SHA" > "$STORE/base-same/SHA"
printf '%s\n' "$COMPILE" > "$STORE/base-same/COMPILE_PATH"

echo "== HEAD $HEAD_SHA at $COMPILE (same path) =="
extract_sha "$COMPILE" "$HEAD_SHA"
build_at "$COMPILE"
rm -rf "$STORE/head-same"
mkdir -p "$STORE/head-same"
cp -a "$COMPILE/.next" "$STORE/head-same/.next"
cp -a "$COMPILE/package.json" "$COMPILE/next.config.js" "$STORE/head-same/" 2>/dev/null || true
printf '%s\n' "$HEAD_SHA" > "$STORE/head-same/SHA"
printf '%s\n' "$COMPILE" > "$STORE/head-same/COMPILE_PATH"

echo "== BASE $BASE_SHA at $COMPILE_ALT (other path) =="
extract_sha "$COMPILE_ALT" "$BASE_SHA"
build_at "$COMPILE_ALT"
rm -rf "$STORE/base-alt"
mkdir -p "$STORE/base-alt"
cp -a "$COMPILE_ALT/.next" "$STORE/base-alt/.next"
printf '%s\n' "$BASE_SHA" > "$STORE/base-alt/SHA"
printf '%s\n' "$COMPILE_ALT" > "$STORE/base-alt/COMPILE_PATH"

echo "DONE builds"
ls -la "$STORE"
