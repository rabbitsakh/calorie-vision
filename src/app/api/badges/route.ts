import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import {
  DIET_PROFILE_SELECT,
  isCalorieGoalCorridor,
  isWeightGoal,
  recommendDietForProfile,
} from "@/lib/diet";
import {
  BADGE_DEFS,
  qualifyingBadgeKeys,
  type BadgeDef,
  type BadgeStatsSnapshot,
} from "@/lib/badges";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";
import { computeStreakFromSet, shiftDateKeyUtc } from "@/lib/streak-utils";

export const dynamic = "force-dynamic";

async function loadBadgeStats(userId: string): Promise<{
  today: string;
  stats: BadgeStatsSnapshot;
  existing: Array<{ badgeKey: string; unlockedAt: Date }>;
  candidates: string[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, ...DIET_PROFILE_SELECT },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const goal = user?.goal && isWeightGoal(user.goal) ? user.goal : null;

  const monthDates: string[] = [];
  for (let i = 29; i >= 0; i--) monthDates.push(shiftDateKey(today, -i));
  const weekDates = monthDates.slice(-7);

  const [
    mealDates,
    mealCount,
    waterEntries,
    existing,
    weight,
    freezes,
    weightLogCount,
    challengesCompleted,
    monthMeals,
  ] = await Promise.all([
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
    prisma.weightEntry.count({ where: { userId } }),
    prisma.userChallenge.count({
      where: { userId, completedAt: { not: null } },
    }),
    prisma.mealEntry.findMany({
      where: { userId, date: { in: monthDates } },
      select: { date: true, calories: true },
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
  for (let i = 0; i < 90; i++) {
    if ((waterByDate.get(cursor) ?? 0) >= WATER_HABIT_DAY_ML) {
      waterStreak += 1;
      cursor = shiftDateKey(cursor, -1);
    } else {
      break;
    }
  }

  const calByDate = new Map<string, number>();
  for (const m of monthMeals) {
    calByDate.set(m.date, (calByDate.get(m.date) ?? 0) + m.calories);
  }
  const target = recommendDietForProfile(weight?.weightKg, user);
  let onTargetDays = 0;
  let monthOnTargetDays = 0;
  if (target) {
    for (const d of monthDates) {
      const cal = calByDate.get(d);
      if (cal == null || cal === 0) continue;
      if (!isCalorieGoalCorridor(cal, target.calories, goal)) continue;
      monthOnTargetDays += 1;
      if (weekDates.includes(d)) onTargetDays += 1;
    }
  }

  const stats: BadgeStatsSnapshot = {
    streak,
    mealCount,
    waterStreak,
    onTargetDays,
    monthOnTargetDays,
    weightLogCount,
    challengesCompleted,
  };

  const earnedKeys = new Set(existing.map((b) => b.badgeKey));
  const candidates = qualifyingBadgeKeys(stats).filter((key) => !earnedKeys.has(key));

  return {
    today,
    stats,
    existing,
    candidates,
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
    const { stats, candidates } = await loadBadgeStats(userId);
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
