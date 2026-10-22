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
  checkAssistantChatLimit,
  rateLimitResponse,
} from "@/lib/assistant-rate-limit";
import {
  actionsHaveWritablePayload,
  assistantWroteFlag,
  assistantWriteMissNote,
  needsWriteRepair,
  preferMultiDishActions,
  repairAssistantWriteActions,
} from "@/lib/assistant-repair";
import {
  hasPhotoPreviewPending,
  photoPreviewSystemAppendix,
  sanitizePendingWriteReply,
  sanitizePhotoPreviewReply,
} from "@/lib/assistant-honesty";
import { enrichAssistantActionsMealMeta } from "@/lib/assistant-meal-time";
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
export const maxDuration = 120;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** POST — SSE token stream, then auto-write tools + final reply. */
export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const rate = await checkAssistantChatLimit(session!.user.id);
  if (!rate.allowed) {
    const body = rateLimitResponse(rate.retryAfterSec);
    return new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rate.retryAfterSec),
      },
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
    return new Response(JSON.stringify({ error: "Некорректный JSON" }), { status: 400 });
  }

  const messages = parseAssistantMessages(body.messages);
  if (!messages) {
    return new Response(
      JSON.stringify({
        error:
          "Чат слишком длинный или сообщение не дошло. Отправь ещё раз — возьму только последние реплики.",
      }),
      { status: 400 },
    );
  }
  const mode = parseAssistantMode(body.mode);

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { timezone: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const date = requireDateKey(typeof body.date === "string" ? body.date : null) ?? today;
  const pack = await loadAdminAssistantContextPack(session!.user.id, date, today);
  const lastUser = messages[messages.length - 1]?.content ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      const toolResults: AssistantToolResult[] = [];
      try {
        send("meta", { date, mode, snapshot: pack.snapshot, prefs: pack.prefs });

        const imageRaw =
          typeof body.imageBase64 === "string" && body.imageBase64.trim()
            ? body.imageBase64
            : null;
        const image = decodeImageBase64(body.imageBase64, body.imageMime);
        if (imageRaw && !image) {
          const bad: AssistantToolResult = {
            ok: false,
            tool: "recognize_meal_preview",
            message:
              "Фото не удалось прочитать (слишком большое или битое). Попробуй ещё раз — мы сжимаем его перед отправкой.",
          };
          toolResults.push(bad);
          send("tool", bad);
        } else if (image) {
          const savePhoto =
            body.savePhoto === true ||
            (body.savePhoto !== false && userWantsWrite(lastUser));
          send(
            "status",
            {
              text: savePhoto
                ? "Распознаю фото и добавляю в рацион…"
                : "Смотрю фото — сейчас покажу карточку…",
            },
          );
          // Keep proxies from buffering the whole recognition wait.
          controller.enqueue(encoder.encode(": ping\n\n"));
          let tick = 0;
          const heartbeat = setInterval(() => {
            tick += 1;
            send("status", {
              text:
                tick % 2 === 0
                  ? "Ещё распознаю фото…"
                  : "Смотрю состав и калории…",
            });
            controller.enqueue(encoder.encode(": ping\n\n"));
          }, 4000);
          let photoResult: AssistantToolResult;
          try {
            photoResult = await toolRecognizeAndSaveMeal({
              userId: session!.user.id,
              date,
              buffer: image.buffer,
              filename: image.filename,
              mimeType: image.mimeType,
              save: savePhoto,
            });
          } finally {
            clearInterval(heartbeat);
          }
          toolResults.push(photoResult);
          send("tool", photoResult);
          send(
            "status",
            {
              text: photoResult.ok
                ? savePhoto
                  ? "Записал. Дописываю ответ…"
                  : "Готово — подтверди карточку ниже…"
                : "Не разобрал фото. Дописываю ответ…",
            },
          );
        }

        let system = buildAssistantSystemPrompt(pack.text, mode, pack.prefsBlock);
        const previewPending = hasPhotoPreviewPending(toolResults);
        if (toolResults.length) {
          system += previewPending
            ? `\n\n${photoPreviewSystemAppendix(formatToolResultsForReply(toolResults))}`
            : `\n\n=== Уже выполнено / распознано сервером ===\n${formatToolResultsForReply(toolResults)}\nУчти это; не дублируй запись тех же блюд.`;
        }

        let raw = "";
        for await (const piece of streamCompleteChat(
          [{ role: "system", content: system }, ...messages],
          0.5,
        )) {
          raw += piece;
          send("token", { text: piece });
        }

        const split = splitAssistantReply(raw.trim());
        let reply = split.reply;
        let actions = split.actions;

        // Photo confirm owns the meal write — don't let the LLM auto-apply the same plate.
        if (previewPending && actions?.meals?.length) {
          const { meals: _drop, ...rest } = actions;
          actions = rest;
        }

        if (!previewPending && needsWriteRepair(lastUser, actions)) {
          send("status", { text: "Уточняю запись в дневник…" });
          const repaired = await repairAssistantWriteActions({
            userMessage: lastUser,
            assistantReply: reply,
            today,
            date,
          });
          if (repaired) actions = repaired;
        }

        if (!previewPending) {
          actions = preferMultiDishActions(lastUser, reply, actions);
        }

        if (
          !previewPending &&
          (actions?.meals?.length || actions?.patchMeals?.length)
        ) {
          actions = enrichAssistantActionsMealMeta(actions, lastUser);
        }

        // Pin absolute day on actions so ActionCard / apply don't fall back to UI "сегодня".
        if (actions?.targetDate) {
          const pinned = resolveAssistantDate(actions.targetDate, today);
          if (pinned) actions = { ...actions, targetDate: pinned };
        }

        const targetDate =
          resolveAssistantDate((actions as ExecutableActions | null)?.targetDate, today) ?? date;

        if (
          actions &&
          (actions.meals?.length ||
            actions.deleteMeals?.length ||
            actions.patchMeals?.length ||
            actions.workoutDays?.length ||
            actions.shopping?.length ||
            actions.waterMl != null ||
            actions.weightKg != null ||
            actions.startWorkout)
        ) {
          // Confirm-gate: nothing is written until ActionCard CTA.
          send("status", { text: "Готовлю подтверждение…" });
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

        const wroteOk = writeResults.some((r) => r.ok);
        const awaitingWeightConfirm = writeResults.some(
          (r) =>
            r.tool === "log_weight" &&
            !r.ok &&
            Boolean(
              r.data &&
                typeof r.data === "object" &&
                (r.data as { needsConfirm?: unknown }).needsConfirm,
            ),
        );
        if (previewPending) {
          reply = sanitizePhotoPreviewReply(reply);
        } else if (actionsHaveWritablePayload(actions) && !wroteOk) {
          reply = sanitizePendingWriteReply(reply);
        }
        const toolNote = formatToolResultsForReply(writeResults);
        // Confirm-gate: writable actions go to ActionCard — not a write miss.
        const missNote = assistantWriteMissNote({
          wroteOk,
          awaitingConfirm: awaitingWeightConfirm,
          previewPending,
          actions,
          userMessage: lastUser,
        });
        const finalReply =
          [reply, toolNote, missNote].filter(Boolean).join("\n\n").trim() || reply;
        const undo = collectUndoFromTools(toolResults);
        const wrote = assistantWroteFlag({
          wroteOk,
          actions,
          userMessage: lastUser,
        });

        send("done", {
          reply: finalReply,
          actions,
          tools: toolResults,
          undo,
          wrote,
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
            undo: collectUndoFromTools(toolResults),
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
      // nginx: flush SSE instead of buffering until recognition finishes
      "X-Accel-Buffering": "no",
    },
  });
}
