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

# Print MemAvailable / SwapFree for deploy logs.
log_meminfo() {
  if [[ -r /proc/meminfo ]]; then
    awk '
      /MemTotal:/ { total = int($2/1024) }
      /MemAvailable:/ { avail = int($2/1024) }
      /SwapTotal:/ { swap_t = int($2/1024) }
      /SwapFree:/ { swap_f = int($2/1024) }
      END {
        printf "   MemTotal: %d MB  MemAvailable: %d MB  SwapTotal: %d MB  SwapFree: %d MB\n",
          total+0, avail+0, swap_t+0, swap_f+0
      }
    ' /proc/meminfo
  fi
}

# Pick a Node heap that fits free RAM + swap after the app is stopped.
# Override the whole NODE_OPTIONS string with DEPLOY_NODE_OPTIONS.
pick_node_heap_mb() {
  local mem_avail_mb=2048
  local swap_free_mb=0
  if [[ -r /proc/meminfo ]]; then
    mem_avail_mb=$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
    swap_free_mb=$(awk '/SwapFree:/ {print int($2/1024)}' /proc/meminfo)
  fi
  # App is stopped; leave headroom for OS + MySQL + webpack RSS outside the V8 heap.
  # Count most of free swap so a ≤2 GB VPS can still finish next build.
  local usable_mb=$((mem_avail_mb + (swap_free_mb * 3) / 4))
  local heap=$((usable_mb - 512))
  # Current app needs >1 GB V8 heap; 1024 floors caused "heap out of memory".
  if (( heap < 1536 )); then heap=1536; fi
  if (( heap > 4096 )); then heap=4096; fi
  echo "$heap"
}

echo "==> Pull latest code"
restore_generated_version_files
# GitHub HTTPS from some VPS intermittently times out — retry with backoff.
pull_ok=0
for attempt in 1 2 3 4; do
  if git pull; then
    pull_ok=1
    break
  fi
  echo "   git pull failed (attempt $attempt/4) — retry in $((attempt * 8))s…"
  sleep $((attempt * 8))
done
if (( ! pull_ok )); then
  echo "   git pull failed after retries." >&2
  echo "   Check VPS → github.com:443 (timeout/IPv6). Then: cv-release --deploy-only" >&2
  exit 1
fi

echo "==> Node $(node -v)"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"; then
  echo "Need Node.js 24 LTS. See README: «Node.js 24 на VPS» (NodeSource setup_24.x or nvm install 24)."
  exit 1
fi

echo "==> Version"
node --experimental-strip-types --no-warnings scripts/sync-app-version.ts

# Load .env early so SENTRY_* flags are visible for install/build.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> Install dependencies"
# @sentry/cli postinstall downloads a binary from CDN and often hangs on VPS
# (IPv6 / CDN timeout). Skip unless we explicitly upload source maps.
if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  export SENTRYCLI_SKIP_DOWNLOAD="${SENTRYCLI_SKIP_DOWNLOAD:-1}"
  echo "   SENTRYCLI_SKIP_DOWNLOAD=$SENTRYCLI_SKIP_DOWNLOAD (no SENTRY_AUTH_TOKEN)"
else
  echo "   SENTRY_AUTH_TOKEN set — allowing @sentry/cli binary download"
fi
# Prefer lockfile install; fall back to npm install if lock is out of sync.
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-120000}"
export npm_config_fetch_retries="${npm_config_fetch_retries:-3}"
if [[ -f package-lock.json ]]; then
  echo "   npm ci…"
  if ! npm ci --no-audit --no-fund; then
    echo "   npm ci failed — falling back to npm install"
    npm install --no-audit --no-fund
  fi
else
  echo "   npm install…"
  npm install --no-audit --no-fund
fi

echo "==> Prisma: apply schema changes"
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
echo "==> Prisma: generate client (once, after schema sync)"
npm run db:generate

echo "==> Free RAM before build (stop running app)"
APP_WAS_RUNNING=0
if pm2 describe calorie-vision >/dev/null 2>&1; then
  APP_WAS_RUNNING=1
  pm2 stop calorie-vision || true
fi
# Best-effort: reclaim page cache so MemAvailable reflects real free RAM.
if [[ "$(id -u)" -eq 0 ]] && [[ -w /proc/sys/vm/drop_caches ]]; then
  sync || true
  echo 3 >/proc/sys/vm/drop_caches 2>/dev/null || true
fi
log_meminfo

echo "==> Build"
# Next.js production build can OOM on small VPS (V8 heap limit or SIGKILL).
# Always re-pick heap after pm2 stop — do not inherit a low NODE_OPTIONS from .env.
# Override: DEPLOY_NODE_OPTIONS='--max-old-space-size=2048'
if [[ -n "${DEPLOY_NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="$DEPLOY_NODE_OPTIONS"
else
  HEAP_MB="$(pick_node_heap_mb)"
  export NODE_OPTIONS="--max-old-space-size=${HEAP_MB}"
fi
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
# Fewer libuv threads = slightly less peak RSS during compile.
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"
echo "   NODE_OPTIONS=$NODE_OPTIONS"
echo "   NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS"
echo "   UV_THREADPOOL_SIZE=$UV_THREADPOOL_SIZE"
log_meminfo
if ! npm run build; then
  echo "   build FAILED"
  echo "   Hint: V8 heap OOM → raise DEPLOY_NODE_OPTIONS or add swap (see README)."
  echo "   Hint: SIGKILL → lower heap / add swap; NEXT_BUILD_CPUS=1 is already default."
  log_meminfo
  if (( APP_WAS_RUNNING )); then
    echo "   Restarting previous app so the site does not stay on 502"
    pm2 restart calorie-vision || pm2 start deploy/ecosystem.config.cjs
    pm2 save || true
  fi
  exit 1
fi

echo "==> Restart app"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 restart calorie-vision --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

# Sanity: public auth URL must not be localhost (Custom Tabs would fail on the phone).
AUTH_URL_CHECK="$(grep -E '^NEXTAUTH_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$AUTH_URL_CHECK" ]]; then
  echo "   WARNING: NEXTAUTH_URL missing in .env"
elif echo "$AUTH_URL_CHECK" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "   WARNING: NEXTAUTH_URL looks like localhost ($AUTH_URL_CHECK) — set https://calorievision.ru"
else
  echo "   NEXTAUTH_URL=$AUTH_URL_CHECK"
fi

pm2 save

echo "==> Health check"
HEALTH_PORT="${PORT:-3000}"
HEALTH_BASE="${NEXT_PUBLIC_BASE_PATH:-}"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  HEALTH_PORT="${PORT:-3000}"
  HEALTH_BASE="${NEXT_PUBLIC_BASE_PATH:-}"
fi
HEALTH_OK=0
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:${HEALTH_PORT}${HEALTH_BASE}/api/health/" >/dev/null \
     || curl -sf "http://127.0.0.1:${HEALTH_PORT}${HEALTH_BASE}/api/health" >/dev/null; then
    HEALTH_OK=1
    echo "   /api/health ok"
    break
  fi
  sleep 2
done
if (( ! HEALTH_OK )); then
  echo "   WARNING: health check failed — site may be down (pm2 logs calorie-vision)"
fi

echo "==> Compress and backfill meal images (after build — less peak RAM)"
npm run images:backfill || echo "image backfill skipped"

restore_generated_version_files

echo "==> Done"
