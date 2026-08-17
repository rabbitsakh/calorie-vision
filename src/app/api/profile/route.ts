import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { goalNeedsPace, isGoalPace, isWeightGoal, type GoalPace, type WeightGoal } from "@/lib/diet";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const dateParam = request.nextUrl.searchParams.get("date");
    const selectedDate = dateParam ? requireDateKey(dateParam) : null;
    if (dateParam && !selectedDate) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const [user, first, current, selected] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { goal: true, goalPace: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: { date: "asc" },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: { date: "desc" },
      }),
      selectedDate
        ? prisma.weightEntry.findUnique({
            where: {
              userId_date: { userId: session.user.id, date: selectedDate },
            },
          })
        : Promise.resolve(null),
    ]);

    const changeKg =
      first && current ? Math.round((current.weightKg - first.weightKg) * 10) / 10 : null;

    return NextResponse.json({
      goal: user?.goal ?? null,
      goalPace: user?.goalPace ?? null,
      firstWeightKg: first?.weightKg ?? null,
      firstWeightDate: first?.date ?? null,
      currentWeightKg: current?.weightKg ?? null,
      currentWeightDate: current?.date ?? null,
      weightChangeKg: changeKg,
      selectedWeightKg: selected?.weightKg ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить профиль" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as { goal?: string | null; goalPace?: string | null };
    if (body.goal !== null && body.goal !== undefined && !isWeightGoal(body.goal)) {
      return NextResponse.json({ error: "Выберите цель: похудеть, набрать или удержать вес" }, { status: 400 });
    }

    const goal = (body.goal ?? null) as WeightGoal | null;
    if (body.goalPace !== undefined && body.goalPace !== null && !isGoalPace(body.goalPace)) {
      return NextResponse.json({ error: "Выберите способ: проще, здорово или быстрее" }, { status: 400 });
    }

    const goalPace =
      goal && goalNeedsPace(goal)
        ? isGoalPace(body.goalPace)
          ? body.goalPace
          : null
        : null;
    if (goal && goalNeedsPace(goal) && !goalPace) {
      return NextResponse.json({ error: "Для этой цели выберите способ" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { goal, goalPace },
      select: { goal: true, goalPace: true },
    });

    return NextResponse.json({ goal: user.goal, goalPace: user.goalPace });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить цель" }, { status: 500 });
  }
}
