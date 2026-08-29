/**
 * Shared challenge progress for /api/challenges and /api/ration-day.
 */

import { prisma } from "@/lib/prisma";
import {
  challengeDef,
  normalizeChallengeKey,
  shiftChallengeDate,
  weekStartMonday,
} from "@/lib/challenges";
import {
  DIET_PROFILE_SELECT,
  isCalorieGoalCorridor,
  isWeightGoal,
  recommendDietForProfile,
  type WeightGoal,
} from "@/lib/diet";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { toDateKeyTz } from "@/lib/dates";

export type ActiveChallengePayload = {
  challengeKey: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt: Date | string | null;
  weekStart: string;
};

export async function computeChallengeProgress(
  userId: string,
  challengeKey: string,
  weekStart: string,
  opts?: {
    calorieTarget?: number | null;
    goal?: WeightGoal | null;
  },
): Promise<number> {
  const key = normalizeChallengeKey(challengeKey);
  const dates = Array.from({ length: 7 }, (_, i) => shiftChallengeDate(weekStart, i));

  if (key === "breakfast_7") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "BREAKFAST" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "water_5" || key === "water_week_7") {
    const rows = await prisma.waterEntry.groupBy({
      by: ["date"],
      where: { userId, date: { in: dates } },
      _sum: { ml: true },
    });
    return rows.filter((r) => (r._sum.ml ?? 0) >= WATER_HABIT_DAY_ML).length;
  }

  if (key === "log_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "dinner_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "DINNER" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "weigh_3") {
    const rows = await prisma.weightEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "corridor_4") {
    const target = opts?.calorieTarget;
    if (!target) return 0;
    const meals = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true, calories: true },
    });
    const calByDate = new Map<string, number>();
    for (const m of meals) {
      calByDate.set(m.date, (calByDate.get(m.date) ?? 0) + m.calories);
    }
    let days = 0;
    for (const d of dates) {
      const cal = calByDate.get(d);
      if (cal == null || cal === 0) continue;
      if (isCalorieGoalCorridor(cal, target, opts?.goal)) days += 1;
    }
    return days;
  }

  return 0;
}

/** Active challenge snapshot for ration-day bootstrap (syncs progress when needed). */
export async function loadActiveChallengeForUser(
  userId: string,
  timezone?: string | null,
): Promise<ActiveChallengePayload | null> {
  const today = toDateKeyTz(new Date(), timezone);
  const weekStart = weekStartMonday(today, timezone);

  const active = await prisma.userChallenge.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });
  if (!active) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...DIET_PROFILE_SELECT },
  });
  const goal = user?.goal && isWeightGoal(user.goal) ? user.goal : null;
  const weight = await prisma.weightEntry.findFirst({
    where: { userId },
    orderBy: weightEntryOrderNewestFirst,
  });
  const diet = recommendDietForProfile(weight?.weightKg, user);
  const progress = await computeChallengeProgress(userId, active.challengeKey, weekStart, {
    calorieTarget: diet?.calories ?? null,
    goal,
  });
  const def = challengeDef(active.challengeKey);
  const completed = progress >= active.target;
  let completedAt = active.completedAt;

  if (progress !== active.progress || (completed && !active.completedAt)) {
    const updated = await prisma.userChallenge.update({
      where: { id: active.id },
      data: {
        progress,
        completedAt: completed ? active.completedAt ?? new Date() : null,
      },
    });
    completedAt = updated.completedAt;
  }

  return {
    challengeKey: normalizeChallengeKey(active.challengeKey),
    title: def?.title ?? active.challengeKey,
    description: def?.description ?? "",
    progress,
    target: active.target,
    completed,
    completedAt,
    weekStart,
  };
}
