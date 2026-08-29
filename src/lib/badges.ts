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
  /** Days in calorie corridor in the last 7 days (for week_on_target). */
  onTargetDays: number;
  /** Days in calorie corridor in the last 30 days (for month_on_target). */
  monthOnTargetDays: number;
  weightLogCount: number;
  /** Completed weekly challenges (completedAt set). */
  challengesCompleted: number;
};

export type NextBadgeHint = BadgeDef & {
  current: number;
  target: number;
  /** 0–1 progress toward unlock. */
  ratio: number;
};

export type BadgeGroupId =
  | "streak"
  | "meals"
  | "water"
  | "target"
  | "weight"
  | "challenges";

export const BADGE_GROUP_LABELS: Record<BadgeGroupId, string> = {
  streak: "Серия",
  meals: "Дневник",
  water: "Вода",
  target: "Коридор",
  weight: "Вес",
  challenges: "Челленджи",
};

export function badgeGroup(key: string): BadgeGroupId {
  if (key.startsWith("streak_")) return "streak";
  if (key.startsWith("meals_") || key === "first_log") return "meals";
  if (key.startsWith("water_")) return "water";
  if (key === "week_on_target" || key === "month_on_target") return "target";
  if (key.startsWith("weight_")) return "weight";
  if (key.startsWith("challenges_")) return "challenges";
  return "meals";
}

/** Days in ±corridor over last 30 needed for month_on_target. */
export const MONTH_ON_TARGET_DAYS = 20;

export const BADGE_DEFS: BadgeDef[] = [
  {
    key: "first_log",
    title: "Первый шаг",
    description: "Первая запись еды",
  },
  {
    key: "streak_3",
    title: "Три дня подряд",
    description: "3 дня серии записей",
  },
  {
    key: "streak_7",
    title: "Неделя подряд",
    description: "7 дней серии записей",
  },
  {
    key: "streak_14",
    title: "Две недели подряд",
    description: "14 дней серии записей",
  },
  {
    key: "streak_30",
    title: "Месяц привычки",
    description: "30 дней серии записей",
  },
  {
    key: "streak_60",
    title: "Два месяца ритма",
    description: "60 дней серии записей",
  },
  {
    key: "meals_10",
    title: "Десятка",
    description: "10 приёмов пищи в дневнике",
  },
  {
    key: "meals_50",
    title: "Полсотни",
    description: "50 приёмов пищи в дневнике",
  },
  {
    key: "meals_100",
    title: "Сотня записей",
    description: "100 приёмов пищи в дневнике",
  },
  {
    key: "meals_500",
    title: "Полтысячи",
    description: "500 приёмов пищи в дневнике",
  },
  {
    key: "meals_1000",
    title: "Тысяча записей",
    description: "1000 приёмов пищи в дневнике",
  },
  {
    key: "water_3",
    title: "Три дня воды",
    description: `Вода ≥${WATER_HABIT_DAY_ML} мл три дня подряд`,
  },
  {
    key: "water_7",
    title: "Неделя воды",
    description: `Вода ≥${WATER_HABIT_DAY_ML} мл семь дней подряд`,
  },
  {
    key: "water_14",
    title: "Две недели воды",
    description: `Вода ≥${WATER_HABIT_DAY_ML} мл четырнадцать дней подряд`,
  },
  {
    key: "water_30",
    title: "Месяц воды",
    description: `Вода ≥${WATER_HABIT_DAY_ML} мл тридцать дней подряд`,
  },
  {
    key: "week_on_target",
    title: "Неделя в цели",
    description: "5+ дней недели в пределах калорийного коридора",
  },
  {
    key: "month_on_target",
    title: "Месяц в коридоре",
    description: `${MONTH_ON_TARGET_DAYS}+ дней за 30 в пределах калорийного коридора`,
  },
  {
    key: "weight_5",
    title: "Пять взвешиваний",
    description: "5 записей веса",
  },
  {
    key: "weight_10",
    title: "Десять взвешиваний",
    description: "10 записей веса",
  },
  {
    key: "weight_30",
    title: "Месяц весов",
    description: "30 записей веса",
  },
  {
    key: "challenges_1",
    title: "Первый челлендж",
    description: "Закрыть один недельный челлендж",
  },
  {
    key: "challenges_4",
    title: "Месяц целей",
    description: "Закрыть 4 недельных челленджа",
  },
  {
    key: "challenges_12",
    title: "Год привычек",
    description: "Закрыть 12 недельных челленджей",
  },
];

export function badgeDef(key: string): BadgeDef | undefined {
  return BADGE_DEFS.find((b) => b.key === key);
}

/** Progress toward a badge unlock for UI bars. */
export function getBadgeProgress(
  key: string,
  stats: BadgeStatsSnapshot,
): { current: number; target: number } | null {
  switch (key) {
    case "first_log":
      return { current: Math.min(stats.mealCount, 1), target: 1 };
    case "streak_3":
      return { current: Math.min(stats.streak, 3), target: 3 };
    case "streak_7":
      return { current: Math.min(stats.streak, 7), target: 7 };
    case "streak_14":
      return { current: Math.min(stats.streak, 14), target: 14 };
    case "streak_30":
      return { current: Math.min(stats.streak, 30), target: 30 };
    case "streak_60":
      return { current: Math.min(stats.streak, 60), target: 60 };
    case "meals_10":
      return { current: Math.min(stats.mealCount, 10), target: 10 };
    case "meals_50":
      return { current: Math.min(stats.mealCount, 50), target: 50 };
    case "meals_100":
      return { current: Math.min(stats.mealCount, 100), target: 100 };
    case "meals_500":
      return { current: Math.min(stats.mealCount, 500), target: 500 };
    case "meals_1000":
      return { current: Math.min(stats.mealCount, 1000), target: 1000 };
    case "water_3":
      return { current: Math.min(stats.waterStreak, 3), target: 3 };
    case "water_7":
      return { current: Math.min(stats.waterStreak, 7), target: 7 };
    case "water_14":
      return { current: Math.min(stats.waterStreak, 14), target: 14 };
    case "water_30":
      return { current: Math.min(stats.waterStreak, 30), target: 30 };
    case "week_on_target":
      return { current: Math.min(stats.onTargetDays, 5), target: 5 };
    case "month_on_target":
      return {
        current: Math.min(stats.monthOnTargetDays, MONTH_ON_TARGET_DAYS),
        target: MONTH_ON_TARGET_DAYS,
      };
    case "weight_5":
      return { current: Math.min(stats.weightLogCount, 5), target: 5 };
    case "weight_10":
      return { current: Math.min(stats.weightLogCount, 10), target: 10 };
    case "weight_30":
      return { current: Math.min(stats.weightLogCount, 30), target: 30 };
    case "challenges_1":
      return { current: Math.min(stats.challengesCompleted, 1), target: 1 };
    case "challenges_4":
      return { current: Math.min(stats.challengesCompleted, 4), target: 4 };
    case "challenges_12":
      return { current: Math.min(stats.challengesCompleted, 12), target: 12 };
    default:
      return null;
  }
}

/** Keys that should be unlocked for the given stats (ignores already-earned). */
export function qualifyingBadgeKeys(stats: BadgeStatsSnapshot): string[] {
  const keys: string[] = [];
  for (const def of BADGE_DEFS) {
    const progress = getBadgeProgress(def.key, stats);
    if (!progress) continue;
    if (progress.current >= progress.target) keys.push(def.key);
  }
  return keys;
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
    const progress = getBadgeProgress(def.key, stats);
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

/** Empty stats snapshot for tests / defaults. */
export function emptyBadgeStats(): BadgeStatsSnapshot {
  return {
    streak: 0,
    mealCount: 0,
    waterStreak: 0,
    onTargetDays: 0,
    monthOnTargetDays: 0,
    weightLogCount: 0,
    challengesCompleted: 0,
  };
}
