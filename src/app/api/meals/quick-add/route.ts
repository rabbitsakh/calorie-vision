import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

type QuickAddItem = {
  dishName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  portionGrams: number | null;
  mealType: MealType | null;
  count: number;
  why: string;
};

function inferMealType(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "BREAKFAST";
  if (hour >= 11 && hour < 15) return "LUNCH";
  if (hour >= 17 && hour < 22) return "DINNER";
  return "SNACK";
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "завтрак",
  LUNCH: "обед",
  DINNER: "ужин",
  SNACK: "перекус",
};

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });

    const now = new Date();
    const today = toDateKeyTz(now, user?.timezone);
    const start = shiftDateKey(today, -90);
    const currentMealType = inferMealType(
      Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: user?.timezone ?? undefined,
        }).format(now),
      ),
    );

    const entries = await prisma.mealEntry.findMany({
      where: {
        userId: session.user.id,
        date: { gte: start, lte: today },
      },
      select: {
        dishName: true,
        calories: true,
        protein: true,
        fat: true,
        carbs: true,
        fiber: true,
        sugar: true,
        portionGrams: true,
        mealType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    type Agg = {
      dishName: string;
      calories: number;
      protein: number | null;
      fat: number | null;
      carbs: number | null;
      fiber: number | null;
      sugar: number | null;
      portionGrams: number | null;
      mealType: MealType | null;
      count: number;
      slotCount: number;
    };

    const byDish = new Map<string, Agg>();

    for (const entry of entries) {
      const name = decodeHtmlEntities(entry.dishName.trim());
      const key = name.toLowerCase();
      const hour = new Date(entry.createdAt).getHours();
      const entrySlot = entry.mealType ?? inferMealType(hour);
      const existing = byDish.get(key);

      if (!existing) {
        byDish.set(key, {
          dishName: name,
          calories: entry.calories,
          protein: entry.protein,
          fat: entry.fat,
          carbs: entry.carbs,
          fiber: entry.fiber,
          sugar: entry.sugar,
          portionGrams: entry.portionGrams,
          mealType: entry.mealType,
          count: 1,
          slotCount: entrySlot === currentMealType ? 1 : 0,
        });
        continue;
      }

      existing.count += 1;
      if (entrySlot === currentMealType) {
        existing.slotCount += 1;
      }
    }

    const suggestions: QuickAddItem[] = [...byDish.values()]
      .filter((item) => item.count >= 2)
      .sort((a, b) => {
        if (b.slotCount !== a.slotCount) return b.slotCount - a.slotCount;
        return b.count - a.count;
      })
      .slice(0, 5)
      .map((item) => ({
        dishName: item.dishName,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        fiber: item.fiber,
        sugar: item.sugar,
        portionGrams: item.portionGrams,
        mealType: item.mealType ?? currentMealType,
        count: item.count,
        why:
          item.slotCount >= 2
            ? `Часто на ${MEAL_TYPE_LABELS[currentMealType]} (${item.slotCount}×)`
            : `Ели ${item.count} раз`,
      }));

    const yesterday = shiftDateKey(today, -1);
    const yesterdayCount = await prisma.mealEntry.count({
      where: { userId: session.user.id, date: yesterday },
    });

    return NextResponse.json({
      suggestions,
      mealType: currentMealType,
      mealTypeLabel: MEAL_TYPE_LABELS[currentMealType],
      yesterdayDate: yesterday,
      yesterdayCount,
      today,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить подсказки" }, { status: 500 });
  }
}
