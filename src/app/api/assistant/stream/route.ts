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

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** POST — SSE token stream, then final reply+actions. */
export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    date?: unknown;
    mode?: unknown;
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
  const system = buildAssistantSystemPrompt(pack.text, mode, pack.prefsBlock);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      try {
        send("meta", { date, mode, snapshot: pack.snapshot, prefs: pack.prefs });
        let raw = "";
        for await (const piece of streamCompleteChat(
          [{ role: "system", content: system }, ...messages],
          0.45,
        )) {
          raw += piece;
          send("token", { text: piece });
        }
        const { reply, actions } = splitAssistantReply(raw.trim());
        send("done", {
          reply,
          actions,
          date,
          mode,
          snapshot: pack.snapshot,
          prefs: pack.prefs,
          source: "gigachat",
        });
      } catch (error) {
        console.error("assistant stream", error);
        send("error", { error: "Ассистент сейчас недоступен" });
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
