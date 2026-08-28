/**
 * Register Telegram bot webhook for @CalorieVisionAppBot (or TELEGRAM_BOT_TOKEN bot).
 *
 * Usage:
 *   npm run telegram:set-webhook
 *   npx tsx scripts/telegram-set-webhook.ts --check
 *
 * From RU VPS where api.telegram.org is blocked, set in .env:
 *   TELEGRAM_HTTPS_PROXY=socks5h://127.0.0.1:1080
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  curlTelegramApi,
  getTelegramProxyUrl,
} from "../src/lib/telegram-api-curl.ts";
import {
  buildTelegramWebhookUrl,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  type TelegramWebhookInfo,
} from "../src/lib/telegram-bot.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(): void {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function readWebhookInfo(): Promise<TelegramWebhookInfo | null> {
  const viaLib = await getTelegramWebhookInfo();
  if (viaLib.ok) return viaLib.info;

  console.warn("getWebhookInfo:", viaLib.error);
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;

  const viaCurl = await curlTelegramApi("getWebhookInfo", token);
  if (!viaCurl.ok) {
    console.error("getWebhookInfo (curl):", viaCurl.error);
    printNetworkHelp();
    process.exit(1);
  }
  return (viaCurl.result ?? {}) as TelegramWebhookInfo;
}

async function main(): Promise<void> {
  loadDotEnv();

  const checkOnly = process.argv.includes("--check");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const siteOrigin = process.env.NEXTAUTH_URL?.trim();
  const proxy = getTelegramProxyUrl();

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN не задан — webhook не регистрируем.");
    process.exit(1);
  }

  if (proxy) {
    console.log("Прокси для Telegram API:", proxy.replace(/:[^:@/]+@/, ":***@"));
  } else {
    console.warn(
      "TELEGRAM_HTTPS_PROXY не задан — с RU VPS api.telegram.org часто недоступен.",
    );
  }

  const info = await readWebhookInfo();
  if (!info) process.exit(1);

  console.log("Текущий webhook:", info.url || "(не задан)");
  if (info.last_error_message) {
    console.log("Последняя ошибка Telegram:", info.last_error_message);
  }
  console.log("Pending updates:", info.pending_update_count ?? 0);

  if (checkOnly) return;

  if (!siteOrigin) {
    console.error("NEXTAUTH_URL не задан — нужен канонический URL сайта (https://calorievision.ru).");
    process.exit(1);
  }

  const webhookUrl = buildTelegramWebhookUrl(siteOrigin, token);
  console.log("Регистрируем webhook:", webhookUrl.replace(token, "***"));

  const setResult = await setTelegramWebhook(webhookUrl);
  if (!setResult.ok) {
    console.error("setWebhook:", setResult.error);
    printNetworkHelp();
    process.exit(1);
  }

  const infoAfter = await readWebhookInfo();
  if (infoAfter) {
    console.log("Webhook установлен:", infoAfter.url || "(пусто)");
  }
  console.log("Готово. Проверьте: напишите боту /start в Telegram.");
}

function printNetworkHelp(): void {
  console.error("");
  console.error("Сервер не достучался до api.telegram.org.");
  console.error("Из РФ это нормально — нужен прокси за рубежом в .env:");
  console.error("  TELEGRAM_HTTPS_PROXY=socks5h://127.0.0.1:1080");
  console.error("  # или http://user:pass@proxy.example:8080");
  console.error("");
  console.error("Проверка через прокси:");
  console.error("  curl -4 --proxy \"$TELEGRAM_HTTPS_PROXY\" -I https://api.telegram.org");
  console.error("");
  console.error("Webhook можно один раз зарегистрировать с ПК (VPN), но ответы бота");
  console.error("(/start → сообщение) всё равно идут с сервера — прокси на VPS обязателен.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
