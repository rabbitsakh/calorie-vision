#!/usr/bin/env bash
# Build signed Capacitor APK and publish to the website download path.
#
# Local / CI secrets:
#   RUSTORE_KEYSTORE_PASSWORD   (required)
#   rustore/android.keystore    OR RUSTORE_KEYSTORE_BASE64
# Optional upload to VPS (APK is gitignored — deploy pull alone will not ship it):
#   DEPLOY_SSH_HOST / DEPLOY_SSH_USER / DEPLOY_SSH_KEY
#   DEPLOY_SSH_PATH  (default /var/www/calorie-vision/public/downloads/calorie-vision.apk)
#
# Usage:
#   bash scripts/publish-apk-site.sh
#   bash scripts/publish-apk-site.sh --build-only
#   bash scripts/publish-apk-site.sh --upload-only   # needs public/downloads/calorie-vision.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/rustore-sdk.sh
source "$ROOT/scripts/lib/rustore-sdk.sh"

KEYSTORE="$ROOT/rustore/android.keystore"
OUT_APK="$ROOT/public/downloads/calorie-vision.apk"
DIST_APK="$ROOT/rustore/dist/app-release.apk"
MODE="all"

for arg in "$@"; do
  case "$arg" in
    --build-only) MODE="build" ;;
    --upload-only) MODE="upload" ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
  esac
done

ensure_keystore() {
  if [[ -f "$KEYSTORE" ]]; then
    return 0
  fi
  if [[ -n "${RUSTORE_KEYSTORE_BASE64:-}" ]]; then
    echo "==> writing $KEYSTORE from RUSTORE_KEYSTORE_BASE64"
    mkdir -p "$(dirname "$KEYSTORE")"
    # strip whitespace/newlines from pasted secrets
    printf '%s' "$RUSTORE_KEYSTORE_BASE64" | tr -d '\r\n\t ' | base64 -d >"$KEYSTORE"
    chmod 600 "$KEYSTORE"
    return 0
  fi
  echo "Нет rustore/android.keystore и нет RUSTORE_KEYSTORE_BASE64." >&2
  echo "Положите keystore рядом с репо или задайте base64-секрет." >&2
  exit 1
}

build_apk() {
  ensure_keystore
  if [[ ! -d "$ROOT/android" ]]; then
    echo "==> rustore-cap-init"
    bash "$ROOT/scripts/rustore-cap-init.sh"
  fi
  echo "==> rustore-cap-build"
  bash "$ROOT/scripts/rustore-cap-build.sh"
  if [[ ! -f "$OUT_APK" ]]; then
    echo "Ожидали $OUT_APK после сборки" >&2
    exit 1
  fi
  echo "==> local APK ready: $OUT_APK ($(wc -c <"$OUT_APK") bytes)"
}

upload_apk() {
  local src="${1:-$OUT_APK}"
  if [[ ! -f "$src" ]]; then
    if [[ -f "$DIST_APK" ]]; then
      src="$DIST_APK"
    else
      echo "Нет APK для загрузки ($OUT_APK)" >&2
      exit 1
    fi
  fi

  local host="${DEPLOY_SSH_HOST:-}"
  local user="${DEPLOY_SSH_USER:-}"
  local key="${DEPLOY_SSH_KEY:-}"
  local remote="${DEPLOY_SSH_PATH:-/var/www/calorie-vision/public/downloads/calorie-vision.apk}"

  if [[ -z "$host" || -z "$user" ]]; then
    echo "DEPLOY_SSH_HOST / DEPLOY_SSH_USER не заданы — пропускаю upload." >&2
    echo "Скопируйте вручную:" >&2
    echo "  scp $src USER@HOST:$remote" >&2
    exit 2
  fi

  local keyfile
  keyfile="$(mktemp)"
  cleanup() { rm -f "$keyfile"; }
  trap cleanup EXIT

  if [[ -f "$key" ]]; then
    cp -f "$key" "$keyfile"
  elif [[ -n "$key" ]]; then
    printf '%s\n' "$key" >"$keyfile"
  else
    echo "DEPLOY_SSH_KEY не задан (путь к ключу или PEM-содержимое)." >&2
    exit 1
  fi
  chmod 600 "$keyfile"

  echo "==> mkdir remote downloads"
  ssh -i "$keyfile" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "${user}@${host}" \
    "mkdir -p \"\$(dirname \"$remote\")\""

  echo "==> scp → ${user}@${host}:$remote"
  scp -i "$keyfile" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "$src" "${user}@${host}:$remote"

  echo "==> verify remote size"
  ssh -i "$keyfile" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "${user}@${host}" \
    "ls -lh \"$remote\" && file \"$remote\""

  echo "==> done. Check https://calorievision.ru/downloads/calorie-vision.apk"
}

case "$MODE" in
  build) build_apk ;;
  upload) upload_apk ;;
  all)
    build_apk
    upload_apk "$OUT_APK" || {
      status=$?
      if [[ $status -eq 2 ]]; then
        echo "==> APK собран локально; upload пропущен (нет SSH секретов)."
        exit 0
      fi
      exit "$status"
    }
    ;;
esac
