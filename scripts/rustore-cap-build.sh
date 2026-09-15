#!/usr/bin/env bash
# Build signed Capacitor APK for RuStore (standalone shell, not Bubblewrap TWA).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/rustore-sdk.sh
source "$ROOT/scripts/lib/rustore-sdk.sh"

ANDROID="$ROOT/android"
DIST="$ROOT/rustore/dist"
KEYSTORE="$ROOT/rustore/android.keystore"

cd "$ROOT"

if [[ ! -d "$ANDROID" ]]; then
  echo "Сначала: bash scripts/rustore-cap-init.sh" >&2
  exit 1
fi

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Нет rustore/android.keystore (тот же keystore, что для TWA)" >&2
  exit 1
fi

mkdir -p "$DIST"

echo "==> cap sync android"
rustore_cap_cli "$ROOT" sync android

rustore_prepare_android_sdk "$ANDROID"
rustore_prepare_java21 "$ANDROID"

cd "$ANDROID"
chmod +x ./gradlew 2>/dev/null || true

# Optional signing via env (RUSTORE_KEYSTORE_PASSWORD / RUSTORE_KEY_ALIAS / RUSTORE_KEY_PASSWORD)
if [[ -n "${RUSTORE_KEYSTORE_PASSWORD:-}" ]]; then
  cat >"$ANDROID/keystore.properties" <<EOF
storeFile=$KEYSTORE
storePassword=$RUSTORE_KEYSTORE_PASSWORD
keyAlias=${RUSTORE_KEY_ALIAS:-calorievision}
keyPassword=${RUSTORE_KEY_PASSWORD:-$RUSTORE_KEYSTORE_PASSWORD}
EOF
fi

echo "==> Gradle assembleRelease"
./gradlew assembleRelease --no-daemon

APK_SRC="$(find "$ANDROID/app/build/outputs/apk" -name '*release*.apk' | head -1 || true)"
if [[ -z "${APK_SRC:-}" ]]; then
  echo "APK не найден в outputs/apk" >&2
  exit 1
fi

cp -f "$APK_SRC" "$DIST/app-release.apk"
mkdir -p "$ROOT/public/downloads"
cp -f "$APK_SRC" "$ROOT/public/downloads/calorie-vision.apk"

echo "==> APK: $DIST/app-release.apk"
echo "Перед модерацией: установите APK, убедитесь что нет адресной строки Chrome."
echo "См. rustore/MODERATION.md"
