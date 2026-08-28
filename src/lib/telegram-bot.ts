/**
 * Soft Telegram bot helpers for Calorie Vision.
 *
 * Setup (BotFather):
 * 1. Create bot → set TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 * 2. Set webhook:
 *    npm run telegram:set-webhook
 *    (на VPS при проблемах с IPv6 скрипт пробует curl --ipv4)
 *
 * TODO(batch-18+): schedule meal/water reminders via Telegram chat_id stored per user
 * (cron similar to /api/cron/reminders). For now only /start deep-link + /remind help.
 */

import dns from "node:dns";
import { getTelegramBotUsername } from "@/lib/telegram-bot-config";

export {
  DEFAULT_TELEGRAM_BOT_USERNAME,
  getTelegramBotUsername,
  telegramBotDeepLink,
} from "@/lib/telegram-bot-config";

const TELEGRAM_API = "https://api.telegram.org";

let ipv4Preferred = false;

/** Prefer IPv4 — on many VPS broken IPv6 causes Node fetch to fail with "fetch failed". */
export function preferTelegramIpv4(): void {
  if (ipv4Preferred) return;
  try {
    dns.setDefaultResultOrder("ipv4first");
    ipv4Preferred = true;
  } catch {
    // Node < 17
  }
}

export function formatTelegramFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "Ошибка Telegram API";
  const parts = [error.message];
  const code = (error as NodeJS.ErrnoException).code;
  if (code) parts.push(`code=${code}`);

  let cause: unknown = error.cause;
  for (let depth = 0; depth < 4 && cause; depth += 1) {
    if (cause instanceof Error) {
      parts.push(cause.message);
      const causeCode = (cause as NodeJS.ErrnoException).code;
      if (causeCode) parts.push(`code=${causeCode}`);
      cause = cause.cause;
    } else {
      parts.push(String(cause));
      break;
    }
  }

  if (error.message === "fetch failed") {
    parts.push(
      "проверьте: curl -4 -I https://api.telegram.org (на VPS часто ломается IPv6 или блокируется исходящий трафик)",
    );
  }

  return parts.join(" — ");
}

async function telegramFetch(url: string, init?: RequestInit): Promise<Response> {
  preferTelegramIpv4();
  const timeoutMs = Number(process.env.TELEGRAM_FETCH_TIMEOUT_MS ?? 30_000);
  const signal = AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 30_000);
  return fetch(url, { ...init, signal });
}

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

/** Extract /command from message text (handles /start@CalorieVisionAppBot). */
export function parseTelegramCommand(text: string): string {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const base = first.split("@")[0] ?? "";
  return base.startsWith("/") ? base : "";
}

/** Verify webhook caller via query `secret` or Telegram secret_token header. */
export function verifyTelegramWebhookSecret(
  request: { headers: Headers; nextUrl: { searchParams: URLSearchParams } },
): boolean {
  const token = getTelegramBotToken();
  if (!token) return false;

  const header =
    request.headers.get("x-telegram-bot-api-secret-token") ??
    request.headers.get("x-telegram-bot-token");
  if (header && header === token) return true;

  const query = request.nextUrl.searchParams.get("secret");
  if (query && query === token) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${token}`) return true;

  return false;
}

export type SendTelegramMessageResult =
  | { ok: true; messageId?: number }
  | { ok: false; error: string };

/** Send a plain-text Telegram message via Bot API. */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: { parseMode?: "HTML" | "Markdown" | "MarkdownV2"; disableWebPagePreview?: boolean },
): Promise<SendTelegramMessageResult> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }

  try {
    const resp = await telegramFetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
        disable_web_page_preview: options?.disableWebPagePreview ?? true,
      }),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!resp.ok || !data.ok) {
      return { ok: false, error: data.description ?? `Telegram API ${resp.status}` };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (error) {
    return { ok: false, error: formatTelegramFetchError(error) };
  }
}

export type TelegramWebhookInfo = {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_message?: string;
};

export async function getTelegramWebhookInfo(): Promise<
  { ok: true; info: TelegramWebhookInfo } | { ok: false; error: string }
> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }
  try {
    const resp = await telegramFetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
    const data = (await resp.json()) as {
      ok?: boolean;
      description?: string;
      result?: TelegramWebhookInfo;
    };
    if (!resp.ok || !data.ok || !data.result) {
      return { ok: false, error: data.description ?? `Telegram API ${resp.status}` };
    }
    return { ok: true, info: data.result };
  } catch (error) {
    return { ok: false, error: formatTelegramFetchError(error) };
  }
}

export async function setTelegramWebhook(
  webhookUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" };
  }
  try {
    const resp = await telegramFetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: token,
        allowed_updates: ["message"],
      }),
    });
    const data = (await resp.json()) as { ok?: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      return { ok: false, error: data.description ?? `Telegram API ${resp.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatTelegramFetchError(error) };
  }
}

export function buildTelegramWebhookUrl(siteOrigin: string, token: string): string {
  const base = siteOrigin.replace(/\/$/, "");
  return `${base}/api/telegram/webhook?secret=${encodeURIComponent(token)}`;
}

export function telegramStartReplyText(): string {
  const bot = getTelegramBotUsername();
  return [
    "Привет! Я бот Calorie Vision 🌿",
    "",
    "Откройте дневник рациона:",
    "https://calorievision.ru/ration",
    "",
    "Команды:",
    `/start — ссылка в приложение`,
    `/remind — как включить напоминания`,
    "",
    `Бот: @${bot}`,
  ].join("\n");
}

export function telegramRemindHelpText(): string {
  return [
    "Напоминания в Telegram — в планах.",
    "",
    "Пока можно:",
    "• включить push в профиле приложения (Напоминания);",
    "• открыть рацион: https://calorievision.ru/ration",
    "",
    // TODO: store chat_id + cron sendTelegramMessage for breakfast/water slots
    "Скоро: мягкие напоминания о еде и воде прямо в чат.",
  ].join("\n");
}
