#!/usr/bin/env bash
# Shared Android SDK helpers for RuStore TWA builds (Linux, macOS, Git Bash on Windows).

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

# Force local A2 / store icon into Bubblewrap mipmaps so APK does not keep a stale cache.
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
  python3 - "$icon_src" "$android_dir" <<'PY'
import sys
from pathlib import Path
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGBA")
android = Path(sys.argv[2])

# Common Bubblewrap / Android launcher sizes (px).
density = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Also keep a full 512 asset if Bubblewrap left one in the project root.
for name in ("icon.png", "icon-512.png", "store_icon.png", "maskable_icon.png"):
    target = android / name
    if target.exists() or name in {"icon.png", "maskable_icon.png"}:
        src.resize((512, 512), Image.Resampling.LANCZOS).convert("RGB").save(target, optimize=True)
        print(f"  wrote {target.relative_to(android)}")

res = android / "app" / "src" / "main" / "res"
written = 0
for folder, size in density.items():
    d = res / folder
    if not d.is_dir():
        continue
    resized = src.resize((size, size), Image.Resampling.LANCZOS)
    for pattern in ("ic_launcher.png", "ic_launcher_round.png", "ic_maskable.png", "ic_launcher_foreground.png"):
        # Replace existing launcher assets; create standard names if folder exists.
        path = d / pattern
        if path.exists() or pattern in {"ic_launcher.png", "ic_launcher_round.png"}:
            # Prefer RGB for launcher (no semi-transparent edges on older Android).
            resized.convert("RGB").save(path, optimize=True)
            written += 1
            print(f"  wrote {path.relative_to(android)}")

# Adaptive foreground often lives as a larger asset.
for folder, size in {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}.items():
    d = res / folder
    fg = d / "ic_launcher_foreground.png"
    if fg.exists():
        src.resize((size, size), Image.Resampling.LANCZOS).save(fg, optimize=True)
        written += 1
        print(f"  wrote {fg.relative_to(android)}")

if written == 0:
    print("  (mipmap-* не найдены — после bubblewrap init/update запустите build снова)")
else:
    print(f"  обновлено файлов: {written}")
PY
}
