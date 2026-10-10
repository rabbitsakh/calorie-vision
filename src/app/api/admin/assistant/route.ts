import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import { requireDateKey, toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildAssistantSystemPrompt,
  parseAssistantMessages,
} from "@/lib/admin-assistant";
import { loadAdminAssistantContext } from "@/lib/admin-assistant-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { messages: [{role,content}], date?: YYYY-MM-DD }
 * Admin-only personal coach with ration + workout context.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
      date?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    const messages = parseAssistantMessages(body.messages);
    if (!messages) {
      return NextResponse.json(
        { error: "Нужен массив messages (последнее — от user)" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { timezone: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    const date = requireDateKey(typeof body.date === "string" ? body.date : null) ?? today;

    const contextBlock = await loadAdminAssistantContext(session!.user.id, date, today);
    const system = buildAssistantSystemPrompt(contextBlock);

    let reply: string;
    try {
      reply = await completeChat(
        [{ role: "system", content: system }, ...messages],
        0.4,
        { retries: 2 },
      );
    } catch (error) {
      console.error("admin assistant gigachat", error);
      return NextResponse.json(
        { error: "Ассистент сейчас недоступен. Попробуйте чуть позже." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply: reply.trim(),
      date,
      source: "gigachat" as const,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось ответить" }, { status: 500 });
  }
}
