export type BadgeDef = {
  key: string;
  title: string;
  description: string;
};

export const BADGE_DEFS: BadgeDef[] = [
  {
    key: "streak_7",
    title: "Неделя подряд",
    description: "7 дней серии записей",
  },
  {
    key: "streak_30",
    title: "Месяц привычки",
    description: "30 дней серии записей",
  },
  {
    key: "meals_100",
    title: "Сотня записей",
    description: "100 приёмов пищи в дневнике",
  },
  {
    key: "water_7",
    title: "Неделя воды",
    description: "Вода ≥1500 мл семь дней подряд",
  },
  {
    key: "first_log",
    title: "Первый шаг",
    description: "Первая запись еды",
  },
  {
    key: "week_on_target",
    title: "Неделя в цели",
    description: "5+ дней недели в пределах ±10% калорийной цели",
  },
];

export function badgeDef(key: string): BadgeDef | undefined {
  return BADGE_DEFS.find((b) => b.key === key);
}
