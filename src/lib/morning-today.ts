/**
 * Morning «Что сегодня» brief — one line under DayHero (not a dashboard).
 */

import { compareNutrient } from "@/lib/diet";
import { dayPartFromHour } from "@/lib/splash-tips";

export type MorningTodayRoutine = {
  name: string;
  planLabel?: string | null;
  muscleLabels: string[];
};

export type MorningTodayInput = {
  selectedIsToday: boolean;
  hour: number;
  loggedToday: boolean;
  calories: number;
  calorieTarget: number | null;
  /** StreakNudge owns empty / freeze / at-risk mornings. */
  streakOwnsMorning: boolean;
  gymDoneToday: boolean;
  routinesToday: MorningTodayRoutine[];
};

export type MorningTodayBrief = {
  eyebrow: string;
  line: string;
  cta: { label: string; href: string } | null;
};

function gymLabel(routines: MorningTodayRoutine[]): string {
  const first = routines[0];
  if (!first) return "Отдых";
  const name = first.planLabel?.trim() || first.name.trim();
  if (name) return name;
  if (first.muscleLabels.length > 0) {
    return first.muscleLabels.slice(0, 2).join(" · ");
  }
  return "Тренировка";
}

function caloriePart(input: MorningTodayInput): string | null {
  if (input.calorieTarget == null || input.calorieTarget <= 0) {
    return input.loggedToday ? null : "Первый приём — и день начат";
  }
  if (!input.loggedToday || input.calories <= 0) {
    return "Первый приём — и день начат";
  }
  const cmp = compareNutrient(input.calories, input.calorieTarget);
  if (cmp.kind === "deficit") {
    return `Ещё ~${Math.round(cmp.remaining)} ккал`;
  }
  if (cmp.kind === "surplus") {
    return `+${Math.round(Math.abs(cmp.remaining))} ккал сверх цели`;
  }
  return "Калории в норме";
}

/**
 * Build the morning brief, or null when the slot should stay empty.
 */
export function buildMorningTodayBrief(input: MorningTodayInput): MorningTodayBrief | null {
  if (!input.selectedIsToday) return null;
  if (dayPartFromHour(input.hour) !== "morning") return null;
  if (input.streakOwnsMorning) return null;

  const food = caloriePart(input);
  const hasPlan = input.routinesToday.length > 0;
  let gym: string | null = null;
  let cta: MorningTodayBrief["cta"] = null;

  if (input.gymDoneToday) {
    gym = "зал уже закрыт";
  } else if (hasPlan) {
    gym = gymLabel(input.routinesToday);
    cta = { label: "В зал", href: "/workouts" };
  } else {
    gym = "Отдых";
  }

  // After first meal + gym done, DayHero already tells the story — step aside.
  if (input.loggedToday && input.gymDoneToday && !hasPlan) {
    return null;
  }
  if (input.loggedToday && input.gymDoneToday && food == null) {
    return null;
  }

  const parts = [food, gym].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length === 0) return null;

  // Capitalize first segment only when it's the gym-only line.
  const line =
    food == null && gym
      ? gym.charAt(0).toUpperCase() + gym.slice(1)
      : parts.join(" · ");

  return {
    eyebrow: "Что сегодня",
    line,
    cta,
  };
}

export function streakOwnsMorning(input: {
  yesterdayEmpty: boolean;
  canFreezeYesterday: boolean;
  streakAtRisk: boolean;
}): boolean {
  return input.yesterdayEmpty || input.canFreezeYesterday || input.streakAtRisk;
}
