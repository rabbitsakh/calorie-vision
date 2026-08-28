/** Client-safe Telegram bot display config (no Node.js built-ins). */

export const DEFAULT_TELEGRAM_BOT_USERNAME = "CalorieVisionAppBot";

export function getTelegramBotUsername(): string {
  const name = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  return name || DEFAULT_TELEGRAM_BOT_USERNAME;
}

export function telegramBotDeepLink(): string {
  return `https://t.me/${getTelegramBotUsername()}`;
}
