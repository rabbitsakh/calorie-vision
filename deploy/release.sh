#!/bin/bash
set -euo pipefail

# cv-release — merge a PR on GitHub, delete branch, deploy.
# Usage: cv-release <PR number or branch name>
#
# Install: sudo ln -sf /var/www/calorie-vision/deploy/release.sh /usr/local/bin/cv-release

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
TARGET="${1:?Использование: cv-release <номер PR или имя ветки>}"

echo "==> Merge PR: $TARGET"
gh pr merge "$TARGET" \
  --repo "$REPO" \
  --merge \
  --delete-branch

echo "==> Deploy"
cd "$APP_DIR"
# Prefer CI artifact path after merge to main (GitHub Actions → Deploy).
# FORCE_LOCAL_BUILD=1 keeps the classic on-VPS next build.
if [[ "${FORCE_LOCAL_BUILD:-}" == "1" ]]; then
  echo "   FORCE_LOCAL_BUILD=1 — bash deploy/deploy.sh"
  bash deploy/deploy.sh
else
  echo "   Merge to main triggers Actions Deploy (standalone artifact)."
  echo "   Fallback (local build on VPS): FORCE_LOCAL_BUILD=1 bash deploy/release.sh $TARGET"
  echo "   Or wait for Actions, or: bash deploy/deploy.sh"
fi
