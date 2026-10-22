/**
 * Parse / enrich meal wall-clock times, meal-type notes, and targetDate
 * from assistant cv-actions + user text.
 */

import type { AssistantActions } from "@/lib/admin-assistant";

export type MealNoteLabel = "завтрак" | "обед" | "ужин" | "перекус";

/** Prisma MealType keys used by diary / assistant patch-delete. */
export type MealTypeKey = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

/** Relative / absolute day label extracted from free text. */
export type MealTargetDateLabel = "сегодня" | "вчера" | "позавчера" | "завтра" | "послезавтра";

const NOTE_TO_MEAL_TYPE: Record<MealNoteLabel, MealTypeKey> = {
  завтрак: "BREAKFAST",
  обед: "LUNCH",
  ужин: "DINNER",
  перекус: "SNACK",
};

const MEAL_TYPE_TO_NOTE: Record<MealTypeKey, MealNoteLabel> = {
  BREAKFAST: "завтрак",
  LUNCH: "обед",
  DINNER: "ужин",
  SNACK: "перекус",
};

export function mealTypeKeyFromLabel(label: MealNoteLabel | null | undefined): MealTypeKey | null {
  if (!label) return null;
  return NOTE_TO_MEAL_TYPE[label] ?? null;
}

export function mealNoteFromTypeKey(key: MealTypeKey | null | undefined): MealNoteLabel | null {
  if (!key) return null;
  return MEAL_TYPE_TO_NOTE[key] ?? null;
}

/** Parse BREAKFAST / завтрак / snack → MealTypeKey. */
export function parseMealTypeKey(raw: unknown): MealTypeKey | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/ё/g, "е");
  if (!t) return null;
  if (t === "breakfast" || t === "завтрак") return "BREAKFAST";
  if (t === "lunch" || t === "обед") return "LUNCH";
  if (t === "dinner" || t === "ужин") return "DINNER";
  if (t === "snack" || t === "перекус" || t === "снек") return "SNACK";
  if (t === "BREAKFAST".toLowerCase()) return "BREAKFAST";
  if (t === "LUNCH".toLowerCase()) return "LUNCH";
  if (t === "DINNER".toLowerCase()) return "DINNER";
  if (t === "SNACK".toLowerCase()) return "SNACK";
  return null;
}

/**
 * True when `match` is only a meal-slot word (весь завтрак), not a dish name.
 * «омлет на завтрак» → false; «завтрак» → true.
 */
export function matchIsMealSlot(match: string | undefined | null): MealTypeKey | null {
  if (!match?.trim()) return null;
  const t = match.trim().toLowerCase().replace(/ё/g, "е");
  return parseMealTypeKey(t);
}

/** Normalize "10:30" / "10.30" / "9:05" → "HH:MM", or null. */
export function parseMealTimeHHMM(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/[./]/g, ":").replace(/\s+/g, "");
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Pull wall-clock time from Russian free text («в 10:30», «около 9.15»).
 * Prefer explicit HH:MM; bare «в 10» alone is ignored (ambiguous).
 */
export function extractMealTimeFromMessage(message: string): string | null {
  const text = message.trim();
  if (!text) return null;

  const patterns = [
    /(?:время|на)\s*(\d{1,2})\s*[:.]\s*(\d{2})\b/iu,
    /(?:в|около|к)\s*(\d{1,2})\s*[:.]\s*(\d{2})\b/iu,
    /(?:в|около|к)\s*(\d{1,2})\s+(\d{2})\b/iu,
    /\b(\d{1,2}):(\d{2})\b/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (!m?.[1] || !m[2]) continue;
    const parsed = parseMealTimeHHMM(`${m[1]}:${m[2]}`);
    if (parsed) return parsed;
  }
  return null;
}

/** Fill missing meals[].time / patchMeals[].time from the user message when present. */
export function enrichAssistantActionsMealTimes(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  if (!actions) return null;
  const fromMsg = extractMealTimeFromMessage(userMessage);
  if (!fromMsg) return actions;

  let changed = false;
  let next: AssistantActions = actions;

  if (actions.meals?.length) {
    const meals = actions.meals.map((m) => {
      if (parseMealTimeHHMM(m.time)) return m;
      changed = true;
      return { ...m, time: fromMsg };
    });
    if (changed) next = { ...next, meals };
  }

  if (actions.patchMeals?.length) {
    let patchChanged = false;
    const patchMeals = actions.patchMeals.map((p) => {
      if (parseMealTimeHHMM(p.time)) return p;
      patchChanged = true;
      return { ...p, time: fromMsg };
    });
    if (patchChanged) {
      changed = true;
      next = { ...next, patchMeals };
    }
  }

  return changed ? next : actions;
}

/** End of a Russian token (JS `\b` is ASCII-only). */
const RU_TOKEN_END = "(?=$|[\\s.,;:!?…»\"')\\]])";

/**
 * Pull meal-type label from Russian free text («на перекус», «на завтрак»).
 */
export function extractMealTypeFromMessage(message: string): MealNoteLabel | null {
  const move = extractMealSlotMoveFromMessage(message);
  if (move) return move.from;
  const text = message.trim();
  if (!text) return null;
  if (new RegExp(`(?:на\\s+)?завтрак${RU_TOKEN_END}`, "i").test(text)) return "завтрак";
  if (new RegExp(`(?:на\\s+)?обед${RU_TOKEN_END}`, "i").test(text)) return "обед";
  if (new RegExp(`(?:на\\s+)?ужин${RU_TOKEN_END}`, "i").test(text)) return "ужин";
  if (new RegExp(`(?:на\\s+)?перекус${RU_TOKEN_END}|снек|snack`, "i").test(text)) {
    return "перекус";
  }
  return null;
}

const SLOT_WORD = "(завтрак|обед|ужин|перекус)";

/**
 * «перенеси обед в ужин» / «перенеси завтрак на обед» → from/to labels.
 */
export function extractMealSlotMoveFromMessage(
  message: string,
): { from: MealNoteLabel; to: MealNoteLabel } | null {
  const text = message.trim().toLowerCase().replace(/ё/g, "е");
  if (!text || !/перенес/i.test(text)) return null;
  const m = new RegExp(
    `перенес\\S*\\s+${SLOT_WORD}\\s+(?:в|на)\\s+${SLOT_WORD}${RU_TOKEN_END}`,
    "i",
  ).exec(text);
  if (!m?.[1] || !m[2]) return null;
  const from = parseMealTypeKey(m[1]);
  const to = parseMealTypeKey(m[2]);
  if (!from || !to || from === to) return null;
  const fromNote = mealNoteFromTypeKey(from);
  const toNote = mealNoteFromTypeKey(to);
  if (!fromNote || !toNote) return null;
  return { from: fromNote, to: toNote };
}

/** True when note already encodes a meal type the save path understands. */
export function noteHasMealType(note: string | undefined): boolean {
  if (!note?.trim()) return false;
  return /завтрак|обед|ужин|перекус|снек|snack/i.test(note);
}

/** Meal-type label already stored on a note, if any. */
export function mealTypeFromNoteLabel(note: string | undefined): MealNoteLabel | null {
  if (!note?.trim()) return null;
  if (/завтрак/i.test(note)) return "завтрак";
  if (/обед/i.test(note)) return "обед";
  if (/ужин/i.test(note)) return "ужин";
  if (/перекус|снек|snack/i.test(note)) return "перекус";
  return null;
}

/**
 * Fill / correct meals[].note from the user message.
 * Explicit user meal type wins over heuristic defaults (e.g. «перекус»).
 */
export function enrichAssistantActionsMealNotes(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  if (!actions?.meals?.length) return actions ?? null;
  const fromMsg = extractMealTypeFromMessage(userMessage);
  if (!fromMsg) return actions;

  let changed = false;
  const meals = actions.meals.map((m) => {
    const existing = mealTypeFromNoteLabel(m.note);
    if (existing === fromMsg) return m;
    // Missing note, or wrong slot (heuristic «перекус» vs user «ужин»).
    changed = true;
    return { ...m, note: fromMsg };
  });
  return changed ? { ...actions, meals } : actions;
}

/**
 * Pull relative day from Russian free text («вчерашний ужин», «сегодня»).
 * Prefer more specific: позавчера before вчера, послезавтра before завтра.
 */
export function extractTargetDateFromMessage(message: string): MealTargetDateLabel | null {
  const text = message.trim().toLowerCase().replace(/ё/g, "е");
  if (!text) return null;
  if (new RegExp(`позавчера${RU_TOKEN_END}`, "i").test(text)) return "позавчера";
  if (/вчерашн/i.test(text) || new RegExp(`вчера${RU_TOKEN_END}`, "i").test(text)) {
    return "вчера";
  }
  if (/yesterday/i.test(text)) return "вчера";
  if (new RegExp(`послезавтра${RU_TOKEN_END}`, "i").test(text)) return "послезавтра";
  if (/завтрашн/i.test(text) || new RegExp(`завтра${RU_TOKEN_END}`, "i").test(text)) {
    return "завтра";
  }
  if (/tomorrow/i.test(text)) return "завтра";
  if (/сегодняшн/i.test(text) || new RegExp(`сегодня${RU_TOKEN_END}`, "i").test(text)) {
    return "сегодня";
  }
  if (/today/i.test(text)) return "сегодня";
  return null;
}

/** Fill / correct targetDate from the user message when present. */
export function enrichAssistantActionsTargetDate(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  if (!actions) return null;
  const fromMsg = extractTargetDateFromMessage(userMessage);
  if (!fromMsg) return actions;
  if (actions.targetDate === fromMsg) return actions;
  return { ...actions, targetDate: fromMsg };
}

/** Time + meal-type + targetDate enrich in one pass (stream / route). */
export function enrichAssistantActionsMealMeta(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  const withTime = enrichAssistantActionsMealTimes(actions, userMessage);
  const withNotes = enrichAssistantActionsMealNotes(withTime, userMessage);
  return enrichAssistantActionsTargetDate(withNotes, userMessage);
}
