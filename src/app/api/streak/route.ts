import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeStreak(dateSet: Set<string>, today: string): number {
  let streak = 0;
  let expected = today;
  while (dateSet.has(expected)) {
    streak += 1;
    expected = shiftDate(expected, -1);
  }
  return streak;
}

function computeLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (shiftDate(prev, 1) === curr) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const todayParam = request.nextUrl.searchParams.get("today");
    const today = todayParam ?? new Date().toISOString().slice(0, 10);

    const entries = await prisma.mealEntry.findMany({
      where: { userId: session.user.id },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 400,
    });

    const dates = entries.map((e) => e.date);
    const dateSet = new Set(dates);

    const loggedToday = dateSet.has(today);
    const yesterday = shiftDate(today, -1);
    const streakBeforeToday = computeStreak(dateSet, yesterday);
    const streak = loggedToday ? computeStreak(dateSet, today) : streakBeforeToday;
    const longestStreak = computeLongestStreak(dates);
    const next = nextMilestone(streak);
    const streakAtRisk = !loggedToday && streakBeforeToday >= 1;

    // Last 14 days with logged status
    const last14: Array<{ date: string; logged: boolean }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = shiftDate(today, -i);
      last14.push({ date: d, logged: dateSet.has(d) });
    }

    // Days with logs this week (Mon–today)
    const daysLoggedTotal = new Set(dates).size;

    // Soft week streak: Mon..today in UTC week starting Monday
    const weekday = new Date(today + "T12:00:00Z").getUTCDay(); // 0=Sun
    const mondayOffset = weekday === 0 ? 6 : weekday - 1;
    const weekStart = shiftDate(today, -mondayOffset);
    let daysLoggedThisWeek = 0;
    for (let i = 0; i <= mondayOffset; i++) {
      if (dateSet.has(shiftDate(weekStart, i))) daysLoggedThisWeek += 1;
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
      daysLoggedThisWeek,
      daysInWeekSoFar,
      weekNudge,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить серию" }, { status: 500 });
  }
}
