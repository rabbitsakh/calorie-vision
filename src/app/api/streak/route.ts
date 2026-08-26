import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import { buildStreakPayload } from "@/lib/streak-payload";
import { weekStartMonday } from "@/lib/streak-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const todayParam = request.nextUrl.searchParams.get("today");
    const today = todayParam ?? new Date().toISOString().slice(0, 10);

    const payload = await buildStreakPayload(session.user.id, today);
    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить серию" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { date?: string; today?: string };
    const date = requireDateKey(body.date);
    const today = requireDateKey(body.today) ?? new Date().toISOString().slice(0, 10);

    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    if (date >= today) {
      return NextResponse.json({ error: "Можно заморозить только прошедшие дни" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? null;
    const weekStart = weekStartMonday(today, timezone);

    try {
      const freeze = await prisma.$transaction(async (tx) => {
        const [existingMeal, existingFreeze, usedThisWeek] = await Promise.all([
          tx.mealEntry.findFirst({
            where: { userId: session.user.id, date },
          }),
          tx.streakFreeze.findFirst({
            where: { userId: session.user.id, date },
          }),
          tx.streakFreeze.findFirst({
            where: { userId: session.user.id, weekStart },
          }),
        ]);

        if (existingMeal) {
          throw Object.assign(new Error("HAS_MEAL"), { code: "HAS_MEAL" });
        }
        if (existingFreeze) {
          throw Object.assign(new Error("ALREADY_FROZEN"), { code: "ALREADY_FROZEN" });
        }
        if (usedThisWeek) {
          throw Object.assign(new Error("WEEK_USED"), { code: "WEEK_USED" });
        }

        return tx.streakFreeze.create({
          data: {
            userId: session.user.id,
            date,
            weekStart,
          },
        });
      });

      return NextResponse.json({ freeze, message: "Серия сохранена!" });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : null;
      if (code === "HAS_MEAL") {
        return NextResponse.json({ error: "В этот день уже есть записи" }, { status: 400 });
      }
      if (code === "ALREADY_FROZEN") {
        return NextResponse.json({ error: "Этот день уже заморожен" }, { status: 400 });
      }
      if (code === "WEEK_USED" || code === "P2002") {
        return NextResponse.json({ error: "Заморозка уже использована на этой неделе" }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось заморозить серию" }, { status: 500 });
  }
}
