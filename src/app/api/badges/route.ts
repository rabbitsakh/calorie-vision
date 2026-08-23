import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { shiftDateKey, toDateKeyTz } from "@/lib/dates";
import { isSex, isWeightGoal, isGoalPace, recommendDiet } from "@/lib/diet";
import { BADGE_DEFS, type BadgeDef } from "@/lib/badges";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, goal: true, goalPace: true, sex: true, heightCm: true, birthYear: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);

    const [mealDates, mealCount, waterEntries, existing, weight] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId },
        select: { date: true },
        distinct: ["date"],
        take: 400,
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
    ]);

    const dateSet = new Set(mealDates.map((m) => m.date));
    const streak = computeStreak(dateSet, today) || computeStreak(dateSet, shiftDate(today, -1));

    const waterByDate = new Map(
      waterEntries.map((w) => [w.date, w._sum.ml ?? 0]),
    );
    let waterStreak = 0;
    let cursor = today;
    for (let i = 0; i < 60; i++) {
      if ((waterByDate.get(cursor) ?? 0) >= WATER_HABIT_DAY_ML) {
        waterStreak += 1;
        cursor = shiftDate(cursor, -1);
      } else {
        break;
      }
    }

    // Week on target: last 7 days
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
    const newlyUnlocked: string[] = [];
    const candidates: string[] = [];

    if (mealCount >= 1) candidates.push("first_log");
    if (streak >= 7) candidates.push("streak_7");
    if (streak >= 30) candidates.push("streak_30");
    if (mealCount >= 100) candidates.push("meals_100");
    if (waterStreak >= 7) candidates.push("water_7");
    if (onTargetDays >= 5) candidates.push("week_on_target");

    const toUnlock = candidates.filter((key) => !earnedKeys.has(key));
    if (toUnlock.length > 0) {
      await prisma.userBadge.createMany({
        data: toUnlock.map((badgeKey) => ({ userId, badgeKey })),
        skipDuplicates: true,
      });
    }

    const unlockedAt = new Map(existing.map((b) => [b.badgeKey, b.unlockedAt]));
    if (toUnlock.length > 0) {
      const fresh = await prisma.userBadge.findMany({ where: { userId } });
      for (const b of fresh) {
        unlockedAt.set(b.badgeKey, b.unlockedAt);
        if (toUnlock.includes(b.badgeKey) && !earnedKeys.has(b.badgeKey)) {
          newlyUnlocked.push(b.badgeKey);
          earnedKeys.add(b.badgeKey);
        }
      }
    }

    const badges = BADGE_DEFS.map((def: BadgeDef) => ({
      ...def,
      unlocked: earnedKeys.has(def.key),
      unlockedAt: unlockedAt.get(def.key)?.toISOString() ?? null,
      newlyUnlocked: newlyUnlocked.includes(def.key),
    }));

    return NextResponse.json({
      badges,
      newlyUnlocked: newlyUnlocked.map((key) => BADGE_DEFS.find((d) => d.key === key)).filter(Boolean),
      stats: { streak, mealCount, waterStreak, onTargetDays },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить достижения" }, { status: 500 });
  }
}
