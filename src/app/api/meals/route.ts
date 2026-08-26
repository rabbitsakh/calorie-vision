import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import { buildDayMealsPayload } from "@/lib/day-meals";
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

    const payload = await buildDayMealsPayload(session.user.id, date);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось загрузить записи" },
      { status: 500 },
    );
  }
}
