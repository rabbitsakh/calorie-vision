/**
 * Parse / enrich meal wall-clock times from assistant cv-actions and user text.
 */

import type { AssistantActions } from "@/lib/admin-assistant";

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
