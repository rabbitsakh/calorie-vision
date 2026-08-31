#!/usr/bin/env bash
# Build signed APK (and AAB if possible) for RuStore.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUSTORE="$ROOT/rustore"
ANDROID="$RUSTORE/android"
DIST="$RUSTORE/dist"
KEYSTORE="$RUSTORE/android.keystore"

cd "$ROOT"

if [[ ! -d "$ANDROID" ]]; then
  echo "Сначала: bash scripts/rustore-init.sh" >&2
  exit 1
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Нет rustore/android.keystore" >&2
  exit 1
fi

BUBBLEWRAP=(npx --yes @bubblewrap/cli@1.24.1)
if command -v bubblewrap >/dev/null 2>&1; then
  BUBBLEWRAP=(bubblewrap)
fi

mkdir -p "$DIST"
cd "$ANDROID"

# Keep version/source of truth from repo manifest.
cp "$RUSTORE/twa-manifest.json" ./twa-manifest.json

echo "==> bubblewrap build"
"${BUBBLEWRAP[@]}" build

# Bubblewrap typically writes app-release-signed.apk under ./app/build/outputs/...
shopt -s nullglob
APKS=(
  ./app-release-signed.apk
  ./app/build/outputs/apk/release/*.apk
)
AABS=(
  ./app-release-bundle.aab
  ./app/build/outputs/bundle/release/*.aab
)

COPIED=0
for f in "${APKS[@]}"; do
  if [[ -f "$f" ]]; then
    cp -f "$f" "$DIST/app-release.apk"
    echo "==> APK → rustore/dist/app-release.apk"
    COPIED=1
    break
  fi
done

for f in "${AABS[@]}"; do
  if [[ -f "$f" ]]; then
    cp -f "$f" "$DIST/app-release.aab"
    echo "==> AAB → rustore/dist/app-release.aab"
    COPIED=1
    break
  fi
done

if [[ "$COPIED" -eq 0 ]]; then
  echo "Сборка прошла, но APK/AAB не найдены — проверьте вывод bubblewrap в $ANDROID" >&2
  find . -name '*.apk' -o -name '*.aab' | head -40 >&2 || true
  exit 1
fi

echo "==> Готово. Загрузите файл в RuStore Консоль (Приложения → Загрузить версию)."
ls -lh "$DIST"
