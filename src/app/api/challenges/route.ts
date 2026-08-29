import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import {
  challengeDef,
  challengeOptionsForWeek,
  shiftChallengeDate,
  weekStartMonday,
} from "@/lib/challenges";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export const dynamic = "force-dynamic";

async function computeProgress(
  userId: string,
  challengeKey: string,
  weekStart: string,
): Promise<number> {
  const dates = Array.from({ length: 7 }, (_, i) => shiftChallengeDate(weekStart, i));

  if (challengeKey === "breakfast_7") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "BREAKFAST" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (challengeKey === "water_5") {
    const rows = await prisma.waterEntry.groupBy({
      by: ["date"],
      where: { userId, date: { in: dates } },
      _sum: { ml: true },
    });
    return rows.filter((r) => (r._sum.ml ?? 0) >= WATER_HABIT_DAY_ML).length;
  }

  if (challengeKey === "log_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (challengeKey === "dinner_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "DINNER" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (challengeKey === "water_7") {
    const rows = await prisma.waterEntry.groupBy({
      by: ["date"],
      where: { userId, date: { in: dates } },
      _sum: { ml: true },
    });
    return rows.filter((r) => (r._sum.ml ?? 0) >= WATER_HABIT_DAY_ML).length;
  }

  return 0;
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? null;
    const today = toDateKeyTz(new Date(), timezone);
    const weekStart = weekStartMonday(today, timezone);
    const options = challengeOptionsForWeek(today, weekStart);

    const active = await prisma.userChallenge.findUnique({
      where: {
        userId_weekStart: { userId: session.user.id, weekStart },
      },
    });

    if (!active) {
      return NextResponse.json({
        active: null,
        options,
        weekStart,
        daysLeft: options[0]?.daysLeft ?? 7,
      });
    }

    const progress = await computeProgress(session.user.id, active.challengeKey, weekStart);
    const def = challengeDef(active.challengeKey);
    const completed = progress >= active.target;
    let completedAt = active.completedAt;

    if (progress !== active.progress || (completed && !active.completedAt)) {
      const updated = await prisma.userChallenge.update({
        where: { id: active.id },
        data: {
          progress,
          completedAt: completed ? active.completedAt ?? new Date() : null,
        },
      });
      completedAt = updated.completedAt;
    }

    return NextResponse.json({
      active: {
        challengeKey: active.challengeKey,
        title: def?.title ?? active.challengeKey,
        description: def?.description ?? "",
        progress,
        target: active.target,
        completed,
        completedAt,
        weekStart,
      },
      options,
      weekStart,
      daysLeft: options[0]?.daysLeft ?? 7,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить челлендж" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { challengeKey?: string };
    const def = body.challengeKey ? challengeDef(body.challengeKey) : undefined;
    if (!def) {
      return NextResponse.json({ error: "Неизвестный челлендж" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? null;
    const today = toDateKeyTz(new Date(), timezone);
    const weekStart = weekStartMonday(today, timezone);

    const existing = await prisma.userChallenge.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
    });
    if (existing) {
      return NextResponse.json({ error: "Челлендж на эту неделю уже выбран" }, { status: 400 });
    }

    const progress = await computeProgress(session.user.id, def.key, weekStart);
    const challenge = await prisma.userChallenge.create({
      data: {
        userId: session.user.id,
        challengeKey: def.key,
        weekStart,
        progress,
        target: def.target,
        completedAt: progress >= def.target ? new Date() : null,
      },
    });

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось начать челлендж" }, { status: 500 });
  }
}
