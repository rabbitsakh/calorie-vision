#!/usr/bin/env bash
# Generate rustore/android from twa-manifest.json (Bubblewrap).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/rustore-sdk.sh
source "$ROOT/scripts/lib/rustore-sdk.sh"
RUSTORE="$ROOT/rustore"
MANIFEST="$RUSTORE/twa-manifest.json"
OUT="$RUSTORE/android"
KEYSTORE="$RUSTORE/android.keystore"

cd "$ROOT"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Нет $MANIFEST" >&2
  exit 1
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Сначала создайте keystore:" >&2
  echo "  keytool -genkeypair -v -keystore rustore/android.keystore -alias calorievision -keyalg RSA -keysize 2048 -validity 10000" >&2
  exit 1
fi

BUBBLEWRAP=(npx --yes @bubblewrap/cli@1.25.0)
if [[ "${RUSTORE_USE_GLOBAL_BUBBLEWRAP:-}" == "1" ]] && command -v bubblewrap >/dev/null 2>&1; then
  BUBBLEWRAP=(bubblewrap)
fi

mkdir -p "$OUT"
cd "$OUT"

if [[ -f ./twa-manifest.json ]]; then
  echo "==> Android-проект уже есть в rustore/android — обновляю манифест"
  cp "$MANIFEST" ./twa-manifest.json
  "${BUBBLEWRAP[@]}" update --skipVersionUpgrade || true
else
  echo "==> Инициализация TWA (Bubblewrap)"
  # Non-interactive: copy our manifest and run init with --manifest if supported.
  cp "$MANIFEST" ./twa-manifest.json
  "${BUBBLEWRAP[@]}" init \
    --manifest https://calorievision.ru/manifest.json \
    --directory . \
    --skipPwaValidation \
    || {
      echo ""
      echo "Если init запросил ответы интерактивно — заполните по rustore/twa-manifest.json" >&2
      echo "packageId=ru.calorievision.app host=calorievision.ru" >&2
      exit 1
    }
  # Re-apply our curated manifest after init.
  cp "$MANIFEST" ./twa-manifest.json
fi

rustore_prepare_android_sdk "$OUT" || true

echo "==> Готово: $OUT"
echo "Дальше: bash scripts/rustore-build.sh"
echo "Fingerprint: keytool -list -v -keystore rustore/android.keystore -alias calorievision | grep SHA256"
