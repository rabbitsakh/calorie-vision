import { prisma } from "@/lib/prisma";
import { buildDayMealsPayload } from "@/lib/day-meals";
import { DIET_PROFILE_SELECT } from "@/lib/diet";
import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import { resolveWaterTargetMl } from "@/lib/water-target";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import { buildStreakPayload } from "@/lib/streak-payload";
import { loadActiveChallengeForUser } from "@/lib/challenge-progress";
import { challengeDef } from "@/lib/challenges";
import { decodeHtmlEntities } from "@/lib/html-text";
import {
  buildContextSnapshot,
  formatAssistantContext,
  type AssistantContextInput,
  type AssistantContextSnapshot,
} from "@/lib/admin-assistant";

function parseWeekdays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const days = raw.filter((n): n is number => typeof n === "number" && n >= 0 && n <= 6);
  return days.length ? days : null;
}

export async function loadAdminAssistantContextPack(
  userId: string,
  date: string,
  today: string,
): Promise<{ text: string; snapshot: AssistantContextSnapshot; input: AssistantContextInput }> {
  const weekStart = weekStartMonday(date, null);
  const weekEnd = shiftDateKeyUtc(weekStart, 6);
  const recentFrom = shiftDateKeyUtc(date, -6);

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...DIET_PROFILE_SELECT,
      timezone: true,
      waterTargetMl: true,
    },
  });

  const [
    day,
    waterAgg,
    weightEntry,
    weightHistory,
    weekRows,
    recentMeals,
    sessions,
    routines,
    streak,
    challenge,
  ] = await Promise.all([
    buildDayMealsPayload(userId, date),
    prisma.waterEntry.aggregate({
      where: { userId, date },
      _sum: { ml: true },
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
      select: { weightKg: true },
    }),
    prisma.weightEntry.findMany({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
      take: 10,
      select: { date: true, weightKg: true },
    }),
    prisma.mealEntry.groupBy({
      by: ["date"],
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { calories: true },
    }),
    prisma.mealEntry.findMany({
      where: { userId, date: { gte: recentFrom, lte: date } },
      select: { date: true, dishName: true, calories: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 14,
    }),
    prisma.workoutRoutine.findMany({
      where: { userId },
      select: {
        name: true,
        weekdays: true,
        _count: { select: { exercises: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    buildStreakPayload(userId, today),
    loadActiveChallengeForUser(userId, account?.timezone ?? null),
  ]);

  const calMap = new Map(weekRows.map((r) => [r.date, r._sum.calories ?? 0]));
  const weekCalories: Array<{ date: string; calories: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDateKeyUtc(weekStart, i);
    weekCalories.push({ date: d, calories: calMap.get(d) ?? 0 });
  }

  const byRecent = new Map<string, { calories: number; dishes: string[] }>();
  for (const row of recentMeals) {
    const cur = byRecent.get(row.date) ?? { calories: 0, dishes: [] };
    cur.calories += row.calories;
    if (cur.dishes.length < 8) {
      cur.dishes.push(decodeHtmlEntities(row.dishName));
    }
    byRecent.set(row.date, cur);
  }
  const recentDays = Array.from(byRecent.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([d, v]) => ({ date: d, calories: v.calories, dishes: v.dishes }));

  const workouts = sessions.map((s) => {
    const summary = serializeSessionSummary(s);
    return {
      date: summary.date,
      muscleLabels: summary.muscleLabels,
      exerciseCount: summary.exerciseCount,
      setCount: summary.setCount,
      totalLoad: summary.totalLoad,
      cardioDistanceKm: summary.cardioDistanceKm,
      cardioDurationSec: summary.cardioDurationSec,
      ended: Boolean(summary.endedAt),
      note: summary.note,
      exercises: s.exercises
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ex) => ex.name)
        .slice(0, 10),
    };
  });

  const challengeLabel = challenge
    ? `${challenge.title || challengeDef(challenge.challengeKey)?.title || challenge.challengeKey} (${challenge.progress}/${challenge.target})`
    : null;

  const input: AssistantContextInput = {
    date,
    today,
    profile: {
      sex: account?.sex ?? null,
      heightCm: account?.heightCm ?? null,
      birthYear: account?.birthYear ?? null,
      goal: account?.goal ?? null,
      goalPace: account?.goalPace ?? null,
      activityLevel: account?.activityLevel ?? null,
    },
    weightKg: weightEntry?.weightKg ?? null,
    weightTrend: weightHistory.map((w) => ({ date: w.date, kg: w.weightKg })),
    waterMl: waterAgg._sum.ml ?? 0,
    waterTargetMl: resolveWaterTargetMl(account?.waterTargetMl),
    streakDays: typeof streak.streak === "number" ? streak.streak : null,
    challenge: challengeLabel,
    day: {
      calories: day.totalCalories,
      protein: day.totalProtein,
      fat: day.totalFat,
      carbs: day.totalCarbs,
      fiber: day.totalFiber,
      sugar: day.totalSugar,
      target: day.target
        ? {
            calories: day.target.calories,
            protein: day.target.protein,
            fat: day.target.fat,
            carbs: day.target.carbs,
            fiber: day.target.fiber,
            sugar: day.target.sugar,
          }
        : null,
      meals: day.entries.map((e) => ({
        dishName: e.dishName,
        calories: e.calories,
        protein: e.protein,
        fat: e.fat,
        carbs: e.carbs,
        portionGrams: e.portionGrams,
        mealType: e.mealType,
      })),
    },
    recentDays,
    weekCalories,
    workouts,
    routines: routines.map((r) => ({
      name: r.name,
      exerciseCount: r._count.exercises,
      weekdays: parseWeekdays(r.weekdays),
    })),
  };

  return {
    text: formatAssistantContext(input),
    snapshot: buildContextSnapshot(input),
    input,
  };
}

/** @deprecated use loadAdminAssistantContextPack */
export async function loadAdminAssistantContext(
  userId: string,
  date: string,
  today: string,
): Promise<string> {
  const pack = await loadAdminAssistantContextPack(userId, date, today);
  return pack.text;
}
