/**
 * Parse / enrich meal wall-clock times and meal-type notes from assistant cv-actions + user text.
 */

import type { AssistantActions } from "@/lib/admin-assistant";

export type MealNoteLabel = "завтрак" | "обед" | "ужин" | "перекус";

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

/** Fill missing meals[].time from the user message when present. */
export function enrichAssistantActionsMealTimes(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  if (!actions?.meals?.length) return actions ?? null;
  const fromMsg = extractMealTimeFromMessage(userMessage);
  if (!fromMsg) return actions;

  let changed = false;
  const meals = actions.meals.map((m) => {
    if (parseMealTimeHHMM(m.time)) return m;
    changed = true;
    return { ...m, time: fromMsg };
  });
  return changed ? { ...actions, meals } : actions;
}

/** End of a Russian token (JS `\b` is ASCII-only). */
const RU_TOKEN_END = "(?=$|[\\s.,;:!?…»\"')\\]])";

/**
 * Pull meal-type label from Russian free text («на перекус», «на завтрак»).
 */
export function extractMealTypeFromMessage(message: string): MealNoteLabel | null {
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

/** True when note already encodes a meal type the save path understands. */
export function noteHasMealType(note: string | undefined): boolean {
  if (!note?.trim()) return false;
  return /завтрак|обед|ужин|перекус|снек|snack/i.test(note);
}

/** Fill missing meals[].note meal-type from the user message when present. */
export function enrichAssistantActionsMealNotes(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  if (!actions?.meals?.length) return actions ?? null;
  const fromMsg = extractMealTypeFromMessage(userMessage);
  if (!fromMsg) return actions;

  let changed = false;
  const meals = actions.meals.map((m) => {
    if (noteHasMealType(m.note)) return m;
    changed = true;
    return { ...m, note: fromMsg };
  });
  return changed ? { ...actions, meals } : actions;
}

/** Time + meal-type enrich in one pass (stream / route). */
export function enrichAssistantActionsMealMeta(
  actions: AssistantActions | null | undefined,
  userMessage: string,
): AssistantActions | null {
  const withTime = enrichAssistantActionsMealTimes(actions, userMessage);
  return enrichAssistantActionsMealNotes(withTime, userMessage);
}
