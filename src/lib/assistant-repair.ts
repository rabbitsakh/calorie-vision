/**
 * When the model claims to write but omits cv-actions, recover structured writes.
 */

import { completeChat } from "@/lib/ai/gigachat";
import {
  normalizeAssistantActions,
  type AssistantActions,
} from "@/lib/admin-assistant";
import { userWantsWrite, userWantsStartWorkout } from "@/lib/assistant-intent";

export function actionsHaveWritablePayload(actions: AssistantActions | null | undefined): boolean {
  if (!actions) return false;
  return Boolean(
    actions.meals?.length ||
      actions.deleteMeals?.length ||
      actions.patchMeals?.length ||
      actions.workoutDays?.length ||
      actions.shopping?.length ||
      actions.waterMl != null ||
      actions.weightKg != null ||
      actions.startWorkout,
  );
}

export function needsWriteRepair(
  userMessage: string,
  actions: AssistantActions | null | undefined,
): boolean {
  if (!userWantsWrite(userMessage) && !userWantsStartWorkout(userMessage)) return false;
  return !actionsHaveWritablePayload(actions);
}

/**
 * After confirm-gate (J–N), stream never silent-writes. Distinguish:
 * - wrote true → tools already applied
 * - wrote null → ActionCard pending (not a miss)
 * - wrote false → user asked to write, but no actions to confirm
 */
export function assistantWroteFlag(opts: {
  wroteOk: boolean;
  actions: AssistantActions | null | undefined;
  userMessage: string;
}): boolean | null {
  if (opts.wroteOk) return true;
  if (actionsHaveWritablePayload(opts.actions)) return null;
  if (userWantsWrite(opts.userMessage) || userWantsStartWorkout(opts.userMessage)) {
    return false;
  }
  return null;
}

/** Scary miss line only when there is nothing for the ActionCard to confirm. */
export function assistantWriteMissNote(opts: {
  wroteOk: boolean;
  awaitingConfirm?: boolean;
  previewPending?: boolean;
  actions: AssistantActions | null | undefined;
  userMessage: string;
}): string {
  if (opts.previewPending || opts.wroteOk || opts.awaitingConfirm) return "";
  if (actionsHaveWritablePayload(opts.actions)) return "";
  if (!needsWriteRepair(opts.userMessage, null)) return "";
  return "⚠ Не удалось подготовить запись. Нажми «Повторить запись» или добавь через «+».";
}

/** Pull JSON object from free-form model output. */
export function extractActionsJson(raw: string): AssistantActions | null {
  const text = raw.trim();
  if (!text) return null;

  const fenced =
    /```(?:cv-actions|json)?\s*([\s\S]*?)```/i.exec(text) ??
    /```\s*([\s\S]*?)```/i.exec(text);
  const candidates: string[] = [];
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }

  for (const chunk of candidates) {
    try {
      const parsed = JSON.parse(chunk) as unknown;
      const actions = normalizeAssistantActions(parsed);
      if (actionsHaveWritablePayload(actions)) return actions;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Second cheap call: force structured cv-actions from the user request + draft reply.
 */
export async function repairAssistantWriteActions(opts: {
  userMessage: string;
  assistantReply: string;
  today: string;
  date: string;
}): Promise<AssistantActions | null> {
  const system = [
    "Ты извлекаешь действия записи для Calorie Vision.",
    "Верни ТОЛЬКО один JSON-объект (без markdown и без текста вокруг).",
    'Обязательно: "apply": true если есть что записать.',
    'Поля: meals[{name,kcal,protein,fat,carbs,note}], shopping[], workoutDays[{day,focus,notes}], waterMl, weightKg, startWorkout, targetDate, summary.',
    "meals.note = завтрак|обед|ужин|перекус если понятно, иначе перекус.",
    "kcal оцени реалистично, если пользователь не указал.",
    `Сегодня=${opts.today}. Контекст дня=${opts.date}. targetDate обычно «сегодня», если не сказали иначе.`,
    'Если нечего писать: {"apply":false}',
  ].join("\n");

  const user = [
    `Запрос пользователя:\n${opts.userMessage}`,
    "",
    `Черновик ответа ассистента (можешь взять ккал/названия отсюда):\n${opts.assistantReply.slice(0, 2500)}`,
  ].join("\n");

  try {
    const raw = await completeChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      0.15,
      { retries: 1 },
    );
    const actions = extractActionsJson(raw);
    if (!actions) return null;
    return { ...actions, apply: true };
  } catch (error) {
    console.error("assistant write repair", error);
    return null;
  }
}
