import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import { calorieTone, compareNutrient, formatGoalChoice, isSex, recommendDiet, round1, type GoalPace, type WeightGoal } from "@/lib/diet";
import { decodeHtmlEntities } from "@/lib/html-text";
import { rememberFoodCorrection } from "@/lib/food-corrections-store";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

type SaveMealBody = {
  date: string;
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
  confidence?: number;
  imagePath?: string;
  mealGroupId?: string;
  wasCorrected?: boolean;
  originalDish?: string;
  originalCalories?: number;
  originalProtein?: number;
  originalFat?: number;
  originalCarbs?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as SaveMealBody;
    const date = requireDateKey(body.date);

    if (!date || !body.dishName || !Number.isFinite(body.calories)) {
      return NextResponse.json(
        { error: "Укажите дату, блюдо и калорийность" },
        { status: 400 },
      );
    }

    const entry = await prisma.mealEntry.create({
      data: {
        userId: session.user.id,
        date,
        dishName: decodeHtmlEntities(body.dishName.trim()),
        calories: Math.round(body.calories),
        protein: body.protein,
        fat: body.fat,
        carbs: body.carbs,
        portionGrams: body.portionGrams,
        confidence: body.confidence,
        imagePath: body.imagePath?.trim() || null,
        mealGroupId: body.mealGroupId?.trim() || null,
        wasCorrected: body.wasCorrected ?? false,
        originalDish: body.originalDish ? decodeHtmlEntities(body.originalDish) : body.originalDish,
        originalCalories: body.originalCalories,
      },
    });

    if (body.wasCorrected && body.originalDish?.trim()) {
      await rememberFoodCorrection({
        originalDish: body.originalDish,
        dishName: body.dishName,
        calories: body.calories,
        protein: body.protein,
        fat: body.fat,
        carbs: body.carbs,
        portionGrams: body.portionGrams,
        originalCalories: body.originalCalories,
        originalProtein: body.originalProtein,
        originalFat: body.originalFat,
        originalCarbs: body.originalCarbs,
      });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось сохранить запись" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));

    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    const [entries, user, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true, goalPace: true, sex: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id, date: { lte: date } },
        orderBy: weightEntryOrderNewestFirst,
      }),
    ]);

    const totalCalories = entries.reduce((sum, item) => sum + item.calories, 0);
    const totalProtein = round1(entries.reduce((sum, item) => sum + (item.protein ?? 0), 0));
    const totalFat = round1(entries.reduce((sum, item) => sum + (item.fat ?? 0), 0));
    const totalCarbs = round1(entries.reduce((sum, item) => sum + (item.carbs ?? 0), 0));
    const goal = (user?.goal ?? null) as WeightGoal | null;
    const goalPace = (user?.goalPace ?? null) as GoalPace | null;
    const sex = isSex(user?.sex) ? user!.sex : null;
    const target = goal && weight ? recommendDiet(weight.weightKg, goal, goalPace, sex) : null;
    const comparison = target
      ? {
          calories: compareNutrient(totalCalories, target.calories),
          protein: compareNutrient(totalProtein, target.protein),
          fat: compareNutrient(totalFat, target.fat),
          carbs: compareNutrient(totalCarbs, target.carbs),
        }
      : null;

    return NextResponse.json({
      entries: entries.map((entry) => ({
        ...entry,
        dishName: decodeHtmlEntities(entry.dishName),
        originalDish: entry.originalDish ? decodeHtmlEntities(entry.originalDish) : entry.originalDish,
      })),
      totalCalories,
      totalProtein,
      totalFat,
      totalCarbs,
      goal,
      goalPace,
      dietLabel: goal ? formatGoalChoice(goal, goalPace) : null,
      sex,
      weightKg: weight?.weightKg ?? null,
      target,
      comparison,
      calorieTone: goal && comparison ? calorieTone(comparison.calories, goal) : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось загрузить записи" },
      { status: 500 },
    );
  }
}
