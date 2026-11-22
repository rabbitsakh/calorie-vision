#!/usr/bin/env bash
# APK и apk.json лежат в public/downloads/ и в git не входят.
# cv-release / deploy.sh сайт собирают, Android — нет. Уже выложенный файл
# снимем до git pull и вернём, если pull или сборка его снесли.
# Подключать через source после deploy/git-gate.sh (нужна ensure_ff_origin_main).

hosted_apk_snapshot() {
  local app_dir="${1:?app dir}"
  local snap="${2:-}"
  [[ -n "$snap" ]] || return 0
  mkdir -p "$snap" || return 1
  rm -f "$snap/calorie-vision.apk" "$snap/apk.json"
  local src="$app_dir/public/downloads"
  if [[ -f "$src/calorie-vision.apk" ]]; then
    cp -p "$src/calorie-vision.apk" "$snap/calorie-vision.apk" || return 1
  fi
  if [[ -f "$src/apk.json" ]]; then
    cp -p "$src/apk.json" "$snap/apk.json" || return 1
  fi
}

# Возвращает файл только если его больше нет. Новый файл, появившийся за время деплоя, не затирает.
hosted_apk_restore_if_missing() {
  local app_dir="${1:?app dir}"
  local snap="${2:-}"
  [[ -n "$snap" && -d "$snap" ]] || return 0
  local dest="$app_dir/public/downloads"
  mkdir -p "$dest" || return 1
  if [[ ! -e "$dest/calorie-vision.apk" && -f "$snap/calorie-vision.apk" ]]; then
    cp -p "$snap/calorie-vision.apk" "$dest/calorie-vision.apk" || return 1
    printf '%s\n' "Восстановили public/downloads/calorie-vision.apk — деплой новый APK не собирал" >&2
  fi
  if [[ ! -e "$dest/apk.json" && -f "$snap/apk.json" ]]; then
    cp -p "$snap/apk.json" "$dest/apk.json" || return 1
    printf '%s\n' "Восстановили public/downloads/apk.json" >&2
  fi
}

# ensure_ff_origin_main должна быть уже определена (deploy/git-gate.sh).
pull_origin_keeping_hosted_apk() {
  local app_dir="${1:?app dir}"
  local rc=0
  if [[ -z "${CV_HOSTED_APK_SNAPSHOT:-}" ]]; then
    CV_HOSTED_APK_SNAPSHOT="$(mktemp -d "${TMPDIR:-/tmp}/cv-hosted-apk.XXXXXX" 2>/dev/null || true)"
    export CV_HOSTED_APK_SNAPSHOT
  fi
  hosted_apk_snapshot "$app_dir" "${CV_HOSTED_APK_SNAPSHOT:-}" || true
  if ! ensure_ff_origin_main; then
    rc=1
  fi
  hosted_apk_restore_if_missing "$app_dir" "${CV_HOSTED_APK_SNAPSHOT:-}" || true
  return "$rc"
}
