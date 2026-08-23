export type ReminderKind =
  | "breakfast"
  | "lunch"
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
  { kind: "water_evening", hour: 18 },
  { kind: "calories", hour: 19 },
  { kind: "streak", hour: 20 },
  { kind: "checkin", hour: 21 },
];

export function reminderKindLabel(kind: ReminderKind): string {
  const labels: Record<ReminderKind, string> = {
    breakfast: "Завтрак (8:00 местного)",
    lunch: "Обед (13:00 местного)",
    water_midday: "Вода днём (14:00 местного)",
    water_evening: "Вода вечером (18:00 местного)",
    calories: "Сводка калорий (19:00 местного)",
    streak: "Серия (20:00 местного)",
    checkin: "Чек-ин (21:00 местного)",
    weekly: "Итог недели (пн 9:00 местного)",
  };
  return labels[kind];
}
