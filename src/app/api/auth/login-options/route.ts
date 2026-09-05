import { NextResponse } from "next/server";
import { isEmailLoginConfigured } from "@/lib/email-auth";
import { getTelegramBotUsername } from "@/lib/telegram-login-config";
import { isTelegramLoginConfigured } from "@/lib/telegram-auth";
import { isTelegramOidcConfigured } from "@/lib/telegram-oidc";

export const dynamic = "force-dynamic";

/**
 * Client-facing flags for which login methods are actually configured.
 */
export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const botId = botToken.includes(":") ? botToken.slice(0, botToken.indexOf(":")) : "";

  let telegramOrigin: string | null = null;
  const siteUrl = process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (siteUrl) {
    try {
      telegramOrigin = new URL(siteUrl).origin.replace("://www.", "://");
    } catch {
      telegramOrigin = null;
    }
  }

  return NextResponse.json({
    email: isEmailLoginConfigured(),
    telegram: isTelegramLoginConfigured(),
    telegramBotUsername: isTelegramLoginConfigured() ? getTelegramBotUsername() : null,
    telegramBotId: botId || null,
    telegramOrigin,
    /** OIDC + phone scope (needs TELEGRAM_CLIENT_SECRET from BotFather Login Widget). */
    telegramOidc: isTelegramOidcConfigured(),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    vk: Boolean(process.env.VK_CLIENT_ID),
  });
}
