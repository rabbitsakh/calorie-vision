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
rustore_patch_capacitor_version "$ROOT"

# Camera permission in manifest if missing
MANIFEST="$ROOT/android/app/src/main/AndroidManifest.xml"
if [[ -f "$MANIFEST" ]] && ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
  rustore_py - "$MANIFEST" <<'PY'
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

# Local reminders (Android 13+ notification permission + exact alarms when available)
if [[ -f "$MANIFEST" ]]; then
  rustore_py - "$MANIFEST" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
needed = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.VIBRATE',
]
added = []
for perm in needed:
    token = f'android:name="{perm}"'
    if token in text:
        continue
    needle = "<manifest"
    idx = text.find(needle)
    if idx < 0:
        raise SystemExit("manifest root not found")
    end = text.find(">", idx)
    insert = f'\n    <uses-permission android:name="{perm}" />'
    text = text[: end + 1] + insert + text[end + 1 :]
    added.append(perm)
path.write_text(text)
if added:
    print("notification permissions added:", ", ".join(added))
else:
    print("notification permissions already present")
PY
fi

# Brand launcher icon (Capacitor defaults to generic Android robot otherwise).
ICON_SRC="$ROOT/rustore/icon-512-store.png"
[[ -f "$ICON_SRC" ]] || ICON_SRC="$ROOT/public/icon-512.png"
rustore_sync_capacitor_icons "$ROOT/android" "$ICON_SRC"

# App Links so Google/VK OAuth Custom Tabs can return into the WebView.
# CvSession bridge so login on calorievision.ru can persist resume token.
rustore_patch_capacitor_android "$ROOT/android"

echo "==> Capacitor Android готов: $ROOT/android"
echo "Дальше: bash scripts/rustore-cap-build.sh"
