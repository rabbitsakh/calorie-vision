import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { dateRangeEnding, requireDateKey, shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { DIET_PROFILE_SELECT, isWeightGoal, recommendDietForProfile, round1 } from "@/lib/diet";
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

function formatWeekDay(dateKey: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(dateKey + "T12:00:00Z"));
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, ...DIET_PROFILE_SELECT },
    });

    const endParam = request.nextUrl.searchParams.get("end");
    const endDate = endParam ? requireDateKey(endParam) : null;
    const end = endDate ?? toDateKeyTz(new Date(), user?.timezone);
    const dates = dateRangeEnding(end, 7);
    const start = dates[0]!;

    const [meals, waterEntries, weight, topFoods] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        select: { date: true, calories: true, protein: true, fat: true, carbs: true },
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
    for (const m of meals) {
      caloriesByDate.set(m.date, (caloriesByDate.get(m.date) ?? 0) + m.calories);
    }

    const waterByDate = new Map<string, number>();
    for (const w of waterEntries) {
      waterByDate.set(w.date, (waterByDate.get(w.date) ?? 0) + w.ml);
    }

    const daysWithMeals = dates.filter((d) => (caloriesByDate.get(d) ?? 0) > 0);
    const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
    const avgCalories = daysWithMeals.length > 0 ? Math.round(totalCalories / daysWithMeals.length) : 0;

    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
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

    if (target && avgCalories > 0) {
      const diff = avgCalories - target.calories;
      const abs = Math.round(Math.abs(diff));
      if (Math.abs(diff) <= target.calories * 0.08) {
        insights.push(
          goal === "LOSE"
            ? `Среднее ${avgCalories} ккал/день — в целевом дефиците (${target.calories}).`
            : `Среднее ${avgCalories} ккал/день — близко к цели (${target.calories}).`,
        );
      } else if (goal === "LOSE") {
        if (diff > 0) {
          insights.push(`В среднем +${abs} ккал/день выше цели похудения.`);
        } else if (avgCalories < target.calories * 0.75) {
          insights.push(
            `В среднем на ${abs} ккал/день ниже цели — для похудения это уже жёстко, не урезайте сильнее.`,
          );
        } else {
          insights.push(
            `В среднем на ${abs} ккал/день ниже цели — для похудения это нормально.`,
          );
        }
      } else if (diff > 0) {
        insights.push(`В среднем +${abs} ккал/день выше цели.`);
      } else {
        insights.push(
          goal === "GAIN"
            ? `В среднем ${abs} ккал/день не хватает до цели набора.`
            : `В среднем ${abs} ккал/день не хватает до нормы.`,
        );
      }
    }

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

    if (closestToTarget) {
      insights.push(
        `Ближе всего к цели: ${formatWeekDay(closestToTarget.date)} (${closestToTarget.calories} ккал).`,
      );
    }
    if (hardestDay) {
      const signed = hardestDay.calories - (target?.calories ?? 0);
      insights.push(
        signed > 0
          ? `Самый тяжёлый день: ${formatWeekDay(hardestDay.date)} (+${Math.round(signed)} ккал) — один день не ломает тренд.`
          : `Самый лёгкий относительно цели: ${formatWeekDay(hardestDay.date)} (${hardestDay.calories} ккал).`,
      );
    }

    return NextResponse.json({
      start,
      end,
      weekLabel: formatWeekRange(start, end),
      daysLogged: daysWithMeals.length,
      avgCalories,
      avgWaterMl,
      calorieTarget: target?.calories ?? null,
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
