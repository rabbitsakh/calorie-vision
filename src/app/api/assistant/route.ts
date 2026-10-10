import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import { requireDateKey, toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildAssistantSystemPrompt,
  parseAssistantMessages,
  parseAssistantMode,
  splitAssistantReply,
} from "@/lib/admin-assistant";
import { loadAdminAssistantContextPack } from "@/lib/admin-assistant-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET ?date= — snapshot chips for any signed-in user. */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    const date = requireDateKey(request.nextUrl.searchParams.get("date")) ?? today;
    const pack = await loadAdminAssistantContextPack(session.user.id, date, today);
    return NextResponse.json({
      snapshot: pack.snapshot,
      prefs: pack.prefs,
      today,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить контекст" }, { status: 500 });
  }
}

/** POST { messages, date?, mode? } — non-streaming reply. */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
      date?: unknown;
      mode?: unknown;
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
    const mode = parseAssistantMode(body.mode);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    const date = requireDateKey(typeof body.date === "string" ? body.date : null) ?? today;

    const pack = await loadAdminAssistantContextPack(session.user.id, date, today);
    const system = buildAssistantSystemPrompt(pack.text, mode, pack.prefsBlock);

    let rawReply: string;
    try {
      rawReply = await completeChat(
        [{ role: "system", content: system }, ...messages],
        0.45,
        { retries: 2 },
      );
    } catch (error) {
      console.error("assistant gigachat", error);
      return NextResponse.json(
        { error: "Ассистент сейчас недоступен. Попробуйте чуть позже." },
        { status: 502 },
      );
    }

    const { reply, actions } = splitAssistantReply(rawReply.trim());

    return NextResponse.json({
      reply,
      actions,
      date,
      mode,
      snapshot: pack.snapshot,
      prefs: pack.prefs,
      source: "gigachat" as const,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось ответить" }, { status: 500 });
  }
}
