#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/calorie-vision"
cd "$APP_DIR"

echo "==> Pull latest code"
git restore package.json package-lock.json
git pull

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
npm run db:push

echo "==> Compress and backfill meal images"
npm run images:backfill || echo "image backfill skipped"

echo "==> Build"
npm run build

echo "==> Restart app"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 restart calorie-vision
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

echo "==> Done"
