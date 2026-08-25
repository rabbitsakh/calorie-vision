import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export type BadgeDef = {
  key: string;
  title: string;
  description: string;
};

export type BadgeStatsSnapshot = {
  streak: number;
  mealCount: number;
  waterStreak: number;
  onTargetDays: number;
};

export type NextBadgeHint = BadgeDef & {
  current: number;
  target: number;
  /** 0–1 progress toward unlock. */
  ratio: number;
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
    description: `Вода ≥${WATER_HABIT_DAY_ML} мл семь дней подряд`,
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

function progressForBadge(
  key: string,
  stats: BadgeStatsSnapshot,
): { current: number; target: number } | null {
  switch (key) {
    case "first_log":
      return { current: Math.min(stats.mealCount, 1), target: 1 };
    case "streak_7":
      return { current: Math.min(stats.streak, 7), target: 7 };
    case "streak_30":
      return { current: Math.min(stats.streak, 30), target: 30 };
    case "meals_100":
      return { current: Math.min(stats.mealCount, 100), target: 100 };
    case "water_7":
      return { current: Math.min(stats.waterStreak, 7), target: 7 };
    case "week_on_target":
      return { current: Math.min(stats.onTargetDays, 5), target: 5 };
    default:
      return null;
  }
}

/** Closest locked badge — prefer highest progress ratio, then nearest remaining steps. */
export function nextBadgeHint(
  unlockedKeys: Iterable<string>,
  stats: BadgeStatsSnapshot,
): NextBadgeHint | null {
  const earned = new Set(unlockedKeys);
  let best: NextBadgeHint | null = null;

  for (const def of BADGE_DEFS) {
    if (earned.has(def.key)) continue;
    const progress = progressForBadge(def.key, stats);
    if (!progress) continue;
    const ratio = progress.target > 0 ? progress.current / progress.target : 0;
    const candidate: NextBadgeHint = { ...def, ...progress, ratio };
    if (
      !best ||
      candidate.ratio > best.ratio ||
      (candidate.ratio === best.ratio &&
        candidate.target - candidate.current < best.target - best.current)
    ) {
      best = candidate;
    }
  }

  return best;
}
