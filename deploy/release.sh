#!/bin/bash
set -euo pipefail

# cv-release — merge a PR on GitHub (if still open), delete branch, deploy.
# Usage:
#   cv-release <PR number or branch name>
#   cv-release --deploy-only          # skip merge; just pull + deploy (after a failed pull)
#
# Always ends in deploy/deploy.sh (same near-zero-downtime path):
#   live build → .next-build → atomic swap → pm2 reload
#   when RAM+swap is tight → stop pm2 for build (fallback)
# Env (forwarded as-is into deploy.sh):
#   DEPLOY_FORCE_LIVE=1 | DEPLOY_FORCE_STOP=1 | DEPLOY_KEEP_LIVE_MIN_MB=2400
#   DEPLOY_VERBOSE=1 | DEPLOY_NODE_OPTIONS=... | DEPLOY_BUILD_TIMEOUT=...
#   DEPLOY_COLOR=0 | NO_COLOR=1  — отключить цвет в cv-release / deploy.sh
#
# Install (symlink, не копия — иначе скрипты на VPS не обновятся):
#   sudo ln -sf /var/www/calorie-vision/deploy/release.sh /usr/local/bin/cv-release

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
DEPLOY_SH="$APP_DIR/deploy/deploy.sh"
RELEASE_SH="$APP_DIR/deploy/release.sh"

# Light color for cv-release banners (same knobs as deploy.sh).
_R_USE_COLOR=0
if [[ -t 2 && -z "${NO_COLOR:-}" && "${DEPLOY_COLOR:-1}" != "0" ]]; then
  _R_USE_COLOR=1
fi
_R_RESET="" _R_BOLD="" _R_DIM="" _R_TEAL="" _R_GREEN="" _R_YELLOW="" _R_RED=""
if (( _R_USE_COLOR )); then
  _R_RESET=$'\033[0m'
  _R_BOLD=$'\033[1m'
  _R_DIM=$'\033[2m'
  _R_TEAL=$'\033[38;5;37m'
  _R_GREEN=$'\033[38;5;78m'
  _R_YELLOW=$'\033[33m'
  _R_RED=$'\033[31m'
fi

# Warn if cv-release is a stale copy instead of a symlink into the repo.
if [[ -e /usr/local/bin/cv-release ]]; then
  _cv_target="$(readlink -f /usr/local/bin/cv-release 2>/dev/null || true)"
  if [[ -z "$_cv_target" ]]; then
    # Regular file (not a symlink) — almost certainly a stale copy.
    if [[ ! -L /usr/local/bin/cv-release ]]; then
      printf '%s⚠  /usr/local/bin/cv-release — обычный файл (копия), не symlink.%s\n' "$_R_YELLOW" "$_R_RESET" >&2
      printf '   sudo ln -sf %s /usr/local/bin/cv-release\n' "$RELEASE_SH" >&2
    fi
  elif [[ "$_cv_target" != "$RELEASE_SH" ]]; then
    printf '%s⚠  /usr/local/bin/cv-release → %s (ожидали %s)%s\n' "$_R_YELLOW" "$_cv_target" "$RELEASE_SH" "$_R_RESET" >&2
    printf '   sudo ln -sf %s /usr/local/bin/cv-release\n' "$RELEASE_SH" >&2
  fi
fi

# Pull latest tree, then re-exec the repo copy of this script so a stale
# /usr/local/bin/cv-release copy still picks up merge/deploy fixes this run.
if [[ "${CV_RELEASE_REEXEC:-}" != "1" ]]; then
  cd "$APP_DIR"
  git restore package.json package-lock.json src/data/changelog.json 2>/dev/null || true
  if ! git pull --ff-only >/tmp/cv-release-pull.log 2>&1; then
    if ! git pull >/tmp/cv-release-pull.log 2>&1; then
      printf '%s⚠  git pull перед cv-release не удался — см. /tmp/cv-release-pull.log%s\n' "$_R_YELLOW" "$_R_RESET" >&2
    fi
  fi
  if [[ ! -f "$RELEASE_SH" ]]; then
    printf '%s%s✗  Нет %s%s\n' "$_R_BOLD" "$_R_RED" "$RELEASE_SH" "$_R_RESET" >&2
    exit 1
  fi
  export CV_RELEASE_REEXEC=1
  exec bash "$RELEASE_SH" "$@"
fi

run_deploy() {
  if [[ ! -f "$DEPLOY_SH" ]]; then
    printf '%s%s✗  Нет %s%s\n' "$_R_BOLD" "$_R_RED" "$DEPLOY_SH" "$_R_RESET" >&2
    exit 1
  fi
  # Same deploy path as `bash deploy/deploy.sh` — live build + .next swap when RAM allows.
  printf '%s→%s %sdeploy.sh%s %s(cv-release → near-zero-downtime: KEEP_LIVE если хватает RAM/swap)%s\n' \
    "$_R_TEAL" "$_R_RESET" "$_R_BOLD" "$_R_RESET" "$_R_DIM" "$_R_RESET" >&2
  if [[ -n "${DEPLOY_FORCE_LIVE:-}" || -n "${DEPLOY_FORCE_STOP:-}" || -n "${DEPLOY_KEEP_LIVE_MIN_MB:-}" ]]; then
    printf '  %senv:%s DEPLOY_FORCE_LIVE=%s DEPLOY_FORCE_STOP=%s DEPLOY_KEEP_LIVE_MIN_MB=%s\n' \
      "$_R_DIM" "$_R_RESET" \
      "${DEPLOY_FORCE_LIVE:--}" "${DEPLOY_FORCE_STOP:--}" "${DEPLOY_KEEP_LIVE_MIN_MB:-2400}" >&2
  fi
  # deploy.sh pulls again + re-execs itself for the color progress UI + stats.
  # Env vars (DEPLOY_*) are inherited by exec.
  exec bash "$DEPLOY_SH"
}

if [[ "${1:-}" == "--deploy-only" || "${1:-}" == "-d" ]]; then
  run_deploy
fi

TARGET="${1:?Использование: cv-release <номер PR | ветка | --deploy-only>}"

pr_state() {
  gh pr view "$TARGET" --repo "$REPO" --json state --jq .state 2>/dev/null || echo "UNKNOWN"
}

STATE="$(pr_state)"
if [[ "$STATE" == "MERGED" ]]; then
  : # already merged — deploy only
elif [[ "$STATE" == "CLOSED" ]]; then
  printf '%s%s✗  PR %s закрыт (не смержен).%s\n' "$_R_BOLD" "$_R_RED" "$TARGET" "$_R_RESET" >&2
  exit 1
else
  printf '%s→%s merge PR %s%s%s\n' "$_R_TEAL" "$_R_RESET" "$_R_BOLD" "$TARGET" "$_R_RESET" >&2
  if ! gh pr merge "$TARGET" \
    --repo "$REPO" \
    --merge \
    --delete-branch; then
    # Race: merged between view and merge (or already merged).
    STATE="$(pr_state)"
    if [[ "$STATE" != "MERGED" ]]; then
      printf '%s%s✗  Merge PR %s не удался (state=%s)%s\n' "$_R_BOLD" "$_R_RED" "$TARGET" "$STATE" "$_R_RESET" >&2
      exit 1
    fi
  fi
  printf '%s✓%s PR смержен\n' "$_R_GREEN" "$_R_RESET" >&2
fi

run_deploy
