import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/dates";
import { calorieTone, compareNutrient, recommendDiet, round1, type WeightGoal } from "@/lib/diet";

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
  wasCorrected?: boolean;
  originalDish?: string;
  originalCalories?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as SaveMealBody;

    if (!body.date || !body.dishName || !Number.isFinite(body.calories)) {
      return NextResponse.json(
        { error: "Укажите дату, блюдо и калорийность" },
        { status: 400 },
      );
    }

    const entry = await prisma.mealEntry.create({
      data: {
        userId: session.user.id,
        date: parseDateInput(body.date),
        dishName: body.dishName.trim(),
        calories: Math.round(body.calories),
        protein: body.protein,
        fat: body.fat,
        carbs: body.carbs,
        portionGrams: body.portionGrams,
        confidence: body.confidence,
        imagePath: body.imagePath,
        wasCorrected: body.wasCorrected ?? false,
        originalDish: body.originalDish,
        originalCalories: body.originalCalories,
      },
    });

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

    const dateParam = request.nextUrl.searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    const date = parseDateInput(dateParam);
    const [entries, user, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id, date: { lte: date } },
        orderBy: { date: "desc" },
      }),
    ]);

    const totalCalories = entries.reduce((sum, item) => sum + item.calories, 0);
    const totalProtein = round1(entries.reduce((sum, item) => sum + (item.protein ?? 0), 0));
    const totalFat = round1(entries.reduce((sum, item) => sum + (item.fat ?? 0), 0));
    const totalCarbs = round1(entries.reduce((sum, item) => sum + (item.carbs ?? 0), 0));
    const goal = (user?.goal ?? null) as WeightGoal | null;
    const target = goal && weight ? recommendDiet(weight.weightKg, goal) : null;
    const comparison = target
      ? {
          calories: compareNutrient(totalCalories, target.calories),
          protein: compareNutrient(totalProtein, target.protein),
          fat: compareNutrient(totalFat, target.fat),
          carbs: compareNutrient(totalCarbs, target.carbs),
        }
      : null;

    return NextResponse.json({
      entries,
      totalCalories,
      totalProtein,
      totalFat,
      totalCarbs,
      goal,
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
