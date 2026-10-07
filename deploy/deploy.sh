#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/calorie-vision"
cd "$APP_DIR"

GENERATED_VERSION_FILES=(
  "package.json"
  "package-lock.json"
  "src/data/changelog.json"
)

# Verbose: DEPLOY_VERBOSE=1 bash deploy/deploy.sh
DEPLOY_VERBOSE="${DEPLOY_VERBOSE:-0}"
DEPLOY_LOG="${DEPLOY_LOG:-/tmp/cv-deploy-$$.log}"

restore_generated_version_files() {
  git restore "${GENERATED_VERSION_FILES[@]}" 2>/dev/null || true
}

# If cv-release/deploy was started from an older on-disk script, pull and
# re-exec once so the quiet progress UI from main actually runs this time.
if [[ "${CV_DEPLOY_REEXEC:-}" != "1" ]]; then
  restore_generated_version_files
  git pull --ff-only >>"$DEPLOY_LOG" 2>&1 || git pull >>"$DEPLOY_LOG" 2>&1 || true
  export CV_DEPLOY_REEXEC=1
  export DEPLOY_LOG
  exec bash "$APP_DIR/deploy/deploy.sh"
fi

: >"$DEPLOY_LOG"

# —— Color progress UI + end stats ————————————————————
# One updating line: [████----]  42%  Build
# Colors off: DEPLOY_COLOR=0 or NO_COLOR=1 or non-TTY.
# Failures / warnings print as normal text below.

_PROGRESS_PCT=0
_PROGRESS_LABEL="Старт"
_DEPLOY_T0=$SECONDS
_DEPLOY_T_NPM=0
_DEPLOY_T_BUILD=0
_DEPLOY_T_MARK=0
KEEP_LIVE=0
HEAP_MB=""
HEALTH_OK=0

_IS_TTY=0
if [[ -t 2 ]]; then _IS_TTY=1; fi

_USE_COLOR=0
if (( _IS_TTY )) && [[ -z "${NO_COLOR:-}" && "${DEPLOY_COLOR:-1}" != "0" ]]; then
  _USE_COLOR=1
fi

# Brand-ish teal / green palette (256-color; fine over modern SSH).
_C_RESET="" _C_BOLD="" _C_DIM="" _C_TEAL="" _C_GREEN="" _C_YELLOW="" _C_RED="" _C_CYAN=""
if (( _USE_COLOR )); then
  _C_RESET=$'\033[0m'
  _C_BOLD=$'\033[1m'
  _C_DIM=$'\033[2m'
  _C_TEAL=$'\033[38;5;37m'
  _C_GREEN=$'\033[38;5;78m'
  _C_YELLOW=$'\033[33m'
  _C_RED=$'\033[31m'
  _C_CYAN=$'\033[36m'
fi

_bar_color() {
  local pct="$1"
  if (( pct >= 85 )); then
    printf '%s' "$_C_GREEN"
  elif (( pct >= 45 )); then
    printf '%s' "$_C_TEAL"
  else
    printf '%s' "$_C_CYAN"
  fi
}

_fmt_duration() {
  local sec="${1:-0}"
  if (( sec < 0 )); then sec=0; fi
  if (( sec < 60 )); then
    printf '%dс' "$sec"
  else
    printf '%dм %dс' "$((sec / 60))" "$((sec % 60))"
  fi
}

_progress_draw() {
  local pct="${1:-$_PROGRESS_PCT}"
  local label="${2:-$_PROGRESS_LABEL}"
  local width=28
  (( pct < 0 )) && pct=0
  (( pct > 100 )) && pct=100
  local filled=$((pct * width / 100))
  local empty=$((width - filled))
  local bar="" i
  # UTF-8 blocks — repo/VPS already use Cyrillic over SSH.
  for ((i = 0; i < filled; i++)); do bar+="█"; done
  for ((i = 0; i < empty; i++)); do bar+="░"; done
  local elapsed=$((SECONDS - _DEPLOY_T0))
  local elapsed_s
  elapsed_s="$(_fmt_duration "$elapsed")"
  if (( _IS_TTY )); then
    local bc
    bc="$(_bar_color "$pct")"
    printf '\r\033[K%s[%s%s%s]%s %s%3d%%%s  %s%s%s  %s%s%s' \
      "$_C_DIM" "$bc" "$bar" "$_C_DIM" "$_C_RESET" \
      "$_C_BOLD" "$pct" "$_C_RESET" \
      "$_C_TEAL" "$label" "$_C_RESET" \
      "$_C_DIM" "$elapsed_s" "$_C_RESET" >&2
  else
    printf '[%s] %3d%%  %s  (%s)\n' "$bar" "$pct" "$label" "$elapsed_s" >&2
  fi
}

progress() {
  _PROGRESS_PCT="$1"
  _PROGRESS_LABEL="$2"
  _progress_draw "$_PROGRESS_PCT" "$_PROGRESS_LABEL"
}

# Mark wall-clock for a named phase (npm / build). Call before → after with same name.
step_timer_begin() {
  _DEPLOY_T_MARK=$SECONDS
}

step_timer_end() {
  local name="$1"
  local took=$((SECONDS - _DEPLOY_T_MARK))
  case "$name" in
    npm) _DEPLOY_T_NPM=$took ;;
    build) _DEPLOY_T_BUILD=$took ;;
  esac
  echo "timer.${name}=${took}s" >>"$DEPLOY_LOG"
}

progress_done() {
  local label="${1:-Готово}"
  _progress_draw 100 "$label"
  if (( _IS_TTY )); then
    printf '\n' >&2
  fi
}

deploy_stats() {
  local total=$((SECONDS - _DEPLOY_T0))
  local sha ver mode mem heap health
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  ver="$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo '?')"
  if (( KEEP_LIVE )); then
    mode="live · сайт не гасили"
  else
    mode="stop-fallback · pm2 стопили на build"
  fi
  mem="$(free_build_mb 2>/dev/null || echo '?')"
  heap="${HEAP_MB:-—}"
  if (( HEALTH_OK )); then
    health="ok"
  else
    health="fail"
  fi

  if (( _IS_TTY )); then
    printf '\n' >&2
  fi
  printf '%s%s✓  Деплой за %s%s\n' "$_C_BOLD" "$_C_GREEN" "$(_fmt_duration "$total")" "$_C_RESET" >&2
  printf '   %scommit%s  %s%s%s  ·  v%s\n' "$_C_DIM" "$_C_RESET" "$_C_TEAL" "$sha" "$_C_RESET" "$ver" >&2
  printf '   %sрежим%s   %s\n' "$_C_DIM" "$_C_RESET" "$mode" >&2
  if (( _DEPLOY_T_NPM > 0 || _DEPLOY_T_BUILD > 0 )); then
    printf '   %sшаги%s    npm %s · build %s\n' \
      "$_C_DIM" "$_C_RESET" \
      "$(_fmt_duration "${_DEPLOY_T_NPM:-0}")" \
      "$(_fmt_duration "${_DEPLOY_T_BUILD:-0}")" >&2
  fi
  printf '   %sRAM%s     %s MB free · heap %s\n' "$_C_DIM" "$_C_RESET" "$mem" "$heap" >&2
  if (( HEALTH_OK )); then
    printf '   %shealth%s  %s%s%s\n' "$_C_DIM" "$_C_RESET" "$_C_GREEN" "$health" "$_C_RESET" >&2
  else
    printf '   %shealth%s  %s%s%s\n' "$_C_DIM" "$_C_RESET" "$_C_YELLOW" "$health" "$_C_RESET" >&2
  fi
  printf '   %sлог%s     %s\n' "$_C_DIM" "$_C_RESET" "$DEPLOY_LOG" >&2

  {
    echo "—— deploy stats ——"
    echo "total_s=$total"
    echo "commit=$sha"
    echo "version=$ver"
    echo "KEEP_LIVE=$KEEP_LIVE"
    echo "npm_s=${_DEPLOY_T_NPM}"
    echo "build_s=${_DEPLOY_T_BUILD}"
    echo "free_mb=$mem"
    echo "heap_mb=$heap"
    echo "health=$health"
  } >>"$DEPLOY_LOG"
}

# Print a warning/error line without breaking the bar (new line).
deploy_warn() {
  if (( _IS_TTY )); then
    printf '\n' >&2
  fi
  printf '%s⚠  %s%s\n' "$_C_YELLOW" "$*" "$_C_RESET" >&2
  _progress_draw "$_PROGRESS_PCT" "$_PROGRESS_LABEL"
}

deploy_fail() {
  if (( _IS_TTY )); then
    printf '\n' >&2
  fi
  printf '%s%s✗  %s%s\n' "$_C_BOLD" "$_C_RED" "$*" "$_C_RESET" >&2
  if [[ -s "$DEPLOY_LOG" ]]; then
    printf '\n%s—— последние строки лога (%s) ——%s\n' "$_C_DIM" "$DEPLOY_LOG" "$_C_RESET" >&2
    tail -n 50 "$DEPLOY_LOG" >&2 || true
    printf '%s——————————————————————————————%s\n' "$_C_DIM" "$_C_RESET" >&2
  fi
}

# Run command quietly. Soft fail: only append to log (no banner).
# Usage: run_soft "Label" cmd args…
run_soft() {
  local label="$1"
  shift
  if [[ "$DEPLOY_VERBOSE" == "1" ]]; then
    "$@"
    return $?
  fi
  if "$@" >>"$DEPLOY_LOG" 2>&1; then
    return 0
  fi
  local rc=$?
  echo "[soft-fail] $label (код $rc)" >>"$DEPLOY_LOG"
  return "$rc"
}

# Run command quietly; on failure show log tail (caller decides exit).
# Usage: run_quiet "Label" cmd args…
run_quiet() {
  local label="$1"
  shift
  if [[ "$DEPLOY_VERBOSE" == "1" ]]; then
    "$@"
    return $?
  fi
  if "$@" >>"$DEPLOY_LOG" 2>&1; then
    return 0
  fi
  local rc=$?
  deploy_fail "$label (код $rc)"
  return "$rc"
}

# Long quiet step with live heartbeat on the progress line:
#   [#####----]  18%  npm install (45с)
# Soft-fail: mode=soft. Hard-fail (deploy_fail): mode=quiet.
# timeout_sec=0 → no kill; % crawls toward end_pct only when timeout_sec>0.
# Usage: run_long soft|quiet "Label" timeout_sec end_pct cmd args…
run_long() {
  local mode="$1"
  local label="$2"
  local timeout_sec="${3:-0}"
  local end_pct="${4:-$_PROGRESS_PCT}"
  shift 4
  local start_pct=$_PROGRESS_PCT
  local start=$SECONDS
  local pid rc=0

  if [[ "$DEPLOY_VERBOSE" == "1" ]]; then
    "$@"
    return $?
  fi

  "$@" >>"$DEPLOY_LOG" 2>&1 &
  pid=$!

  _kill_long() {
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 2
      # npm often leaves children after the parent dies
      pkill -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
    fi
  }

  trap '_kill_long; trap - INT TERM; return 130' INT TERM

  while kill -0 "$pid" 2>/dev/null; do
    local elapsed=$((SECONDS - start))
    if (( timeout_sec > 0 && elapsed >= timeout_sec )); then
      echo "[timeout] $label after ${timeout_sec}s" >>"$DEPLOY_LOG"
      _kill_long
      wait "$pid" 2>/dev/null || true
      trap - INT TERM
      if [[ "$mode" == "soft" ]]; then
        echo "[soft-fail] $label (таймаут ${timeout_sec}с)" >>"$DEPLOY_LOG"
        return 124
      fi
      deploy_fail "$label — таймаут ${timeout_sec}с (см. лог)"
      return 124
    fi
    local pct=$start_pct
    if (( timeout_sec > 0 && end_pct > start_pct )); then
      pct=$((start_pct + (end_pct - start_pct) * elapsed / timeout_sec))
      (( pct > end_pct )) && pct=$end_pct
    fi
    _progress_draw "$pct" "${label} (${elapsed}с)"
    sleep 2
  done

  set +e
  wait "$pid"
  rc=$?
  set -e
  trap - INT TERM
  _PROGRESS_PCT=$end_pct
  _PROGRESS_LABEL="$label"
  _progress_draw "$_PROGRESS_PCT" "$_PROGRESS_LABEL"

  if (( rc == 0 )); then
    return 0
  fi
  if [[ "$mode" == "soft" ]]; then
    echo "[soft-fail] $label (код $rc)" >>"$DEPLOY_LOG"
    return "$rc"
  fi
  deploy_fail "$label (код $rc)"
  return "$rc"
}

# Print MemAvailable / SwapFree into the log (not the progress line).
log_meminfo() {
  if [[ -r /proc/meminfo ]]; then
    awk '
      /MemTotal:/ { total = int($2/1024) }
      /MemAvailable:/ { avail = int($2/1024) }
      /SwapTotal:/ { swap_t = int($2/1024) }
      /SwapFree:/ { swap_f = int($2/1024) }
      END {
        printf "MemTotal: %d MB  MemAvailable: %d MB  SwapTotal: %d MB  SwapFree: %d MB\n",
          total+0, avail+0, swap_t+0, swap_f+0
      }
    ' /proc/meminfo >>"$DEPLOY_LOG"
  fi
}

# Free RAM + swap in MB (for live-build gate and heap sizing).
free_build_mb() {
  local mem_avail_mb=2048
  local swap_free_mb=0
  if [[ -r /proc/meminfo ]]; then
    mem_avail_mb=$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
    swap_free_mb=$(awk '/SwapFree:/ {print int($2/1024)}' /proc/meminfo)
  fi
  echo $((mem_avail_mb + swap_free_mb))
}

# Pick a Node heap that fits free RAM + swap.
# When KEEP_LIVE=1 the app is still serving — leave more headroom.
# Override the whole NODE_OPTIONS string with DEPLOY_NODE_OPTIONS.
pick_node_heap_mb() {
  local mem_avail_mb=2048
  local swap_free_mb=0
  local keep_live="${1:-0}"
  if [[ -r /proc/meminfo ]]; then
    mem_avail_mb=$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
    swap_free_mb=$(awk '/SwapFree:/ {print int($2/1024)}' /proc/meminfo)
  fi
  # Count most of free swap so a ≤2 GB VPS can still finish next build.
  local usable_mb=$((mem_avail_mb + (swap_free_mb * 3) / 4))
  local reserve=512
  if (( keep_live )); then
    # Running next start + MySQL + OS while webpack runs.
    reserve=900
  fi
  local heap=$((usable_mb - reserve))
  # Current app needs >1 GB V8 heap; 1024 floors caused "heap out of memory".
  if (( heap < 1536 )); then heap=1536; fi
  if (( heap > 4096 )); then heap=4096; fi
  echo "$heap"
}

# A: keep pm2 online during build when free RAM+swap is enough.
# Override: DEPLOY_FORCE_LIVE=1 | DEPLOY_FORCE_STOP=1
# Threshold: DEPLOY_KEEP_LIVE_MIN_MB (default 2400).
can_keep_live() {
  if [[ "${DEPLOY_FORCE_STOP:-0}" == "1" ]]; then
    return 1
  fi
  if [[ "${DEPLOY_FORCE_LIVE:-0}" == "1" ]]; then
    return 0
  fi
  local min_mb="${DEPLOY_KEEP_LIVE_MIN_MB:-2400}"
  local free_mb
  free_mb="$(free_build_mb)"
  echo "free_build_mb=${free_mb} keep_live_min_mb=${min_mb}" >>"$DEPLOY_LOG"
  (( free_mb >= min_mb ))
}

# B: promote side-build dir onto `.next` without touching the live tree mid-build.
swap_next_build() {
  local build_dir="${1:-.next-build}"
  local stamp
  stamp="$(date +%s)"
  if [[ ! -d "$build_dir" ]]; then
    deploy_fail "Нет каталога сборки $build_dir"
    return 1
  fi
  if [[ ! -f "$build_dir/BUILD_ID" && ! -d "$build_dir/server" ]]; then
    deploy_fail "Сборка в $build_dir выглядит пустой (нет BUILD_ID/server)"
    return 1
  fi
  rm -rf ".next.prev" ".next.prev-${stamp}" >>"$DEPLOY_LOG" 2>&1 || true
  if [[ -d .next ]]; then
    mv .next ".next.prev-${stamp}" >>"$DEPLOY_LOG" 2>&1 || return 1
  fi
  if ! mv "$build_dir" .next >>"$DEPLOY_LOG" 2>&1; then
    deploy_fail "Не удалось заменить .next ← $build_dir"
    if [[ -d ".next.prev-${stamp}" ]]; then
      mv ".next.prev-${stamp}" .next >>"$DEPLOY_LOG" 2>&1 || true
    fi
    return 1
  fi
  rm -rf ".next.prev-${stamp}" >>"$DEPLOY_LOG" 2>&1 || true
  echo "swapped ${build_dir} → .next" >>"$DEPLOY_LOG"
  return 0
}

progress 2 "Pull"
restore_generated_version_files
# Already pulled once in the re-exec prologue / cv-release — a fast second pull is enough
# unless that failed; then retry with backoff (GitHub HTTPS timeouts on some VPS).
pull_ok=0
for attempt in 1 2 3 4; do
  if run_soft "git pull" git pull; then
    pull_ok=1
    break
  fi
  deploy_warn "git pull не удался ($attempt/4) — повтор через $((attempt * 8))с…"
  sleep $((attempt * 8))
done
if (( ! pull_ok )); then
  deploy_fail "git pull после 4 попыток. Проверьте VPS → github.com:443, затем: cv-release --deploy-only"
  exit 1
fi

progress 8 "Node"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"; then
  deploy_fail "Нужен Node.js 24 LTS (сейчас $(node -v)). См. README: «Node.js 24 на VPS»."
  exit 1
fi
echo "node $(node -v)" >>"$DEPLOY_LOG"

progress 12 "Версия"
run_quiet "sync-app-version" node --experimental-strip-types --no-warnings scripts/sync-app-version.ts

# Load .env early so SENTRY_* flags are visible for install/build.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

progress 18 "npm install"
# @sentry/cli postinstall downloads a binary from CDN and often hangs on VPS
# (IPv6 / CDN timeout). Always skip on deploy unless DEPLOY_SENTRY_CLI=1.
# SENTRY_AUTH_TOKEN alone must NOT enable the download — that was a common hang.
if [[ "${DEPLOY_SENTRY_CLI:-}" == "1" ]]; then
  echo "DEPLOY_SENTRY_CLI=1 — allowing @sentry/cli binary download" >>"$DEPLOY_LOG"
  unset SENTRYCLI_SKIP_DOWNLOAD || true
else
  export SENTRYCLI_SKIP_DOWNLOAD=1
  echo "SENTRYCLI_SKIP_DOWNLOAD=1" >>"$DEPLOY_LOG"
fi
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-60000}"
export npm_config_fetch_retries="${npm_config_fetch_retries:-2}"
export npm_config_fetch_retry_mintimeout="${npm_config_fetch_retry_mintimeout:-5000}"
export npm_config_fetch_retry_maxtimeout="${npm_config_fetch_retry_maxtimeout:-20000}"
# Heartbeat + hard cap so the bar never sits silent at 18%.
DEPLOY_NPM_TIMEOUT="${DEPLOY_NPM_TIMEOUT:-600}"
npm_prefer=()
if [[ -d node_modules ]]; then
  npm_prefer=(--prefer-offline)
fi
step_timer_begin
if [[ -f package-lock.json ]]; then
  if ! run_long soft "npm ci" "$DEPLOY_NPM_TIMEOUT" 32 \
    npm ci --no-audit --no-fund "${npm_prefer[@]}"; then
    deploy_warn "npm ci не удался — пробуем npm install"
    run_long quiet "npm install" "$DEPLOY_NPM_TIMEOUT" 34 \
      npm install --no-audit --no-fund "${npm_prefer[@]}" || exit 1
  fi
else
  run_long quiet "npm install" "$DEPLOY_NPM_TIMEOUT" 34 \
    npm install --no-audit --no-fund "${npm_prefer[@]}" || exit 1
fi
step_timer_end npm

progress 35 "Prisma"
# Run the hand-written SQL migration first so prisma db push does not trip over
# duplicate foreign key names that MySQL doesn't let Prisma rename automatically.
if ls deploy/migrate-*.sql >/dev/null 2>&1; then
  if ! run_soft "db:migrate-sql" npm run db:migrate-sql; then
    deploy_warn "SQL migration failed or already applied — продолжаем db:push"
  fi
fi
if ! run_soft "db:push" npm run db:push; then
  if [[ "${ALLOW_DB_PUSH_FAIL:-}" == "1" ]]; then
    deploy_warn "db:push failed — ALLOW_DB_PUSH_FAIL=1, продолжаем"
  else
    deploy_fail "db:push failed — abort (set ALLOW_DB_PUSH_FAIL=1 to override)"
    exit 1
  fi
fi

progress 42 "Prisma generate"
run_quiet "db:generate" npm run db:generate || exit 1

# —— A/B: live build into .next-build, then atomic swap + short reload ————
# A: keep pm2 online when free RAM+swap ≥ DEPLOY_KEEP_LIVE_MIN_MB (default 2400).
# B: never write into live `.next` during build (NEXT_DIST_DIR=.next-build).
KEEP_LIVE=0
APP_WAS_RUNNING=0
if pm2 describe calorie-vision >/dev/null 2>&1; then
  APP_WAS_RUNNING=1
fi
log_meminfo
if (( APP_WAS_RUNNING )) && can_keep_live; then
  KEEP_LIVE=1
  progress 48 "Build рядом (сайт онлайн)"
  echo "KEEP_LIVE=1 — pm2 остаётся online на время сборки" >>"$DEPLOY_LOG"
else
  KEEP_LIVE=0
  progress 48 "Освобождаем RAM"
  if (( APP_WAS_RUNNING )); then
    deploy_warn "Мало RAM/swap для сборки рядом — останавливаем pm2 на время build. Порог: DEPLOY_KEEP_LIVE_MIN_MB=${DEPLOY_KEEP_LIVE_MIN_MB:-2400}; форс-онлайн: DEPLOY_FORCE_LIVE=1"
    pm2 stop calorie-vision >>"$DEPLOY_LOG" 2>&1 || true
  fi
  # Best-effort: reclaim page cache so MemAvailable reflects real free RAM.
  if [[ "$(id -u)" -eq 0 ]] && [[ -w /proc/sys/vm/drop_caches ]]; then
    sync || true
    echo 3 >/proc/sys/vm/drop_caches 2>/dev/null || true
  fi
  echo "KEEP_LIVE=0 — сборка при остановленном pm2" >>"$DEPLOY_LOG"
fi
log_meminfo

progress 55 "Build"
# Next.js production build can OOM on small VPS (V8 heap limit or SIGKILL).
# Always re-pick heap — do not inherit a low NODE_OPTIONS from .env.
# Override: DEPLOY_NODE_OPTIONS='--max-old-space-size=2048'
if [[ -n "${DEPLOY_NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="$DEPLOY_NODE_OPTIONS"
  # Best-effort parse for the end-of-deploy stats line.
  HEAP_MB="$(printf '%s' "$DEPLOY_NODE_OPTIONS" | sed -n 's/.*max-old-space-size=\([0-9][0-9]*\).*/\1/p' | head -1)"
else
  HEAP_MB="$(pick_node_heap_mb "$KEEP_LIVE")"
  export NODE_OPTIONS="--max-old-space-size=${HEAP_MB}"
fi
export NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"
# Side output so live `next start` keeps reading the old `.next` until swap.
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-build}"
rm -rf "$NEXT_DIST_DIR" >>"$DEPLOY_LOG" 2>&1 || true
{
  echo "NODE_OPTIONS=$NODE_OPTIONS"
  echo "NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS"
  echo "UV_THREADPOOL_SIZE=$UV_THREADPOOL_SIZE"
  echo "NEXT_DIST_DIR=$NEXT_DIST_DIR"
  echo "KEEP_LIVE=$KEEP_LIVE"
} >>"$DEPLOY_LOG"
log_meminfo
DEPLOY_BUILD_TIMEOUT="${DEPLOY_BUILD_TIMEOUT:-900}"
step_timer_begin
if ! run_long quiet "Build" "$DEPLOY_BUILD_TIMEOUT" 82 npm run build; then
  step_timer_end build
  # run_long already printed deploy_fail + log tail
  echo "Hint: V8 OOM → DEPLOY_NODE_OPTIONS / swap; SIGKILL → lower heap / DEPLOY_FORCE_STOP=1; таймаут → DEPLOY_BUILD_TIMEOUT" >>"$DEPLOY_LOG"
  log_meminfo
  rm -rf "$NEXT_DIST_DIR" >>"$DEPLOY_LOG" 2>&1 || true
  if (( APP_WAS_RUNNING && ! KEEP_LIVE )); then
    deploy_warn "Перезапускаем предыдущую версию, чтобы не оставить 502"
    pm2 restart calorie-vision >>"$DEPLOY_LOG" 2>&1 \
      || pm2 start deploy/ecosystem.config.cjs >>"$DEPLOY_LOG" 2>&1 || true
    pm2 save >>"$DEPLOY_LOG" 2>&1 || true
  elif (( KEEP_LIVE )); then
    deploy_warn "Сборка рядом не удалась — оставляем текущий сайт без перезапуска"
  fi
  exit 1
fi
step_timer_end build

progress 85 "Переключаем .next"
if ! swap_next_build "$NEXT_DIST_DIR"; then
  if (( APP_WAS_RUNNING && ! KEEP_LIVE )); then
    deploy_warn "Swap не удался — пробуем поднять прежний процесс"
    pm2 restart calorie-vision >>"$DEPLOY_LOG" 2>&1 \
      || pm2 start deploy/ecosystem.config.cjs >>"$DEPLOY_LOG" 2>&1 || true
    pm2 save >>"$DEPLOY_LOG" 2>&1 || true
  fi
  exit 1
fi
unset NEXT_DIST_DIR

progress 88 "Reload"
if pm2 describe calorie-vision >/dev/null 2>&1; then
  # reload ≈ короткий рестарт на fork-режиме; сайт лежит секунды, не минуты сборки.
  if ! run_soft "pm2 reload" pm2 reload calorie-vision --update-env; then
    run_quiet "pm2 restart" pm2 restart calorie-vision --update-env || exit 1
  fi
else
  run_quiet "pm2 start" pm2 start deploy/ecosystem.config.cjs || exit 1
fi

# Sanity: public auth URL must not be localhost (Custom Tabs would fail on the phone).
AUTH_URL_CHECK="$(grep -E '^NEXTAUTH_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$AUTH_URL_CHECK" ]]; then
  deploy_warn "NEXTAUTH_URL отсутствует в .env"
elif echo "$AUTH_URL_CHECK" | grep -qiE 'localhost|127\.0\.0\.1'; then
  deploy_warn "NEXTAUTH_URL похож на localhost ($AUTH_URL_CHECK) — нужен https://calorievision.ru"
else
  echo "NEXTAUTH_URL=$AUTH_URL_CHECK" >>"$DEPLOY_LOG"
fi

pm2 save >>"$DEPLOY_LOG" 2>&1 || true

progress 94 "Health"
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
    echo "/api/health ok" >>"$DEPLOY_LOG"
    break
  fi
  sleep 2
done
if (( ! HEALTH_OK )); then
  deploy_warn "health check failed — сайт может быть недоступен (pm2 logs calorie-vision)"
fi

progress 97 "Картинки"
if ! run_soft "images:backfill" npm run images:backfill; then
  deploy_warn "image backfill пропущен"
fi

restore_generated_version_files

progress_done "Готово"
deploy_stats
