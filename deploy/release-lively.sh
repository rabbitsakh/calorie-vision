#!/bin/bash
set -euo pipefail

# cv-release-lively — merge Duolingo-style mascot liveliness PRs, then deploy.
#
#   sudo ln -sf /var/www/calorie-vision/deploy/release-lively.sh /usr/local/bin/cv-release-lively
#   cv-release-lively
#   cv-release-lively 253 254 255 …

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
DEFAULT_PRS=(253 254 255 256 257 258 259 260)

if [[ $# -gt 0 ]]; then
  PRS=("$@")
else
  PRS=("${DEFAULT_PRS[@]}")
fi

echo "==> Mascot liveliness release: ${PRS[*]}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Нужна команда: $1"; exit 1; }
}
need_cmd gh
need_cmd git
need_cmd npm
need_cmd pm2

cd "$APP_DIR"
gh auth status

for pr in "${PRS[@]}"; do
  state="$(gh pr view "$pr" --repo "$REPO" --json state,title -q '.state + " | " + .title')"
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
  gh pr merge "$pr" --repo "$REPO" --merge --delete-branch
done

echo "==> Deploy once"
bash deploy/deploy.sh
echo "==> Liveliness release done"
