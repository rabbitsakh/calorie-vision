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
bash deploy/deploy.sh
