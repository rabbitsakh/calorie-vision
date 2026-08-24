import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import { applyFiberSugarOverrides, calorieTone, compareNutrient, formatGoalChoice, isSex, recommendDiet, round1, type GoalPace, type WeightGoal } from "@/lib/diet";
import { decodeHtmlEntities } from "@/lib/html-text";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import {
  buildMealCreateData,
  rememberMealCorrectionIfNeeded,
  validateSaveMealInput,
  type SaveMealInput,
} from "@/lib/save-meal";

type SaveMealBody = SaveMealInput;
type BatchSaveMealBody = { entries: SaveMealInput[] };

function isBatchSaveBody(body: unknown): body is BatchSaveMealBody {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as BatchSaveMealBody).entries)
  );
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as SaveMealBody | BatchSaveMealBody;

    if (isBatchSaveBody(body)) {
      if (body.entries.length === 0) {
        return NextResponse.json({ error: "Список блюд пуст" }, { status: 400 });
      }
      if (body.entries.length > 20) {
        return NextResponse.json({ error: "Слишком много блюд за один раз" }, { status: 400 });
      }

      const validated = body.entries.map((entry) => ({
        entry,
        ...validateSaveMealInput(entry),
      }));
      const invalid = validated.find((row) => row.error);
      if (invalid?.error) {
        return NextResponse.json({ error: invalid.error }, { status: 400 });
      }

      const mealGroupId =
        body.entries.length > 1
          ? body.entries.find((entry) => entry.mealGroupId?.trim())?.mealGroupId?.trim() ||
            crypto.randomUUID()
          : body.entries[0]?.mealGroupId?.trim() || null;

      const entries = await prisma.$transaction(async (tx) => {
        const created = [];
        for (const row of validated) {
          const data = buildMealCreateData(session.user.id, row.entry, row.date);
          if (mealGroupId && !data.mealGroupId) {
            data.mealGroupId = mealGroupId;
          }
          created.push(await tx.mealEntry.create({ data }));
        }
        return created;
      });

      await Promise.all(
        validated.map((row) => rememberMealCorrectionIfNeeded(session.user.id, row.entry)),
      );

      return NextResponse.json({ entries });
    }

    const validation = validateSaveMealInput(body);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const entry = await prisma.mealEntry.create({
      data: buildMealCreateData(session.user.id, body, validation.date),
    });

    await rememberMealCorrectionIfNeeded(session.user.id, body);

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
        select: {
          goal: true,
          goalPace: true,
          sex: true,
          heightCm: true,
          birthYear: true,
          fiberTargetG: true,
          sugarTargetG: true,
        },
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
    const totalFiber = round1(entries.reduce((sum, item) => sum + (item.fiber ?? 0), 0));
    const totalSugar = round1(entries.reduce((sum, item) => sum + (item.sugar ?? 0), 0));
    const goal = (user?.goal ?? null) as WeightGoal | null;
    const goalPace = (user?.goalPace ?? null) as GoalPace | null;
    const sex = isSex(user?.sex) ? user!.sex : null;
    const target =
      goal && weight
        ? applyFiberSugarOverrides(
            recommendDiet(weight.weightKg, goal, goalPace, sex, user?.heightCm, user?.birthYear),
            { fiberTargetG: user?.fiberTargetG, sugarTargetG: user?.sugarTargetG },
          )
        : null;
    const comparison = target
      ? {
          calories: compareNutrient(totalCalories, target.calories),
          protein: compareNutrient(totalProtein, target.protein),
          fat: compareNutrient(totalFat, target.fat),
          carbs: compareNutrient(totalCarbs, target.carbs),
          fiber: compareNutrient(totalFiber, target.fiber),
          sugar: compareNutrient(totalSugar, target.sugar),
        }
      : null;

    return NextResponse.json(
      {
        entries: entries.map((entry) => ({
          ...entry,
          dishName: decodeHtmlEntities(entry.dishName),
          originalDish: entry.originalDish ? decodeHtmlEntities(entry.originalDish) : entry.originalDish,
        })),
        totalCalories,
        totalProtein,
        totalFat,
        totalCarbs,
        totalFiber,
        totalSugar,
        goal,
        goalPace,
        dietLabel: goal ? formatGoalChoice(goal, goalPace) : null,
        sex,
        weightKg: weight?.weightKg ?? null,
        target,
        comparison,
        calorieTone: goal && comparison ? calorieTone(comparison.calories, goal) : null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось загрузить записи" },
      { status: 500 },
    );
  }
}
