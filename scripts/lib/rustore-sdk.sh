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
