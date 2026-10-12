import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { streamCompleteChat } from "@/lib/ai/gigachat";
import { requireDateKey, toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildAssistantSystemPrompt,
  parseAssistantMessages,
  parseAssistantMode,
  splitAssistantReply,
} from "@/lib/admin-assistant";
import { loadAdminAssistantContextPack } from "@/lib/admin-assistant-context";
import {
  decodeImageBase64,
  executeAssistantWriteTools,
  formatToolResultsForReply,
  resolveAssistantDate,
  toolRecognizeAndSaveMeal,
  type AssistantToolResult,
  type ExecutableActions,
} from "@/lib/assistant-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** POST — SSE token stream, then auto-write tools + final reply. */
export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    date?: unknown;
    mode?: unknown;
    imageBase64?: unknown;
    imageMime?: unknown;
  } | null;
  if (!body) {
    return new Response(JSON.stringify({ error: "Некорректный JSON" }), { status: 400 });
  }

  const messages = parseAssistantMessages(body.messages);
  if (!messages) {
    return new Response(JSON.stringify({ error: "Нужен массив messages" }), { status: 400 });
  }
  const mode = parseAssistantMode(body.mode);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { timezone: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const date = requireDateKey(typeof body.date === "string" ? body.date : null) ?? today;
  const pack = await loadAdminAssistantContextPack(session!.user.id, date, today);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      const toolResults: AssistantToolResult[] = [];
      try {
        send("meta", { date, mode, snapshot: pack.snapshot, prefs: pack.prefs });

        const image = decodeImageBase64(body.imageBase64, body.imageMime);
        if (image) {
          send("status", { text: "Распознаю фото и добавляю в рацион…" });
          const photoResult = await toolRecognizeAndSaveMeal({
            userId: session!.user.id,
            date,
            buffer: image.buffer,
            filename: image.filename,
            mimeType: image.mimeType,
          });
          toolResults.push(photoResult);
          send("tool", photoResult);
        }

        let system = buildAssistantSystemPrompt(pack.text, mode, pack.prefsBlock);
        if (toolResults.length) {
          system += `\n\n=== Уже выполнено сервером ===\n${formatToolResultsForReply(toolResults)}\nУчти это в ответе; не дублируй запись тех же блюд.`;
        }

        let raw = "";
        for await (const piece of streamCompleteChat(
          [{ role: "system", content: system }, ...messages],
          0.45,
        )) {
          raw += piece;
          send("token", { text: piece });
        }

        const { reply, actions } = splitAssistantReply(raw.trim());
        const lastUser = messages[messages.length - 1]?.content ?? "";
        const targetDate =
          resolveAssistantDate((actions as ExecutableActions | null)?.targetDate, today) ?? date;

        if (actions && (actions.meals?.length || actions.workoutDays?.length)) {
          send("status", { text: "Записываю в дневник и план…" });
        }

        const writeResults = await executeAssistantWriteTools({
          userId: session!.user.id,
          today,
          date: targetDate,
          actions: (actions ?? {}) as ExecutableActions,
          lastUserMessage: lastUser,
        });
        for (const r of writeResults) {
          toolResults.push(r);
          send("tool", r);
        }

        const toolNote = formatToolResultsForReply(writeResults);
        const finalReply = [reply, toolNote].filter(Boolean).join("\n\n").trim() || reply;

        send("done", {
          reply: finalReply,
          actions,
          tools: toolResults,
          date,
          mode,
          snapshot: pack.snapshot,
          prefs: pack.prefs,
          source: "gigachat",
        });
      } catch (error) {
        console.error("assistant stream", error);
        if (toolResults.some((t) => t.ok)) {
          send("done", {
            reply: formatToolResultsForReply(toolResults),
            actions: null,
            tools: toolResults,
            date,
            mode,
            snapshot: pack.snapshot,
            prefs: pack.prefs,
            source: "tools",
          });
        } else {
          send("error", { error: "Ассистент сейчас недоступен" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
