import { NextRequest, NextResponse } from "next/server";
import {
  parseTelegramCommand,
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

  const command = parseTelegramCommand(text);

  let reply: string | null = null;
  if (command === "/start" || command === "/help") {
    reply = telegramStartReplyText();
  } else if (command === "/remind") {
    reply = telegramRemindHelpText();
  } else if (text) {
    reply = "Напишите /start — открою рацион, или /remind — про напоминания.";
  }

  if (reply) {
    const sent = await sendTelegramMessage(chatId, reply);
    if (!sent.ok) {
      console.error("[telegram/webhook] sendMessage failed:", sent.error, { chatId, command });
      return NextResponse.json({ ok: false, error: sent.error }, { status: 502 });
    }
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
