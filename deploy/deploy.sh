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

# Pick a Node heap that fits available RAM (override with NODE_OPTIONS).
pick_node_heap_mb() {
  local avail_mb=2048
  if [[ -r /proc/meminfo ]]; then
    avail_mb=$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
  fi
  # Leave headroom for OS + MySQL + webpack worker; clamp 1024..3072.
  local heap=$((avail_mb - 768))
  if (( heap < 1024 )); then heap=1024; fi
  if (( heap > 3072 )); then heap=3072; fi
  echo "$heap"
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

echo "==> Free RAM before build (stop running app)"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 stop calorie-vision || true
fi

echo "==> Build"
# Next.js production build can OOM on small VPS (SIGKILL). Cap heap to available RAM
# and keep a single compile worker (see next.config experimental.cpus).
if [[ -z "${NODE_OPTIONS:-}" ]]; then
  HEAP_MB="$(pick_node_heap_mb)"
  export NODE_OPTIONS="--max-old-space-size=${HEAP_MB}"
fi
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
echo "   NODE_OPTIONS=$NODE_OPTIONS"
echo "   NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS"
if [[ -r /proc/meminfo ]]; then
  awk '/MemAvailable:/ {printf "   MemAvailable: %d MB\n", int($2/1024)}' /proc/meminfo
fi
npm run build

echo "==> Restart app"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 restart calorie-vision
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

echo "==> Compress and backfill meal images (after build — less peak RAM)"
npm run images:backfill || echo "image backfill skipped"

restore_generated_version_files

echo "==> Done"
