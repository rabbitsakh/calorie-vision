/** Telegram Login Widget config (BotFather bot — not chat bot / webhook). */

export const DEFAULT_TELEGRAM_BOT_USERNAME = "CalorieVisionAppBot";

export function getTelegramBotUsername(): string {
  const name = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  return name || DEFAULT_TELEGRAM_BOT_USERNAME;
}

export function getTelegramBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}
