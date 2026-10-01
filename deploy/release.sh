#!/bin/bash
set -euo pipefail

# cv-release — merge a PR on GitHub (if still open), delete branch, deploy.
# Usage:
#   cv-release <PR number or branch name>
#   cv-release --deploy-only          # skip merge; just pull + deploy (after a failed pull)
#
# Install (symlink, не копия — иначе скрипты на VPS не обновятся):
#   sudo ln -sf /var/www/calorie-vision/deploy/release.sh /usr/local/bin/cv-release

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
DEPLOY_SH="$APP_DIR/deploy/deploy.sh"

# Warn if cv-release is a stale copy instead of a symlink into the repo.
if [[ -e /usr/local/bin/cv-release ]]; then
  _cv_target="$(readlink -f /usr/local/bin/cv-release 2>/dev/null || true)"
  if [[ -n "$_cv_target" && "$_cv_target" != "$APP_DIR/deploy/release.sh" ]]; then
    echo "⚠  /usr/local/bin/cv-release → $_cv_target (ожидали $APP_DIR/deploy/release.sh)" >&2
    echo "   sudo ln -sf $APP_DIR/deploy/release.sh /usr/local/bin/cv-release" >&2
  fi
fi

# Pull latest tree BEFORE starting deploy.sh so progress-bar / script fixes
# from main apply on this same run (bash does not re-read a script mid-flight).
refresh_app_scripts() {
  cd "$APP_DIR"
  git restore package.json package-lock.json src/data/changelog.json 2>/dev/null || true
  if ! git pull --ff-only >/tmp/cv-release-pull.log 2>&1; then
    if ! git pull >/tmp/cv-release-pull.log 2>&1; then
      echo "⚠  git pull перед деплоем не удался — см. /tmp/cv-release-pull.log" >&2
      return 1
    fi
  fi
  return 0
}

run_deploy() {
  refresh_app_scripts || true
  if [[ ! -x "$DEPLOY_SH" && ! -f "$DEPLOY_SH" ]]; then
    echo "✗  Нет $DEPLOY_SH" >&2
    exit 1
  fi
  # Re-exec so we never keep running a pre-pull script body.
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
  echo "✗  PR $TARGET закрыт (не смержен)." >&2
  exit 1
else
  if ! gh pr merge "$TARGET" \
    --repo "$REPO" \
    --merge \
    --delete-branch; then
      # Race: merged between view and merge (or already merged).
      STATE="$(pr_state)"
      if [[ "$STATE" != "MERGED" ]]; then
        echo "✗  Merge PR $TARGET не удался (state=$STATE)" >&2
        exit 1
      fi
  fi
fi

run_deploy()
