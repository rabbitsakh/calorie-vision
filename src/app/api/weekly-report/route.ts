import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { mondayOfWeek, requireDateKey, shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { DIET_PROFILE_SELECT, recommendDietForProfile, round1 } from "@/lib/diet";
import { mergeDecodedFoodStats } from "@/lib/html-text";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export const dynamic = "force-dynamic";

function formatWeekRange(start: string, end: string): string {
  const fmt = (key: string) => {
    const d = new Date(key + "T12:00:00Z");
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, fiberTargetG: true, sugarTargetG: true, ...DIET_PROFILE_SELECT },
    });

    const endParam = request.nextUrl.searchParams.get("end");
    const endDate = endParam ? requireDateKey(endParam) : null;
    const anchor = endDate ?? toDateKeyTz(new Date(), user?.timezone);
    // Mon–Sun week containing `end` — same window as WeeklyPlan bars
    const start = mondayOfWeek(anchor);
    const end = shiftDateKey(start, 6);
    const dates = Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));

    const [meals, waterEntries, weight, topFoods] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
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
      prisma.waterEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        select: { date: true, ml: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      prisma.mealEntry.groupBy({
        by: ["dishName"],
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 12,
      }),
    ]);

    const caloriesByDate = new Map<string, number>();
    const fiberByDate = new Map<string, number>();
    const sugarByDate = new Map<string, number>();
    for (const m of meals) {
      caloriesByDate.set(m.date, (caloriesByDate.get(m.date) ?? 0) + m.calories);
      fiberByDate.set(m.date, (fiberByDate.get(m.date) ?? 0) + (m.fiber ?? 0));
      sugarByDate.set(m.date, (sugarByDate.get(m.date) ?? 0) + (m.sugar ?? 0));
    }

    const waterByDate = new Map<string, number>();
    for (const w of waterEntries) {
      waterByDate.set(w.date, (waterByDate.get(w.date) ?? 0) + w.ml);
    }

    const daysWithMeals = dates.filter((d) => (caloriesByDate.get(d) ?? 0) > 0);
    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const avgCalories = daysWithMeals.length > 0 ? Math.round(totalCalories / daysWithMeals.length) : 0;

    const target = recommendDietForProfile(weight?.weightKg, user);

    let bestDay: { date: string; calories: number } | null = null;
    let lightestDay: { date: string; calories: number } | null = null;
    let closestToTarget: { date: string; calories: number; diff: number } | null = null;
    let hardestDay: { date: string; calories: number; diff: number } | null = null;

    for (const d of daysWithMeals) {
      const cal = caloriesByDate.get(d)!;
      if (!bestDay || cal > bestDay.calories) bestDay = { date: d, calories: cal };
      if (!lightestDay || cal < lightestDay.calories) lightestDay = { date: d, calories: cal };

      if (target) {
        const diff = Math.abs(cal - target.calories);
        if (!closestToTarget || diff < closestToTarget.diff) {
          closestToTarget = { date: d, calories: cal, diff };
        }
        if (!hardestDay || diff > hardestDay.diff) {
          hardestDay = { date: d, calories: cal, diff };
        }
      }
    }

    // Soften wording: if same day is both closest and hardest, only show closest
    if (
      closestToTarget &&
      hardestDay &&
      closestToTarget.date === hardestDay.date
    ) {
      hardestDay = null;
    }

    const waterDays = dates.filter((d) => (waterByDate.get(d) ?? 0) > 0);
    const avgWaterMl =
      waterDays.length > 0
        ? Math.round(waterDays.reduce((s, d) => s + (waterByDate.get(d) ?? 0), 0) / waterDays.length)
        : 0;

    const insights: string[] = [];

    if (daysWithMeals.length >= 5) {
      insights.push(`Вы вели дневник ${daysWithMeals.length} из 7 дней — отличная регулярность!`);
    } else if (daysWithMeals.length >= 3) {
      insights.push(`Записи ${daysWithMeals.length} дней из 7 — попробуйте чаще фиксировать еду.`);
    } else if (daysWithMeals.length > 0) {
      insights.push(`Всего ${daysWithMeals.length} ${daysWithMeals.length === 1 ? "день" : "дня"} с записями — начните с ежедневного лога.`);
    }

    // Keep unique lines only (logging / water / top food). Closest & hardest stay as cards.
    if (avgWaterMl >= WATER_HABIT_DAY_ML) {
      insights.push(`Средняя вода ${avgWaterMl} мл/день — хороший результат.`);
    } else if (avgWaterMl > 0) {
      insights.push(`Вода: в среднем ${avgWaterMl} мл/день — можно больше.`);
    }

    const top = mergeDecodedFoodStats(
      topFoods.map((f) => ({
        dishName: f.dishName,
        count: f._count.id,
        avgCalories: 0,
      })),
      3,
    );
    if (top[0]) {
      insights.push(`Чаще всего: «${top[0].dishName}» (${top[0].count}×).`);
    }

    const avgFiber =
      daysWithMeals.length > 0
        ? round1(
            daysWithMeals.reduce((s, d) => s + (fiberByDate.get(d) ?? 0), 0) / daysWithMeals.length,
          )
        : 0;
    const avgSugar =
      daysWithMeals.length > 0
        ? round1(
            daysWithMeals.reduce((s, d) => s + (sugarByDate.get(d) ?? 0), 0) / daysWithMeals.length,
          )
        : 0;
    const fiberTarget =
      user?.fiberTargetG != null && Number.isFinite(user.fiberTargetG)
        ? round1(user.fiberTargetG)
        : null;
    const sugarTarget =
      user?.sugarTargetG != null && Number.isFinite(user.sugarTargetG)
        ? round1(user.sugarTargetG)
        : null;

    return NextResponse.json({
      start,
      end,
      weekLabel: formatWeekRange(start, end),
      daysLogged: daysWithMeals.length,
      avgCalories,
      avgWaterMl,
      avgFiber,
      avgSugar,
      calorieTarget: target?.calories ?? null,
      fiberTarget,
      sugarTarget,
      bestDay,
      lightestDay,
      closestToTarget,
      hardestDay,
      topFoods: top,
      insights,
      prevWeekStart: shiftDateKey(start, -7),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить отчёт" }, { status: 500 });
  }
}
