#!/bin/bash
# Pack prepared `.next/standalone` into a tarball for CI → VPS deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${PACK_OUT_DIR:-$ROOT/dist}"
OUT_FILE="${PACK_OUT_FILE:-$OUT_DIR/calorie-vision-standalone.tar.gz}"

bash "$ROOT/scripts/prepare-standalone.sh"

mkdir -p "$(dirname "$OUT_FILE")"
echo "==> Pack $OUT_FILE"
# Archive so extract into APP_DIR recreates `.next/standalone/…`
tar -czf "$OUT_FILE" -C "$ROOT" .next/standalone

SIZE="$(du -h "$OUT_FILE" | awk '{print $1}')"
echo "   packed $SIZE → $OUT_FILE"
