#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/calorie-vision"
cd "$APP_DIR"

echo "==> Pull latest code"
git restore package.json package-lock.json
git pull

echo "==> Install dependencies"
npm install

echo "==> Prisma"
npm run db:generate
npm run db:push

echo "==> Version"
node --experimental-strip-types scripts/sync-app-version.ts

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
