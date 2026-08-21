import { NextResponse } from "next/server";
import { isTelegramLoginConfigured } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

/**
 * Client-facing flags for which login methods are actually configured.
 * Avoids showing Email/SMS when SMTP / sms.ru are missing on the server.
 */
export async function GET() {
  return NextResponse.json({
    email: Boolean(process.env.EMAIL_SERVER),
    phone: Boolean(process.env.SMS_RU_API_ID) || process.env.ALLOW_DEV_PHONE_LOGIN === "1",
    telegram: isTelegramLoginConfigured(),
    telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    vk: Boolean(process.env.VK_CLIENT_ID),
  });
}
