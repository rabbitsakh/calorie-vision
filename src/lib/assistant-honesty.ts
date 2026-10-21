/**
 * Wave A0 — keep assistant copy honest about what was actually written.
 */

export type HonestyTool = {
  ok: boolean;
  tool: string;
  message: string;
};

const CLAIMS_SAVED_RE =
  /добав(ил|ляю|лен|лено|ила)|записал(а|и)?|уже\s+в\s+(рацион|дневник)|сохранил(а|и)?|внесли?\s+в\s+рацион/i;

export function hasPhotoPreviewPending(tools: HonestyTool[] | null | undefined): boolean {
  return Boolean(
    tools?.some((t) => t.ok && t.tool === "recognize_meal_preview"),
  );
}

export function replyClaimsSaved(text: string): boolean {
  return CLAIMS_SAVED_RE.test(text);
}

function sanitizeConfirmPendingReply(
  reply: string,
  opts: { emptyFallback: string; claimedFallback: string; cta: string },
): string {
  const trimmed = reply.trim();
  if (!trimmed) return opts.cta;
  if (!replyClaimsSaved(trimmed)) {
    if (/подтверд|карточк|кнопк|ниже/i.test(trimmed)) return trimmed;
    return `${trimmed}\n\n${opts.cta}`;
  }
  const first = trimmed.split(/\n+/)[0]?.trim() ?? "";
  const safeFirst = CLAIMS_SAVED_RE.test(first) ? opts.claimedFallback : first;
  return `${safeFirst || opts.emptyFallback}\n\n${opts.cta}`;
}

/**
 * If recognition is only a preview, the model must not claim the diary was updated.
 * Replace/append a clear confirm CTA.
 */
export function sanitizePhotoPreviewReply(reply: string): string {
  return sanitizeConfirmPendingReply(reply, {
    emptyFallback: "На фото разобрал блюда.",
    claimedFallback: "На фото разобрал блюда.",
    cta: "Пока только распознал — в рацион ещё не записал. Нажми «Добавить в рацион» на карточке ниже.",
  });
}

/**
 * ActionCard pending: model often says «Добавил…» before the user taps CTA.
 */
export function sanitizePendingWriteReply(reply: string): string {
  return sanitizeConfirmPendingReply(reply, {
    emptyFallback: "Подготовил запись.",
    claimedFallback: "Подготовил запись.",
    cta: "Пока не записал — нажми кнопку подтверждения на карточке ниже.",
  });
}

/** Extra system rules when a photo preview is waiting for confirm. */
export function photoPreviewSystemAppendix(toolSummary: string): string {
  return [
    "=== Уже распознано сервером (ЕЩЁ НЕ В ДНЕВНИКЕ) ===",
    toolSummary,
    "КРИТИЧНО: запись в рацион НЕ сделана. Запрещено писать «добавил», «записал», «уже в рационе».",
    "Перечисли ВСЕ позиции с карточки (если их несколько — каждую). Не сокращай до одного блюда.",
    "Скажи, что увидел, и попроси нажать «Добавить в рацион» на карточке ниже.",
    "Не создавай cv-actions с meals по этому фото — пользователь подтвердит карточкой.",
  ].join("\n");
}
