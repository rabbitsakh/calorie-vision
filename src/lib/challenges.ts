import { WATER_HABIT_DAY_ML } from "@/lib/water-target";
import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";

export type ChallengeDef = {
  key: string;
  title: string;
  description: string;
  target: number;
};

export type ChallengeOption = ChallengeDef & {
  /** True when target needs more days than remain in the week (from today). */
  tight: boolean;
  daysLeft: number;
  recommended?: boolean;
};

/** Legacy challenge key → current catalog key. */
const CHALLENGE_KEY_ALIASES: Record<string, string> = {
  water_7: "water_week_7",
};

export const CHALLENGE_DEFS: ChallengeDef[] = [
  {
    key: "breakfast_7",
    title: "Завтрак каждый день",
    description: "Запишите завтрак 7 дней подряд на этой неделе",
    target: 7,
  },
  {
    key: "water_5",
    title: "Пять дней с водой",
    description: `≥${WATER_HABIT_DAY_ML} мл воды в 5 днях этой недели`,
    target: 5,
  },
  {
    key: "log_5",
    title: "Пять дней дневника",
    description: "Любые записи еды в 5 днях этой недели",
    target: 5,
  },
  {
    key: "dinner_5",
    title: "Ужин пять дней",
    description: "Запишите ужин в 5 днях этой недели",
    target: 5,
  },
  {
    key: "water_week_7",
    title: "Неделя воды",
    description: `≥${WATER_HABIT_DAY_ML} мл воды все 7 дней недели`,
    target: 7,
  },
  {
    key: "weigh_3",
    title: "Три взвешивания",
    description: "Отметьте вес в 3 разных днях этой недели",
    target: 3,
  },
  {
    key: "corridor_4",
    title: "Четыре дня в коридоре",
    description: "4 дня недели в пределах калорийного коридора",
    target: 4,
  },
];

export function normalizeChallengeKey(key: string): string {
  return CHALLENGE_KEY_ALIASES[key] ?? key;
}

export function challengeDef(key: string): ChallengeDef | undefined {
  return CHALLENGE_DEFS.find((c) => c.key === normalizeChallengeKey(key));
}

/** Days left in the Mon–Sun week including today (1–7). */
export function daysLeftInChallengeWeek(
  today: string,
  weekStart: string = weekStartMonday(today),
): number {
  const start = new Date(weekStart + "T12:00:00Z").getTime();
  const now = new Date(today + "T12:00:00Z").getTime();
  const dayIndex = Math.round((now - start) / 86_400_000);
  if (dayIndex < 0) return 7;
  if (dayIndex > 6) return 1;
  return 7 - dayIndex;
}

export type ChallengeRecommendCtx = {
  breakfastDays: number;
  waterDays: number;
  logDays: number;
  dinnerDays: number;
  weighDays: number;
  corridorDays: number;
  daysLeft: number;
};

/**
 * Soft recommendation: nudge the weakest habit that still fits the week.
 * Prefer 5-day / 3–4-day goals mid-week; never push impossible 7-day targets.
 */
export function recommendChallengeKey(ctx: ChallengeRecommendCtx): string {
  const candidates: Array<{ key: string; score: number; target: number }> = [
    { key: "breakfast_7", score: 7 - ctx.breakfastDays, target: 7 },
    { key: "water_5", score: 5 - ctx.waterDays, target: 5 },
    { key: "log_5", score: 5 - ctx.logDays, target: 5 },
    { key: "dinner_5", score: 5 - ctx.dinnerDays, target: 5 },
    { key: "water_week_7", score: 7 - ctx.waterDays, target: 7 },
    { key: "weigh_3", score: 3 - ctx.weighDays, target: 3 },
    { key: "corridor_4", score: 4 - ctx.corridorDays, target: 4 },
  ];

  const feasible = candidates.filter((c) => c.target <= ctx.daysLeft && c.score > 0);
  const pool = feasible.length > 0 ? feasible : candidates.filter((c) => c.target <= ctx.daysLeft);
  const ranked = (pool.length > 0 ? pool : candidates).sort((a, b) => b.score - a.score);
  return ranked[0]?.key ?? "log_5";
}

/** Options with mid-week feasibility + optional recommendation flag. */
export function challengeOptionsForWeek(
  today: string,
  weekStart?: string,
  recommendedKey?: string | null,
): ChallengeOption[] {
  const start = weekStart ?? weekStartMonday(today);
  const daysLeft = daysLeftInChallengeWeek(today, start);
  return CHALLENGE_DEFS.map((def) => ({
    ...def,
    daysLeft,
    tight: def.target > daysLeft,
    recommended: recommendedKey != null && def.key === recommendedKey,
  }));
}

export function shiftChallengeDate(dateKey: string, days: number): string {
  return shiftDateKeyUtc(dateKey, days);
}

export { weekStartMonday } from "@/lib/streak-utils";
