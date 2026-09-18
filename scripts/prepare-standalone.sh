#!/bin/bash
# Copy static assets + public into .next/standalone so `node server.js` can run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STANDALONE="$ROOT/.next/standalone"

if [[ ! -d "$STANDALONE" ]]; then
  echo "Missing $STANDALONE — run \`npm run build\` first (output: 'standalone')." >&2
  exit 1
fi

if [[ ! -d "$ROOT/.next/static" ]]; then
  echo "Missing $ROOT/.next/static — build incomplete." >&2
  exit 1
fi

echo "==> Prepare standalone layout"
rm -rf "$STANDALONE/.next/static"
mkdir -p "$STANDALONE/.next"
cp -a "$ROOT/.next/static" "$STANDALONE/.next/static"

# Ship public assets but never pack user uploads (and never clobber them on extract).
mkdir -p "$STANDALONE/public"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude uploads "$ROOT/public/" "$STANDALONE/public/"
else
  find "$STANDALONE/public" -mindepth 1 -maxdepth 1 ! -name uploads -exec rm -rf {} +
  for entry in "$ROOT/public"/*; do
    base="$(basename "$entry")"
    [[ "$base" == "uploads" ]] && continue
    cp -a "$entry" "$STANDALONE/public/"
  done
fi
mkdir -p "$STANDALONE/public/uploads"

# Metadata for ops / health debugging
{
  echo "builtAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "gitSha=${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
  echo "appVersion=$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo unknown)"
} >"$STANDALONE/.deploy-meta"

echo "   ready: $STANDALONE"
