#!/usr/bin/env bash
# Shared Android SDK helpers for RuStore TWA builds (Linux, macOS, Git Bash on Windows).

# Real CPython for Git Bash on Windows (skip Microsoft Store stubs in WindowsApps).
# Sets RUSTORE_PY as a bash array: (python3) or (py -3) or (python).
# Override: export RUSTORE_PYTHON=/c/Python312/python.exe
rustore_init_python() {
  if declare -p RUSTORE_PY >/dev/null 2>&1 && ((${#RUSTORE_PY[@]} > 0)); then
    return 0
  fi

  local -a candidates=()
  local cand exe resolved

  if [[ -n "${RUSTORE_PYTHON:-}" ]]; then
    candidates+=("${RUSTORE_PYTHON}")
  fi
  # Prefer py launcher on Windows, then python3/python from PATH.
  if command -v py >/dev/null 2>&1; then
    candidates+=("py:-3")
  fi
  if command -v python3 >/dev/null 2>&1; then
    candidates+=("python3")
  fi
  if command -v python >/dev/null 2>&1; then
    candidates+=("python")
  fi

  for cand in "${candidates[@]}"; do
    local -a cmd=()
    if [[ "$cand" == py:-3 ]]; then
      cmd=(py -3)
    else
      cmd=("$cand")
      # Skip Microsoft Store stubs BEFORE invoking — they hang in Git Bash.
      resolved="$(command -v "$cand" 2>/dev/null || true)"
      case "$resolved" in
        *WindowsApps*|*windowsapps*)
          echo "==> skip Store stub: $resolved"
          continue
          ;;
      esac
    fi
    # Bound probe: Store stubs can hang forever on -c.
    exe="$(
      if command -v timeout >/dev/null 2>&1; then
        timeout 5 "${cmd[@]}" -c "import sys; print(sys.executable)" 2>/dev/null
      else
        "${cmd[@]}" -c "import sys; print(sys.executable)" 2>/dev/null
      fi
    )" || continue
    [[ -n "$exe" ]] || continue
    case "$exe" in
      *WindowsApps*|*windowsapps*) continue ;;
    esac
    "${cmd[@]}" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" 2>/dev/null || continue
    RUSTORE_PY=("${cmd[@]}")
    echo "==> Python: $("${cmd[@]}" -c "import sys; print(sys.executable + ' (' + sys.version.split()[0] + ')' )" 2>/dev/null)"
    if ! "${cmd[@]}" -c "from PIL import Image" >/dev/null 2>&1; then
      echo "Нет Pillow для синхронизации иконок. В Git Bash:" >&2
      echo "  ${cmd[*]} -m pip install pillow" >&2
      return 1
    fi
    return 0
  done

  echo "Не найден рабочий Python 3.9+ (или сработал Microsoft Store stub)." >&2
  echo "1) Установите Python с https://www.python.org/downloads/ (галочка Add to PATH)" >&2
  echo "2) Отключите App execution aliases: Параметры → Приложения → Псевдонимы →" >&2
  echo "   python.exe / python3.exe = Выкл" >&2
  echo "3) Проверка в Git Bash:  py -3 -c \"import sys; print(sys.executable)\"" >&2
  echo "   Затем:  py -3 -m pip install pillow" >&2
  echo "Или задайте:  export RUSTORE_PYTHON=/c/Path/to/python.exe" >&2
  return 1
}

rustore_py() {
  rustore_init_python || return 1
  "${RUSTORE_PY[@]}" "$@"
}

# Bubblewrap stores cmdline-tools path; Gradle needs the SDK root (parent of cmdline-tools).
rustore_resolve_android_sdk_root() {
  local candidate sdk_path root parent

  for candidate in "${ANDROID_SDK_ROOT:-}" "${ANDROID_HOME:-}"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      if [[ -d "$candidate/platforms" || -d "$candidate/build-tools" || -d "$candidate/licenses" ]]; then
        printf '%s\n' "$candidate"
        return 0
      fi
      if [[ "$(basename "$candidate")" == "latest" && "$(basename "$(dirname "$candidate")")" == "cmdline-tools" ]]; then
        root="$(cd "$candidate/../.." && pwd)"
        printf '%s\n' "$root"
        return 0
      fi
    fi
  done

  local cfg="${HOME}/.bubblewrap/config.json"
  if [[ -f "$cfg" ]] && command -v node >/dev/null 2>&1; then
    sdk_path="$(node -e "try{const c=require(process.argv[1]);process.stdout.write(c.androidSdkPath||'')}catch{}" "$cfg")"
    if [[ -n "$sdk_path" ]]; then
      if [[ -d "$sdk_path/platforms" || -d "$sdk_path/build-tools" ]]; then
        printf '%s\n' "$sdk_path"
        return 0
      fi
      if [[ "$sdk_path" == *cmdline-tools* ]]; then
        root="$(cd "$sdk_path/../.." 2>/dev/null && pwd || true)"
        if [[ -n "$root" ]]; then
          printf '%s\n' "$root"
          return 0
        fi
      fi
    fi
  fi

  for candidate in \
    "${LOCALAPPDATA:-}/Android/Sdk" \
    "${USERPROFILE:-}/AppData/Local/Android/Sdk" \
    "${HOME}/AppData/Local/Android/Sdk" \
    "${HOME}/Android/Sdk"; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

rustore_escape_sdk_dir_for_properties() {
  local dir="$1"
  if command -v cygpath >/dev/null 2>&1; then
    dir="$(cygpath -w "$dir")"
  fi
  node -e "process.stdout.write(process.argv[1].replace(/\\\\/g,'\\\\\\\\'))" "$dir"
}

rustore_write_local_properties() {
  local android_dir="$1"
  local sdk_root="$2"
  local escaped
  escaped="$(rustore_escape_sdk_dir_for_properties "$sdk_root")"
  mkdir -p "$android_dir"
  printf 'sdk.dir=%s\n' "$escaped" >"$android_dir/local.properties"
  echo "==> local.properties → sdk.dir=$sdk_root"
}

rustore_detect_compile_sdk() {
  local android_dir="$1"
  local gradle="$android_dir/app/build.gradle"
  local value="36"
  if [[ -f "$gradle" ]]; then
    value="$(sed -n 's/.*compileSdk[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$gradle" | head -1)"
    [[ -z "$value" ]] && value="$(sed -n 's/.*compileSdkVersion[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$gradle" | head -1)"
  fi
  [[ -z "$value" ]] && value="${RUSTORE_COMPILE_SDK:-36}"
  printf '%s\n' "$value"
}

rustore_detect_build_tools() {
  local android_dir="$1"
  local gradle="$android_dir/app/build.gradle"
  local value="35.0.0"
  if [[ -f "$gradle" ]]; then
    value="$(sed -n 's/.*buildToolsVersion[[:space:]]*"\([^"]*\)".*/\1/p' "$gradle" | head -1)"
  fi
  [[ -z "$value" ]] && value="${RUSTORE_BUILD_TOOLS:-35.0.0}"
  printf '%s\n' "$value"
}

rustore_find_sdkmanager() {
  local sdk_root="$1"
  local candidate
  for candidate in \
    "$sdk_root/cmdline-tools/latest/bin/sdkmanager" \
    "$sdk_root/cmdline-tools/latest/bin/sdkmanager.bat" \
    "$sdk_root/cmdline-tools/bin/sdkmanager" \
    "$sdk_root/tools/bin/sdkmanager"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

rustore_ensure_android_sdk() {
  local sdk_root="$1"
  local android_dir="$2"
  local platform build_tools sdkmanager

  export ANDROID_HOME="$sdk_root"
  export ANDROID_SDK_ROOT="$sdk_root"

  platform="$(rustore_detect_compile_sdk "$android_dir")"
  build_tools="$(rustore_detect_build_tools "$android_dir")"

  if [[ -d "$sdk_root/build-tools/$build_tools" && -d "$sdk_root/platforms/android-$platform" ]]; then
    echo "==> Android SDK OK (build-tools $build_tools, platform android-$platform)"
    return 0
  fi

  echo "==> Installing Android SDK packages (build-tools $build_tools, platform android-$platform)"
  sdkmanager="$(rustore_find_sdkmanager "$sdk_root" || true)"

  if [[ -n "$sdkmanager" ]]; then
    yes | "$sdkmanager" --licenses >/dev/null 2>&1 || true
    "$sdkmanager" --install "platform-tools" "build-tools;${build_tools}" "platforms;android-${platform}"
    return 0
  fi

  if command -v android >/dev/null 2>&1; then
    android sdk install "build-tools/${build_tools}" "platforms/android-${platform}"
    return 0
  fi

  echo "Не найден sdkmanager. Установите Android SDK Platform $platform и Build-Tools $build_tools." >&2
  echo "ANDROID_HOME должен указывать на корень SDK, не на cmdline-tools/latest:" >&2
  echo "  $sdk_root" >&2
  return 1
}

rustore_prepare_android_sdk() {
  local android_dir="$1"
  local sdk_root

  if ! sdk_root="$(rustore_resolve_android_sdk_root)"; then
    echo "Не удалось найти Android SDK. Задайте ANDROID_HOME (корень SDK, не cmdline-tools):" >&2
    echo "  export ANDROID_HOME=\"\$LOCALAPPDATA/Android/Sdk\"   # Git Bash / PowerShell" >&2
    return 1
  fi

  rustore_write_local_properties "$android_dir" "$sdk_root"
  rustore_ensure_android_sdk "$sdk_root" "$android_dir"
}

# Exact Bubblewrap (@bubblewrap/core TwaGenerator) icon destinations.
# API 26+ launcher uses mipmap-anydpi-v26/ic_launcher.xml → @mipmap/ic_maskable
# (legacy uses ic_launcher.png). Wrong sizes / missing maskable = "old" APK icon.
# Source of truth: rustore/icon-512-store.png (opaque) falling back to public/icon-512.png.
rustore_sync_launcher_icons() {
  local android_dir="$1"
  local icon_src="$2"
  local res_dir="$android_dir/app/src/main/res"

  if [[ ! -f "$icon_src" ]]; then
    echo "Нет исходной иконки: $icon_src" >&2
    return 1
  fi
  if [[ ! -d "$res_dir" ]]; then
    echo "==> android/res ещё нет — иконки подтянет bubblewrap init/update"
    return 0
  fi

  echo "==> Синхронизация launcher icons из $(basename "$icon_src")"
  rustore_py - "$icon_src" "$android_dir" <<'PY'
import sys
from pathlib import Path
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGBA")
android = Path(sys.argv[2])
# Opaque RGB plate (RuStore / launcher expect no soft alpha edges).
opaque = Image.new("RGB", src.size, (30, 115, 108))
opaque.paste(src, mask=src.split()[-1])

# Paths/sizes from @bubblewrap/core TwaGenerator IMAGES / ADAPTIVE / SPLASH / NOTIFICATION.
assets = [
    ("store_icon.png", 512),
    ("app/src/main/res/mipmap-mdpi/ic_launcher.png", 48),
    ("app/src/main/res/mipmap-hdpi/ic_launcher.png", 72),
    ("app/src/main/res/mipmap-xhdpi/ic_launcher.png", 96),
    ("app/src/main/res/mipmap-xxhdpi/ic_launcher.png", 144),
    ("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 192),
    ("app/src/main/res/mipmap-mdpi/ic_maskable.png", 82),
    ("app/src/main/res/mipmap-hdpi/ic_maskable.png", 123),
    ("app/src/main/res/mipmap-xhdpi/ic_maskable.png", 164),
    ("app/src/main/res/mipmap-xxhdpi/ic_maskable.png", 246),
    ("app/src/main/res/mipmap-xxxhdpi/ic_maskable.png", 328),
    ("app/src/main/res/drawable-mdpi/splash.png", 300),
    ("app/src/main/res/drawable-hdpi/splash.png", 450),
    ("app/src/main/res/drawable-xhdpi/splash.png", 600),
    ("app/src/main/res/drawable-xxhdpi/splash.png", 900),
    ("app/src/main/res/drawable-xxxhdpi/splash.png", 1200),
    ("app/src/main/res/drawable-mdpi/ic_notification_icon.png", 24),
    ("app/src/main/res/drawable-hdpi/ic_notification_icon.png", 36),
    ("app/src/main/res/drawable-xhdpi/ic_notification_icon.png", 48),
    ("app/src/main/res/drawable-xxhdpi/ic_notification_icon.png", 72),
    ("app/src/main/res/drawable-xxxhdpi/ic_notification_icon.png", 96),
]

written = 0
for rel, size in assets:
    path = android / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    opaque.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
    written += 1
    print(f"  wrote {rel} ({size}px)")

# Legacy / alternate names some forks leave behind.
for name in ("ic_launcher_round.png", "ic_launcher_foreground.png"):
    for folder in ("mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"):
        path = android / "app/src/main/res" / folder / name
        if path.exists():
            # Match sibling ic_launcher size if present, else 192.
            sib = path.with_name("ic_launcher.png")
            size = Image.open(sib).size[0] if sib.exists() else 192
            opaque.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)
            written += 1
            print(f"  wrote {path.relative_to(android)} ({size}px)")

# Sanity: adaptive icon must be teal A2, not old black CV.
probe = android / "app/src/main/res/mipmap-xxxhdpi/ic_maskable.png"
if probe.exists():
    c = Image.open(probe).convert("RGB").getpixel((8, 8))
    # A2 teal plate ≈ (30, 115, 108); old mark was near-black.
    if c[1] < 80 or c[2] < 70:
        print(f"ERROR: {probe.name} corner={c} — похоже на старую иконку", file=sys.stderr)
        sys.exit(1)
    print(f"  OK probe ic_maskable xxxhdpi corner={c}")

print(f"  обновлено файлов: {written}")
PY
}

# Capacitor Android adaptive icons (mipmap-*/ic_launcher*.png + teal background).
# Call after `cap add` / `cap sync`, before Gradle.
rustore_sync_capacitor_icons() {
  local android_dir="$1"
  local icon_src="${2:-}"
  local res_dir="$android_dir/app/src/main/res"

  if [[ -z "$icon_src" ]]; then
    if [[ -f "$ROOT/rustore/icon-512-store.png" ]]; then
      icon_src="$ROOT/rustore/icon-512-store.png"
    elif [[ -f "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/rustore/icon-512-store.png" ]]; then
      icon_src="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/rustore/icon-512-store.png"
    elif [[ -f "$android_dir/../rustore/icon-512-store.png" ]]; then
      icon_src="$android_dir/../rustore/icon-512-store.png"
    fi
  fi
  # Resolve relative to repo when called as rustore_sync_capacitor_icons "$ANDROID"
  if [[ -z "$icon_src" || ! -f "$icon_src" ]]; then
    local repo
    repo="$(cd "$android_dir/.." && pwd)"
    if [[ -f "$repo/rustore/icon-512-store.png" ]]; then
      icon_src="$repo/rustore/icon-512-store.png"
    elif [[ -f "$repo/public/icon-512.png" ]]; then
      icon_src="$repo/public/icon-512.png"
    fi
  fi

  if [[ ! -f "$icon_src" ]]; then
    echo "Нет иконки (rustore/icon-512-store.png)" >&2
    return 1
  fi
  if [[ ! -d "$res_dir" ]]; then
    echo "Нет $res_dir — сначала cap add android" >&2
    return 1
  fi

  echo "==> Capacitor launcher icons ← $(basename "$icon_src")"
  rustore_py - "$icon_src" "$android_dir" <<'PY'
import sys
from pathlib import Path
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGBA")
android = Path(sys.argv[2])
res = android / "app/src/main/res"
# Brand teal plate (A2)
TEAL = (30, 115, 108)
plate = Image.new("RGB", src.size, TEAL)
plate.paste(src, mask=src.split()[-1])

# Legacy launcher + round (API < 26)
legacy = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
# Adaptive foreground canvas (108dp family)
foreground = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

written = 0
for folder, size in legacy.items():
    d = res / folder
    d.mkdir(parents=True, exist_ok=True)
    img = plate.resize((size, size), Image.Resampling.LANCZOS)
    for name in ("ic_launcher.png", "ic_launcher_round.png"):
        img.save(d / name, optimize=True)
        written += 1
        print(f"  wrote {folder}/{name} ({size}px)")

for folder, size in foreground.items():
    d = res / folder
    d.mkdir(parents=True, exist_ok=True)
    # Full-bleed teal plate with logo; adaptive safe zone crops ~1/3
    img = plate.resize((size, size), Image.Resampling.LANCZOS)
    img.save(d / "ic_launcher_foreground.png", optimize=True)
    written += 1
    print(f"  wrote {folder}/ic_launcher_foreground.png ({size}px)")

# Solid teal adaptive background (color resource + simple drawable)
values = res / "values"
values.mkdir(parents=True, exist_ok=True)
(values / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    "<resources>\n"
    '    <color name="ic_launcher_background">#1E736C</color>\n'
    "</resources>\n",
    encoding="utf-8",
)
print("  wrote values/ic_launcher_background.xml (#1E736C)")

drawable = res / "drawable"
drawable.mkdir(parents=True, exist_ok=True)
(drawable / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
    '    <solid android:color="@color/ic_launcher_background" />\n'
    "</shape>\n",
    encoding="utf-8",
)
print("  wrote drawable/ic_launcher_background.xml")

# Point adaptive icons at our mipmap foreground + color background
anydpi = res / "mipmap-anydpi-v26"
anydpi.mkdir(parents=True, exist_ok=True)
adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (anydpi / name).write_text(adaptive, encoding="utf-8")
    print(f"  wrote mipmap-anydpi-v26/{name}")

# Drop Cap vector foreground if present (would override look on some devices)
for obsolete in (
    res / "drawable-v24" / "ic_launcher_foreground.xml",
    res / "drawable" / "ic_launcher_foreground.xml",
):
    if obsolete.exists():
        obsolete.unlink()
        print(f"  removed {obsolete.relative_to(res)}")

probe = res / "mipmap-xxxhdpi" / "ic_launcher_foreground.png"
c = Image.open(probe).convert("RGB").getpixel((12, 12))
if c[1] < 80 or c[2] < 70:
    print(f"ERROR: foreground corner={c} — не A2 teal", file=sys.stderr)
    sys.exit(1)
print(f"  OK probe foreground xxxhdpi corner={c}")
print(f"  обновлено файлов: {written}")
PY
}

# Prevent `bubblewrap build` from re-running update (which re-fetches icons over our sync).
rustore_lock_manifest_checksum() {
  local android_dir="$1"
  local manifest="$android_dir/twa-manifest.json"
  local checksum_file="$android_dir/manifest-checksum.txt"

  if [[ ! -f "$manifest" ]]; then
    echo "Нет $manifest — checksum не обновлён" >&2
    return 1
  fi

  rustore_py - "$manifest" "$checksum_file" <<'PY'
import hashlib, pathlib, sys
data = pathlib.Path(sys.argv[1]).read_bytes()
digest = hashlib.sha1(data).hexdigest()
pathlib.Path(sys.argv[2]).write_text(digest)
print(f"  manifest-checksum.txt = {digest}")
PY
}

# Resolve Capacitor CLI without `npx cap` (on Windows that fetches a random "cap" package).
# Usage: rustore_cap_cli "$ROOT" --version | sync android | add android
rustore_cap_cli() {
  local root="${1:?root}"
  shift
  local bin="$root/node_modules/@capacitor/cli/bin/capacitor"
  if [[ ! -f "$bin" ]]; then
    echo "Нет @capacitor/cli. Запустите: npm install" >&2
    return 1
  fi
  node "$bin" "$@"
}

# Major version from `java -version` (stderr). Empty if unreadable.
rustore_java_major() {
  local java_bin="$1"
  local line major
  [[ -x "$java_bin" || -f "$java_bin" ]] || return 1
  line="$("$java_bin" -version 2>&1 | head -n 1)" || return 1
  if [[ "$line" =~ version\ \"([0-9]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

# Capacitor 8 / AGP needs JDK 21. Sets JAVA_HOME + PATH; optional write org.gradle.java.home.
# Override: export JAVA_HOME=/path/to/jdk-21
rustore_prepare_java21() {
  local android_dir="${1:-}"
  local home java_bin major win_home
  local -a candidates=()

  _rustore_add_jdk_candidate() {
    local h="$1"
    [[ -n "$h" && -d "$h" ]] || return 0
    candidates+=("$h")
  }

  _rustore_add_jdk_candidate "${JAVA_HOME:-}"

  shopt -s nullglob
  local p
  for p in \
    "/c/Program Files/Eclipse Adoptium"/jdk-21* \
    "/c/Program Files/Java"/jdk-21* \
    "/c/Program Files/Microsoft"/jdk-21* \
    "/c/Program Files/Android/Android Studio/jbr" \
    "/c/Program Files/Android/Android Studio/jre" \
    "${LOCALAPPDATA:-}/Programs/Android/Android Studio/jbr" \
    "${ProgramFiles:-}/Android/Android Studio/jbr" \
    "${HOME}/.jdks"/jdk-21* \
    /usr/lib/jvm/java-21-openjdk \
    /usr/lib/jvm/java-21-openjdk-amd64 \
    /usr/lib/jvm/temurin-21-jdk \
    /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
    /Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home; do
    _rustore_add_jdk_candidate "$p"
  done
  shopt -u nullglob

  # PATH java — last resort (may be 17/25).
  if command -v java >/dev/null 2>&1; then
    java_bin="$(command -v java)"
    home="$(cd "$(dirname "$java_bin")/.." && pwd 2>/dev/null || true)"
    _rustore_add_jdk_candidate "$home"
  fi

  for home in "${candidates[@]}"; do
    if [[ -f "$home/bin/java.exe" ]]; then
      java_bin="$home/bin/java.exe"
    elif [[ -f "$home/bin/java" ]]; then
      java_bin="$home/bin/java"
    else
      continue
    fi
    major="$(rustore_java_major "$java_bin" || true)"
    if [[ "$major" == "21" ]]; then
      export JAVA_HOME="$home"
      export PATH="$JAVA_HOME/bin:$PATH"
      echo "==> JAVA_HOME=$JAVA_HOME (JDK 21)"
      if [[ -n "$android_dir" && -d "$android_dir" ]]; then
        win_home="$JAVA_HOME"
        if command -v cygpath >/dev/null 2>&1; then
          win_home="$(cygpath -w "$JAVA_HOME")"
        fi
        win_home="$(node -e "process.stdout.write(process.argv[1].replace(/\\\\/g,'\\\\\\\\'))" "$win_home")"
        if [[ -f "$android_dir/gradle.properties" ]]; then
          if grep -q '^org.gradle.java.home=' "$android_dir/gradle.properties" 2>/dev/null; then
            grep -v '^org.gradle.java.home=' "$android_dir/gradle.properties" >"$android_dir/gradle.properties.tmp"
            mv "$android_dir/gradle.properties.tmp" "$android_dir/gradle.properties"
          fi
          printf '\norg.gradle.java.home=%s\n' "$win_home" >>"$android_dir/gradle.properties"
        else
          printf 'org.gradle.java.home=%s\n' "$win_home" >"$android_dir/gradle.properties"
        fi
        echo "==> gradle.properties org.gradle.java.home set"
      fi
      return 0
    fi
  done

  echo "Нет JDK 21 — Capacitor 8 / Android Gradle Plugin его требуют." >&2
  echo "Сейчас JAVA_HOME=${JAVA_HOME:-не задан}; java=$(command -v java 2>/dev/null || echo нет)" >&2
  if command -v java >/dev/null 2>&1; then
    java -version 2>&1 | head -n 1 >&2 || true
  fi
  echo "" >&2
  echo "Установите Temurin 21: https://adoptium.net/temurin/releases/?version=21" >&2
  echo "Затем в Git Bash (подставьте свой путь):" >&2
  echo '  export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.x-hotspot"' >&2
  echo '  export PATH="$JAVA_HOME/bin:$PATH"' >&2
  echo '  java -version   # должно быть 21.x' >&2
  echo "См. rustore/WINDOWS.md" >&2
  return 1
}

# Write keystore.properties + patch android/app/build.gradle so assembleRelease is signed.
# Requires RUSTORE_KEYSTORE_PASSWORD (or interactive prompt). Alias default: calorievision.
rustore_configure_capacitor_signing() {
  local root="${1:?root}"
  local android_dir="${2:?android}"
  local keystore="${3:?keystore}"
  local app_gradle="$android_dir/app/build.gradle"
  local props="$android_dir/keystore.properties"
  local store_file alias password key_password

  if [[ ! -f "$keystore" ]]; then
    echo "Нет keystore: $keystore" >&2
    return 1
  fi
  if [[ ! -f "$app_gradle" ]]; then
    echo "Нет $app_gradle — сначала npm run rustore:cap:init" >&2
    return 1
  fi

  password="${RUSTORE_KEYSTORE_PASSWORD:-}"
  if [[ -z "$password" ]]; then
    if [[ -t 0 ]]; then
      read -r -s -p "Пароль rustore/android.keystore: " password
      echo
    fi
  fi
  if [[ -z "$password" ]]; then
    echo "Нужен пароль keystore. В Git Bash:" >&2
    echo '  export RUSTORE_KEYSTORE_PASSWORD="ваш-пароль"' >&2
    echo '  export RUSTORE_KEY_ALIAS="calorievision"   # если другой alias' >&2
    echo "Без подписи Android ставит APK как «пакет недействителен / повреждён»." >&2
    return 1
  fi

  alias="${RUSTORE_KEY_ALIAS:-calorievision}"
  key_password="${RUSTORE_KEY_PASSWORD:-$password}"

  store_file="$keystore"
  if command -v cygpath >/dev/null 2>&1; then
    store_file="$(cygpath -w "$keystore")"
  fi
  store_file="$(node -e "process.stdout.write(process.argv[1].replace(/\\\\/g,'\\\\\\\\'))" "$store_file")"

  cat >"$props" <<EOF
storeFile=$store_file
storePassword=$password
keyAlias=$alias
keyPassword=$key_password
EOF
  echo "==> keystore.properties (alias=$alias)"

  python3 - "$app_gradle" <<'PY2'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
marker = "// RUSTORE_RELEASE_SIGNING"

header = """
// RUSTORE_RELEASE_SIGNING
def _rustoreKs = new Properties()
def _rustoreKsFile = rootProject.file("keystore.properties")
if (_rustoreKsFile.exists()) {
    _rustoreKs.load(new FileInputStream(_rustoreKsFile))
}
""".lstrip("\n")

signing_block = """
    signingConfigs {
        release {
            if (_rustoreKsFile.exists()) {
                storeFile file(_rustoreKs["storeFile"])
                storePassword _rustoreKs["storePassword"]
                keyAlias _rustoreKs["keyAlias"]
                keyPassword _rustoreKs["keyPassword"]
            }
        }
    }
"""

if marker in text:
    print("signing patch already present")
else:
    lines = text.splitlines(keepends=True)
    out = []
    inserted_header = False
    for line in lines:
        out.append(line)
        if not inserted_header and line.startswith("apply plugin:"):
            out.append("\n")
            out.append(header)
            if not header.endswith("\n"):
                out.append("\n")
            inserted_header = True
    text = "".join(out)
    if not inserted_header:
        text = header + "\n" + text

    if "signingConfigs" not in text:
        text = text.replace(
            "    buildTypes {",
            signing_block + "    buildTypes {",
            1,
        )

    if "signingConfig signingConfigs.release" not in text:
        for needle in (
            "        release {\n            minifyEnabled false",
            "        release {\n            minifyEnabled false",
        ):
            repl = needle.replace(
                "        release {\n",
                "        release {\n            signingConfig signingConfigs.release\n",
                1,
            )
            if needle in text:
                text = text.replace(needle, repl, 1)
                break
        if "signingConfig signingConfigs.release" not in text:
            # Last resort: inject after "release {"
            text = text.replace(
                "        release {",
                "        release {\n            signingConfig signingConfigs.release",
                1,
            )

    path.write_text(text)
    print("app/build.gradle: release signingConfig wired")
PY2
}

# Locate build-tools binary (apksigner / zipalign), Windows .bat aware.
rustore_find_build_tools_bin() {
  local name="${1:?name}"
  local sdk bt
  sdk="$(rustore_resolve_android_sdk_root 2>/dev/null || true)"
  [[ -n "$sdk" ]] || return 1
  bt="$(ls -d "$sdk"/build-tools/*/ 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "$bt" ]] || return 1
  if [[ -f "${bt}${name}" ]]; then
    printf '%s\n' "${bt}${name}"
    return 0
  fi
  if [[ -f "${bt}${name}.bat" ]]; then
    printf '%s\n' "${bt}${name}.bat"
    return 0
  fi
  return 1
}

# Run apksigner/zipalign; on Windows Git Bash use cmd //c for .bat.
rustore_run_build_tools() {
  local bin="${1:?bin}"
  shift
  if [[ "$bin" == *.bat ]]; then
    local win
    if command -v cygpath >/dev/null 2>&1; then
      win="$(cygpath -w "$bin")"
    else
      win="$bin"
    fi
    cmd.exe //c "$win" "$@"
  else
    "$bin" "$@"
  fi
}

# Strict verify — unsigned APK must not be shipped.
rustore_assert_apk_signed() {
  local apk="${1:?apk}"
  local apksigner
  if [[ ! -f "$apk" ]]; then
    echo "APK не найден: $apk" >&2
    return 1
  fi
  case "$(basename "$apk")" in
    *unsigned*)
      echo "Собран unsigned APK — подпись не применилась." >&2
      return 1
      ;;
  esac
  if apksigner="$(rustore_find_build_tools_bin apksigner)"; then
    if rustore_run_build_tools "$apksigner" verify "$apk" >/dev/null 2>&1; then
      echo "==> APK signing OK: $(basename "$apk")"
      rustore_run_build_tools "$apksigner" verify -v --print-certs "$apk" 2>&1 | head -n 20 || true
      return 0
    fi
    echo "APK не проходит apksigner verify — не подписан или повреждён." >&2
    return 1
  fi
  # Fallback: require v1 META-INF cert (weak, but better than shipping blind).
  if command -v unzip >/dev/null 2>&1; then
    if unzip -l "$apk" 2>/dev/null | grep -qE 'META-INF/.*\.(RSA|DSA|EC)$'; then
      echo "==> APK signing OK (v1 META-INF): $(basename "$apk")"
      return 0
    fi
  fi
  echo "Не удалось проверить подпись (нет apksigner в Android SDK build-tools)." >&2
  echo "Установите build-tools и повторите. Без проверки APK не отдаём." >&2
  return 1
}

# Always sign (and zipalign) after Gradle — Gradle signingConfig often silently yields unsigned APK.
# Usage: rustore_sign_apk "$apk_in" "$apk_out" "$keystore"
rustore_sign_apk() {
  local apk_in="${1:?apk_in}"
  local apk_out="${2:?apk_out}"
  local keystore="${3:?keystore}"
  local password alias key_password
  local apksigner zipalign aligned tmp_dir

  if [[ ! -f "$apk_in" ]]; then
    echo "Нет входного APK: $apk_in" >&2
    return 1
  fi
  if [[ ! -f "$keystore" ]]; then
    echo "Нет keystore: $keystore" >&2
    return 1
  fi

  password="${RUSTORE_KEYSTORE_PASSWORD:-}"
  if [[ -z "$password" ]]; then
    if [[ -t 0 ]]; then
      read -r -s -p "Пароль rustore/android.keystore: " password
      echo
    fi
  fi
  if [[ -z "$password" ]]; then
    echo "Нужен RUSTORE_KEYSTORE_PASSWORD для подписи APK." >&2
    return 1
  fi
  alias="${RUSTORE_KEY_ALIAS:-calorievision}"
  key_password="${RUSTORE_KEY_PASSWORD:-$password}"

  apksigner="$(rustore_find_build_tools_bin apksigner)" || {
    echo "Нет apksigner в Android SDK build-tools. Установите build-tools;35.0.0 (или новее)." >&2
    return 1
  }
  zipalign="$(rustore_find_build_tools_bin zipalign || true)"

  tmp_dir="$(mktemp -d)"
  aligned="$tmp_dir/aligned.apk"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp_dir'" RETURN

  # apksigner.bat / zipalign.bat need Windows paths under Git Bash.
  _rustore_winpath() {
    local p="$1"
    if command -v cygpath >/dev/null 2>&1; then
      cygpath -w "$p"
    else
      printf '%s\n' "$p"
    fi
  }

  if [[ -n "$zipalign" ]]; then
    echo "==> zipalign"
    rustore_run_build_tools "$zipalign" -f -p 4 \
      "$(_rustore_winpath "$apk_in")" \
      "$(_rustore_winpath "$aligned")"
  else
    cp -f "$apk_in" "$aligned"
  fi

  echo "==> apksigner sign (alias=$alias)"
  mkdir -p "$(dirname "$apk_out")"
  rustore_run_build_tools "$apksigner" sign \
    --ks "$(_rustore_winpath "$keystore")" \
    --ks-key-alias "$alias" \
    --ks-pass "pass:$password" \
    --key-pass "pass:$key_password" \
    --v1-signing-enabled true \
    --v2-signing-enabled true \
    --out "$(_rustore_winpath "$apk_out")" \
    "$(_rustore_winpath "$aligned")"

  rustore_assert_apk_signed "$apk_out"
}
