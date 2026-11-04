/**
 * When the model claims to write but omits cv-actions, recover structured writes.
 */

import { completeChat } from "@/lib/ai/gigachat";
import {
  normalizeAssistantActions,
  sanitizeAssistantMealName,
  type AssistantActions,
} from "@/lib/admin-assistant";

export { sanitizeAssistantMealName };
import {
  userWantsWrite,
  userWantsStartWorkout,
  userWantsStartEmptyWorkout,
  userWantsRepeatWorkout,
  userWantsGymEdit,
} from "@/lib/assistant-intent";
import {
  extractMealSlotMoveFromMessage,
  extractMealTimeFromMessage,
  extractMealTypeFromMessage,
  extractTargetDateFromMessage,
  matchIsMealSlot,
  mealNoteFromTypeKey,
  mealTypeKeyFromLabel,
  MEAL_SLOT_STEM_RE,
  parseMealTimeHHMM,
  parseMealTypeKey,
} from "@/lib/assistant-meal-time";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";
import { dishNameScore, splitQuickPortion } from "@/lib/quick-log";

/** True when a patch would change something (not a bare match-only noop). */
export function patchMealHasEffect(
  patch: NonNullable<AssistantActions["patchMeals"]>[number],
): boolean {
  return Boolean(
    parseMealTimeHHMM(patch.time) ||
      patch.name?.trim() ||
      patch.toMealType ||
      typeof patch.kcal === "number" ||
      typeof patch.protein === "number" ||
      typeof patch.fat === "number" ||
      typeof patch.carbs === "number" ||
      typeof patch.portionGrams === "number",
  );
}

/** Drop patchMeals that only name a dish and change nothing — avoids empty ActionCards. */
export function pruneNoopAssistantActions(
  actions: AssistantActions | null | undefined,
): AssistantActions | null {
  if (!actions) return null;
  if (!actions.patchMeals?.length) return actions;
  const patchMeals = actions.patchMeals.filter(patchMealHasEffect);
  if (patchMeals.length === actions.patchMeals.length) return actions;
  const next = { ...actions };
  if (patchMeals.length) next.patchMeals = patchMeals;
  else delete next.patchMeals;
  return actionsHaveWritablePayload(next) ? next : null;
}

export function actionsHaveWritablePayload(actions: AssistantActions | null | undefined): boolean {
  if (!actions) return false;
  return Boolean(
    actions.meals?.length ||
      actions.deleteMeals?.length ||
      actions.patchMeals?.some(patchMealHasEffect) ||
      actions.workoutDays?.length ||
      actions.shopping?.length ||
      actions.waterMl != null ||
      actions.weightKg != null ||
      actions.startWorkout ||
      actions.repeatWorkout ||
      actions.startEmptyWorkout ||
      Boolean(
        actions.patchWorkout?.addExercises?.length ||
          actions.patchWorkout?.logSets?.length,
      ),
  );
}

/**
 * The draft tells the user to confirm a card («подтверждая ниже», «нажми «В дневник»»).
 * A bare dish name («Мороженое») has no write verb, but the reply still owes a card.
 */
export function replyPromisesWriteCard(reply: string | null | undefined): boolean {
  const t = (reply ?? "").toLowerCase().replace(/ё/g, "е");
  if (!t.trim()) return false;
  if (/подтвер\S*\s+(?:ниже|карточк)/.test(t)) return true;
  if (/(?:нажми|нажмите|жми)\S*\s+[«"]?в\s+(?:дневник|рацион)/.test(t)) return true;
  // «Подтверждайте запись в дневник», «подтверди добавление».
  if (/подтвер\S*\s+(?:\S+\s+){0,2}?(?:запис|добавл|сохран)/.test(t)) return true;
  // Offer as a question: «Запиши чебурек в дневник?», «Добавить в рацион?».
  if (/(?:запис|запиш|добав|сохран)\S*\s+(?:\S+\s+){0,5}?в\s+(?:дневник|рацион)\S*\s*\?/.test(t)) {
    return true;
  }
  return /(?:сохран|добав|запис)\S*\s+(?:\S+\s+){0,4}?в\s+(?:дневник|рацион)/.test(t) &&
    /ниже|карточк/.test(t);
}

/**
 * User typed just a dish («Чебурек с фаршем индейки») and the draft answered with a kcal
 * estimate — that is a log request in this app, so it owes a confirm card.
 */
export function replyEstimatesBareDish(
  userMessage: string,
  assistantReply: string | null | undefined,
): boolean {
  const u = userMessage.trim();
  if (!u || u.length > 120) return false;
  if (/[?？]\s*$/.test(u)) return false;
  if (/^(что|как|сколько|какой|какая|какие|чем|почему|зачем|можно|стоит|посоветуй|подскажи)\b/i.test(u)) {
    return false;
  }
  if (!/[а-яёa-z]{3,}/i.test(u)) return false;
  return extractKcalFromReply(assistantReply) != null;
}

/** First plausible «250 ккал» / «~250 kcal» from the draft (ranges → midpoint). */
export function extractKcalFromReply(reply: string | null | undefined): number | null {
  const t = (reply ?? "").replace(/\u00a0/g, " ");
  const m = /(\d{2,4})(?:\s*[-–—]\s*(\d{2,4}))?\s*(?:ккал|kcal|калори)/i.exec(t);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const kcal = Math.round((a + b) / 2);
  return kcal > 0 && kcal < 5000 ? kcal : null;
}

function macroFromReply(t: string, re: RegExp): number | undefined {
  const m = re.exec(t);
  if (!m) return undefined;
  const v = Number(m[1]!.replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
}

/** Кириллическая «г» не является границей слова `\b` в JS. */
const PORTION_GRAM_END = String.raw`(?=$|\s|[^\p{L}\p{N}])`;

/** Подписи КБЖУ, которые нельзя показывать как название блюда. */
const NUTRIENT_LABELS = new Set([
  "калории",
  "калория",
  "калорийность",
  "калорийности",
  "калорийностью",
  "ккал",
  "kcal",
  "calorie",
  "calories",
  "белки",
  "белок",
  "белка",
  "белков",
  "жиры",
  "жир",
  "жира",
  "жиров",
  "углеводы",
  "углевод",
  "углевода",
  "углеводов",
  "кбжу",
  "бжу",
  "protein",
  "proteins",
  "fat",
  "fats",
  "carb",
  "carbs",
]);

/** «Калории», «Калорийность», «Белки» — не блюдо. «Жирная сметана» остаётся блюдом. */
export function isNutrientLabelName(name: string): boolean {
  let t = name.trim().toLowerCase().replace(/ё/g, "е");
  t = t.replace(/\(\s*\d+(?:[.,]\d+)?\s*(?:мл|грамм(?:а|ов)?|гр|г)\s*\)\s*$/iu, "").trim();
  t = t.replace(/[.:;]+$/u, "").trim();
  return NUTRIENT_LABELS.has(t);
}

function fragmentStartsWithNutrientLabel(fragment: string): boolean {
  const raw = fragment.trim().toLowerCase().replace(/ё/g, "е");
  const head = (raw.split(/[:—–]/)[0] ?? "").trim();
  const first = (head.split(/\s+/)[0] ?? "").replace(/[.:;,]+$/u, "");
  return isNutrientLabelName(first);
}

/** Черновик из пунктов «Калорийность / Белки / Жиры / Углеводы», а не список блюд. */
function replyLooksLikeNutrientBreakdown(reply: string): boolean {
  let labels = 0;
  for (const raw of reply.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim();
    if (line && fragmentStartsWithNutrientLabel(line)) labels += 1;
  }
  return labels >= 2 && /ккал|калори/i.test(reply);
}

/**
 * Название блюда из фразы пользователя: без «я съел / съела / запиши / добавь»
 * и без «в дневник».
 */
export function dishNameFromUserLog(userMessage: string): string {
  let s = userMessage.replace(/\u00a0/g, " ").trim();
  const filler =
    /^\s*(?:я\s+)?(?:съел|съела|выпил|выпила|поел|поела|добав\S*|закинь|запиш\S*|кинь|положи|внеси|сохран\S*)\s+/iu;
  for (let i = 0; i < 4; i += 1) {
    const next = s
      .replace(filler, "")
      .replace(/\s+в\s+(?:дневник|рацион)\S*/giu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (next === s) break;
    s = next;
  }
  const name = sanitizeAssistantMealName(s).slice(0, 120);
  if (!name || name.length < 2 || isNutrientLabelName(name)) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const MACRO_VALUE = String.raw`\s*[:—–-]?\s*(?:около|примерно|~)?\s*(\d+(?:[.,]\d+)?)\s*(?:грамм(?:а|ов)?|гр|г)`;

/** «Белки: около 20 г» и «белки 15 г, жиры 15 г, углеводы 20 г». */
function macrosFromReply(reply: string): { protein?: number; fat?: number; carbs?: number } {
  const t = reply.toLowerCase().replace(/ё/g, "е").replace(/\u00a0/g, " ");
  return {
    protein: macroFromReply(t, new RegExp(String.raw`(?:белки|белок|б)${MACRO_VALUE}`, "iu")),
    fat: macroFromReply(t, new RegExp(String.raw`(?:жиры|жир|ж)${MACRO_VALUE}`, "iu")),
    carbs: macroFromReply(t, new RegExp(String.raw`(?:углеводы|углевод|у)${MACRO_VALUE}`, "iu")),
  };
}

/** Убрать БЖУ, чтобы «около 20 г» после «Белки:» не стало порцией блюда. */
function withoutMacroAmounts(text: string): string {
  return text
    .replace(
      new RegExp(String.raw`(?:белки|белок|жиры|жир|углеводы|углевод|протеин)${MACRO_VALUE}`, "giu"),
      " ",
    )
    .replace(
      new RegExp(
        String.raw`(?:^|[\s,(])[бжfуu]\s*[:—–-]?\s*(?:около|примерно|~)?\s*\d+(?:[.,]\d+)?\s*(?:грамм(?:а|ов)?|гр|г)`,
        "giu",
      ),
      " ",
    );
}

/**
 * Порция из черновика: «Чебурек (100 г)» или «порция около 180 г».
 * «(Б 12 г)» не подходит: после скобки не число.
 */
function portionGramsFromReply(reply: string): number | undefined {
  const t = reply.toLowerCase().replace(/ё/g, "е").replace(/\u00a0/g, " ");
  const scoped = withoutMacroAmounts(t);
  // «(3 шт. ≈ 150 г)», «(≈ 30 г)», «порция около 180 г» — последняя названная порция.
  const marked = new RegExp(
    String.raw`(?:≈|~|∼|около|примерно)\s*(\d{1,4}(?:[.,]\d+)?)\s*(?:грамм(?:а|ов)?|гр|г)${PORTION_GRAM_END}`,
    "giu",
  );
  let last: number | undefined;
  let hit: RegExpExecArray | null;
  while ((hit = marked.exec(scoped))) {
    const n = Number(hit[1]!.replace(",", "."));
    if (n >= 1 && n <= 5000) last = Math.round(n);
  }
  if (last != null) return last;
  const paren = /\((\d{1,4}(?:[.,]\d+)?)\s*(?:грамм(?:а|ов)?|гр|г)\)/iu.exec(scoped);
  if (paren?.[1]) {
    const n = Number(paren[1].replace(",", "."));
    if (n >= 1 && n <= 5000) return Math.round(n);
  }
  const hinted = new RegExp(
    String.raw`(?:порци\S*|вес\S*)\s*(\d{2,4})\s*(?:грамм(?:а|ов)?|гр|г)${PORTION_GRAM_END}`,
    "iu",
  ).exec(scoped);
  if (!hinted?.[1]) return undefined;
  const n = Number(hinted[1]);
  return n >= 1 && n <= 5000 ? n : undefined;
}

/**
 * Last-resort offline card: dish name from the user's text, kcal/БЖУ/grams from prose draft.
 * Keeps «примерно 250 ккал… подтверждайте запись» from ending as text with no button.
 */
export function heuristicRepairFromProseKcal(
  userMessage: string,
  assistantReply: string,
): AssistantActions | null {
  const kcal = extractKcalFromReply(assistantReply);
  if (kcal == null) return null;
  const name = dishNameFromUserLog(userMessage);
  if (!name) return null;
  const { protein, fat, carbs } = macrosFromReply(assistantReply);
  const grams =
    parsePortionGramsFromMessage(userMessage) ?? portionGramsFromReply(assistantReply);
  const { note, targetDate } = mealMetaFromMessage(userMessage, assistantReply);
  return {
    apply: true,
    targetDate,
    meals: [
      {
        // Одна скобка «(100 г)»: карточка выносит граммы в отдельное поле.
        name:
          grams && parsePortionGramsFromMessage(name) == null ? `${name} (${grams} г)` : name,
        kcal,
        protein,
        fat,
        carbs,
        note,
      },
    ],
    summary: `к подтверждению: ${name}`,
  };
}

/** Message the offline repairers can gate on when only the reply carries the write intent. */
function repairIntentMessage(userMessage: string, assistantReply?: string): string {
  if (userWantsWrite(userMessage)) return userMessage;
  if (!replyPromisesWriteCard(assistantReply) && !replyEstimatesBareDish(userMessage, assistantReply)) {
    return userMessage;
  }
  return `запиши ${userMessage}`;
}

export function needsWriteRepair(
  userMessage: string,
  actions: AssistantActions | null | undefined,
  assistantReply?: string,
): boolean {
  if (replyPromisesWriteCard(assistantReply)) return !actionsHaveWritablePayload(actions);
  if (replyEstimatesBareDish(userMessage, assistantReply)) {
    return !actionsHaveWritablePayload(actions);
  }
  if (
    !userWantsWrite(userMessage) &&
    !userWantsStartWorkout(userMessage) &&
    !userWantsRepeatWorkout(userMessage) &&
    !userWantsGymEdit(userMessage)
  ) {
    return false;
  }
  return !actionsHaveWritablePayload(actions);
}

/** Offline: «повтори вчерашний зал» / «повтори последнюю тренировку». */
export function heuristicRepairRepeatWorkoutActions(
  userMessage: string,
): AssistantActions | null {
  if (!userWantsRepeatWorkout(userMessage)) return null;
  const text = userMessage.trim().toLowerCase().replace(/ё/g, "е");
  // Explicit «на сегодня/вчера» wins; «вчерашний зал» alone → clone onto сегодня.
  const onDay = /(?:на|к)\s+(сегодня|вчера|завтра|позавчера)/i.exec(text);
  let targetDate = "сегодня";
  if (onDay?.[1]) {
    targetDate = onDay[1];
  } else if (!/вчерашн|прошл/i.test(text)) {
    targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";
  }
  return {
    apply: true,
    targetDate,
    repeatWorkout: true,
    summary: `повторить последнюю → ${targetDate} — подтверди`,
  };
}

/** Offline: «начни тренировку» / «начни пустую». */
export function heuristicRepairStartWorkoutActions(
  userMessage: string,
): AssistantActions | null {
  const empty = userWantsStartEmptyWorkout(userMessage);
  const start = userWantsStartWorkout(userMessage);
  if (!empty && !start) return null;
  const targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";
  if (empty) {
    return {
      apply: true,
      targetDate,
      startEmptyWorkout: true,
      summary: "начать пустую тренировку — подтверди",
    };
  }
  return {
    apply: true,
    targetDate,
    startWorkout: true,
    summary: "начать тренировку — подтверди",
  };
}

/** Offline: «добавь жим», «поставь 80×8 на жим», «добавь подход на жим 80×8». */
export function heuristicRepairPatchWorkoutActions(
  userMessage: string,
): AssistantActions | null {
  if (!userWantsGymEdit(userMessage)) return null;
  const text = userMessage.trim();
  const targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";

  const setMatch =
    /(\d+[.,]?\d*)\s*(?:кг|kg)?\s*[xх×*]\s*(\d+)/i.exec(text) ??
    /(\d+[.,]?\d*)\s*(?:на|по)\s*(\d+)/i.exec(text);
  const weightKg = setMatch
    ? Number(String(setMatch[1]).replace(",", "."))
    : undefined;
  const reps = setMatch ? Math.round(Number(setMatch[2])) : undefined;

  const mentionsSet = /подход/i.test(text);
  const nameMatch =
    /(?:добав\S*|запиш\S*|поставь\S*)\s+(?:подход\S*\s+(?:на\s+|по\s+)?)?(?:упражнение\s+)?([а-яёa-z0-9][а-яёa-z0-9\s-]{1,40}?)(?:\s+\d|\s*$|,|\.|!)/i.exec(
      text,
    ) ??
    /(?:на|в)\s+([а-яёa-z][а-яёa-z\s-]{1,30}?)(?:\s*$|,|\.|!)/i.exec(text);
  let name = nameMatch?.[1]?.trim() ?? "";
  name = name
    .replace(/\b\d+[.,]?\d*\s*(кг|kg|x|х|×)?\b/gi, "")
    .replace(/^(?:подход\S*|подхода\S*|подходов)\s+/i, "")
    .replace(/\s+(?:подход\S*|подхода\S*|подходов)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || /^подход/i.test(name)) {
    // Fallback short exercise nouns (incl. accusative).
    const noun =
      /(жим(?:\s+л[её]жа)?|тяг[уиа](?:\s+\S+)?|присед(?:ания)?|разводк\S*|подтягиван\S*)/i.exec(
        text,
      );
    name = noun?.[1]?.trim() ?? "";
  }
  if (!name || /^подход/i.test(name)) return null;

  // «Добавь подход…» → logSets; «добавь жим» → addExercises; «поставь 80×8» → logSets.
  const hasAddExercise =
    (/добав/i.test(text) || /запиш\S*\s+упражн|новое\s+упражн/i.test(text)) &&
    !mentionsSet;
  if (hasAddExercise || (!setMatch && !mentionsSet)) {
    return {
      apply: true,
      targetDate,
      patchWorkout: {
        addExercises: [
          {
            name: name.slice(0, 120),
            ...(weightKg != null && Number.isFinite(weightKg) && reps != null
              ? { sets: [{ weightKg, reps }] }
              : {}),
          },
        ],
      },
      summary: `добавить «${name}» — подтверди`,
    };
  }
  return {
    apply: true,
    targetDate,
    patchWorkout: {
      logSets: [
        {
          match: name.slice(0, 120),
          ...(weightKg != null && Number.isFinite(weightKg) ? { weightKg } : {}),
          ...(reps != null && Number.isFinite(reps) ? { reps } : {}),
        },
      ],
    },
    summary: `подход ${name} — подтверди`,
  };
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
  if (
    userWantsWrite(opts.userMessage) ||
    userWantsStartWorkout(opts.userMessage) ||
    userWantsStartEmptyWorkout(opts.userMessage) ||
    userWantsRepeatWorkout(opts.userMessage) ||
    userWantsGymEdit(opts.userMessage)
  ) {
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
  assistantReply?: string;
}): string {
  if (opts.previewPending || opts.wroteOk || opts.awaitingConfirm) return "";
  if (actionsHaveWritablePayload(opts.actions)) return "";
  if (!needsWriteRepair(opts.userMessage, null, opts.assistantReply)) return "";
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

/** Solid-food cues — when present with a drink, do not collapse to drink-only. */
const FOODISH_RE =
  /пюре|картош|картофел|котлет|рис\b|гречк|макарон|паста|омлет|яиц|яйц|курин|мясо|салат|суп\b|борщ|хлеб|сыр\b|творог|рыба|рыбн|стейк|сосиск|колбас|пельмен|вареник|блины|каша|овсян|творож|фарш|индейк|говядин|свинин|лосос|треск/i;

/** True when the message clearly lists several dishes (not a single drink). */
export function messageLooksLikeMultiDish(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const bullets = text.match(/^\s*[-•*]\s+\S+/gm) ?? [];
  if (bullets.length >= 2) return true;
  const numbered = text.match(/^\s*\d+[.)]\s+\S+/gm) ?? [];
  if (numbered.length >= 2) return true;
  const drink = drinkLookupQuery(text);
  if (drink && FOODISH_RE.test(text)) return true;
  // Inline: «Вчерашний ужин: пюре, котлета, пиво» / «на ужин пюре и котлета».
  if (parseInlineMealsFromText(text).length >= 2) return true;
  // Plain draft rows with kcal (no «-» bullets).
  if (parsePlainMacroLines(text).length >= 2) return true;
  return false;
}

type ParsedMealLine = NonNullable<AssistantActions["meals"]>[number];

/** Drop tool-echo / false «✓ В рацион…» lines that poison comma-split repair. */
export function stripAssistantToolNoise(text: string): string {
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  const toolLine = new RegExp(String.raw`^[✓✗✔✖]\s*В\s+рацион${end}`, "iu");
  const dated = /^В\s+рацион\s+\d{4}-\d{2}-\d{2}\s*:/iu;
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (toolLine.test(t)) return false;
      if (dated.test(t)) return false;
      return true;
    })
    .join("\n");
}

function mealNameLooksPolluted(name: string): boolean {
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  return new RegExp(
    String.raw`В\s+рацион${end}|^\s*(?:белки|жиры|углеводы)${end}|^[✓✗✔✖]`,
    "iu",
  ).test(name.trim());
}

function parseMacroRaw(v?: string): number | undefined {
  if (!v) return undefined;
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : undefined;
}

/**
 * Trailing «~450 ккал, Б24 Ж15 У50» / «белки 24 г, жиры 15 г, углеводы 50 г».
 * Also accepts «(3 шт.): ~450 ккал…» without a paren wrapping the kcal block.
 * Note: `\w` is ASCII-only — use `\p{L}` for Cyrillic stems.
 */
/** «(учтено полностью)» в конце строки не должно срывать разбор «100 ккал, белки 5 г». */
function withoutTrailingAside(fragment: string): string {
  return fragment.replace(/\s*\([^0-9)]*\)\s*$/u, "").trim();
}

function extractTrailingMacros(fragment: string): {
  kcal: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  head: string;
} | null {
  const rest = withoutTrailingAside(fragment.trim());
  if (!rest) return null;

  const gram = String.raw`(?:г|гр|грамм(?:а|ов)?|g)?`;
  // Full words first — avoid `[с]` matching the start of «с креветками».
  const approx = String.raw`(?:около|примерно|~)?\s*`;
  const kcalWord = String.raw`(?:ккал|kcal)`;
  const full = new RegExp(
    String.raw`(?::\s*)?${approx}(\d+(?:[.,]\d+)?)\s*${kcalWord}\s*[,;]?\s*(?:(?:белк\p{L}*|protein)\s*[:—–-]?\s*(?:около|примерно|~|about)?\s*(\d+(?:[.,]\d+)?)\s*${gram})?\s*[,;]?\s*(?:(?:жир\p{L}*|fat)\s*[:—–-]?\s*(?:около|примерно|~|about)?\s*(\d+(?:[.,]\d+)?)\s*${gram})?\s*[,;]?\s*(?:(?:углевод\p{L}*|carb\p{L}*)\s*[:—–-]?\s*(?:около|примерно|~|about)?\s*(\d+(?:[.,]\d+)?)\s*${gram})?\s*\)?\s*$`,
    "iu",
  ).exec(rest);
  if (full?.[1]) {
    const kcal = Math.round(Number(full[1].replace(",", ".")));
    if (Number.isFinite(kcal) && kcal > 0) {
      return {
        kcal,
        protein: parseMacroRaw(full[2]),
        fat: parseMacroRaw(full[3]),
        carbs: parseMacroRaw(full[4]),
        head: cleanMealHead(rest.slice(0, full.index)),
      };
    }
  }

  // Abbrev Б/Ж/У (not «с» — that ate dish text after «ккал»).
  const abbrev = new RegExp(
    String.raw`[—(]?\s*${approx}(\d+(?:[.,]\d+)?)\s*(?:ккал|kcal)\s*[,;]?\s*(?:[бb]\s*(\d+(?:[.,]\d+)?))?\s*[,;]?\s*(?:[жf]\s*(\d+(?:[.,]\d+)?))?\s*[,;]?\s*(?:[уu]\s*(\d+(?:[.,]\d+)?))?\s*\)?\s*$`,
    "iu",
  ).exec(rest);
  if (abbrev?.[1]) {
    const kcal = Math.round(Number(abbrev[1].replace(",", ".")));
    if (Number.isFinite(kcal) && kcal > 0) {
      return {
        kcal,
        protein: parseMacroRaw(abbrev[2]),
        fat: parseMacroRaw(abbrev[3]),
        carbs: parseMacroRaw(abbrev[4]),
        head: cleanMealHead(rest.slice(0, abbrev.index)),
      };
    }
  }

  return null;
}

const EXCLUSION_REASON_RE =
  /(?:исключ|не\s+(?:стал\s+)?записыва|не\s+включа|не\s+добавля|пропуска|уберу|убрал)/iu;
const EXCLUSION_WHY_RE = /(?:предпочт|диет|не\s+любл|не\s+ем|не\s+хоч|не\s+предлага)/iu;

/**
 * «Желе из ряженки: исключено из-за ваших предпочтений» — блюдо уже съели,
 * модель отказалась его записать. Возвращает имя без причины.
 */
function peelPreferenceExclusion(fragment: string): { name: string } | null {
  const t = fragment.trim();
  const m =
    /^(.{2,80}?)\s*[:—–-]\s*(.+)$/u.exec(t) ??
    /^(.{2,80}?)\s+(исключ\p{L}*.{0,120})$/iu.exec(t);
  if (!m?.[1] || !m[2]) return null;
  const reason = m[2];
  if (!EXCLUSION_REASON_RE.test(reason)) return null;
  if (!EXCLUSION_WHY_RE.test(reason) && !/исключ/iu.test(reason)) return null;
  const name = m[1].replace(/[.:;—–-]+$/u, "").trim();
  if (name.length < 2 || fragmentStartsWithNutrientLabel(name)) return null;
  return { name };
}

/** «Сырники ( ≈ )» после вырезания чисел → «Сырники». */
function tidyDishBase(name: string): string {
  return name
    .replace(/[≈∼~]/g, " ")
    .replace(/\b(?:около|примерно)\b/giu, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Уже съеденное, которое черновик выкинул из-за предпочтений/диеты.
 * Если таблицы нет — скромная оценка, чтобы позиция не пропала с карточки.
 */
function mealFromPreferenceExclusion(
  name: string,
  lineNote?: string,
): ParsedMealLine | null {
  const inner = mealLineFromFragment(name, lineNote);
  if (inner) {
    if (splitQuickPortion(inner.name).grams != null) return inner;
    const pack = lookupRuNutritionTable(name);
    const grams = pack && pack.portionGrams > 0 ? Math.round(pack.portionGrams) : 100;
    const base = splitQuickPortion(inner.name).base;
    return { ...inner, name: `${base} (${grams} г)`.slice(0, 120) };
  }
  const clean = sanitizeAssistantMealName(name).replace(/\s+/g, " ").trim();
  if (!clean || clean.length < 2) return null;
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    name: `${title} (100 г)`.slice(0, 120),
    kcal: 120,
    ...(lineNote ? { note: lineNote } : {}),
  };
}

/** Trim trailing «: около» / dashes left after macro extraction. */
function cleanMealHead(head: string): string {
  return head
    .trim()
    .replace(/\b(?:около|примерно)\s*$/iu, "")
    .replace(/[—\-–:]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip БЖУ gram labels so «углеводы 10 г» is not treated as portion. */
function stripMacroGramLabels(text: string): string {
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  return text
    .replace(
      /(?:белки|жиры|углеводы|протеин)\s*\d+(?:[.,]\d+)?\s*(?:г|гр|грамм(?:а|ов)?)?/giu,
      " ",
    )
    .replace(new RegExp(String.raw`[бbжfуu]\s*\d+(?:[.,]\d+)?${end}`, "giu"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mealLineFromFragment(
  fragment: string,
  lineNote?: string,
  misses?: string[],
): ParsedMealLine | null {
  let rest = fragment.trim();
  if (!rest || rest.length < 2) return null;
  // Уже съеденное не выкидываем, даже если черновик пишет «исключено из-за предпочтений».
  const excluded = peelPreferenceExclusion(rest);
  if (excluded) return mealFromPreferenceExclusion(excluded.name, lineNote);
  // «Калорийность: 300 ккал» / «Белки: около 20 г» — подпись нутриента, не блюдо.
  if (fragmentStartsWithNutrientLabel(rest)) return null;

  let kcal: number | undefined;
  let protein: number | undefined;
  let fat: number | undefined;
  let carbs: number | undefined;

  const macros = extractTrailingMacros(rest);
  if (macros) {
    kcal = macros.kcal;
    protein = macros.protein;
    fat = macros.fat;
    carbs = macros.carbs;
    rest = macros.head;
  } else {
    // «100 ккал … (учтено полностью)» — цифры из текста, не оценка из таблицы.
    const looseKcal = extractKcalFromReply(rest);
    if (looseKcal != null) {
      const stated = macrosFromReply(rest);
      kcal = looseKcal;
      protein = stated.protein;
      fat = stated.fat;
      carbs = stated.carbs;
      rest = cleanMealHead(
        rest.replace(/(?::\s*)?(?:примерно|около|~|≈|about)?\s*\d+\s*(?:ккал|kcal)[\s\S]*$/iu, ""),
      );
    }
  }

  if (!rest || rest.length < 2) return null;

  const forPortion = stripMacroGramLabels(rest);
  const portion = parsePortionGramsFromMessage(forPortion);
  const pieces = parsePieceCountFromMessage(forPortion);
  const drinkQ = drinkLookupQuery(rest);
  const cleaned = sanitizeAssistantMealName(
    forPortion
      .replace(/\d+(?:[.,]\d+)?\s*(?:л|литр(?:а|ов|ы)?|мл|грамм(?:а|ов)?|гр|г|шт(?:ук[аи]?)?\.?)/gi, " ")
      .replace(/\(\s*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const pack =
    (drinkQ ? lookupRuNutritionTable(drinkQ) : null) ??
    lookupRuNutritionTable(cleaned) ??
    lookupRuNutritionTable(sanitizeAssistantMealName(rest));

  if (kcal == null && pack) {
    const baseGrams = pack.portionGrams > 0 ? pack.portionGrams : 100;
    let scale: number;
    if (portion != null && portion > 0) {
      scale = portion / baseGrams;
    } else if (pieces != null && pieces > 0 && packLooksPerPiece(pack.dishName)) {
      scale = pieces;
    } else {
      scale = 1;
    }
    kcal = Math.round(pack.calories * scale);
    protein =
      pack.protein == null ? undefined : Math.round(pack.protein * scale * 10) / 10;
    fat = pack.fat == null ? undefined : Math.round(pack.fat * scale * 10) / 10;
    carbs = pack.carbs == null ? undefined : Math.round(pack.carbs * scale * 10) / 10;
  }

  const unit = drinkQ || /мл|литр|\bл\b/i.test(rest) ? "мл" : "г";
  // Prefer the user's dish wording when kcal came from the draft — pack names
  // like «Макароны» must not replace «арахисовая паста».
  const baseName = tidyDishBase(
    sanitizeAssistantMealName(
      (kcal != null && cleaned.length >= 2 ? cleaned : null) ??
        pack?.dishName ??
        cleaned,
    ),
  );
  if (!baseName || baseName.length < 2 || mealNameLooksPolluted(baseName)) return null;
  const alreadyPieces = pieces != null && new RegExp(
    String.raw`\(\s*${pieces}\s*шт`,
    "i",
  ).test(baseName);
  // «3 шт» остаётся в имени, даже если рядом есть граммы («3 шт. ≈ 150 г»).
  const explicitPieces = pieces != null && /шт/iu.test(forPortion);
  let name = baseName;
  if (explicitPieces && !alreadyPieces) {
    name = `${name} (${pieces} шт)`;
  }
  const alreadyPortion = new RegExp(
    String.raw`\(\s*${portion}\s*${unit}\s*\)\s*$`,
    "i",
  ).test(name);
  if (portion != null && portion > 0 && !alreadyPortion) {
    name = `${name} (${portion} ${unit})`;
  } else if (
    !explicitPieces &&
    pieces != null &&
    pieces > 1 &&
    !alreadyPieces &&
    packLooksPerPiece(pack?.dishName ?? baseName)
  ) {
    name = `${name} (${pieces} шт)`;
  }

  if (kcal == null || !Number.isFinite(kcal) || kcal <= 0) {
    const labeled =
      portion != null && portion > 0 ? `${baseName} (${portion} ${unit})` : baseName;
    misses?.push(labeled);
    return null;
  }

  return {
    name: name.slice(0, 120),
    kcal,
    protein,
    fat,
    carbs,
    ...(lineNote ? { note: lineNote } : {}),
  };
}

/**
 * «пюре, котлета и пиво» режется по запятой и «и».
 * «омлет 200 ккал, белки 14 г плюс гречка 180 ккал» — сначала по «плюс»,
 * запятые внутри БЖУ не становятся новыми блюдами.
 */
function splitInlineDishParts(body: string): string[] {
  const chunks = body.split(/\s+плюс\s+|\s+а\s+также\s+|\s+\+\s+/i);
  const parts: string[] = [];
  for (const chunk of chunks) {
    const piece = chunk.trim();
    if (piece.length < 2) continue;
    const keepsMacros =
      /\d\s*(?:ккал|kcal)/i.test(piece) &&
      /белк|жир|углевод|protein|fat|carb/i.test(piece);
    const bits = keepsMacros
      ? piece.split(/\s+и\s+/i)
      : piece.split(/\s*,\s*|\s+и\s+/i);
    for (const bit of bits) {
      const name = bit.trim();
      if (name.length >= 2) parts.push(name);
    }
  }
  return parts;
}

/**
 * Inline multi-dish without bullets: «Вчерашний ужин: пюре, котлета, пиво 3л»
 * or «вчера на ужин пюре и котлета и пиво».
 */
export function parseInlineMealsFromText(text: string, misses?: string[]): ParsedMealLine[] {
  const raw = stripAssistantToolNoise(text).trim();
  if (!raw) return [];
  // Prefer a slot header / colon list; else whole message after stripping day words.
  const header = new RegExp(
    `(?:(?:вчерашн|сегодняшн|завтрашн)\\S*\\s+)?${MEAL_SLOT_STEM_RE}\\s*[:—–-]\\s*(.+)`,
    "iu",
  ).exec(raw);
  const onSlot = new RegExp(
    `(?:на|в)\\s+${MEAL_SLOT_STEM_RE}\\s+(.+)`,
    "iu",
  ).exec(raw);
  let body = header?.[2] ?? onSlot?.[2] ?? "";
  const hasDishSep =
    /,/.test(raw) ||
    /\sи\s/i.test(raw) ||
    /\sплюс\s/i.test(raw) ||
    /\sа\s+также\s/i.test(raw) ||
    /\s\+\s/.test(raw);
  if (!body.trim()) {
    // «вчера на ужин пюре и котлета» already covered by onSlot; bare comma list needs food cues.
    if (!hasDishSep) return [];
    body = raw
      .replace(/^\s*я\s+(?:съел|выпил|поел|запил)\s+/iu, " ")
      .replace(/(?:вчерашн|сегодняшн|завтрашн)\S*/giu, " ")
      .replace(/(?:вчера|сегодня|завтра|позавчера)/giu, " ")
      .replace(new RegExp(`(?:на|в)\\s+${MEAL_SLOT_STEM_RE}`, "giu"), " ")
      .replace(new RegExp(MEAL_SLOT_STEM_RE, "giu"), " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  body = body.replace(/\s*всего\b[\s\S]*$/i, "").trim();
  if (!body) return [];

  const parts = splitInlineDishParts(body);
  if (parts.length < 2) return [];

  const meals: ParsedMealLine[] = [];
  for (const part of parts) {
    const meal = mealLineFromFragment(part, undefined, misses);
    if (meal) meals.push(meal);
  }
  return meals;
}

/**
 * Parse bullet / numbered lines with optional «~200 ккал, Б4 Ж3 У35»
 * or full-word «белки 24 г, жиры 15 г, углеводы 50 г».
 * Falls back to inline comma / «и» lists only when the text is not a bullet list.
 * Used for offline multi-dish repair from user text or assistant draft.
 */
export function parseStructuredMealsFromText(text: string, misses?: string[]): ParsedMealLine[] {
  const { meals, missed } = parseStructuredMealsDetailed(text);
  misses?.push(...missed);
  return meals;
}

/**
 * Same as {@link parseStructuredMealsFromText}, plus dish names that were listed
 * but could not be priced (no kcal in the line and no table match). Callers must
 * not present a partial list as the whole meal when `missed` is non-empty.
 */
export function parseStructuredMealsDetailed(text: string): {
  meals: ParsedMealLine[];
  missed: string[];
} {
  const cleaned = stripAssistantToolNoise(text);
  const bulletMissed: string[] = [];
  const lines = cleaned.split(/\r?\n/);
  const meals: ParsedMealLine[] = [];
  let bulletLines = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m =
      /^[-•*]\s+(.+)$/.exec(line) ??
      /^\d+[.)]\s+(.+)$/.exec(line);
    if (!m?.[1]) continue;
    bulletLines += 1;
    let rest = m[1].trim();
    let lineNote: string | undefined;
    const slotPrefix = new RegExp(
      `^${MEAL_SLOT_STEM_RE}\\s*[:—–-]\\s*`,
      "i",
    ).exec(rest);
    if (slotPrefix?.[1]) {
      lineNote = mealNoteFromTypeKey(parseMealTypeKey(slotPrefix[1])) ?? undefined;
      rest = rest.slice(slotPrefix[0].length).trim();
    }
    const meal = mealLineFromFragment(rest, lineNote, bulletMissed);
    if (meal) meals.push(meal);
  }
  // Порог «это список», не лимит: в карточку идут все позиции, не первые две.
  if (meals.length >= 2) return { meals, missed: bulletMissed };
  // Bullet drafts must not fall through to comma-split of the whole reply
  // (that glued «углеводы» + «✓ В рацион…» into dish names).
  if (bulletLines >= 2) return { meals, missed: bulletMissed };

  // Plain draft lines without «-»: «4 яйца: около 280 ккал, белки…»
  const fromPlain = parsePlainMacroLines(cleaned);
  if (fromPlain.length >= 2) return { meals: fromPlain, missed: [] };

  const inlineMissed: string[] = [];
  const inline = parseInlineMealsFromText(cleaned, inlineMissed);
  return inline.length >= 2
    ? { meals: inline, missed: inlineMissed }
    : { meals, missed: bulletMissed };
}

/**
 * Non-bullet dish lines that already carry kcal (common GigaChat draft shape).
 * Skips итог / prompt lines.
 */
export function parsePlainMacroLines(text: string): ParsedMealLine[] {
  const meals: ParsedMealLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.length < 8) continue;
    if (/^(?:итого|всего|сумма|нажми|подтверд)/i.test(line)) continue;
    if (!/\d\s*ккал/i.test(line)) continue;
    // Skip prose that isn't a dish row («фиксирую завтрак: …»).
    if (/^(?:замечательно|отлично|хорошо|ок[,.]|фиксир)/i.test(line)) continue;
    let rest = line;
    let lineNote: string | undefined;
    const slotPrefix = new RegExp(
      `^${MEAL_SLOT_STEM_RE}\\s*[:—–-]\\s*`,
      "i",
    ).exec(rest);
    if (slotPrefix?.[1]) {
      lineNote = mealNoteFromTypeKey(parseMealTypeKey(slotPrefix[1])) ?? undefined;
      rest = rest.slice(slotPrefix[0].length).trim();
    }
    const meal = mealLineFromFragment(rest, lineNote);
    if (meal) meals.push(meal);
  }
  return meals;
}

function mealMetaFromMessage(
  userMessage: string,
  assistantReply?: string,
): {
  note: string;
  targetDate: string;
} {
  return {
    note:
      extractMealTypeFromMessage(userMessage) ??
      extractMealTypeFromMessage(assistantReply ?? "") ??
      "перекус",
    targetDate:
      extractTargetDateFromMessage(userMessage) ??
      extractTargetDateFromMessage(assistantReply ?? "") ??
      "сегодня",
  };
}

/** «4 варёных яйца», «яйца 3 шт» → piece count for per-item staples. */
export function parsePieceCountFromMessage(text: string): number | null {
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  const withUnit = new RegExp(
    String.raw`(\d+)\s*(?:шт(?:ук[аи]?)?\.?)${end}`,
    "iu",
  ).exec(text);
  if (withUnit?.[1]) {
    const n = Number(withUnit[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  // Count glued to a piece food: «4 варёных яйца», «2 банана».
  const beforeFood = new RegExp(
    String.raw`(\d+)\s+(?:вар[её]н\p{L}*\s+)?(?:яиц\p{L}*|банан\p{L}*|яблок\p{L}*|апельсин\p{L}*|мандарин\p{L}*|сосиск\p{L}*|котлет\p{L}*)`,
    "iu",
  ).exec(text);
  if (beforeFood?.[1]) {
    const n = Number(beforeFood[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  // Leading count before any food word: «4 варёных…».
  const leading = /^\s*(\d+)\s+(?=\p{L})/u.exec(text.trim());
  if (leading?.[1]) {
    const n = Number(leading[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  return null;
}

function packLooksPerPiece(dishName: string): boolean {
  return /яйц|сырок|банан|яблоко|апельсин|мандарин|сосиск|котлет/i.test(dishName);
}

function unparsedMealRows(missed: string[], note?: string): ParsedMealLine[] {
  const rows: ParsedMealLine[] = [];
  const seen = new Set<string>();
  for (const raw of missed) {
    const clean = sanitizeAssistantMealName(raw).replace(/\s+/g, " ").trim();
    if (!clean || clean.length < 2 || isNutrientLabelName(clean)) continue;
    const key = clean.toLowerCase().replace(/ё/g, "е");
    if (seen.has(key)) continue;
    seen.add(key);
    const name = clean.charAt(0).toUpperCase() + clean.slice(1);
    rows.push({
      name: name.slice(0, 120),
      unparsed: true,
      ...(note ? { note } : {}),
    });
  }
  return rows;
}

function appendUnparsed(meals: ParsedMealLine[], missed: string[], note?: string): ParsedMealLine[] {
  const extras = unparsedMealRows(missed, note).filter(
    (row) => !meals.some((meal) => dishNameScore(meal.name, row.name) >= 0.45),
  );
  return [...meals, ...extras];
}

/**
 * Offline multi-dish repair from bullet lists in the user message / assistant draft.
 * Одна строка без цены не отменяет остальные: она остаётся с unparsed.
 */
export function heuristicRepairMultiDishActions(
  userMessage: string,
  assistantReply?: string,
): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  if (!messageLooksLikeMultiDish(userMessage) && !messageLooksLikeMultiDish(assistantReply ?? "")) {
    return null;
  }

  const fromUser = parseStructuredMealsDetailed(userMessage);
  let picked = fromUser;
  // Prefer the draft when it covers ≥ as many dishes: cleaner names + macros.
  // User inline may drop staples (арахисовая паста) or keep «Я съел …» prefixes.
  if (assistantReply) {
    const fromReply = parseStructuredMealsDetailed(assistantReply);
    const replyN = fromReply.meals.length;
    const userN = fromUser.meals.length;
    if (replyN >= 2 && (replyN >= userN || userN < 2)) {
      picked = fromReply;
    }
    // A complete parse beats one that silently dropped an unpriced dish.
    if (picked.missed.length && userN >= 2 && !fromUser.missed.length) picked = fromUser;
    if (picked.missed.length && replyN >= 2 && !fromReply.missed.length) picked = fromReply;
  }
  const { note, targetDate } = mealMetaFromMessage(userMessage, assistantReply);
  const priced = picked.meals.map((m) => ({
    ...m,
    note,
    name: sanitizeAssistantMealName(stripMealSlotPrefix(m.name)),
  }));
  const meals = appendUnparsed(priced, picked.missed, note);
  if (meals.length < 2) return null;

  const withNote = meals;
  const names = withNote.map((m) => m.name.split(" (")[0]!).slice(0, 4).join(", ");

  return {
    apply: true,
    targetDate,
    meals: withNote,
    summary: `к подтверждению: ${names}`,
  };
}

/**
 * Offline: model listed one dish with kcal in a bullet but forgot cv-actions
 * («Ок, кидаю в план: - Перекус: протеин … (~220 ккал)»).
 */
export function heuristicRepairFromDraftReply(
  userMessage: string,
  assistantReply: string,
): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  if (!assistantReply.trim()) return null;

  if (replyLooksLikeNutrientBreakdown(assistantReply)) {
    const prose = heuristicRepairFromProseKcal(userMessage, assistantReply);
    if (prose?.meals?.some((m) => m.name && !isNutrientLabelName(m.name))) return prose;
  }

  const { meals, missed } = parseStructuredMealsDetailed(assistantReply);
  if (meals.length < 1 && missed.length < 1) return null;
  // Prefer lines that already carry kcal from the draft. Unpriced rows stay on the card.
  const withKcal = meals.filter((m) => typeof m.kcal === "number" && m.kcal > 0);
  const picked = withKcal.length ? withKcal : meals;
  if (!picked.length && !missed.length) return null;

  const { note, targetDate } = mealMetaFromMessage(userMessage, assistantReply);
  const noted = picked.map((m) => ({
    ...m,
    note: m.note && isMealNoteLabel(m.note) ? m.note : note,
    name: sanitizeAssistantMealName(stripMealSlotPrefix(m.name)),
  }));
  const withNote = appendUnparsed(noted, missed, note);
  const names = withNote.map((m) => m.name.split(" (")[0]!).slice(0, 4).join(", ");

  return {
    apply: true,
    targetDate,
    meals: withNote,
    summary: `к подтверждению: ${names}`,
  };
}

function isMealNoteLabel(note: string): boolean {
  return /^(завтрак|обед|ужин|перекус)$/i.test(note.trim());
}

/** «Перекус: протеин изолят 60 г» → «протеин изолят 60 г». */
function stripMealSlotPrefix(name: string): string {
  return name
    .replace(/^(?:завтрак|обед|ужин|перекус)\s*[:—–-]\s*/i, "")
    .trim()
    .slice(0, 120);
}

/**
 * Offline repair for clear drink/food write intents (beer liters, etc.)
 * when the model moralizes without cv-actions.
 * Skips when the message is a multi-dish list (beer + food) — use multi-dish path.
 */
export function heuristicRepairWriteActions(userMessage: string): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  if (messageLooksLikeMultiDish(userMessage)) return null;

  const drinkQ = drinkLookupQuery(userMessage);
  const cleaned = userMessage
    .replace(/^\s*я\s+(съел|выпил|поел)\s+/i, "")
    .replace(
      /(?:^|\s)(?:добав\S*|закинь|запиш\S*|кинь|положи|внеси|сохран\S*)(?=$|\s)/giu,
      " ",
    )
    .replace(/\d+(?:[.,]\d+)?\s*(?:л|литр(?:а|ов|ы)?|мл|г|гр|грамм(?:а|ов)?)\b/gi, " ")
    .replace(
      new RegExp(`(?:(?:на|в|во)\\s+)?${MEAL_SLOT_STEM_RE}(?=$|\\s|[^\\p{L}\\p{N}])`, "giu"),
      " ",
    )
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
  const { note, targetDate } = mealMetaFromMessage(userMessage);

  return {
    apply: true,
    targetDate,
    meals: [
      {
        name: name.slice(0, 120),
        kcal: Math.round(pack.calories * scale),
        protein: num(pack.protein),
        fat: num(pack.fat),
        carbs: num(pack.carbs),
        note,
      },
    ],
    summary: `к подтверждению: ${pack.dishName}`,
  };
}

/**
 * Offline slot edit: «исправь завтрак на 6:30», «удали ужин», «перенеси обед в ужин».
 */
export function heuristicRepairSlotEditActions(userMessage: string): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  const targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";
  const text = userMessage.trim();
  const move = extractMealSlotMoveFromMessage(userMessage);
  if (move) {
    const fromType = mealTypeKeyFromLabel(move.from);
    const toType = mealTypeKeyFromLabel(move.to);
    if (!fromType || !toType) return null;
    return {
      apply: true,
      targetDate,
      patchMeals: [{ match: move.from, mealType: fromType, toMealType: toType }],
      summary: `${move.from} → ${move.to} — подтверди`,
    };
  }

  const note = extractMealTypeFromMessage(userMessage);
  const mealType = mealTypeKeyFromLabel(note);
  if (!note || !mealType) return null;
  const time = extractMealTimeFromMessage(userMessage);
  const grams = parsePortionGramsFromMessage(userMessage);

  if (/удал|убери/i.test(text)) {
    return {
      apply: true,
      targetDate,
      deleteMeals: [{ match: note, mealType }],
      summary: `удалить ${note} — подтверди`,
    };
  }

  // Time patch: verb optional when «время … HH:MM» / slot + clock are explicit.
  if (
    time &&
    (/исправ|поправ|поставь|смени|измени|перенес|перемест|время/i.test(text) ||
      new RegExp(`${MEAL_SLOT_STEM_RE}.{0,24}\\d{1,2}\\s*[:.\\s]\\s*\\d{2}`, "i").test(
        text,
      ))
  ) {
    return {
      apply: true,
      targetDate,
      patchMeals: [{ match: note, mealType, time }],
      summary: `${note} → ${time} — подтверди`,
    };
  }

  if (
    grams &&
    /исправ|поправ|сделай|поставь|измени|порци/i.test(text) &&
    !/добав|съел|запиш|закинь|положи/i.test(text)
  ) {
    return {
      apply: true,
      targetDate,
      patchMeals: [{ match: note, mealType, portionGrams: grams }],
      summary: `${note} → ${grams} г — подтверди`,
    };
  }

  return null;
}

/** Pull dish name for portion patch («сделай омлет 200 г»). */
function extractDishMatchForPortionPatch(message: string): string | null {
  let t = message.trim().toLowerCase().replace(/ё/g, "е");
  t = t.replace(
    /исправ\S*|поправ\S*|сделай|поставь|измени\S*|порци\S*|пожалуйста|сегодня|вчера|позавчера|завтра/gi,
    " ",
  );
  // No `\b` — JS word boundaries are ASCII-only and break on Cyrillic «г».
  t = t.replace(/\d+(?:[.,]\d+)?\s*(?:грамм(?:а|ов)?|гр|г|мл|литр(?:а|ов|ы)?|л)/gi, " ");
  t = t.replace(new RegExp(`(?:^|\\s)${MEAL_SLOT_STEM_RE}(?=$|\\s)`, "gi"), " ");
  t = t.replace(/(?:^|\s)(?:на|в|у|к|с|и|или|время)(?=$|\s)/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2) return null;
  if (matchIsMealSlot(t)) return null;
  return t.slice(0, 120);
}

/**
 * Offline portion patch: «сделай омлет 200 г», «исправь кашу на 150г».
 * Slot-wide portion is handled by heuristicRepairSlotEditActions.
 */
export function heuristicRepairPortionPatchActions(
  userMessage: string,
): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  const text = userMessage.trim();
  if (!/исправ|поправ|сделай|поставь|измени|порци/i.test(text)) return null;
  if (/добав|съел|запиш|закинь|положи|внеси/i.test(text)) return null;
  if (extractMealSlotMoveFromMessage(userMessage)) return null;
  const grams = parsePortionGramsFromMessage(userMessage);
  if (!grams) return null;
  // Slot-wide portion is handled by heuristicRepairSlotEditActions.
  if (extractMealTypeFromMessage(userMessage)) return null;
  const match = extractDishMatchForPortionPatch(userMessage);
  if (!match) return null;
  const targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";
  return {
    apply: true,
    targetDate,
    patchMeals: [{ match, portionGrams: grams }],
    summary: `${match} → ${grams} г — подтверди`,
  };
}

function sameDish(a: string, b: string): boolean {
  return dishNameScore(a, b) >= 0.45;
}

/**
 * Подпись граммов из черновика, если в имени порции нет.
 * Явные граммы, в том числе 100, не затираются. Ккал и БЖУ не трогаем.
 */
function stampStatedPortions(
  assistantReply: string,
  actions: AssistantActions | null,
): AssistantActions | null {
  if (!actions?.meals?.length || !assistantReply.trim()) return actions;
  const parsed = parseStructuredMealsFromText(assistantReply);
  if (!parsed.length) return actions;
  let changed = false;
  const meals = actions.meals.map((meal) => {
    let best: ParsedMealLine | null = null;
    let bestScore = 0;
    for (const row of parsed) {
      const score = dishNameScore(meal.name, row.name);
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
    if (!best || bestScore < 0.45) return meal;
    const stated = splitQuickPortion(best.name);
    const current = splitQuickPortion(meal.name);
    if (stated.grams == null) return meal;
    if (current.grams != null) return meal;
    changed = true;
    return {
      ...meal,
      name: `${current.base} (${stated.grams} ${stated.unit})`.slice(0, 120),
    };
  });
  return changed ? { ...actions, meals } : actions;
}

/** Дописать блюда, которые черновик исключил из-за предпочтений или диеты. */
function mergeExcludedEatenMeals(
  assistantReply: string,
  actions: AssistantActions | null,
): AssistantActions | null {
  if (!assistantReply.trim()) return actions;
  const extras: ParsedMealLine[] = [];
  for (const raw of assistantReply.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim();
    const peeled = peelPreferenceExclusion(line);
    if (!peeled) continue;
    const meal = mealFromPreferenceExclusion(peeled.name);
    if (meal) extras.push(meal);
  }
  if (!extras.length) return actions;
  const meals = [...(actions?.meals ?? [])];
  let added = false;
  for (const extra of extras) {
    if (meals.some((m) => sameDish(m.name, extra.name))) continue;
    meals.push(extra);
    added = true;
  }
  if (!added) return actions;
  if (!actions) {
    return { apply: true, meals, summary: `к подтверждению: ${extras.map((m) => splitQuickPortion(m.name).base).join(", ")}` };
  }
  return { ...actions, apply: true, meals };
}

/**
 * When the model (or drink heuristic) collapsed a multi-dish log to one meal,
 * or polluted names with tool/macro leftovers, replace with the offline parse.
 * Затем подставляет граммы из «≈ N г» и возвращает блюда, выкинутые из-за предпочтений.
 */
export function preferMultiDishActions(
  userMessage: string,
  assistantReply: string,
  actions: AssistantActions | null | undefined,
): AssistantActions | null {
  const looksMulti =
    messageLooksLikeMultiDish(userMessage) ||
    messageLooksLikeMultiDish(assistantReply);
  let chosen: AssistantActions | null = actions ?? null;
  if (looksMulti) {
    const multi =
      heuristicRepairMultiDishActions(userMessage, assistantReply) ??
      heuristicRepairFromDraftReply(userMessage, assistantReply);
    const mealCount = actions?.meals?.length ?? 0;
    const multiCount = multi?.meals?.length ?? 0;
    // Ответ на ЭТО сообщение — источник карточки, даже если модель
    // выкинула уже виденные в чате блюда и оставила одно «новое».
    if (multiCount >= 2 && multiCount >= mealCount) chosen = multi;
    else if (mealCount >= 2) {
      const polluted = (actions?.meals ?? []).some((m) => mealNameLooksPolluted(m.name));
      if (polluted && multiCount >= 2) chosen = multi;
    } else {
      chosen = multi ?? actions ?? null;
    }
  }
  chosen = stampStatedPortions(assistantReply, chosen);
  return mergeExcludedEatenMeals(assistantReply, chosen);
}

/**
 * Prefer one slot patch/delete over dish lists / meals when the user asked by slot.
 */
export function preferSlotEditActions(
  userMessage: string,
  actions: AssistantActions | null | undefined,
): AssistantActions | null {
  const slot = heuristicRepairSlotEditActions(userMessage);
  if (slot) {
    if (slot.deleteMeals?.length) {
      if (actions?.deleteMeals?.length) return actions;
      return slot;
    }
    if (slot.patchMeals?.length) {
      // Whole-slot time / move / portion beats per-dish patches / accidental meals[].
      return slot;
    }
  }
  const portion = heuristicRepairPortionPatchActions(userMessage);
  if (portion?.patchMeals?.length) {
    const modelPatches = actions?.patchMeals?.filter(patchMealHasEffect) ?? [];
    if (modelPatches.some((p) => typeof p.portionGrams === "number" || p.toMealType)) {
      return actions ?? null;
    }
    return portion;
  }
  return actions ?? null;
}

function macrosLookEmpty(meal: { protein?: number; fat?: number; carbs?: number }): boolean {
  const empty = (v?: number) => v == null || !Number.isFinite(v) || v <= 0;
  return empty(meal.protein) && empty(meal.fat) && empty(meal.carbs);
}

function fillEmptyMacros<T extends { kcal?: number; protein?: number; fat?: number; carbs?: number }>(
  meal: T,
  prose: { kcal?: number; protein?: number; fat?: number; carbs?: number },
): T {
  return {
    ...meal,
    kcal: meal.kcal && meal.kcal > 0 ? meal.kcal : prose.kcal,
    protein: prose.protein ?? meal.protein,
    fat: prose.fat ?? meal.fat,
    carbs: prose.carbs ?? meal.carbs,
  };
}

/**
 * Модель или черновик назвали блюдо «Калории» / «Белки» либо вернули нулевое БЖУ.
 * Имя берём из фразы пользователя, БЖУ — из текста ответа.
 */
export function salvageNutrientLabelMeals(
  actions: AssistantActions | null | undefined,
  userMessage: string,
  assistantReply: string,
): AssistantActions | null {
  if (!actions?.meals?.length) return actions ?? null;
  const badName = actions.meals.some((m) => isNutrientLabelName(m.name));
  const emptyMacros = actions.meals.every(macrosLookEmpty);
  if (!badName && !emptyMacros) return actions;

  const prose = heuristicRepairFromProseKcal(userMessage, assistantReply);
  const proseMeal = prose?.meals?.[0];
  const proseNameOk = Boolean(proseMeal?.name && !isNutrientLabelName(proseMeal.name));

  if (badName) {
    const real = actions.meals.filter((m) => !isNutrientLabelName(m.name));
    if (!real.length) {
      if (prose?.meals?.length && proseNameOk) {
        return {
          ...actions,
          apply: true,
          meals: prose.meals,
          summary: prose.summary ?? actions.summary,
        };
      }
      const fallback = dishNameFromUserLog(userMessage);
      if (!fallback) return actions;
      return {
        ...actions,
        apply: true,
        meals: actions.meals.map((m) => ({
          ...(proseMeal && macrosLookEmpty(m) ? fillEmptyMacros(m, proseMeal) : m),
          name: fallback,
        })),
      };
    }
    return {
      ...actions,
      meals: real.map((m) => (macrosLookEmpty(m) && proseMeal ? fillEmptyMacros(m, proseMeal) : m)),
    };
  }

  if (!proseMeal) return actions;
  return {
    ...actions,
    meals: actions.meals.map((m) => fillEmptyMacros(m, proseMeal)),
  };
}

/**
 * Второй короткий вызов: собрать cv-actions из запроса и черновика.
 * Сначала офлайн-эвристики, затем извлечение через GigaChat.
 */
export async function repairAssistantWriteActions(opts: {
  userMessage: string;
  assistantReply: string;
  today: string;
  date: string;
  /** Тесты корпуса не ходят в сеть. В проде второй вызов включён. */
  allowRepairLlm?: boolean;
  onRepairLlm?: () => void;
}): Promise<AssistantActions | null> {
  const actions = await repairAssistantWriteActionsInner(opts);
  return salvageNutrientLabelMeals(actions, opts.userMessage, opts.assistantReply);
}

async function repairAssistantWriteActionsInner(opts: {
  userMessage: string;
  assistantReply: string;
  today: string;
  date: string;
  allowRepairLlm?: boolean;
  onRepairLlm?: () => void;
}): Promise<AssistantActions | null> {
  opts = { ...opts, userMessage: repairIntentMessage(opts.userMessage, opts.assistantReply) };
  const slot = heuristicRepairSlotEditActions(opts.userMessage);
  if (slot) return slot;

  const portion = heuristicRepairPortionPatchActions(opts.userMessage);
  if (portion) return portion;

  const start = heuristicRepairStartWorkoutActions(opts.userMessage);
  if (start) return start;

  const repeat = heuristicRepairRepeatWorkoutActions(opts.userMessage);
  if (repeat) return repeat;

  const gymPatch = heuristicRepairPatchWorkoutActions(opts.userMessage);
  if (gymPatch) return gymPatch;

  const multi = heuristicRepairMultiDishActions(opts.userMessage, opts.assistantReply);
  if (multi) return multi;

  const fromDraft = heuristicRepairFromDraftReply(opts.userMessage, opts.assistantReply);
  if (fromDraft) return fromDraft;

  const heuristic = heuristicRepairWriteActions(opts.userMessage);
  if (heuristic) return heuristic;

  const system = [
    "Ты извлекаешь действия записи для Calorie Vision.",
    "Верни ТОЛЬКО один JSON-объект (без markdown и без текста вокруг).",
    'Обязательно: "apply": true если есть что записать.',
    'Поля: meals[{name,kcal,...}], deleteMeals[], patchMeals[], shopping[], workoutDays[], waterMl, weightKg, startWorkout, startEmptyWorkout, repeatWorkout, patchWorkout, targetDate, summary.',
    "meals.note = завтрак|обед|ужин|перекус если понятно, иначе перекус.",
    "«Исправь завтрак на 6:30» → patchMeals:[{match:\"завтрак\",mealType:\"BREAKFAST\",time:\"06:30\"}] (один объект на весь слот).",
    "«Удали ужин» → deleteMeals:[{match:\"ужин\",mealType:\"DINNER\"}].",
    "«Перенеси обед в ужин» → patchMeals:[{match:\"обед\",mealType:\"LUNCH\",toMealType:\"DINNER\"}].",
    "«Сделай омлет 200 г» → patchMeals:[{match:\"омлет\",portionGrams:200}].",
    "«Повтори вчерашний зал» / «повтори последнюю» → repeatWorkout:true, targetDate сегодня (или как сказал).",
    "«Начни тренировку» → startWorkout:true. Нет плана → startEmptyWorkout:true.",
    "«Добавь жим» / «поставь 80×8» → patchWorkout.addExercises или patchWorkout.logSets.",
    "Несколько блюд в запросе = несколько объектов в meals[] (пюре + котлета + пиво → 3). Не обрезай список до 2.",
    "Если пользователь УЖЕ съел блюдо — включи его, даже если оно в «не предлагай», не в диете или в черновике написано «исключено из-за предпочтений».",
    "Повтор в том же чате не повод выкидывать блюда: в meals[] все позиции текущего ответа, с ккал и БЖУ из текста, не из прошлой карточки.",
    "Граммы из «≈ 150 г», «(3 шт. ≈ 150 г)», «≈ 30 г» пиши в name как «(150 г)» / «(30 г)». kcal и БЖУ — на эту порцию, не на 100 г.",
    "meals[].name — блюдо из запроса пользователя («чебурек с фаршем индейки»). Нельзя называть блюдо «Калории», «Калорийность», «Белки», «Жиры» или «Углеводы».",
    "Белки, жиры и углеводы бери из черновика, даже если они написаны словами: «Белки: около 20 г».",
    "kcal оцени реалистично, если пользователь не указал.",
    "Алкоголь/напитки тоже пиши в meals (пиво, вино…): 1 мл ≈ 1 г; 3 литра пива ≈ 3000 г, ~900–1300 ккал.",
    "Даже если в черновике только совет «не пей» — всё равно собери meals из запроса пользователя.",
    `Сегодня=${opts.today}. Контекст дня=${opts.date}.`,
    'targetDate: «вчера» / «сегодня» / «завтра» / YYYY-MM-DD. «Вчерашний ужин» → targetDate «вчера», note «ужин».',
    'Если нечего писать: {"apply":false}',
  ].join("\n");

  const user = [
    `Запрос пользователя:\n${opts.userMessage}`,
    "",
    `Черновик ответа ассистента (можешь взять ккал/названия отсюда):\n${opts.assistantReply.slice(0, 2500)}`,
  ].join("\n");

  if (opts.allowRepairLlm === false) {
    return heuristicRepairFromProseKcal(opts.userMessage, opts.assistantReply);
  }

  try {
    opts.onRepairLlm?.();
    const raw = await completeChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      0.15,
      { retries: 1 },
    );
    const actions = extractActionsJson(raw);
    if (actions && actionsHaveWritablePayload(actions)) return { ...actions, apply: true };
  } catch (error) {
    console.error("assistant write repair", error);
  }
  // LLM repair failed/empty: still owe a confirm card when the draft has a kcal estimate.
  return heuristicRepairFromProseKcal(opts.userMessage, opts.assistantReply);
}
