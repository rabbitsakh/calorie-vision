import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { buildDayMealsPayload } from "@/lib/day-meals";
import { mondayWeekWrapTip } from "@/lib/motivation-voice";
import { computeLastWeekStats } from "@/lib/push-reminders";
import { prisma } from "@/lib/prisma";
import { buildStreakPayload } from "@/lib/streak-payload";
import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import { resolveWaterTargetMl } from "@/lib/water-target";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));
    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    const todayParam =
      requireDateKey(request.nextUrl.searchParams.get("today")) ?? date;
    const userId = session.user.id;

    const accountPromise = prisma.user.findUnique({
      where: { id: userId },
      select: {
        sex: true,
        heightCm: true,
        birthYear: true,
        fastingStartHour: true,
        fastingEndHour: true,
        timezone: true,
        waterTargetMl: true,
      },
    });

    const [meals, streak, waterAgg, account, weekRows, diaryNote] = await Promise.all([
      buildDayMealsPayload(userId, date),
      buildStreakPayload(userId, todayParam),
      prisma.waterEntry.aggregate({
        where: { userId, date },
        _sum: { ml: true },
      }),
      accountPromise,
      accountPromise.then((acc) => {
        const weekStart = weekStartMonday(date, acc?.timezone ?? null);
        const weekEnd = shiftDateKeyUtc(weekStart, 6);
        return prisma.mealEntry.groupBy({
          by: ["date"],
          where: {
            userId,
            date: { gte: weekStart, lte: weekEnd },
          },
          _sum: { calories: true },
        });
      }),
      prisma.diaryNote.findUnique({
        where: { userId_date: { userId, date } },
        select: { mood: true },
      }),
    ]);

    const waterTarget = resolveWaterTargetMl(account?.waterTargetMl);
    const weekStart = weekStartMonday(date, account?.timezone ?? null);
    const caloriesByDate = new Map(
      weekRows.map((row) => [row.date, row._sum.calories ?? 0]),
    );
    const weekDays: Array<{ date: string; calories: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = shiftDateKeyUtc(weekStart, i);
      weekDays.push({ date: d, calories: caloriesByDate.get(d) ?? 0 });
    }

    const tip = await (async () => {
      const tz = account?.timezone ?? null;
      const isMonday = todayParam === weekStartMonday(todayParam, tz);
      if (isMonday && todayParam === date) {
        const weekStart = weekStartMonday(todayParam, tz);
        const lastWeekStart = shiftDateKeyUtc(weekStart, -7);
        const lastWeekEnd = shiftDateKeyUtc(weekStart, -1);
        const lastWeekRows = await prisma.mealEntry.groupBy({
          by: ["date"],
          where: {
            userId,
            date: { gte: lastWeekStart, lte: lastWeekEnd },
          },
        });
        const stats = computeLastWeekStats(
          lastWeekRows.map((row) => row.date),
          todayParam,
          tz,
        );
        return mondayWeekWrapTip(stats.daysLoggedLastWeek, stats.daysInLastWeek);
      }
      return streak.streak >= 1
        ? "Регулярность важнее идеальных цифр. Запишите следующий приём — и день уже засчитан."
        : "Сегодня достаточно одного приёма пищи, чтобы войти в ритм.";
    })();

    return NextResponse.json(
      {
        date,
        today: todayParam,
        meals,
        streak,
        water: {
          totalMl: waterAgg._sum.ml ?? 0,
          target: waterTarget,
        },
        account: {
          sex: account?.sex ?? null,
          heightCm: account?.heightCm ?? null,
          birthYear: account?.birthYear ?? null,
          fastingStartHour: account?.fastingStartHour ?? null,
          fastingEndHour: account?.fastingEndHour ?? null,
          timezone: account?.timezone ?? null,
          waterTargetMl: account?.waterTargetMl ?? null,
        },
        week: {
          days: weekDays,
          calorieTarget: meals.target?.calories ?? null,
        },
        tip,
        diaryMood: diaryNote?.mood != null ? String(diaryNote.mood) : null,
        challenges: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось загрузить день рациона" },
      { status: 500 },
    );
  }
}
