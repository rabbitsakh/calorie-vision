#!/bin/bash
set -euo pipefail

# Paste on the server after the design batch PR is open:
#   cd /var/www/calorie-vision && bash deploy/release-design.sh
# Or simply:
#   cv-release <PR#>

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
BATCH_BRANCH="cursor/design-ux-batch-d07a"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Нужна команда: $1"; exit 1; }
}

need_cmd gh
need_cmd git
need_cmd npm
need_cmd pm2

cd "$APP_DIR"

if [[ $# -gt 0 ]]; then
  PRS=("$@")
else
  pr="$(gh pr list --repo "$REPO" --head "$BATCH_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || true)"
  if [[ -z "${pr:-}" || "$pr" == "null" ]]; then
    echo "Не найден открытый PR для $BATCH_BRANCH — укажи номер: bash deploy/release-design.sh <PR#>"
    exit 1
  fi
  PRS=("$pr")
fi

echo "==> Design UX release: ${PRS[*]}"

for pr in "${PRS[@]}"; do
  state="$(gh pr view "$pr" --repo "$REPO" --json state -q .state)"
  if [[ "$state" == "MERGED" ]]; then
    echo "PR #$pr already merged — skip"
    continue
  fi
  if [[ "$state" != "OPEN" ]]; then
    echo "PR #$pr is $state — stop"
    exit 1
  fi
  echo "==> Merge PR #$pr"
  gh pr merge "$pr" --repo "$REPO" --merge --delete-branch
done

echo "==> Deploy once"
bash deploy/deploy.sh
echo "==> Design release done"
