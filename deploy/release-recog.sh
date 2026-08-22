#!/bin/bash
set -euo pipefail

# cv-release-recog — merge the recognition batch PR (or listed PRs) once, then deploy.
#
# Paste on the server:
#   bash /var/www/calorie-vision/deploy/release-recog.sh
#
# Or install a short alias:
#   sudo ln -sf /var/www/calorie-vision/deploy/release-recog.sh /usr/local/bin/cv-release-recog
#   cv-release-recog
#
# Optional: pass PR numbers to override the default batch list:
#   cv-release-recog 165
#   cv-release-recog 155 156 163

REPO="rabbitsakh/calorie-vision"
APP_DIR="/var/www/calorie-vision"
BATCH_BRANCH="cursor/recog-batch-install-d07a"

# If no args: resolve the open integration PR for BATCH_BRANCH.
# Else: merge the listed PR numbers in order (no deploy between them).
resolve_default_prs() {
  local pr
  pr="$(gh pr list --repo "$REPO" --head "$BATCH_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || true)"
  if [[ -z "$pr" || "$pr" == "null" ]]; then
    echo "Не найден открытый PR для ветки $BATCH_BRANCH."
    echo "Укажи номер PR явно: bash deploy/release-recog.sh <PR#>"
    exit 1
  fi
  echo "$pr"
}

if [[ $# -gt 0 ]]; then
  PRS=("$@")
else
  mapfile -t PRS < <(resolve_default_prs)
fi

echo "==> Recognition release: ${PRS[*]}"
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

echo "==> Recognition release done"
