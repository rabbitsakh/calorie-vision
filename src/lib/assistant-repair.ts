/**
 * When the model claims to write but omits cv-actions, recover structured writes.
 */

import { completeChat } from "@/lib/ai/gigachat";
import {
  normalizeAssistantActions,
  type AssistantActions,
} from "@/lib/admin-assistant";
import { userWantsWrite, userWantsStartWorkout } from "@/lib/assistant-intent";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";

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

/** Parse мл/л / граммы from free-form Russian. `\b` is ASCII-only — use (?=$|\s|[^\p{L}\p{N}]). */
export function parsePortionGramsFromMessage(message: string): number | null {
  const text = message.trim().toLowerCase().replace(/ё/g, "е");
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  const liter = new RegExp(
    String.raw`(\d+(?:[.,]\d+)?)\s*(?:литр(?:а|ов|ы)?|л)${end}`,
    "iu",
  ).exec(text);
  if (liter?.[1]) {
    const n = Number(liter[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 20) return Math.round(n * 1000);
  }
  const ml = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*мл${end}`, "iu").exec(text);
  if (ml?.[1]) {
    const n = Number(ml[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 20000) return Math.round(n);
  }
  const grams = new RegExp(
    String.raw`(\d+(?:[.,]\d+)?)\s*(?:грамм(?:а|ов)?|гр|г)${end}`,
    "iu",
  ).exec(text);
  if (grams?.[1]) {
    const n = Number(grams[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n <= 20000) return Math.round(n);
  }
  return null;
}

/** Map genitive / colloquial drink phrases to a table-friendly query. */
function drinkLookupQuery(message: string): string | null {
  const n = message.toLowerCase().replace(/ё/g, "е");
  if (/пив/.test(n)) {
    return /т[еe]мн/.test(n) ? "пиво тёмное" : "пиво светлое";
  }
  if (/вин(?!оград)/.test(n)) {
    if (/игрист|шампан|просекк/.test(n)) return "вино игристое";
    return "вино";
  }
  if (/водк/.test(n)) return "водка";
  if (/коньяк/.test(n)) return "коньяк";
  if (/сидр/.test(n)) return "сидр";
  if (/виски|whisky|whiskey/.test(n)) return "виски";
  return null;
}

/**
 * Offline repair for clear drink/food write intents (beer liters, etc.)
 * when the model moralizes without cv-actions.
 */
export function heuristicRepairWriteActions(userMessage: string): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  const drinkQ = drinkLookupQuery(userMessage);
  const cleaned = userMessage
    .replace(/^\s*я\s+(съел|выпил|поел)\s+/i, "")
    .replace(/\d+(?:[.,]\d+)?\s*(?:л|литр(?:а|ов|ы)?|мл|г|гр|грамм(?:а|ов)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pack =
    (drinkQ ? lookupRuNutritionTable(drinkQ) : null) ??
    lookupRuNutritionTable(cleaned) ??
    lookupRuNutritionTable(userMessage);
  if (!pack) return null;

  const baseGrams = pack.portionGrams > 0 ? pack.portionGrams : 100;
  const portion = parsePortionGramsFromMessage(userMessage) ?? baseGrams;
  const scale = portion / baseGrams;
  const num = (v?: number) =>
    v == null || !Number.isFinite(v) ? undefined : Math.round(v * scale * 10) / 10;
  const unit = drinkQ || /мл|литр|\bл\b/i.test(userMessage) ? "мл" : "г";
  const name =
    portion !== baseGrams ? `${pack.dishName} (${portion} ${unit})` : pack.dishName;

  return {
    apply: true,
    targetDate: "сегодня",
    meals: [
      {
        name: name.slice(0, 120),
        kcal: Math.round(pack.calories * scale),
        protein: num(pack.protein),
        fat: num(pack.fat),
        carbs: num(pack.carbs),
        note: "перекус",
      },
    ],
    summary: `к подтверждению: ${pack.dishName}`,
  };
}

/**
 * Second cheap call: force structured cv-actions from the user request + draft reply.
 * Tries offline heuristic first (drinks/staples), then a small GigaChat extract.
 */
export async function repairAssistantWriteActions(opts: {
  userMessage: string;
  assistantReply: string;
  today: string;
  date: string;
}): Promise<AssistantActions | null> {
  const heuristic = heuristicRepairWriteActions(opts.userMessage);
  if (heuristic) return heuristic;

  const system = [
    "Ты извлекаешь действия записи для Calorie Vision.",
    "Верни ТОЛЬКО один JSON-объект (без markdown и без текста вокруг).",
    'Обязательно: "apply": true если есть что записать.',
    'Поля: meals[{name,kcal,protein,fat,carbs,note}], shopping[], workoutDays[{day,focus,notes}], waterMl, weightKg, startWorkout, targetDate, summary.',
    "meals.note = завтрак|обед|ужин|перекус если понятно, иначе перекус.",
    "kcal оцени реалистично, если пользователь не указал.",
    "Алкоголь/напитки тоже пиши в meals (пиво, вино…): 1 мл ≈ 1 г; 3 литра пива ≈ 3000 г, ~900–1300 ккал.",
    "Даже если в черновике только совет «не пей» — всё равно собери meals из запроса пользователя.",
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
