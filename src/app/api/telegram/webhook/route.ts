import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramMessage,
  telegramRemindHelpText,
  telegramStartReplyText,
  verifyTelegramWebhookSecret,
} from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number; type?: string };
  };
};

/**
 * Soft MVP Telegram webhook.
 * Verifies TELEGRAM_BOT_TOKEN via ?secret=, Authorization Bearer, or
 * X-Telegram-Bot-Api-Secret-Token header.
 *
 * /start → deep link to ration
 * /remind → help text (scheduler TODO in telegram-bot.ts)
 */
export async function POST(request: NextRequest) {
  if (!verifyTelegramWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() ?? "";

  if (chatId == null) {
    return NextResponse.json({ ok: true });
  }

  const command = text.split(/\s+/)[0]?.toLowerCase().split("@")[0] ?? "";

  if (command === "/start" || command === "/help") {
    await sendTelegramMessage(chatId, telegramStartReplyText());
  } else if (command === "/remind") {
    await sendTelegramMessage(chatId, telegramRemindHelpText());
  } else if (text) {
    await sendTelegramMessage(
      chatId,
      "Напишите /start — открою рацион, или /remind — про напоминания.",
    );
  }

  return NextResponse.json({ ok: true });
}

/** Health / webhook probe (still requires secret). */
export async function GET(request: NextRequest) {
  if (!verifyTelegramWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    commands: ["/start", "/remind", "/help"],
  });
}
