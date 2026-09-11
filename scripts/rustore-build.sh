#!/usr/bin/env bash
# Build signed APK (and AAB if possible) for RuStore.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/rustore-sdk.sh
source "$ROOT/scripts/lib/rustore-sdk.sh"
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

rustore_prepare_android_sdk "$ANDROID"
# Fail fast on Windows Store python stubs (hang after "Android SDK OK").
rustore_init_python

cd "$ANDROID"

# Keep version/source of truth from repo manifest.
cp "$RUSTORE/twa-manifest.json" ./twa-manifest.json

ICON_SRC="$RUSTORE/icon-512-store.png"
if [[ ! -f "$ICON_SRC" ]]; then
  ICON_SRC="$ROOT/public/icon-512.png"
fi

# Serve the opaque store icon locally so bubblewrap update never picks a stale CDN/cache copy.
ICON_HTTP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cv-twa-icon.XXXXXX")"
ICON_HTTP_PORT=""
ICON_HTTP_PID=""
cleanup_icon_http() {
  if [[ -n "${ICON_HTTP_PID}" ]] && kill -0 "$ICON_HTTP_PID" 2>/dev/null; then
    kill "$ICON_HTTP_PID" 2>/dev/null || true
    wait "$ICON_HTTP_PID" 2>/dev/null || true
  fi
  rm -rf "$ICON_HTTP_DIR"
}
trap cleanup_icon_http EXIT

cp "$ICON_SRC" "$ICON_HTTP_DIR/icon-512.png"
# Pick a free port.
echo "==> starting local icon HTTP server"
ICON_HTTP_PORT="$(rustore_py - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)"
rustore_py -m http.server "$ICON_HTTP_PORT" --bind 127.0.0.1 --directory "$ICON_HTTP_DIR" >/dev/null 2>&1 &
ICON_HTTP_PID=$!
LOCAL_ICON_URL="http://127.0.0.1:${ICON_HTTP_PORT}/icon-512.png"
# Wait until the server answers.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$LOCAL_ICON_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
echo "==> local icon URL: $LOCAL_ICON_URL"

rustore_py - "$ANDROID/twa-manifest.json" "$LOCAL_ICON_URL" <<'PY'
import json, sys
path, url = sys.argv[1], sys.argv[2]
data = json.loads(open(path, encoding="utf-8").read())
data["iconUrl"] = url
data["maskableIconUrl"] = url
open(path, "w", encoding="utf-8").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print(f"  patched twa-manifest iconUrl → {url}")
PY

# Re-fetch icons from the local A2 file, then force exact Bubblewrap mipmap sizes.
echo "==> bubblewrap update (icons / manifest)"
"${BUBBLEWRAP[@]}" update --skipVersionUpgrade || true

rustore_sync_launcher_icons "$ANDROID" "$ICON_SRC"

# Restore production icon URLs in the project manifest (local server dies after build).
rustore_py - "$ANDROID/twa-manifest.json" "$RUSTORE/twa-manifest.json" <<'PY'
import json, sys
android_path, repo_path = sys.argv[1], sys.argv[2]
android = json.loads(open(android_path, encoding="utf-8").read())
repo = json.loads(open(repo_path, encoding="utf-8").read())
android["iconUrl"] = repo["iconUrl"]
android["maskableIconUrl"] = repo["maskableIconUrl"]
android["appVersionName"] = repo["appVersionName"]
android["appVersionCode"] = repo["appVersionCode"]
open(android_path, "w", encoding="utf-8").write(json.dumps(android, indent=2, ensure_ascii=False) + "\n")
print("  restored production iconUrl / version from repo manifest")
PY

# Critical: lock checksum so `bubblewrap build` does not re-run update and overwrite mipmaps.
echo "==> lock manifest-checksum (block build-time re-update)"
rustore_lock_manifest_checksum "$ANDROID"

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
APK_OUT=""
for f in "${APKS[@]}"; do
  if [[ -f "$f" ]]; then
    cp -f "$f" "$DIST/app-release.apk"
    APK_OUT="$DIST/app-release.apk"
    echo "==> APK → rustore/dist/app-release.apk"
    # Host on the landing/install pages (gitignored binary).
    mkdir -p "$ROOT/public/downloads"
    cp -f "$APK_OUT" "$ROOT/public/downloads/calorie-vision.apk"
    echo "==> APK → public/downloads/calorie-vision.apk (лендинг /install)"
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

# Verify the signed APK actually embeds the teal A2 launcher (not old black CV).
if [[ -n "$APK_OUT" ]] && command -v unzip >/dev/null 2>&1; then
  echo "==> verify APK launcher icon"
  VERIFY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cv-apk-icon.XXXXXX")"
  if unzip -l "$APK_OUT" | grep -q 'res/mipmap-xxxhdpi-v4/ic_maskable.png\|res/mipmap-xxxhdpi/ic_maskable.png\|ic_maskable.png'; then
    unzip -qo "$APK_OUT" 'res/mipmap*/ic_maskable.png' 'res/mipmap*/ic_launcher.png' -d "$VERIFY_DIR" 2>/dev/null || true
  fi
  rustore_py - "$VERIFY_DIR" <<'PY' || true
import sys
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    sys.exit(0)
root = Path(sys.argv[1])
candidates = list(root.rglob("ic_maskable.png")) + list(root.rglob("ic_launcher.png"))
if not candidates:
    print("  (не удалось извлечь mipmap из APK — проверьте вручную)")
    sys.exit(0)
img = Image.open(candidates[0]).convert("RGB")
c = img.getpixel((max(1, img.size[0]//16), max(1, img.size[1]//16)))
print(f"  APK {candidates[0].name} corner≈{c}")
if c[1] < 80 or c[2] < 70:
    print("ERROR: в APK всё ещё старая (тёмная) иконка", file=sys.stderr)
    sys.exit(1)
print("  OK: в APK teal A2")
PY
  rm -rf "$VERIFY_DIR"
fi

echo "==> Готово. Загрузите файл в RuStore Консоль (Приложения → Загрузить версию)."
echo "    На телефоне: обновите из RuStore или удалите старое приложение и поставьте снова"
echo "    (лаунчер Android кэширует ярлык)."
ls -lh "$DIST"
