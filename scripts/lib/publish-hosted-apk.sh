#!/usr/bin/env bash
# Кладёт подписанный release APK на сайт: public/downloads/calorie-vision.apk + apk.json.
# Версию приложения, keystore и .env не меняет. Если версию прочитать не удалось,
# каталог public/downloads не трогает.
#
#   publish_hosted_apk "$ROOT" "$signed_apk" [--version-name X --version-code N --built-at ISO]

publish_hosted_apk() {
  local root="${1:?root}"
  local apk="${2:?apk}"
  shift 2

  if [[ ! -f "$apk" ]]; then
    echo "Нет подписанного APK: $apk" >&2
    return 1
  fi

  local dest_dir="$root/public/downloads"
  local dest_apk="$dest_dir/calorie-vision.apk"
  local writer
  writer="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/write-apk-manifest.ts"
  local tmp_json badging
  tmp_json="$(mktemp)"
  badging="$(mktemp)"

  if declare -F rustore_find_build_tools_bin >/dev/null 2>&1; then
    local aapt=""
    if aapt="$(rustore_find_build_tools_bin aapt 2>/dev/null)"; then
      if declare -F rustore_run_build_tools >/dev/null 2>&1; then
        rustore_run_build_tools "$aapt" dump badging "$apk" >"$badging" 2>/dev/null || true
      fi
    fi
  fi

  local -a cmd=(
    node --experimental-strip-types --no-warnings
    "$writer"
    --apk "$apk"
    --out "$tmp_json"
    --repo "$root"
  )
  if [[ -s "$badging" ]]; then
    cmd+=(--badging "$badging")
  fi
  if (( $# > 0 )); then
    cmd+=("$@")
  fi

  if ! "${cmd[@]}"; then
    rm -f "$tmp_json" "$badging"
    echo "apk.json не записан — public/downloads не меняли" >&2
    return 1
  fi

  mkdir -p "$dest_dir"
  # Тот же inode (повторный вызов на уже скопированный файл) нельзя копировать поверх себя.
  if [[ ! -e "$dest_apk" ]] || ! cmp -s "$apk" "$dest_apk"; then
    cp -f "$apk" "$dest_apk"
  fi
  mv -f "$tmp_json" "$dest_dir/apk.json"
  rm -f "$badging"
  chmod a+r "$dest_apk" "$dest_dir/apk.json" 2>/dev/null || true
  echo "==> APK → public/downloads/calorie-vision.apk + apk.json"
}
