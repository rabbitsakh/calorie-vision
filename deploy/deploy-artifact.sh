#!/bin/bash
# Apply a CI-built standalone tarball on the VPS (no `next build`).
# Usage: bash deploy/deploy-artifact.sh [/path/to/calorie-vision-standalone.tar.gz]
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/calorie-vision}"
ARTIFACT="${1:-${DEPLOY_ARTIFACT:-/tmp/calorie-vision-standalone.tar.gz}}"
cd "$APP_DIR"

GENERATED_VERSION_FILES=(
  "package.json"
  "package-lock.json"
  "src/data/changelog.json"
)

restore_generated_version_files() {
  git restore "${GENERATED_VERSION_FILES[@]}" 2>/dev/null || true
}

if [[ ! -f "$ARTIFACT" ]]; then
  echo "Artifact not found: $ARTIFACT" >&2
  exit 1
fi

echo "==> Pull latest code (migrations, prisma schema, deploy scripts)"
restore_generated_version_files
git pull

echo "==> Node $(node -v)"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"; then
  echo "Need Node.js 24 LTS. See README: «Node.js 24 на VPS»."
  exit 1
fi

echo "==> Version sync (repo metadata)"
node --experimental-strip-types --no-warnings scripts/sync-app-version.ts

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "==> Install dependencies (Prisma CLI / migrate tools — no build)"
if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  export SENTRYCLI_SKIP_DOWNLOAD="${SENTRYCLI_SKIP_DOWNLOAD:-1}"
  echo "   SENTRYCLI_SKIP_DOWNLOAD=$SENTRYCLI_SKIP_DOWNLOAD"
fi
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-120000}"
export npm_config_fetch_retries="${npm_config_fetch_retries:-3}"
if [[ -f package-lock.json ]]; then
  if ! npm ci --no-audit --no-fund; then
    echo "   npm ci failed — falling back to npm install"
    npm install --no-audit --no-fund
  fi
else
  npm install --no-audit --no-fund
fi

echo "==> Prisma: apply schema changes"
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
    echo "   db:push failed — aborting (set ALLOW_DB_PUSH_FAIL=1 to override)"
    exit 1
  fi
fi
npm run db:generate

echo "==> Unpack standalone artifact"
mkdir -p .next
if [[ -d .next/standalone ]]; then
  rm -rf .next/standalone.prev
  mv .next/standalone .next/standalone.prev
fi
# Tarball contains `.next/standalone/…`
tar -xzf "$ARTIFACT" -C "$APP_DIR"

if [[ ! -f .next/standalone/server.js ]]; then
  echo "Unpack failed: missing .next/standalone/server.js" >&2
  if [[ -d .next/standalone.prev ]]; then
    mv .next/standalone.prev .next/standalone
  fi
  exit 1
fi

# Persistent uploads live under the git checkout; standalone cwd is .next/standalone.
mkdir -p public/uploads
rm -rf .next/standalone/public/uploads
ln -sfn "$APP_DIR/public/uploads" .next/standalone/public/uploads

# Prefer absolute uploads path so relative cwd never bites (optional .env already set).
if [[ -f .deploy-meta ]] || [[ -f .next/standalone/.deploy-meta ]]; then
  echo "   meta: $(tr '\n' ' ' < .next/standalone/.deploy-meta)"
fi

echo "==> Restart app (standalone server.js)"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  pm2 delete calorie-vision || true
fi
pm2 start deploy/ecosystem.config.cjs
pm2 save

AUTH_URL_CHECK="$(grep -E '^NEXTAUTH_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$AUTH_URL_CHECK" ]]; then
  echo "   WARNING: NEXTAUTH_URL missing in .env"
elif echo "$AUTH_URL_CHECK" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "   WARNING: NEXTAUTH_URL looks like localhost ($AUTH_URL_CHECK)"
else
  echo "   NEXTAUTH_URL=$AUTH_URL_CHECK"
fi

echo "==> Health check"
HEALTH_PORT="${PORT:-3000}"
HEALTH_BASE="${NEXT_PUBLIC_BASE_PATH:-}"
HEALTH_OK=0
for _ in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${HEALTH_PORT}${HEALTH_BASE}/api/health/" >/dev/null \
     || curl -sf "http://127.0.0.1:${HEALTH_PORT}${HEALTH_BASE}/api/health" >/dev/null; then
    HEALTH_OK=1
    echo "   /api/health ok"
    break
  fi
  sleep 2
done
if (( ! HEALTH_OK )); then
  echo "   WARNING: health check failed — rolling back standalone if possible"
  if [[ -d .next/standalone.prev ]]; then
    rm -rf .next/standalone
    mv .next/standalone.prev .next/standalone
    pm2 delete calorie-vision || true
    pm2 start deploy/ecosystem.config.cjs
    pm2 save || true
  fi
  echo "   site may be down (pm2 logs calorie-vision)"
  exit 1
fi

# Drop previous release after healthy switch
rm -rf .next/standalone.prev

echo "==> Compress and backfill meal images (optional)"
npm run images:backfill || echo "image backfill skipped"

restore_generated_version_files

echo "==> Done (artifact deploy)"
