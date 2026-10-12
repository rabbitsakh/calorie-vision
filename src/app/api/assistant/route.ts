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
  type AssistantActions,
} from "@/lib/admin-assistant";
import { loadAdminAssistantContextPack } from "@/lib/admin-assistant-context";
import {
  checkAssistantChatLimit,
  rateLimitResponse,
} from "@/lib/assistant-rate-limit";
import {
  collectUndoFromTools,
  decodeImageBase64,
  executeAssistantWriteTools,
  formatToolResultsForReply,
  resolveAssistantDate,
  toolRecognizeAndSaveMeal,
  userWantsWrite,
  type AssistantToolResult,
  type ExecutableActions,
} from "@/lib/assistant-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

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

/** POST { messages, date?, mode?, imageBase64?, imageMime?, savePhoto? } */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const rate = await checkAssistantChatLimit(session.user.id);
    if (!rate.allowed) {
      const body = rateLimitResponse(rate.retryAfterSec);
      return NextResponse.json(body, {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      });
    }

    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
      date?: unknown;
      mode?: unknown;
      imageBase64?: unknown;
      imageMime?: unknown;
      savePhoto?: unknown;
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
    const toolResults: AssistantToolResult[] = [];
    const lastUser = messages[messages.length - 1]?.content ?? "";

    const image = decodeImageBase64(body.imageBase64, body.imageMime);
    if (image) {
      const savePhoto =
        body.savePhoto === true || (body.savePhoto !== false && userWantsWrite(lastUser));
      const photoResult = await toolRecognizeAndSaveMeal({
        userId: session.user.id,
        date,
        buffer: image.buffer,
        filename: image.filename,
        mimeType: image.mimeType,
        save: savePhoto,
      });
      toolResults.push(photoResult);
    }

    let system = buildAssistantSystemPrompt(pack.text, mode, pack.prefsBlock);
    if (toolResults.length) {
      system += `\n\n=== Уже выполнено / распознано сервером ===\n${formatToolResultsForReply(toolResults)}\nУчти это; не дублируй запись тех же блюд.`;
    }

    let rawReply: string;
    try {
      rawReply = await completeChat(
        [{ role: "system", content: system }, ...messages],
        0.5,
        { retries: 2 },
      );
    } catch (error) {
      console.error("assistant gigachat", error);
      if (toolResults.some((t) => t.ok)) {
        return NextResponse.json({
          reply: formatToolResultsForReply(toolResults),
          actions: null,
          tools: toolResults,
          undo: collectUndoFromTools(toolResults),
          date,
          mode,
          snapshot: pack.snapshot,
          prefs: pack.prefs,
          source: "tools" as const,
        });
      }
      return NextResponse.json(
        { error: "Ассистент сейчас недоступен. Попробуйте чуть позже." },
        { status: 502 },
      );
    }

    const { reply, actions } = splitAssistantReply(rawReply.trim());
    const writeResults = await executeAssistantWriteTools({
      userId: session.user.id,
      today,
      date: resolveAssistantDate((actions as ExecutableActions | null)?.targetDate, today) ?? date,
      actions: (actions ?? {}) as ExecutableActions,
      lastUserMessage: lastUser,
    });
    toolResults.push(...writeResults);

    const toolNote = formatToolResultsForReply(writeResults);
    const finalReply = [reply, toolNote].filter(Boolean).join("\n\n").trim() || reply;

    return NextResponse.json({
      reply: finalReply,
      actions: actions as AssistantActions | null,
      tools: toolResults,
      undo: collectUndoFromTools(toolResults),
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
