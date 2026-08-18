#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/calorie-vision"
cd "$APP_DIR"

echo "==> Pull latest code"
git restore package.json package-lock.json
git pull

echo "==> Install dependencies"
npm install

echo "==> Prisma: apply schema changes"
npm run db:generate
# Run the hand-written SQL migration first so prisma db push does not trip over
# duplicate foreign key names that MySQL doesn't let Prisma rename automatically.
if [ -f deploy/migrate-weight-timezone.sql ]; then
  DB_URL="${DATABASE_URL:-}"
  DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+):.*|\1|')
  DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
  DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+)(\?.*)?$|\1|')
  DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
  DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
  if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
       < deploy/migrate-weight-timezone.sql 2>&1; then
    echo "   SQL migration applied"
  else
    echo "   SQL migration failed or already applied; continuing with db:push"
  fi
fi
npm run db:push

echo "==> Compress and backfill meal images"
npm run images:backfill || echo "image backfill skipped"

echo "==> Version"
node scripts/sync-app-version.cjs

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
