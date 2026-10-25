/**
 * When the model claims to write but omits cv-actions, recover structured writes.
 */

import { completeChat } from "@/lib/ai/gigachat";
import {
  normalizeAssistantActions,
  type AssistantActions,
} from "@/lib/admin-assistant";
import {
  userWantsWrite,
  userWantsStartWorkout,
  userWantsRepeatWorkout,
  userWantsGymEdit,
} from "@/lib/assistant-intent";
import {
  extractMealSlotMoveFromMessage,
  extractMealTimeFromMessage,
  extractMealTypeFromMessage,
  extractTargetDateFromMessage,
  matchIsMealSlot,
  mealTypeKeyFromLabel,
  parseMealTimeHHMM,
} from "@/lib/assistant-meal-time";
import { lookupRuNutritionTable } from "@/lib/ru-nutrition-lookup";

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

export function needsWriteRepair(
  userMessage: string,
  actions: AssistantActions | null | undefined,
): boolean {
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
  } else if (!/вчерашн/i.test(text)) {
    targetDate = extractTargetDateFromMessage(userMessage) ?? "сегодня";
  }
  return {
    apply: true,
    targetDate,
    repeatWorkout: true,
    summary: `повторить последнюю → ${targetDate} — подтверди`,
  };
}

/** Offline: «добавь жим», «поставь 80×8 на жим». */
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

  const nameMatch =
    /(?:добав\S*|запиш\S*|поставь\S*)\s+(?:упражнение\s+)?([а-яёa-z0-9][а-яёa-z0-9\s-]{1,40}?)(?:\s+\d|\s*$|,|\.|!)/i.exec(
      text,
    ) ??
    /(?:на|в)\s+([а-яёa-z][а-яёa-z\s-]{1,30}?)(?:\s*$|,|\.|!)/i.exec(text);
  let name = nameMatch?.[1]?.trim() ?? "";
  name = name
    .replace(/\b\d+[.,]?\d*\s*(кг|kg|x|х|×)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) {
    // Fallback short exercise nouns.
    const noun = /(жим(?:\s+л[её]жа)?|тяга(?:\s+\S+)?|присед(?:ания)?|разводк\S*|подтягиван\S*)/i.exec(
      text,
    );
    name = noun?.[1]?.trim() ?? "";
  }
  if (!name) return null;

  const hasAdd = /добав|запиш\S*\s+упражн|новое\s+упражн/i.test(text);
  if (hasAdd || !setMatch) {
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
  return false;
}

type ParsedMealLine = NonNullable<AssistantActions["meals"]>[number];

/**
 * Parse bullet / numbered lines with optional «~200 ккал, Б4 Ж3 У35».
 * Used for offline multi-dish repair from user text or assistant draft.
 */
export function parseStructuredMealsFromText(text: string): ParsedMealLine[] {
  const lines = text.split(/\r?\n/);
  const meals: ParsedMealLine[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m =
      /^[-•*]\s+(.+)$/.exec(line) ??
      /^\d+[.)]\s+(.+)$/.exec(line);
    if (!m?.[1]) continue;
    let rest = m[1].trim();
    let lineNote: string | undefined;
    const slotPrefix = /^(завтрак|обед|ужин|перекус)\s*[:—–-]\s*/i.exec(rest);
    if (slotPrefix?.[1]) {
      lineNote = slotPrefix[1].toLowerCase();
      rest = rest.slice(slotPrefix[0].length).trim();
    }
    let kcal: number | undefined;
    let protein: number | undefined;
    let fat: number | undefined;
    let carbs: number | undefined;

    const macroBlock =
      /[—(]\s*~?\s*(\d+(?:[.,]\d+)?)\s*ккал\s*[,;]?\s*(?:[бb]\s*(\d+(?:[.,]\d+)?)?)?\s*[,;]?\s*(?:[жf]\s*(\d+(?:[.,]\d+)?)?)?\s*[,;]?\s*(?:[уucс]\s*(\d+(?:[.,]\d+)?)?)?\s*\)?\s*$/iu.exec(
        rest,
      );
    if (macroBlock) {
      const n = (v?: string) => {
        if (!v) return undefined;
        const x = Number(v.replace(",", "."));
        return Number.isFinite(x) ? Math.round(x * 10) / 10 : undefined;
      };
      kcal = Math.round(Number(macroBlock[1]!.replace(",", ".")));
      protein = n(macroBlock[2]);
      fat = n(macroBlock[3]);
      carbs = n(macroBlock[4]);
      rest = rest.slice(0, macroBlock.index).trim().replace(/[—\-–:]\s*$/, "").trim();
    }

    if (!rest || rest.length < 2) continue;

    const portion = parsePortionGramsFromMessage(rest);
    const drinkQ = drinkLookupQuery(rest);
    const cleaned = rest
      .replace(/\d+(?:[.,]\d+)?\s*(?:л|литр(?:а|ов|ы)?|мл|г|гр|грамм(?:а|ов)?)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const pack =
      (drinkQ ? lookupRuNutritionTable(drinkQ) : null) ??
      lookupRuNutritionTable(cleaned) ??
      lookupRuNutritionTable(rest);

    if (kcal == null && pack) {
      const baseGrams = pack.portionGrams > 0 ? pack.portionGrams : 100;
      const grams = portion ?? baseGrams;
      const scale = grams / baseGrams;
      kcal = Math.round(pack.calories * scale);
      protein =
        pack.protein == null ? undefined : Math.round(pack.protein * scale * 10) / 10;
      fat = pack.fat == null ? undefined : Math.round(pack.fat * scale * 10) / 10;
      carbs = pack.carbs == null ? undefined : Math.round(pack.carbs * scale * 10) / 10;
    }

    const unit = drinkQ || /мл|литр|\bл\b/i.test(rest) ? "мл" : "г";
    const baseName = pack?.dishName ?? cleaned;
    const name =
      portion != null && portion > 0
        ? `${baseName} (${portion} ${unit})`
        : baseName;

    if (kcal == null || !Number.isFinite(kcal) || kcal <= 0) continue;

    meals.push({
      name: name.slice(0, 120),
      kcal,
      protein,
      fat,
      carbs,
      ...(lineNote ? { note: lineNote } : {}),
    });
  }
  return meals;
}

function mealMetaFromMessage(userMessage: string): {
  note: string;
  targetDate: string;
} {
  return {
    note: extractMealTypeFromMessage(userMessage) ?? "перекус",
    targetDate: extractTargetDateFromMessage(userMessage) ?? "сегодня",
  };
}

/**
 * Offline multi-dish repair from bullet lists in the user message / assistant draft.
 */
export function heuristicRepairMultiDishActions(
  userMessage: string,
  assistantReply?: string,
): AssistantActions | null {
  if (!userWantsWrite(userMessage)) return null;
  if (!messageLooksLikeMultiDish(userMessage) && !messageLooksLikeMultiDish(assistantReply ?? "")) {
    return null;
  }

  let meals = parseStructuredMealsFromText(userMessage);
  if (meals.length < 2 && assistantReply) {
    meals = parseStructuredMealsFromText(assistantReply);
  }
  if (meals.length < 2) return null;

  const { note, targetDate } = mealMetaFromMessage(userMessage);
  const withNote = meals.map((m) => ({ ...m, note }));
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

  const meals = parseStructuredMealsFromText(assistantReply);
  if (meals.length < 1) return null;
  // Prefer lines that already carry kcal from the draft.
  const withKcal = meals.filter((m) => typeof m.kcal === "number" && m.kcal > 0);
  const picked = withKcal.length ? withKcal : meals;
  if (!picked.length) return null;

  const { note, targetDate } = mealMetaFromMessage(userMessage);
  const withNote = picked.map((m) => ({
    ...m,
    note: m.note && isMealNoteLabel(m.note) ? m.note : note,
    name: stripMealSlotPrefix(m.name),
  }));
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
    .replace(/\d+(?:[.,]\d+)?\s*(?:л|литр(?:а|ов|ы)?|мл|г|гр|грамм(?:а|ов)?)\b/gi, " ")
    .replace(/(?:на\s+)?(?:завтрак|обед|ужин|перекус)(?=$|\s|[^\p{L}\p{N}])/giu, " ")
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

  if (time && /исправ|поправ|поставь|смени|измени|перенес/i.test(text)) {
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

/**
 * When the model (or drink heuristic) collapsed a multi-dish log to one meal,
 * replace with the offline multi-dish parse.
 */
export function preferMultiDishActions(
  userMessage: string,
  assistantReply: string,
  actions: AssistantActions | null | undefined,
): AssistantActions | null {
  if (!messageLooksLikeMultiDish(userMessage)) return actions ?? null;
  const mealCount = actions?.meals?.length ?? 0;
  if (mealCount >= 2) return actions ?? null;
  const multi = heuristicRepairMultiDishActions(userMessage, assistantReply);
  return multi ?? actions ?? null;
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

/**
 * Second cheap call: force structured cv-actions from the user request + draft reply.
 * Tries offline heuristic first (slot edit, multi-dish, drinks/staples), then GigaChat extract.
 */
export async function repairAssistantWriteActions(opts: {
  userMessage: string;
  assistantReply: string;
  today: string;
  date: string;
}): Promise<AssistantActions | null> {
  const slot = heuristicRepairSlotEditActions(opts.userMessage);
  if (slot) return slot;

  const portion = heuristicRepairPortionPatchActions(opts.userMessage);
  if (portion) return portion;

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
    "Несколько блюд в запросе = несколько объектов в meals[] (пюре + котлета + пиво → 3).",
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
