import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { mealEntryCloneData } from "@/lib/meal-entry-clone";
import { prisma } from "@/lib/prisma";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealType = (typeof MEAL_TYPES)[number];

function parseMealType(value: unknown): MealType | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "string" && MEAL_TYPES.includes(value as MealType)) {
    return value as MealType;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as {
      fromDate: string;
      toDate: string;
      mealType?: string | null;
    };
    const fromDate = requireDateKey(body.fromDate);
    const toDate = requireDateKey(body.toDate);
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "Укажите корректные даты" }, { status: 400 });
    }

    const mealType = parseMealType(body.mealType);
    if (body.mealType !== undefined && mealType === undefined) {
      return NextResponse.json({ error: "Некорректный тип приёма пищи" }, { status: 400 });
    }

    const source = await prisma.mealEntry.findMany({
      where: {
        userId: session.user.id,
        date: fromDate,
        ...(mealType !== undefined ? { mealType } : {}),
      },
    });

    if (source.length === 0) {
      return NextResponse.json(
        {
          error: mealType
            ? "За вчера нет записей этого приёма пищи"
            : "За этот день нет записей для копирования",
        },
        { status: 404 },
      );
    }

    await prisma.mealEntry.createMany({
      data: source.map((row) => mealEntryCloneData(row, { date: toDate })),
    });

    return NextResponse.json({ copied: source.length, mealType: mealType ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось скопировать записи" }, { status: 500 });
  }
}
