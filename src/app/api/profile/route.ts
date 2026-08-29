import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { goalNeedsPace, isGoalPace, isWeightGoal, type WeightGoal } from "@/lib/diet";
import { prisma } from "@/lib/prisma";
import {
  computeWeightChangeKg,
  weightEntryOrderNewestFirst,
  weightEntryOrderOldestFirst,
} from "@/lib/weight-entries";

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
        select: { goal: true, goalPace: true, targetWeightKg: true, goalDeadline: true },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderOldestFirst,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
      selectedDate
        ? prisma.weightEntry.findFirst({
            where: { userId: session.user.id, date: selectedDate },
            orderBy: weightEntryOrderNewestFirst,
          })
        : Promise.resolve(null),
    ]);

    const changeKg = computeWeightChangeKg(first, current);

    return NextResponse.json({
      goal: user?.goal ?? null,
      goalPace: user?.goalPace ?? null,
      targetWeightKg: user?.targetWeightKg ?? null,
      goalDeadline: user?.goalDeadline ?? null,
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

    const body = (await request.json()) as { goal?: string | null; goalPace?: string | null; targetWeightKg?: number | null; goalDeadline?: string | null };
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

    const targetWeightKg = body.targetWeightKg != null && body.targetWeightKg > 0 ? body.targetWeightKg : null;
    const goalDeadline = body.goalDeadline?.match(/^\d{4}-\d{2}-\d{2}$/) ? body.goalDeadline : null;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { goal, goalPace, targetWeightKg, goalDeadline },
      select: { goal: true, goalPace: true, targetWeightKg: true, goalDeadline: true },
    });

    return NextResponse.json({ goal: user.goal, goalPace: user.goalPace, targetWeightKg: user.targetWeightKg, goalDeadline: user.goalDeadline });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить цель" }, { status: 500 });
  }
}
