import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { loadDayNorm } from "@/lib/day-norm-load";
import {
  DIET_PROFILE_SELECT,
  isWeightGoal,
  round1,
  compareNutrient,
  buildGoalAwareCalorieTip,
} from "@/lib/diet";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        timezone: true,
        ...DIET_PROFILE_SELECT,
        fiberTargetG: true,
        sugarTargetG: true,
      },
    });

    const today = toDateKeyTz(new Date(), user?.timezone);
    const yesterday = shiftDateKey(today, -1);

    const dateParam = request.nextUrl.searchParams.get("date");
    const summaryDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : yesterday;

    const [entries, waterEntries] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: summaryDate },
        select: { calories: true, protein: true, fat: true, carbs: true, fiber: true, sugar: true },
      }),
      prisma.waterEntry.findMany({
        where: { userId: session.user.id, date: summaryDate },
        select: { ml: true },
      }),
    ]);

    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = round1(entries.reduce((sum, e) => sum + (e.protein ?? 0), 0));
    const totalFat = round1(entries.reduce((sum, e) => sum + (e.fat ?? 0), 0));
    const totalCarbs = round1(entries.reduce((sum, e) => sum + (e.carbs ?? 0), 0));
    const totalFiber = round1(entries.reduce((sum, e) => sum + (e.fiber ?? 0), 0));
    const totalSugar = round1(entries.reduce((sum, e) => sum + (e.sugar ?? 0), 0));
    const totalWaterMl = waterEntries.reduce((sum, e) => sum + e.ml, 0);

    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
    const norm = await loadDayNorm(session.user.id, summaryDate);
    const target = norm?.target ?? null;

    let tip: string;
    if (entries.length === 0) {
      tip = "Вчера записей не было — сегодня отличный день начать заново!";
    } else if (!target) {
      tip =
        entries.length >= 3
          ? "Хороший день с несколькими записями — так проще видеть картину целиком."
          : "Добавьте ещё записи сегодня, чтобы видеть полную картину дня.";
    } else {
      tip = buildGoalAwareCalorieTip({
        actual: totalCalories,
        target: target.calories,
        goal,
        tense: "yesterday",
      });
    }

    return NextResponse.json({
      date: summaryDate,
      today,
      /** Number of meal log rows (not meal occasions). */
      mealCount: entries.length,
      entryCount: entries.length,
      totalCalories,
      totalProtein,
      totalFat,
      totalCarbs,
      totalFiber,
      totalSugar,
      totalWaterMl,
      goal,
      target: target
        ? {
            calories: target.calories,
            protein: target.protein,
            fat: target.fat,
            carbs: target.carbs,
            fiber: target.fiber,
            sugar: target.sugar,
          }
        : null,
      training: norm?.training
        ? {
            trainingDay: norm.training.trainingDay,
            baseCalories: norm.training.baseCalories,
            calorieBonusKcal: norm.training.calorieBonusKcal,
          }
        : null,
      comparison: target
        ? {
            calories: compareNutrient(totalCalories, target.calories),
          }
        : null,
      tip,
      hasData: entries.length > 0 || totalWaterMl > 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить сводку" }, { status: 500 });
  }
}
