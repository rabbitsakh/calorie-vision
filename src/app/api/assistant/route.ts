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
        {
          error:
            "Чат слишком длинный или сообщение не дошло. Отправь ещё раз — возьму только последние реплики.",
        },
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

    const imageRaw =
      typeof body.imageBase64 === "string" && body.imageBase64.trim()
        ? body.imageBase64
        : null;
    const image = decodeImageBase64(body.imageBase64, body.imageMime);
    if (imageRaw && !image) {
      toolResults.push({
        ok: false,
        tool: "recognize_meal_preview",
        message:
          "Фото не удалось прочитать (слишком большое или битое). Попробуй ещё раз.",
      });
    } else if (image) {
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
    const previewPending = hasPhotoPreviewPending(toolResults);
    if (toolResults.length) {
      system += previewPending
        ? `\n\n${photoPreviewSystemAppendix(formatToolResultsForReply(toolResults))}`
        : `\n\n=== Уже выполнено / распознано сервером ===\n${formatToolResultsForReply(toolResults)}\nУчти это; не дублируй запись тех же блюд.`;
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
          reply: previewPending
            ? sanitizePhotoPreviewReply(formatToolResultsForReply(toolResults))
            : formatToolResultsForReply(toolResults),
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

    const split = splitAssistantReply(rawReply.trim());
    let reply = split.reply;
    let actions = split.actions;
    if (previewPending && actions?.meals?.length) {
      const { meals: _drop, ...rest } = actions;
      actions = rest;
    }
    if (!previewPending && needsWriteRepair(lastUser, actions)) {
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

    if (actions?.targetDate) {
      const pinned = resolveAssistantDate(actions.targetDate, today);
      if (pinned) actions = { ...actions, targetDate: pinned };
    }

    const writeResults = await executeAssistantWriteTools({
      userId: session.user.id,
      today,
      date: resolveAssistantDate((actions as ExecutableActions | null)?.targetDate, today) ?? date,
      actions: (actions ?? {}) as ExecutableActions,
      lastUserMessage: lastUser,
    });
    toolResults.push(...writeResults);

    const wroteOk = writeResults.some((r) => r.ok);
    if (previewPending) {
      reply = sanitizePhotoPreviewReply(reply);
    } else if (actionsHaveWritablePayload(actions) && !wroteOk) {
      reply = sanitizePendingWriteReply(reply);
    }

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
    const wrote = assistantWroteFlag({
      wroteOk,
      actions,
      userMessage: lastUser,
    });

    return NextResponse.json({
      reply: finalReply,
      actions: actions as AssistantActions | null,
      tools: toolResults,
      undo: collectUndoFromTools(toolResults),
      wrote,
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
