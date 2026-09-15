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

# Password required up front (Gradle patch + apksigner).
if [[ -z "${RUSTORE_KEYSTORE_PASSWORD:-}" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "Пароль rustore/android.keystore: " RUSTORE_KEYSTORE_PASSWORD
    echo
    export RUSTORE_KEYSTORE_PASSWORD
  fi
fi
if [[ -z "${RUSTORE_KEYSTORE_PASSWORD:-}" ]]; then
  echo "Задайте пароль keystore:" >&2
  echo '  export RUSTORE_KEYSTORE_PASSWORD="ваш-пароль"' >&2
  echo '  export RUSTORE_KEY_ALIAS="calorievision"   # если alias другой' >&2
  echo "Без подписи Android: «пакет недействителен / повреждён»." >&2
  exit 1
fi

mkdir -p "$DIST"
# Drop stale APKs so the phone never gets an old unsigned build.
echo "==> cleaning $DIST"
rm -f "$DIST"/*.apk "$DIST"/*.aab "$DIST"/*.idsig 2>/dev/null || true

echo "==> cap sync android"
rustore_cap_cli "$ROOT" sync android

# Re-apply A2 icons after sync (cap sync can restore Cap defaults).
ICON_SRC="$ROOT/rustore/icon-512-store.png"
[[ -f "$ICON_SRC" ]] || ICON_SRC="$ROOT/public/icon-512.png"
rustore_sync_capacitor_icons "$ANDROID" "$ICON_SRC"

rustore_prepare_android_sdk "$ANDROID"
rustore_prepare_java21 "$ANDROID"

# Best-effort Gradle signing (may still yield unsigned on some AGP/Windows setups).
rustore_configure_capacitor_signing "$ROOT" "$ANDROID" "$KEYSTORE" || true

cd "$ANDROID"
chmod +x ./gradlew 2>/dev/null || true

echo "==> Gradle assembleRelease"
./gradlew assembleRelease --no-daemon

# Take any release APK (including unsigned) — we re-sign below.
APK_RAW="$(find "$ANDROID/app/build/outputs/apk" -name 'app-release.apk' | head -1 || true)"
if [[ -z "${APK_RAW:-}" ]]; then
  APK_RAW="$(find "$ANDROID/app/build/outputs/apk" -name '*release*.apk' | head -1 || true)"
fi
if [[ -z "${APK_RAW:-}" ]]; then
  echo "APK не найден в outputs/apk" >&2
  find "$ANDROID/app/build/outputs/apk" -name '*.apk' 2>/dev/null || true
  exit 1
fi
echo "==> raw APK: $APK_RAW"

# Always zipalign + apksigner — this is what makes the package installable.
OUT_APK="$DIST/app-release.apk"
rustore_sign_apk "$APK_RAW" "$OUT_APK" "$KEYSTORE"

mkdir -p "$ROOT/public/downloads"
cp -f "$OUT_APK" "$ROOT/public/downloads/calorie-vision.apk"

echo "==> APK: $OUT_APK"
if command -v stat >/dev/null 2>&1; then
  # Git Bash / Linux: show size + mtime so you can confirm it's fresh
  stat -c '%n  %s bytes  %y' "$OUT_APK" 2>/dev/null \
    || stat -f '%N  %z bytes  %Sm' "$OUT_APK" 2>/dev/null \
    || ls -lh "$OUT_APK"
else
  ls -lh "$OUT_APK"
fi
echo "Установка: скопируйте ЭТОТ файл по USB/adb (не через Telegram — он портит APK)."
echo "  adb install -r rustore/dist/app-release.apk"
echo "Если уже стоит старый TWA: сначала удалите «Calorie Vision»."
echo "См. rustore/MODERATION.md"
