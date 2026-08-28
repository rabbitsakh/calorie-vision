#!/usr/bin/env bash
# curl --ipv4 fallback for npm run telegram:set-webhook on VPS with broken IPv6.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
ORIGIN="${NEXTAUTH_URL:-}"

if [[ -z "$TOKEN" ]]; then
  echo "TELEGRAM_BOT_TOKEN не задан" >&2
  exit 1
fi

CURL=(curl --ipv4 -sS --max-time 30)

echo "==> getWebhookInfo"
"${CURL[@]}" "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
echo ""

if [[ "${1:-}" == "--check" ]]; then
  exit 0
fi

if [[ -z "$ORIGIN" ]]; then
  echo "NEXTAUTH_URL не задан" >&2
  exit 1
fi

PAYLOAD="$(node -e "
const token = process.argv[1];
const origin = process.argv[2].replace(/\\/\$/, '');
const url = origin + '/api/telegram/webhook?secret=' + encodeURIComponent(token);
console.log(JSON.stringify({
  url,
  secret_token: token,
  allowed_updates: ['message'],
}));
" "$TOKEN" "$ORIGIN")"

echo "==> setWebhook"
"${CURL[@]}" -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo ""

echo "==> getWebhookInfo (after)"
"${CURL[@]}" "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
echo ""
echo "Готово. Напишите боту /start."
