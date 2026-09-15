#!/usr/bin/env bash
# One-time (or refresh) Capacitor Android project for RuStore standalone shell.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/capacitor.config.ts" ]]; then
  echo "Нет capacitor.config.ts" >&2
  exit 1
fi

mkdir -p "$ROOT/rustore/cap-www"

echo "==> npx cap add android (idempotent)"
if [[ -d "$ROOT/android" ]]; then
  npx --yes cap sync android
else
  npx --yes cap add android
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

echo "==> Capacitor Android готов: $ROOT/android"
echo "Дальше: bash scripts/rustore-cap-build.sh"
