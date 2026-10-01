#!/bin/bash
set -euo pipefail

# cv-release — merge a PR on GitHub (if still open), delete branch, deploy.
# Usage:
#   cv-release <PR number or branch name>
#   cv-release --deploy-only          # skip merge; just pull + deploy (after a failed pull)
#
# Install: sudo ln -sf /var/www/calorie-vision/deploy/release.sh /usr/local/bin/cv-release

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"

if [[ "${1:-}" == "--deploy-only" || "${1:-}" == "-d" ]]; then
  cd "$APP_DIR"
  bash deploy/deploy.sh
  exit 0
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

cd "$APP_DIR"
bash deploy/deploy.sh
