/**
 * Soft Telegram bot helpers for Calorie Vision.
 *
 * Setup (BotFather):
 * 1. Create bot → set TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 * 2. Set webhook:
 *    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
 *      -d "url=https://calorievision.ru/api/telegram/webhook?secret=$TELEGRAM_BOT_TOKEN" \
 *      -d "secret_token=$TELEGRAM_BOT_TOKEN"
 *
 * TODO(batch-18+): schedule meal/water reminders via Telegram chat_id stored per user
 * (cron similar to /api/cron/reminders). For now only /start deep-link + /remind help.
 */

const TELEGRAM_API = "https://api.telegram.org";

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

export function getTelegramBotUsername(): string | null {
  const name = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  return name || null;
}

export function telegramBotDeepLink(): string | null {
  const username = getTelegramBotUsername();
  return username ? `https://t.me/${username}` : null;
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
    const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
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
    const message = error instanceof Error ? error.message : "Ошибка Telegram API";
    return { ok: false, error: message };
  }
}

export function telegramStartReplyText(): string {
  return [
    "Привет! Я бот Calorie Vision 🌿",
    "",
    "Откройте дневник рациона:",
    "https://calorievision.ru/ration",
    "",
    "Команды:",
    "/start — ссылка в приложение",
    "/remind — как включить напоминания",
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
