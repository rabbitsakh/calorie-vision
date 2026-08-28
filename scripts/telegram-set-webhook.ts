/**
 * Register Telegram bot webhook for @CalorieVisionAppBot (or TELEGRAM_BOT_TOKEN bot).
 *
 * Usage:
 *   npm run telegram:set-webhook
 *   npx tsx scripts/telegram-set-webhook.ts
 *   npx tsx scripts/telegram-set-webhook.ts --check   # only print getWebhookInfo
 *
 * Requires TELEGRAM_BOT_TOKEN and NEXTAUTH_URL in env (or .env in project root).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTelegramWebhookUrl,
  getTelegramWebhookInfo,
  setTelegramWebhook,
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

async function main(): Promise<void> {
  loadDotEnv();

  const checkOnly = process.argv.includes("--check");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const siteOrigin = process.env.NEXTAUTH_URL?.trim();

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN не задан — webhook не регистрируем.");
    process.exit(1);
  }

  const infoBefore = await getTelegramWebhookInfo();
  if (!infoBefore.ok) {
    console.error("getWebhookInfo:", infoBefore.error);
    process.exit(1);
  }

  console.log("Текущий webhook:", infoBefore.info.url || "(не задан)");
  if (infoBefore.info.last_error_message) {
    console.log("Последняя ошибка Telegram:", infoBefore.info.last_error_message);
  }
  console.log("Pending updates:", infoBefore.info.pending_update_count ?? 0);

  if (checkOnly) {
    return;
  }

  if (!siteOrigin) {
    console.error("NEXTAUTH_URL не задан — нужен канонический URL сайта (https://calorievision.ru).");
    process.exit(1);
  }

  const webhookUrl = buildTelegramWebhookUrl(siteOrigin, token);
  console.log("Регистрируем webhook:", webhookUrl.replace(token, "***"));

  const result = await setTelegramWebhook(webhookUrl);
  if (!result.ok) {
    console.error("setWebhook:", result.error);
    process.exit(1);
  }

  const infoAfter = await getTelegramWebhookInfo();
  if (infoAfter.ok) {
    console.log("Webhook установлен:", infoAfter.info.url || "(пусто)");
  }
  console.log("Готово. Проверьте: напишите боту /start в Telegram.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
