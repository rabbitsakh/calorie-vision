import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import {
  normalizeCaloriesBurned,
  normalizeExerciseLabel,
} from "@/lib/exercise";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));
    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    const entries = await prisma.exerciseEntry.findMany({
      where: { userId: session.user.id, date },
      orderBy: { createdAt: "asc" },
    });

    const totalBurned = entries.reduce((sum, e) => sum + e.caloriesBurned, 0);
    return NextResponse.json({ entries, totalBurned });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as {
      date?: string;
      label?: string;
      caloriesBurned?: number;
      minutes?: number | null;
    };

    const date = requireDateKey(body.date);
    if (!date) {
      return NextResponse.json({ error: "Укажите корректную дату" }, { status: 400 });
    }

    const label = normalizeExerciseLabel(body.label);
    if (!label) {
      return NextResponse.json(
        { error: "Укажите название от 1 до 80 символов" },
        { status: 400 },
      );
    }

    const caloriesBurned = normalizeCaloriesBurned(body.caloriesBurned);
    if (caloriesBurned === null) {
      return NextResponse.json(
        { error: "Укажите калории от 1 до 5000" },
        { status: 400 },
      );
    }

    let minutes: number | null = null;
    if (body.minutes != null && body.minutes !== undefined) {
      const m = Math.round(Number(body.minutes));
      if (!Number.isFinite(m) || m < 1 || m > 600) {
        return NextResponse.json(
          { error: "Укажите длительность от 1 до 600 минут" },
          { status: 400 },
        );
      }
      minutes = m;
    }

    const entry = await prisma.exerciseEntry.create({
      data: {
        userId: session.user.id,
        date,
        label,
        caloriesBurned,
        minutes,
      },
    });

    const all = await prisma.exerciseEntry.findMany({
      where: { userId: session.user.id, date },
      orderBy: { createdAt: "asc" },
    });
    const totalBurned = all.reduce((sum, e) => sum + e.caloriesBurned, 0);

    return NextResponse.json({ entry, entries: all, totalBurned });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json({ error: "Укажите id" }, { status: 400 });
    }

    await prisma.exerciseEntry.deleteMany({
      where: { id: body.id, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
