import { prisma } from "@/lib/prisma";
import { buildDayMealsPayload } from "@/lib/day-meals";
import { DIET_PROFILE_SELECT } from "@/lib/diet";
import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import { resolveWaterTargetMl } from "@/lib/water-target";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import {
  formatAssistantContext,
  type AssistantContextInput,
} from "@/lib/admin-assistant";

export async function loadAdminAssistantContext(
  userId: string,
  date: string,
  today: string,
): Promise<string> {
  const weekStart = weekStartMonday(date, null);
  const weekEnd = shiftDateKeyUtc(weekStart, 6);

  const [day, account, waterAgg, weightEntry, weekRows, sessions, routines] = await Promise.all([
    buildDayMealsPayload(userId, date),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...DIET_PROFILE_SELECT,
        timezone: true,
        waterTargetMl: true,
      },
    }),
    prisma.waterEntry.aggregate({
      where: { userId, date },
      _sum: { ml: true },
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
      select: { weightKg: true },
    }),
    prisma.mealEntry.groupBy({
      by: ["date"],
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      _sum: { calories: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.workoutRoutine.findMany({
      where: { userId },
      select: {
        name: true,
        _count: { select: { exercises: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const calMap = new Map(weekRows.map((r) => [r.date, r._sum.calories ?? 0]));
  const weekCalories: Array<{ date: string; calories: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = shiftDateKeyUtc(weekStart, i);
    weekCalories.push({ date: d, calories: calMap.get(d) ?? 0 });
  }

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
    };
  });

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
    waterMl: waterAgg._sum.ml ?? 0,
    waterTargetMl: resolveWaterTargetMl(account?.waterTargetMl),
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
    weekCalories,
    workouts,
    routines: routines.map((r) => ({
      name: r.name,
      exerciseCount: r._count.exercises,
    })),
  };

  return formatAssistantContext(input);
}
