export type ReminderKind =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "water_midday"
  | "water_evening"
  | "calories"
  | "streak"
  | "checkin"
  | "weekly";

export const REMINDER_SCHEDULE: Array<{ kind: ReminderKind; hour: number; weekday?: number }> = [
  { kind: "weekly", hour: 9, weekday: 1 },
  { kind: "breakfast", hour: 8 },
  { kind: "lunch", hour: 13 },
  { kind: "water_midday", hour: 14 },
  { kind: "dinner", hour: 18 },
  { kind: "water_evening", hour: 18 },
  { kind: "calories", hour: 19 },
  { kind: "streak", hour: 20 },
  { kind: "checkin", hour: 21 },
];

export type ReminderKindPref = {
  enabled?: boolean;
  /** Local hour 0–23; omit → schedule default. */
  hour?: number;
};

export type PushReminderPrefs = Partial<Record<ReminderKind, ReminderKindPref>>;

const REMINDER_KIND_SET = new Set<ReminderKind>(REMINDER_SCHEDULE.map((slot) => slot.kind));

export function isReminderKind(value: string): value is ReminderKind {
  return REMINDER_KIND_SET.has(value as ReminderKind);
}

export function parsePushReminderPrefs(raw: unknown): PushReminderPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const prefs: PushReminderPrefs = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isReminderKind(key) || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const pref: ReminderKindPref = {};
    if (typeof entry.enabled === "boolean") {
      pref.enabled = entry.enabled;
    }
    if (entry.hour !== undefined && entry.hour !== null) {
      const hour = Number(entry.hour);
      if (Number.isFinite(hour)) {
        const clamped = Math.min(23, Math.max(0, Math.trunc(hour)));
        pref.hour = clamped;
      }
    }
    if (pref.enabled !== undefined || pref.hour !== undefined) {
      prefs[key] = pref;
    }
  }
  return prefs;
}

export function normalizePushReminderPrefs(input: unknown): PushReminderPrefs {
  return parsePushReminderPrefs(input);
}

/** Schedule with user hour overrides; disabled kinds omitted. */
export function effectiveReminderSchedule(
  prefs?: PushReminderPrefs | null,
): Array<{ kind: ReminderKind; hour: number; weekday?: number }> {
  const result: Array<{ kind: ReminderKind; hour: number; weekday?: number }> = [];
  for (const slot of REMINDER_SCHEDULE) {
    const pref = prefs?.[slot.kind];
    if (pref?.enabled === false) continue;
    const hour =
      pref?.hour != null && Number.isFinite(pref.hour)
        ? Math.min(23, Math.max(0, Math.trunc(pref.hour)))
        : slot.hour;
    result.push({
      kind: slot.kind,
      hour,
      ...(slot.weekday != null ? { weekday: slot.weekday } : {}),
    });
  }
  return result;
}

export function reminderKindLabel(kind: ReminderKind, hour?: number): string {
  const h = hour ?? REMINDER_SCHEDULE.find((slot) => slot.kind === kind)?.hour ?? 12;
  const time = `${String(h).padStart(2, "0")}:00 местного`;
  const labels: Record<ReminderKind, string> = {
    breakfast: `Завтрак (${time})`,
    lunch: `Обед (${time})`,
    dinner: `Ужин (${time})`,
    water_midday: `Вода днём (${time})`,
    water_evening: `Вода вечером (${time})`,
    calories: `Сводка калорий (${time})`,
    streak: `Серия (${time})`,
    checkin: `Чек-ин (${time})`,
    weekly: `Итог недели (пн ${time})`,
  };
  return labels[kind];
}
