#!/bin/bash
set -euo pipefail

# cv-release — merge a PR on GitHub (if still open), delete branch, deploy.
# Usage:
#   cv-release <PR number or branch name>
#   cv-release --deploy-only          # skip merge; just pull + deploy (after a failed pull)
#
# Deploy itself is deploy/deploy.sh (live build + .next swap when RAM allows).
#
# Install (symlink, не копия — иначе скрипты на VPS не обновятся):
#   sudo ln -sf /var/www/calorie-vision/deploy/release.sh /usr/local/bin/cv-release

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
DEPLOY_SH="$APP_DIR/deploy/deploy.sh"
RELEASE_SH="$APP_DIR/deploy/release.sh"

# Warn if cv-release is a stale copy instead of a symlink into the repo.
if [[ -e /usr/local/bin/cv-release ]]; then
  _cv_target="$(readlink -f /usr/local/bin/cv-release 2>/dev/null || true)"
  if [[ -z "$_cv_target" ]]; then
    # Regular file (not a symlink) — almost certainly a stale copy.
    if [[ ! -L /usr/local/bin/cv-release ]]; then
      echo "⚠  /usr/local/bin/cv-release — обычный файл (копия), не symlink." >&2
      echo "   sudo ln -sf $RELEASE_SH /usr/local/bin/cv-release" >&2
    fi
  elif [[ "$_cv_target" != "$RELEASE_SH" ]]; then
    echo "⚠  /usr/local/bin/cv-release → $_cv_target (ожидали $RELEASE_SH)" >&2
    echo "   sudo ln -sf $RELEASE_SH /usr/local/bin/cv-release" >&2
  fi
fi

# Pull latest tree, then re-exec the repo copy of this script so a stale
# /usr/local/bin/cv-release copy still picks up merge/deploy fixes this run.
if [[ "${CV_RELEASE_REEXEC:-}" != "1" ]]; then
  cd "$APP_DIR"
  git restore package.json package-lock.json src/data/changelog.json 2>/dev/null || true
  if ! git pull --ff-only >/tmp/cv-release-pull.log 2>&1; then
    if ! git pull >/tmp/cv-release-pull.log 2>&1; then
      echo "⚠  git pull перед cv-release не удался — см. /tmp/cv-release-pull.log" >&2
    fi
  fi
  if [[ ! -f "$RELEASE_SH" ]]; then
    echo "✗  Нет $RELEASE_SH" >&2
    exit 1
  fi
  export CV_RELEASE_REEXEC=1
  exec bash "$RELEASE_SH" "$@"
fi

run_deploy() {
  if [[ ! -f "$DEPLOY_SH" ]]; then
    echo "✗  Нет $DEPLOY_SH" >&2
    exit 1
  fi
  # deploy.sh pulls again + re-execs itself for the quiet progress UI.
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

run_deploy
