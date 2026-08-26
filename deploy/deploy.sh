#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/calorie-vision"
cd "$APP_DIR"

GENERATED_VERSION_FILES=(
  "package.json"
  "package-lock.json"
  "src/data/changelog.json"
)

restore_generated_version_files() {
  git restore "${GENERATED_VERSION_FILES[@]}" 2>/dev/null || true
}

echo "==> Pull latest code"
restore_generated_version_files
git pull

echo "==> Node $(node -v)"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"; then
  echo "Need Node.js 24 LTS. See README: «Node.js 24 на VPS» (NodeSource setup_24.x or nvm install 24)."
  exit 1
fi

echo "==> Version"
node --experimental-strip-types --no-warnings scripts/sync-app-version.ts

echo "==> Install dependencies"
npm install

echo "==> Prisma: apply schema changes"
npm run db:generate
# Run the hand-written SQL migration first so prisma db push does not trip over
# duplicate foreign key names that MySQL doesn't let Prisma rename automatically.
if ls deploy/migrate-*.sql >/dev/null 2>&1; then
  if npm run db:migrate-sql 2>&1; then
    echo "   SQL migration applied"
  else
    echo "   SQL migration failed or already applied; continuing with db:push"
  fi
fi
if npm run db:push; then
  echo "   db:push ok"
else
  if [[ "${ALLOW_DB_PUSH_FAIL:-}" == "1" ]]; then
    echo "   db:push failed — ALLOW_DB_PUSH_FAIL=1, continuing"
  else
    echo "   db:push failed — aborting deploy (set ALLOW_DB_PUSH_FAIL=1 to override)"
    exit 1
  fi
fi

echo "==> Compress and backfill meal images"
npm run images:backfill || echo "image backfill skipped"

echo "==> Build"
# Next.js production build can OOM on small VPS (SIGKILL). Cap heap and allow override.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
echo "   NODE_OPTIONS=$NODE_OPTIONS"
npm run build

echo "==> Restart app"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 restart calorie-vision
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

restore_generated_version_files

echo "==> Done"
