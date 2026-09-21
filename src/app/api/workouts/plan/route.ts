import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { routineInclude, serializeRoutine } from "@/lib/workouts/routines";
import { planWeekdayFromDateKey, WEEKDAY_LABELS_RU } from "@/lib/workouts/weekdays";

export const dynamic = "force-dynamic";

/** GET ?date=YYYY-MM-DD — routines scheduled for that weekday (+ full week overview). */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const dateParam = request.nextUrl.searchParams.get("date");
    const date = requireDateKey(dateParam ?? null);
    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }
    const weekday = planWeekdayFromDateKey(date);
    if (weekday == null) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const rows = await prisma.workoutRoutine.findMany({
      where: { userId: session.user.id },
      include: routineInclude,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    const routines = rows.map(serializeRoutine);
    const today = routines.filter((r) => r.weekdays.includes(weekday));
    const week = WEEKDAY_LABELS_RU.map((label, day) => ({
      weekday: day,
      label,
      routines: routines.filter((r) => r.weekdays.includes(day)),
    }));

    return NextResponse.json({
      date,
      weekday,
      weekdayLabel: WEEKDAY_LABELS_RU[weekday],
      today,
      week,
      routines,
    });
  } catch (error) {
    console.error("GET /api/workouts/plan", error);
    return NextResponse.json({ error: "Не удалось загрузить план" }, { status: 500 });
  }
}
