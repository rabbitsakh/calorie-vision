#!/usr/bin/env bash
# Shared Android SDK helpers for RuStore TWA builds (Linux, macOS, Git Bash on Windows).

# Bubblewrap and Gradle both need the SDK root (not cmdline-tools/latest).
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
  local value=""
  if [[ -f "$gradle" ]]; then
    value="$(sed -n 's/.*buildToolsVersion[[:space:]]*"\([^"]*\)".*/\1/p' "$gradle" | head -1)"
  fi
  if [[ -z "$value" && -n "${RUSTORE_BUILD_TOOLS:-}" ]]; then
    value="$RUSTORE_BUILD_TOOLS"
  fi
  if [[ -z "$value" ]]; then
    # Bubblewrap 1.24+ often uses the latest installed build-tools (e.g. 36.1.0).
    local sdk_root
    sdk_root="$(rustore_resolve_android_sdk_root 2>/dev/null || true)"
    if [[ -n "$sdk_root" && -d "$sdk_root/build-tools" ]]; then
      value="$(ls -1 "$sdk_root/build-tools" 2>/dev/null | sort -V | tail -1)"
    fi
  fi
  [[ -z "$value" ]] && value="36.1.0"
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

  rustore_ensure_bubblewrap_sdk_layout "$sdk_root"
  rustore_fix_bubblewrap_config "$sdk_root"
  rustore_write_local_properties "$android_dir" "$sdk_root"
  rustore_ensure_android_sdk "$sdk_root" "$android_dir"
}

# Bubblewrap validatePath requires Sdk/bin or Sdk/tools, but build-tools live under Sdk root.
# On Windows, junction Sdk/bin → cmdline-tools/latest/bin satisfies both Gradle and Bubblewrap.
rustore_ensure_bubblewrap_sdk_layout() {
  local sdk_root="$1"
  local cmdline_bin="$sdk_root/cmdline-tools/latest/bin"
  local sdk_bin="$sdk_root/bin"

  [[ -d "$cmdline_bin" ]] || return 0
  if [[ -e "$sdk_bin" ]]; then
    return 0
  fi

  echo "==> Bubblewrap: создаю Sdk/bin → cmdline-tools/latest/bin"
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*)
      local target
      target="$(rustore_escape_sdk_dir_for_properties "$cmdline_bin")"
      cmd //c "mklink /J \"$(cygpath -w "$sdk_bin")\" \"$target\"" >/dev/null 2>&1 \
        || cmd //c "mklink /J \"$(cygpath -w "$sdk_bin")\" \"$(cygpath -w "$cmdline_bin")\"" \
        || ln -s "$cmdline_bin" "$sdk_bin" 2>/dev/null \
        || true
      ;;
    *)
      ln -sfn "$cmdline_bin" "$sdk_bin" 2>/dev/null || true
      ;;
  esac

  if [[ ! -e "$sdk_bin" ]]; then
    echo "Не удалось создать $sdk_bin. В PowerShell (от администратора не нужно):" >&2
    echo "  cmd /c mklink /J \"$sdk_root\\bin\" \"$sdk_root\\cmdline-tools\\latest\\bin\"" >&2
    return 1
  fi
}

rustore_fix_bubblewrap_config() {
  local sdk_root="$1"
  local cfg="${HOME}/.bubblewrap/config.json"
  [[ -f "$cfg" ]] || return 0
  command -v node >/dev/null 2>&1 || return 0

  node - "$cfg" "$sdk_root" <<'NODE'
const fs = require('fs');
const [cfgPath, sdkRoot] = process.argv.slice(2);
let config = {};
try {
  config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch {
  process.exit(0);
}
const current = config.androidSdkPath || '';
const normalized = current.replace(/\\/g, '/');
if (normalized.includes('/cmdline-tools/') || normalized.endsWith('/cmdline-tools/latest')) {
  config.androidSdkPath = sdkRoot;
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`==> bubblewrap config.json: androidSdkPath → ${sdkRoot}`);
}
NODE
}
