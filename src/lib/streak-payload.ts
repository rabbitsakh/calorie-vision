import { prisma } from "@/lib/prisma";
import {
  computeLongestStreak,
  computeStreakFromSet,
  shiftDateKeyUtc,
  weekStartMonday,
} from "@/lib/streak-utils";

const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

function nextMilestone(streak: number): number | null {
  return MILESTONES.find((m) => m > streak) ?? null;
}

export async function buildStreakPayload(userId: string, today: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone ?? null;
  const weekStart = weekStartMonday(today, timezone);

  const [entries, freezes, freezeThisWeek] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
    }),
    prisma.streakFreeze.findMany({
      where: { userId },
      select: { date: true },
    }),
    prisma.streakFreeze.findFirst({
      where: { userId, weekStart },
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

  const daysLoggedTotal = mealDates.length;

  // Soft week streak: Mon..today in user timezone (meal days only)
  const mealDateSet = new Set(mealDates);
  const mondayOffset = Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${weekStart}T12:00:00Z`)) / 86_400_000,
  );
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

  return {
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
  };
}
