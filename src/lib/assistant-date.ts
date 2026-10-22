/**
 * Client-safe date helpers for assistant targetDate (сегодня / вчера / weekday).
 */

import { requireDateKey, shiftDateKey } from "@/lib/dates";
import {
  planWeekdayFromDateKey,
  WEEKDAY_LABELS_RU,
} from "@/lib/workouts/weekdays";

export function weekdayIndexFromLabel(label: string): number | null {
  const t = label.trim().toLowerCase();
  if (!t) return null;
  const map: Array<[RegExp, number]> = [
    [/^(пн|понедельник|mon)/i, 0],
    [/^(вт|вторник|tue)/i, 1],
    [/^(ср|среда|wed)/i, 2],
    [/^(чт|четверг|thu)/i, 3],
    [/^(пт|пятница|fri)/i, 4],
    [/^(сб|суббота|sat)/i, 5],
    [/^(вс|воскресенье|sun)/i, 6],
  ];
  for (const [re, idx] of map) {
    if (re.test(t)) return idx;
  }
  const exact = (WEEKDAY_LABELS_RU as readonly string[]).findIndex(
    (l) => l.toLowerCase() === t,
  );
  return exact >= 0 ? exact : null;
}

/** Resolve «сегодня» / «вчера» / «завтра» / YYYY-MM-DD / weekday label → date key. */
export function resolveAssistantDate(
  raw: string | undefined | null,
  today: string,
): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === "сегодня" || t === "today") return today;
  if (t === "вчера" || t === "yesterday") return shiftDateKey(today, -1);
  if (t === "позавчера") return shiftDateKey(today, -2);
  if (t === "завтра" || t === "tomorrow") return shiftDateKey(today, 1);
  if (t === "послезавтра") return shiftDateKey(today, 2);
  const exact = requireDateKey(raw.trim());
  if (exact) return exact;

  const wd = weekdayIndexFromLabel(raw.trim());
  if (wd == null) return null;
  const todayWd = planWeekdayFromDateKey(today);
  if (todayWd == null) return null;
  let delta = wd - todayWd;
  if (delta < 0) delta += 7;
  return shiftDateKey(today, delta);
}
