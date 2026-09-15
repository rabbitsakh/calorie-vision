#!/usr/bin/env bash
# One-time (or refresh) Capacitor Android project for RuStore standalone shell.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/rustore-sdk.sh
source "$ROOT/scripts/lib/rustore-sdk.sh"
cd "$ROOT"

if [[ ! -f "$ROOT/capacitor.config.ts" ]]; then
  echo "Нет capacitor.config.ts" >&2
  exit 1
fi

mkdir -p "$ROOT/rustore/cap-www"

# Use local @capacitor/cli via node — `npx cap` on Windows resolves a wrong package.
echo "==> Capacitor $(rustore_cap_cli "$ROOT" --version)"

echo "==> cap add/sync android"
if [[ -d "$ROOT/android" ]]; then
  rustore_cap_cli "$ROOT" sync android
else
  rustore_cap_cli "$ROOT" add android
fi

# Prefer same applicationId as legacy TWA for RuStore updates.
APP_BUILD="$ROOT/android/app/build.gradle"
if [[ -f "$APP_BUILD" ]]; then
  python3 - "$APP_BUILD" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
text = path.read_text()
text2 = re.sub(r'applicationId\s+"[^"]+"', 'applicationId "ru.calorievision.app"', text)
text2 = re.sub(r'namespace\s+"[^"]+"', 'namespace "ru.calorievision.app"', text2)
# Keep versions in sync with package.json when present
import json
pkg = json.loads(Path("package.json").read_text())
version = str(pkg.get("version", "1.12.28"))
# versionCode: encode 1.12.28 → 11228-ish; use monotonic from twa if higher
code_match = re.search(r"versionCode\s+(\d+)", text2)
code = int(code_match.group(1)) if code_match else 1
parts = version.split(".")
try:
    major, minor, patch = (int(parts[0]), int(parts[1]), int(parts[2]))
    encoded = major * 10000 + minor * 100 + patch
except Exception:
    encoded = code
code = max(code, encoded, 6)
text2 = re.sub(r"versionCode\s+\d+", f"versionCode {code}", text2, count=1)
text2 = re.sub(r'versionName\s+"[^"]+"', f'versionName "{version}"', text2, count=1)
path.write_text(text2)
print(f"applicationId=ru.calorievision.app versionName={version} versionCode={code}")
PY
fi

# Camera permission in manifest if missing
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
if [[ -f "$MANIFEST" ]] && ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
  python3 - "$MANIFEST" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
needle = "<manifest"
idx = text.find(needle)
if idx < 0:
    raise SystemExit("manifest root not found")
# insert after <manifest ...>
end = text.find(">", idx)
insert = '\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />'
text = text[: end + 1] + insert + text[end + 1 :]
path.write_text(text)
print("CAMERA permission added")
PY
fi

# Brand launcher icon (Capacitor defaults to generic Android robot otherwise).
ICON_SRC="$ROOT/rustore/icon-512-store.png"
[[ -f "$ICON_SRC" ]] || ICON_SRC="$ROOT/public/icon-512.png"
rustore_sync_capacitor_icons "$ROOT/android" "$ICON_SRC"

# App Links so Google/VK OAuth Custom Tabs can return into the WebView.
rustore_patch_capacitor_app_links "$ROOT/android"

echo "==> Capacitor Android готов: $ROOT/android"
echo "Дальше: bash scripts/rustore-cap-build.sh"
