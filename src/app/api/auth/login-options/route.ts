import { NextResponse } from "next/server";
import { isEmailLoginConfigured } from "@/lib/email-auth";
import { getTelegramBotUsername } from "@/lib/telegram-bot";
import { isTelegramLoginConfigured } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

/**
 * Client-facing flags for which login methods are actually configured.
 */
export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const botId = botToken.includes(":") ? botToken.slice(0, botToken.indexOf(":")) : "";

  return NextResponse.json({
    email: isEmailLoginConfigured(),
    telegram: isTelegramLoginConfigured(),
    telegramBotUsername: isTelegramLoginConfigured() ? getTelegramBotUsername() : null,
    telegramBotId: botId || null,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    vk: Boolean(process.env.VK_CLIENT_ID),
  });
}
