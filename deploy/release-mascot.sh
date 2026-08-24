#!/bin/bash
set -euo pipefail

# cv-release-mascot — merge the mascot companion batch PRs once, then deploy.
#
# Install:
#   sudo ln -sf /var/www/calorie-vision/deploy/release-mascot.sh /usr/local/bin/cv-release-mascot
#
# Default batch (10 PRs, merge in order):
#   cv-release-mascot
#
# Override PR numbers:
#   cv-release-mascot 243 244 245 246 247 248 249 250 251 252

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"

# Update after PRs are opened (cursor/mascot-01 … cursor/mascot-10).
DEFAULT_PRS=(243 244 245 246 247 248 249 250 251 252)

if [[ $# -gt 0 ]]; then
  PRS=("$@")
else
  PRS=("${DEFAULT_PRS[@]}")
fi

echo "==> Mascot release: ${PRS[*]}"
echo "==> Repo: $REPO"
echo "==> App:  $APP_DIR"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Нужна команда: $1"
    exit 1
  }
}

need_cmd gh
need_cmd git
need_cmd npm
need_cmd pm2

cd "$APP_DIR"

echo "==> Auth check (gh)"
gh auth status

for pr in "${PRS[@]}"; do
  state="$(gh pr view "$pr" --repo "$REPO" --json state,title,mergeable -q '.state + " | " + .title + " | mergeable=" + (.mergeable // "UNKNOWN")')"
  echo "==> PR #$pr: $state"

  merged="$(gh pr view "$pr" --repo "$REPO" --json state -q .state)"
  if [[ "$merged" == "MERGED" ]]; then
    echo "   already merged — skip"
    continue
  fi
  if [[ "$merged" != "OPEN" ]]; then
    echo "   PR #$pr is $merged — stop"
    exit 1
  fi

  echo "==> Merge PR #$pr"
  gh pr merge "$pr" \
    --repo "$REPO" \
    --merge \
    --delete-branch
done

echo "==> Deploy once"
bash deploy/deploy.sh

echo "==> Mascot release done"
