import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { isSex, isWeightGoal, isGoalPace, recommendDiet } from "@/lib/diet";
import { BADGE_DEFS, type BadgeDef } from "@/lib/badges";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";
import { computeStreakFromSet, shiftDateKeyUtc } from "@/lib/streak-utils";

export const dynamic = "force-dynamic";

type BadgeStats = {
  streak: number;
  mealCount: number;
  waterStreak: number;
  onTargetDays: number;
};

async function loadBadgeStats(userId: string): Promise<{
  today: string;
  stats: BadgeStats;
  existing: Array<{ badgeKey: string; unlockedAt: Date }>;
  candidates: string[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);

  const [mealDates, mealCount, waterEntries, existing, weight, freezes] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
    }),
    prisma.mealEntry.count({ where: { userId } }),
    prisma.waterEntry.groupBy({
      by: ["date"],
      where: { userId },
      _sum: { ml: true },
    }),
    prisma.userBadge.findMany({ where: { userId } }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
    }),
    prisma.streakFreeze.findMany({
      where: { userId },
      select: { date: true },
    }),
  ]);

  // Include freeze days in badge streak (#30)
  const dateSet = new Set([
    ...mealDates.map((m) => m.date),
    ...freezes.map((f) => f.date),
  ]);
  const streak =
    computeStreakFromSet(dateSet, today) ||
    computeStreakFromSet(dateSet, shiftDateKeyUtc(today, -1));

  const waterByDate = new Map(waterEntries.map((w) => [w.date, w._sum.ml ?? 0]));
  let waterStreak = 0;
  let cursor = today;
  for (let i = 0; i < 60; i++) {
    if ((waterByDate.get(cursor) ?? 0) >= WATER_HABIT_DAY_ML) {
      waterStreak += 1;
      cursor = shiftDateKey(today, -(i + 1));
    } else {
      break;
    }
  }

  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) weekDates.push(shiftDateKey(today, -i));
  const weekMeals = await prisma.mealEntry.findMany({
    where: { userId, date: { in: weekDates } },
    select: { date: true, calories: true },
  });
  const calByDate = new Map<string, number>();
  for (const m of weekMeals) {
    calByDate.set(m.date, (calByDate.get(m.date) ?? 0) + m.calories);
  }
  const goal = isWeightGoal(user?.goal) ? user!.goal : null;
  const goalPace = isGoalPace(user?.goalPace) ? user!.goalPace : null;
  const sex = isSex(user?.sex) ? user!.sex : null;
  const target =
    goal && weight
      ? recommendDiet(weight.weightKg, goal, goalPace, sex, user?.heightCm, user?.birthYear)
      : null;
  let onTargetDays = 0;
  if (target) {
    for (const d of weekDates) {
      const cal = calByDate.get(d);
      if (cal == null || cal === 0) continue;
      if (Math.abs(cal - target.calories) <= target.calories * 0.1) onTargetDays += 1;
    }
  }

  const earnedKeys = new Set(existing.map((b) => b.badgeKey));
  const candidates: string[] = [];
  if (mealCount >= 1) candidates.push("first_log");
  if (streak >= 7) candidates.push("streak_7");
  if (streak >= 30) candidates.push("streak_30");
  if (mealCount >= 100) candidates.push("meals_100");
  if (waterStreak >= 7) candidates.push("water_7");
  if (onTargetDays >= 5) candidates.push("week_on_target");

  return {
    today,
    stats: { streak, mealCount, waterStreak, onTargetDays },
    existing,
    candidates: candidates.filter((key) => !earnedKeys.has(key)),
  };
}

function serializeBadges(
  existing: Array<{ badgeKey: string; unlockedAt: Date }>,
  newlyUnlocked: string[] = [],
) {
  const earnedKeys = new Set(existing.map((b) => b.badgeKey));
  for (const key of newlyUnlocked) earnedKeys.add(key);
  const unlockedAt = new Map(existing.map((b) => [b.badgeKey, b.unlockedAt]));

  return BADGE_DEFS.map((def: BadgeDef) => ({
    ...def,
    unlocked: earnedKeys.has(def.key),
    unlockedAt: unlockedAt.get(def.key)?.toISOString() ?? null,
    newlyUnlocked: newlyUnlocked.includes(def.key),
  }));
}

/** Read-only: list badges without unlocking (#29). */
export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { stats, existing, candidates } = await loadBadgeStats(session.user.id);
    const badges = serializeBadges(existing);

    return NextResponse.json({
      badges,
      pendingUnlock: candidates,
      newlyUnlocked: [],
      stats,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить достижения" }, { status: 500 });
  }
}

/** Unlock newly earned badges (#29). */
export async function POST() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const userId = session.user.id;
    const { stats, existing, candidates } = await loadBadgeStats(userId);
    const newlyUnlocked: string[] = [];

    if (candidates.length > 0) {
      await prisma.userBadge.createMany({
        data: candidates.map((badgeKey) => ({ userId, badgeKey })),
        skipDuplicates: true,
      });
      newlyUnlocked.push(...candidates);
    }

    const fresh = await prisma.userBadge.findMany({ where: { userId } });
    const badges = serializeBadges(fresh, newlyUnlocked);

    return NextResponse.json({
      badges,
      newlyUnlocked: newlyUnlocked
        .map((key) => BADGE_DEFS.find((d) => d.key === key))
        .filter(Boolean),
      stats,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось обновить достижения" }, { status: 500 });
  }
}
