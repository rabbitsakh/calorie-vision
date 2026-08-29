import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import {
  challengeDef,
  challengeOptionsForWeek,
  normalizeChallengeKey,
  recommendChallengeKey,
  shiftChallengeDate,
  weekStartMonday,
} from "@/lib/challenges";
import {
  DIET_PROFILE_SELECT,
  isCalorieGoalCorridor,
  isWeightGoal,
  recommendDietForProfile,
} from "@/lib/diet";
import { WATER_HABIT_DAY_ML } from "@/lib/water-target";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

async function computeProgress(
  userId: string,
  challengeKey: string,
  weekStart: string,
  opts?: {
    calorieTarget?: number | null;
    goal?: Parameters<typeof isCalorieGoalCorridor>[2];
  },
): Promise<number> {
  const key = normalizeChallengeKey(challengeKey);
  const dates = Array.from({ length: 7 }, (_, i) => shiftChallengeDate(weekStart, i));

  if (key === "breakfast_7") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "BREAKFAST" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "water_5" || key === "water_week_7") {
    const rows = await prisma.waterEntry.groupBy({
      by: ["date"],
      where: { userId, date: { in: dates } },
      _sum: { ml: true },
    });
    return rows.filter((r) => (r._sum.ml ?? 0) >= WATER_HABIT_DAY_ML).length;
  }

  if (key === "log_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "dinner_5") {
    const rows = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates }, mealType: "DINNER" },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "weigh_3") {
    const rows = await prisma.weightEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ["date"],
    });
    return rows.length;
  }

  if (key === "corridor_4") {
    const target = opts?.calorieTarget;
    if (!target) return 0;
    const meals = await prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true, calories: true },
    });
    const calByDate = new Map<string, number>();
    for (const m of meals) {
      calByDate.set(m.date, (calByDate.get(m.date) ?? 0) + m.calories);
    }
    let days = 0;
    for (const d of dates) {
      const cal = calByDate.get(d);
      if (cal == null || cal === 0) continue;
      if (isCalorieGoalCorridor(cal, target, opts?.goal)) days += 1;
    }
    return days;
  }

  return 0;
}

async function weekHabitSnapshot(userId: string, weekStart: string, today: string) {
  const dates = Array.from({ length: 7 }, (_, i) => shiftChallengeDate(weekStart, i));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...DIET_PROFILE_SELECT },
  });
  const goal = user?.goal && isWeightGoal(user.goal) ? user.goal : null;
  const weight = await prisma.weightEntry.findFirst({
    where: { userId },
    orderBy: weightEntryOrderNewestFirst,
  });
  const diet = recommendDietForProfile(weight?.weightKg, user);
  const calorieTarget = diet?.calories ?? null;

  const [breakfast, dinner, logDays, water, weigh, corridor] = await Promise.all([
    computeProgress(userId, "breakfast_7", weekStart),
    computeProgress(userId, "dinner_5", weekStart),
    computeProgress(userId, "log_5", weekStart),
    computeProgress(userId, "water_5", weekStart),
    computeProgress(userId, "weigh_3", weekStart),
    computeProgress(userId, "corridor_4", weekStart, { calorieTarget, goal }),
  ]);

  return {
    breakfastDays: breakfast,
    dinnerDays: dinner,
    logDays,
    waterDays: water,
    weighDays: weigh,
    corridorDays: corridor,
    daysLeft: challengeOptionsForWeek(today, weekStart)[0]?.daysLeft ?? 7,
    calorieTarget,
    goal,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const history = request.nextUrl.searchParams.get("history") === "1";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? null;
    const today = toDateKeyTz(new Date(), timezone);
    const weekStart = weekStartMonday(today, timezone);

    if (history) {
      const rows = await prisma.userChallenge.findMany({
        where: { userId: session.user.id },
        orderBy: { weekStart: "desc" },
        take: 12,
      });
      return NextResponse.json({
        history: rows.map((row) => {
          const def = challengeDef(row.challengeKey);
          return {
            weekStart: row.weekStart,
            challengeKey: normalizeChallengeKey(row.challengeKey),
            title: def?.title ?? row.challengeKey,
            progress: row.progress,
            target: row.target,
            completed: Boolean(row.completedAt) || row.progress >= row.target,
            completedAt: row.completedAt,
          };
        }),
      });
    }

    const snap = await weekHabitSnapshot(session.user.id, weekStart, today);
    const recommendedKey = recommendChallengeKey(snap);
    const options = challengeOptionsForWeek(today, weekStart, recommendedKey);

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
        daysLeft: snap.daysLeft,
        recommendedKey,
      });
    }

    const progress = await computeProgress(
      session.user.id,
      active.challengeKey,
      weekStart,
      { calorieTarget: snap.calorieTarget, goal: snap.goal },
    );
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
        challengeKey: normalizeChallengeKey(active.challengeKey),
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
      daysLeft: snap.daysLeft,
      recommendedKey,
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

    const body = (await request.json()) as { challengeKey?: string; replace?: boolean };
    const rawKey = body.challengeKey ? normalizeChallengeKey(body.challengeKey) : "";
    const def = rawKey ? challengeDef(rawKey) : undefined;
    if (!def) {
      return NextResponse.json({ error: "Неизвестный челлендж" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, ...DIET_PROFILE_SELECT },
    });
    const timezone = user?.timezone ?? null;
    const today = toDateKeyTz(new Date(), timezone);
    const weekStart = weekStartMonday(today, timezone);
    const goal = user?.goal && isWeightGoal(user.goal) ? user.goal : null;
    const weight = await prisma.weightEntry.findFirst({
      where: { userId: session.user.id },
      orderBy: weightEntryOrderNewestFirst,
    });
    const diet = recommendDietForProfile(weight?.weightKg, user);
    const progressOpts = { calorieTarget: diet?.calories ?? null, goal };

    const existing = await prisma.userChallenge.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
    });

    if (existing) {
      if (!body.replace) {
        return NextResponse.json({ error: "Челлендж на эту неделю уже выбран" }, { status: 400 });
      }
      if (existing.completedAt) {
        return NextResponse.json({ error: "Закрытый челлендж нельзя сменить" }, { status: 400 });
      }
      const progress = await computeProgress(session.user.id, def.key, weekStart, progressOpts);
      const challenge = await prisma.userChallenge.update({
        where: { id: existing.id },
        data: {
          challengeKey: def.key,
          progress,
          target: def.target,
          completedAt: progress >= def.target ? new Date() : null,
        },
      });
      return NextResponse.json({ challenge, replaced: true });
    }

    const progress = await computeProgress(session.user.id, def.key, weekStart, progressOpts);
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
