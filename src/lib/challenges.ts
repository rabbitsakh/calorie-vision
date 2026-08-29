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
    key: "water_7",
    title: "Неделя воды",
    description: `≥${WATER_HABIT_DAY_ML} мл воды все 7 дней недели`,
    target: 7,
  },
];

export function challengeDef(key: string): ChallengeDef | undefined {
  return CHALLENGE_DEFS.find((c) => c.key === key);
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

/** Options with mid-week feasibility hints (no retroactive credit assumed). */
export function challengeOptionsForWeek(today: string, weekStart?: string): ChallengeOption[] {
  const start = weekStart ?? weekStartMonday(today);
  const daysLeft = daysLeftInChallengeWeek(today, start);
  return CHALLENGE_DEFS.map((def) => ({
    ...def,
    daysLeft,
    tight: def.target > daysLeft,
  }));
}

/** @deprecated use shiftDateKeyUtc — kept for callers expecting local helper name. */
export function shiftChallengeDate(dateKey: string, days: number): string {
  return shiftDateKeyUtc(dateKey, days);
}

/** Timezone-aware Monday YYYY-MM-DD (re-exported from streak-utils). */
export { weekStartMonday } from "@/lib/streak-utils";
