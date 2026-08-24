import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { dateRangeEnding, requireDateKey, shiftDateKey } from "@/lib/dates";
import { isSex, isWeightGoal, isGoalPace, recommendDiet, round1 } from "@/lib/diet";
import { mergeDecodedFoodStats } from "@/lib/html-text";
import { prisma } from "@/lib/prisma";
import { buildMoodFoodInsight, detectCalorieCorridorStreak } from "@/lib/stats-insights";
import {
  computeWeightChangeKg,
  medianWeightByDate,
  weightEntryOrderNewestFirst,
  weightEntryOrderOldestFirst,
} from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "quarter";

function parsePeriod(value: string | null): Period {
  if (value === "month") return "month";
  if (value === "quarter") return "quarter";
  return "week";
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
    const dayCount = period === "quarter" ? 90 : period === "month" ? 30 : 7;
    const dates = dateRangeEnding(end, dayCount);
    const start = dates[0];

    const [meals, weights, user, latestWeight, topFoods, firstWeight, lastWeight, allMealsForTiming, diaryNotes] = await Promise.all([
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
          fiber: true,
          sugar: true,
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
        take: 24,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderOldestFirst,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        select: { createdAt: true, calories: true },
      }),
      prisma.diaryNote.findMany({
        where: {
          userId: session.user.id,
          date: { gte: start, lte: end },
          mood: { not: null },
        },
        select: { date: true, mood: true },
      }),
    ]);

    const mealByDate = new Map<
      string,
      { calories: number; protein: number; fat: number; carbs: number; fiber: number; sugar: number }
    >();
    for (const meal of meals) {
      const current =
        mealByDate.get(meal.date) ?? { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 };
      current.calories += meal.calories;
      current.protein += meal.protein ?? 0;
      current.fat += meal.fat ?? 0;
      current.carbs += meal.carbs ?? 0;
      current.fiber += meal.fiber ?? 0;
      current.sugar += meal.sugar ?? 0;
      mealByDate.set(meal.date, current);
    }

    const weightByDate = medianWeightByDate(weights);

    const days = dates.map((date) => {
      const mealTotals = mealByDate.get(date);
      return {
        date,
        calories: mealTotals?.calories ?? 0,
        protein: round1(mealTotals?.protein ?? 0),
        fat: round1(mealTotals?.fat ?? 0),
        carbs: round1(mealTotals?.carbs ?? 0),
        fiber: round1(mealTotals?.fiber ?? 0),
        sugar: round1(mealTotals?.sugar ?? 0),
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

    // Hourly calorie distribution (0–23)
    const hourlyCalories = new Array<number>(24).fill(0);
    for (const m of allMealsForTiming) {
      const hour = new Date(m.createdAt).getHours();
      hourlyCalories[hour] = (hourlyCalories[hour] ?? 0) + m.calories;
    }

    const caloriesByDate = new Map(
      [...mealByDate.entries()].map(([date, totals]) => [date, totals.calories]),
    );
    const moodInsight = buildMoodFoodInsight(diaryNotes, caloriesByDate, calorieTarget);
    const corridorAlert = detectCalorieCorridorStreak(
      days.map((d) => ({ date: d.date, calories: d.calories })),
      calorieTarget,
      3,
    );

    // Week-over-week: last 7 days ending at `end` vs the prior 7 days
    const thisWeekDates = dateRangeEnding(end, 7);
    const prevWeekEnd = shiftDateKey(thisWeekDates[0], -1);
    const prevWeekDates = dateRangeEnding(prevWeekEnd, 7);
    const prevWeekStart = prevWeekDates[0];

    const prevWeekMeals = await prisma.mealEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: prevWeekStart, lte: prevWeekEnd },
      },
      select: { date: true, calories: true },
    });

    function weekAvgCalories(
      dates: string[],
      mealRows: Array<{ date: string; calories: number }>,
    ): { avgCalories: number; totalCalories: number; daysLogged: number } {
      const byDate = new Map<string, number>();
      for (const row of mealRows) {
        byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.calories);
      }
      const logged = dates.filter((d) => (byDate.get(d) ?? 0) > 0);
      const total = logged.reduce((sum, d) => sum + (byDate.get(d) ?? 0), 0);
      return {
        avgCalories: logged.length > 0 ? Math.round(total / logged.length) : 0,
        totalCalories: total,
        daysLogged: logged.length,
      };
    }

    const thisWeek = weekAvgCalories(thisWeekDates, meals);
    const prevWeek = weekAvgCalories(prevWeekDates, prevWeekMeals);
    const deltaAvg =
      thisWeek.daysLogged > 0 && prevWeek.daysLogged > 0
        ? thisWeek.avgCalories - prevWeek.avgCalories
        : null;
    const deltaPct =
      deltaAvg != null && prevWeek.avgCalories > 0
        ? Math.round((deltaAvg / prevWeek.avgCalories) * 100)
        : null;

    const weekOverWeek = {
      thisWeek: {
        start: thisWeekDates[0],
        end: thisWeekDates[thisWeekDates.length - 1],
        ...thisWeek,
      },
      prevWeek: {
        start: prevWeekDates[0],
        end: prevWeekDates[prevWeekDates.length - 1],
        ...prevWeek,
      },
      deltaAvgCalories: deltaAvg,
      deltaPct,
    };

    return NextResponse.json({
      period,
      start,
      end,
      days,
      calorieTarget,
      hourlyCalories,
      moodInsight,
      corridorAlert,
      weekOverWeek,
      topFoods: mergeDecodedFoodStats(
        topFoods.map((f) => ({
          dishName: f.dishName,
          count: f._count.id,
          avgCalories: Math.round(f._avg.calories ?? 0),
        })),
        8,
      ),
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
