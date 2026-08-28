/**
 * Register Telegram bot webhook for @CalorieVisionAppBot (or TELEGRAM_BOT_TOKEN bot).
 *
 * Usage:
 *   npm run telegram:set-webhook
 *   npx tsx scripts/telegram-set-webhook.ts
 *   npx tsx scripts/telegram-set-webhook.ts --check   # only print getWebhookInfo
 *   bash scripts/telegram-set-webhook.sh              # curl --ipv4 fallback
 *
 * Requires TELEGRAM_BOT_TOKEN and NEXTAUTH_URL in env (or .env in project root).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

type CurlTelegramResult =
  | { ok: true; result: TelegramWebhookInfo | true }
  | { ok: false; error: string };

function curlTelegramApi(
  method: string,
  token: string,
  body?: Record<string, unknown>,
): CurlTelegramResult {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const args = ["--ipv4", "-sS", "--max-time", "30", "-H", "Accept: application/json"];
  if (body) {
    args.push(
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(body),
      url,
    );
  } else {
    args.push(url);
  }

  const result = spawnSync("curl", args, { encoding: "utf8" });
  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    return { ok: false, error: detail || `curl exit ${result.status}` };
  }

  try {
    const data = JSON.parse(result.stdout.trim()) as {
      ok?: boolean;
      description?: string;
      result?: TelegramWebhookInfo;
    };
    if (!data.ok) {
      return { ok: false, error: data.description ?? "Telegram API error" };
    }
    return { ok: true, result: data.result ?? true };
  } catch {
    return { ok: false, error: `Invalid JSON from curl: ${result.stdout.slice(0, 160)}` };
  }
}

function isNetworkFetchError(error: string): boolean {
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ENETUNREACH|UND_ERR/i.test(error);
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

  let info: TelegramWebhookInfo | null = null;

  const infoBefore = await getTelegramWebhookInfo();
  if (infoBefore.ok) {
    info = infoBefore.info;
  } else if (isNetworkFetchError(infoBefore.error)) {
    console.warn("Node fetch не достучался до Telegram, пробуем curl --ipv4…");
    const curlInfo = curlTelegramApi("getWebhookInfo", token);
    if (!curlInfo.ok) {
      console.error("getWebhookInfo (curl):", curlInfo.error);
      printNetworkHelp();
      process.exit(1);
    }
    info = typeof curlInfo.result === "object" ? curlInfo.result : {};
  } else {
    console.error("getWebhookInfo:", infoBefore.error);
    process.exit(1);
  }

  console.log("Текущий webhook:", info.url || "(не задан)");
  if (info.last_error_message) {
    console.log("Последняя ошибка Telegram:", info.last_error_message);
  }
  console.log("Pending updates:", info.pending_update_count ?? 0);

  if (checkOnly) {
    return;
  }

  if (!siteOrigin) {
    console.error("NEXTAUTH_URL не задан — нужен канонический URL сайта (https://calorievision.ru).");
    process.exit(1);
  }

  const webhookUrl = buildTelegramWebhookUrl(siteOrigin, token);
  console.log("Регистрируем webhook:", webhookUrl.replace(token, "***"));

  const setResult = await setTelegramWebhook(webhookUrl);
  if (!setResult.ok && isNetworkFetchError(setResult.error)) {
    console.warn("Node fetch не сработал, пробуем curl --ipv4…");
    const curlSet = curlTelegramApi("setWebhook", token, {
      url: webhookUrl,
      secret_token: token,
      allowed_updates: ["message"],
    });
    if (!curlSet.ok) {
      console.error("setWebhook (curl):", curlSet.error);
      printNetworkHelp();
      process.exit(1);
    }
  } else if (!setResult.ok) {
    console.error("setWebhook:", setResult.error);
    process.exit(1);
  }

  const infoAfter = await getTelegramWebhookInfo();
  if (infoAfter.ok) {
    console.log("Webhook установлен:", infoAfter.info.url || "(пусто)");
  } else {
    const curlAfter = curlTelegramApi("getWebhookInfo", token);
    if (curlAfter.ok && typeof curlAfter.result === "object") {
      console.log("Webhook установлен:", curlAfter.result.url || "(пусто)");
    }
  }

  console.log("Готово. Проверьте: напишите боту /start в Telegram.");
}

function printNetworkHelp(): void {
  console.error("");
  console.error("Сервер не достучался до api.telegram.org.");
  console.error("Диагностика на VPS:");
  console.error("  curl -4 -I https://api.telegram.org");
  console.error("  curl -4 \"https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo\"");
  console.error("");
  console.error("Если curl --ipv4 работает — повторите: npm run telegram:set-webhook");
  console.error("Если curl тоже падает — исходящий трафик к Telegram заблокирован на VPS.");
  console.error("Webhook можно зарегистрировать с локального ПК, но для ответов бота серверу");
  console.error("всё равно нужен исходящий доступ к api.telegram.org (или HTTPS_PROXY).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
