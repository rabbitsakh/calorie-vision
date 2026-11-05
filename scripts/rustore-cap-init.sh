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
# В репозитории лежат Java-плагины (CvFiles, CvRest). Пока нет gradlew — это не проект,
# cap add его затрёт, поэтому исходники сохраняем и кладём обратно.
PLUGIN_DIR="$ROOT/android/app/src/main/java/ru/calorievision/app"
plugin_backup=""
if [[ -x "$ROOT/android/gradlew" ]]; then
  rustore_cap_cli "$ROOT" sync android
else
  if [[ -d "$PLUGIN_DIR" ]]; then
    plugin_backup="$(mktemp -d)"
    cp "$PLUGIN_DIR"/*.java "$plugin_backup"/ 2>/dev/null || true
  fi
  rm -rf "$ROOT/android"
  rustore_cap_cli "$ROOT" add android
  if [[ -n "$plugin_backup" ]]; then
    mkdir -p "$PLUGIN_DIR"
    cp "$plugin_backup"/*.java "$PLUGIN_DIR"/ 2>/dev/null || true
    rm -rf "$plugin_backup"
  fi
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

# Таймер отдыха: foreground-сервис с хронометром на экране блокировки.
if [[ -f "$MANIFEST" ]]; then
  rustore_py - "$MANIFEST" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
perms = [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.WAKE_LOCK",
]
for perm in perms:
    token = f'android:name="{perm}"'
    if token in text:
        continue
    idx = text.find("<manifest")
    end = text.find(">", idx)
    text = text[: end + 1] + f'\n    <uses-permission android:name="{perm}" />' + text[end + 1 :]
if "CvRestTimerService" not in text:
    service = """
        <service
            android:name=".CvRestTimerService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Таймер отдыха между подходами" />
        </service>"""
    needle = "</application>"
    idx = text.find(needle)
    if idx < 0:
        raise SystemExit("application close not found")
    text = text[:idx] + service + "\n    " + text[idx:]
    print("CvRestTimerService added")
else:
    print("CvRestTimerService already present")
path.write_text(text)
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
