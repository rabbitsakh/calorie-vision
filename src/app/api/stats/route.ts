import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { dateRangeEnding, requireDateKey } from "@/lib/dates";
import { isSex, isWeightGoal, isGoalPace, recommendDiet, round1 } from "@/lib/diet";
import { prisma } from "@/lib/prisma";
import {
  computeWeightChangeKg,
  latestWeightByDate,
  weightEntryOrderNewestFirst,
  weightEntryOrderOldestFirst,
} from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

type Period = "week" | "month";

function parsePeriod(value: string | null): Period {
  return value === "month" ? "month" : "week";
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const period = parsePeriod(request.nextUrl.searchParams.get("period"));
    const endParam = request.nextUrl.searchParams.get("end");
    const endDate = endParam ? requireDateKey(endParam) : null;
    if (endParam && !endDate) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const today = new Date();
    const end =
      endDate ??
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dayCount = period === "month" ? 30 : 7;
    const dates = dateRangeEnding(end, dayCount);
    const start = dates[0];

    const [meals, weights, user, latestWeight, topFoods, firstWeight, lastWeight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: {
          userId: session.user.id,
          date: { gte: start, lte: end },
        },
        select: {
          date: true,
          calories: true,
          protein: true,
          fat: true,
          carbs: true,
        },
      }),
      prisma.weightEntry.findMany({
        where: {
          userId: session.user.id,
          date: { gte: start, lte: end },
        },
        select: { date: true, weightKg: true, measuredAt: true, id: true },
        orderBy: weightEntryOrderOldestFirst,
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true, goalPace: true, sex: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      prisma.mealEntry.groupBy({
        by: ["dishName"],
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        _count: { id: true },
        _avg: { calories: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderOldestFirst,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
    ]);

    const mealByDate = new Map<string, { calories: number; protein: number; fat: number; carbs: number }>();
    for (const meal of meals) {
      const current = mealByDate.get(meal.date) ?? { calories: 0, protein: 0, fat: 0, carbs: 0 };
      current.calories += meal.calories;
      current.protein += meal.protein ?? 0;
      current.fat += meal.fat ?? 0;
      current.carbs += meal.carbs ?? 0;
      mealByDate.set(meal.date, current);
    }

    const weightByDate = latestWeightByDate(weights);

    const days = dates.map((date) => {
      const mealTotals = mealByDate.get(date);
      return {
        date,
        calories: mealTotals?.calories ?? 0,
        protein: round1(mealTotals?.protein ?? 0),
        fat: round1(mealTotals?.fat ?? 0),
        carbs: round1(mealTotals?.carbs ?? 0),
        weightKg: weightByDate.get(date) ?? null,
      };
    });

    const daysWithMeals = days.filter((day) => day.calories > 0);
    const daysWithWeight = days.filter((day) => day.weightKg != null);

    const avgCalories =
      daysWithMeals.length > 0
        ? Math.round(daysWithMeals.reduce((sum, day) => sum + day.calories, 0) / daysWithMeals.length)
        : 0;

    const resolvedGoal = isWeightGoal(user?.goal) ? user!.goal : null;
    const resolvedPace = isGoalPace(user?.goalPace) ? user!.goalPace : null;
    const resolvedSex = isSex(user?.sex) ? user!.sex : null;
    const calorieTarget = resolvedGoal && latestWeight
      ? recommendDiet(latestWeight.weightKg, resolvedGoal, resolvedPace, resolvedSex).calories
      : null;

    return NextResponse.json({
      period,
      start,
      end,
      days,
      calorieTarget,
      topFoods: topFoods.map((f) => ({
        dishName: f.dishName,
        count: f._count.id,
        avgCalories: Math.round(f._avg.calories ?? 0),
      })),
      summary: {
        avgCalories,
        totalMealDays: daysWithMeals.length,
        weightChangeKg: computeWeightChangeKg(firstWeight, lastWeight),
        firstWeightKg: firstWeight?.weightKg ?? null,
        lastWeightKg: lastWeight?.weightKg ?? null,
        daysWithWeight: daysWithWeight.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
