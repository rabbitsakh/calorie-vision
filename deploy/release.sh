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
  echo "==> Deploy only (no merge)"
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
  echo "==> PR $TARGET already merged — skip merge, deploy only"
elif [[ "$STATE" == "CLOSED" ]]; then
  echo "==> PR $TARGET is closed (not merged). Aborting." >&2
  exit 1
else
  echo "==> Merge PR: $TARGET (state=$STATE)"
  gh pr merge "$TARGET" \
    --repo "$REPO" \
    --merge \
    --delete-branch || {
      # Race: merged between view and merge (or already merged).
      STATE="$(pr_state)"
      if [[ "$STATE" == "MERGED" ]]; then
        echo "==> Merge reported failure but PR is MERGED — continuing to deploy"
      else
        echo "==> Merge failed (state=$STATE)" >&2
        exit 1
      fi
    }
fi

echo "==> Deploy"
cd "$APP_DIR"
bash deploy/deploy.sh
