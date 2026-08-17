import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { isWeightGoal } from "@/lib/diet";
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
        select: { goal: true },
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

    const body = (await request.json()) as { goal?: string | null };
    if (body.goal !== null && body.goal !== undefined && !isWeightGoal(body.goal)) {
      return NextResponse.json({ error: "Выберите цель: похудеть, набрать или удержать вес" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { goal: body.goal ?? null },
      select: { goal: true },
    });

    return NextResponse.json({ goal: user.goal });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить цель" }, { status: 500 });
  }
}
