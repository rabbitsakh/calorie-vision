import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import {
  isSex,
  isWeightGoal,
  isGoalPace,
  recommendDiet,
  round1,
  compareNutrient,
  buildGoalAwareCalorieTip,
} from "@/lib/diet";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true },
    });

    const today = toDateKeyTz(new Date(), user?.timezone);
    const yesterday = shiftDateKey(today, -1);

    const dateParam = request.nextUrl.searchParams.get("date");
    const summaryDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : yesterday;

    const [entries, weight, waterEntries] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: summaryDate },
        select: { calories: true, protein: true, fat: true, carbs: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id, date: { lte: summaryDate } },
        orderBy: weightEntryOrderNewestFirst,
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
    const totalWaterMl = waterEntries.reduce((sum, e) => sum + e.ml, 0);

    const goal = isWeightGoal(user?.goal) ? user!.goal : null;
    const goalPace = isGoalPace(user?.goalPace) ? user!.goalPace : null;
    const sex = isSex(user?.sex) ? user!.sex : null;
    const target = goal && weight
      ? recommendDiet(weight.weightKg, goal, goalPace, sex, user?.heightCm, user?.birthYear)
      : null;

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
      totalWaterMl,
      goal,
      target: target
        ? {
            calories: target.calories,
            protein: target.protein,
            fat: target.fat,
            carbs: target.carbs,
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
