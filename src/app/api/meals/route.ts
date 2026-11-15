import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { isMealConfirmInput, trackMealConfirmed } from "@/lib/funnel-analytics";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import { buildDayMealsPayload } from "@/lib/day-meals";
import {
  buildMealCreateData,
  rememberMealCorrectionIfNeeded,
  validateSaveMealInput,
  type SaveMealInput,
} from "@/lib/save-meal";
import { mealImagePathForUser } from "@/lib/upload";
import { grantGymChestForDate } from "@/lib/gym-reward-grant";
import { saveMealOnce } from "@/lib/meal-idempotency";
import { normalizeClientRequestId } from "@/lib/meal-request-id";

type SaveMealBody = SaveMealInput;
type BatchSaveMealBody = { entries: SaveMealInput[] };

async function createMealEntry(userId: string, entry: SaveMealInput, date: string) {
  const clientRequestId = normalizeClientRequestId(entry.clientRequestId);
  return saveMealOnce({
    clientRequestId,
    findExisting: (key) =>
      prisma.mealEntry.findFirst({ where: { userId, clientRequestId: key } }),
    create: async () => {
      const imagePath = await mealImagePathForUser(userId, entry.imagePath);
      const data = buildMealCreateData(
        userId,
        { ...entry, imagePath: imagePath ?? undefined, clientRequestId: clientRequestId ?? undefined },
        date,
      );
      return prisma.mealEntry.create({ data });
    },
  });
}

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

      const saved = [];
      for (const row of validated) {
        const result = await createMealEntry(
          session.user.id,
          mealGroupId && !row.entry.mealGroupId?.trim()
            ? { ...row.entry, mealGroupId }
            : row.entry,
          row.date,
        );
        saved.push({ ...result, entryInput: row.entry, date: row.date });
      }

      const fresh = saved.filter((row) => row.created);
      await Promise.all(
        fresh.map((row) => rememberMealCorrectionIfNeeded(session.user.id, row.entryInput)),
      );

      const confirmed = fresh.filter((row) => isMealConfirmInput(row.entryInput)).length;
      if (confirmed > 0) trackMealConfirmed(session.user.id, confirmed);

      const dates = [...new Set(fresh.map((row) => row.date))];
      await Promise.all(dates.map((date) => grantGymChestForDate(session.user.id, date)));

      return NextResponse.json({ entries: saved.map((row) => row.row) });
    }

    const validation = validateSaveMealInput(body);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const saved = await createMealEntry(session.user.id, body, validation.date);

    if (saved.created) {
      await rememberMealCorrectionIfNeeded(session.user.id, body);
      if (isMealConfirmInput(body)) trackMealConfirmed(session.user.id, 1);
      await grantGymChestForDate(session.user.id, validation.date);
    }

    return NextResponse.json({ entry: saved.row });
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
