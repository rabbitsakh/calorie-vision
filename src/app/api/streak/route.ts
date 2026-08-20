import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { requireDateKey } from "@/lib/dates";
import {
  computeLongestStreak,
  computeStreakFromSet,
  shiftDateKeyUtc,
  weekStartMonday,
} from "@/lib/streak-utils";

export const dynamic = "force-dynamic";

const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const todayParam = request.nextUrl.searchParams.get("today");
    const today = todayParam ?? new Date().toISOString().slice(0, 10);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? null;
    const weekStart = weekStartMonday(today, timezone);

    const [entries, freezes, freezeThisWeek] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id },
        select: { date: true },
        orderBy: { date: "desc" },
        take: 400,
      }),
      prisma.streakFreeze.findMany({
        where: { userId: session.user.id },
        select: { date: true },
        take: 100,
      }),
      prisma.streakFreeze.findFirst({
        where: { userId: session.user.id, weekStart },
      }),
    ]);

    const mealDates = entries.map((e) => e.date);
    const frozenDates = freezes.map((f) => f.date);
    const dateSet = new Set([...mealDates, ...frozenDates]);

    const loggedToday = dateSet.has(today);
    const yesterday = shiftDateKeyUtc(today, -1);
    const streakBeforeToday = computeStreakFromSet(dateSet, yesterday);
    const streak = loggedToday ? computeStreakFromSet(dateSet, today) : streakBeforeToday;
    const longestStreak = computeLongestStreak([...dateSet]);
    const next = nextMilestone(streak);
    const streakAtRisk = !loggedToday && streakBeforeToday >= 1;

    const freezeAvailable = !freezeThisWeek;
    const canFreezeYesterday =
      freezeAvailable &&
      !dateSet.has(yesterday) &&
      streakBeforeToday >= 1 &&
      yesterday < today;

    const last14: Array<{ date: string; logged: boolean; frozen: boolean }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = shiftDateKeyUtc(today, -i);
      last14.push({
        date: d,
        logged: mealDates.includes(d),
        frozen: frozenDates.includes(d),
      });
    }

    const daysLoggedTotal = new Set(mealDates).size;

    // Soft week streak: Mon..today (meal days only)
    const mealDateSet = new Set(mealDates);
    const weekday = new Date(today + "T12:00:00Z").getUTCDay(); // 0=Sun
    const mondayOffset = weekday === 0 ? 6 : weekday - 1;
    let daysLoggedThisWeek = 0;
    for (let i = 0; i <= mondayOffset; i++) {
      if (mealDateSet.has(shiftDateKeyUtc(weekStart, i))) daysLoggedThisWeek += 1;
    }
    const daysInWeekSoFar = mondayOffset + 1;
    let weekNudge: string | null = null;
    if (daysLoggedThisWeek < daysInWeekSoFar && daysInWeekSoFar >= 3) {
      const nextGoal = Math.min(7, daysLoggedThisWeek + 1);
      if (daysLoggedThisWeek >= 3 && daysLoggedThisWeek < 5) {
        weekNudge = `${daysLoggedThisWeek} из ${daysInWeekSoFar} дней на этой неделе — добейте до ${Math.max(nextGoal, 5)}.`;
      } else if (daysLoggedThisWeek >= 5 && daysLoggedThisWeek < 7) {
        weekNudge = `${daysLoggedThisWeek} из 7 — отличная регулярность, ещё немного до полной недели.`;
      } else if (daysLoggedThisWeek > 0 && daysLoggedThisWeek < 3) {
        weekNudge = `${daysLoggedThisWeek} из ${daysInWeekSoFar} дней с записями — каждый день считается.`;
      }
    } else if (daysLoggedThisWeek === daysInWeekSoFar && daysInWeekSoFar >= 3) {
      weekNudge = `${daysLoggedThisWeek} из ${daysInWeekSoFar} — вы ведёте дневник каждый день на этой неделе!`;
    }

    return NextResponse.json({
      streak,
      longestStreak: Math.max(longestStreak, streak),
      nextMilestone: next,
      daysUntilNext: next ? next - streak : null,
      last14,
      daysLoggedTotal,
      loggedToday,
      streakAtRisk,
      streakBeforeToday,
      freezeAvailable,
      canFreezeYesterday,
      frozenDates,
      weekStart,
      daysLoggedThisWeek,
      daysInWeekSoFar,
      weekNudge,
    });
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

    const [existingMeal, existingFreeze, usedThisWeek] = await Promise.all([
      prisma.mealEntry.findFirst({
        where: { userId: session.user.id, date },
      }),
      prisma.streakFreeze.findFirst({
        where: { userId: session.user.id, date },
      }),
      prisma.streakFreeze.findFirst({
        where: { userId: session.user.id, weekStart },
      }),
    ]);

    if (existingMeal) {
      return NextResponse.json({ error: "В этот день уже есть записи" }, { status: 400 });
    }
    if (existingFreeze) {
      return NextResponse.json({ error: "Этот день уже заморожен" }, { status: 400 });
    }
    if (usedThisWeek) {
      return NextResponse.json({ error: "Заморозка уже использована на этой неделе" }, { status: 400 });
    }

    const freeze = await prisma.streakFreeze.create({
      data: {
        userId: session.user.id,
        date,
        weekStart,
      },
    });

    return NextResponse.json({ freeze, message: "Серия сохранена!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось заморозить серию" }, { status: 500 });
  }
}
