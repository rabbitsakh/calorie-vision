import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import { sendPushNotification } from "@/lib/push";
import {
  buildReminderPayload,
  computeCalorieTarget,
  computeLastWeekStats,
  computeStreakStats,
  localHour,
  localWeekday,
  remindersForLocalTime,
  resolvePushTimezone,
  type ReminderKind,
  type UserReminderContext,
} from "@/lib/push-reminders";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function loadUserReminderContext(
  userId: string,
  today: string,
  timezone: string,
): Promise<UserReminderContext> {
  const [meals, waterTotal, diary, user, latestWeight, recentMeals, freezes] = await Promise.all([
    prisma.mealEntry.findMany({
      where: { userId, date: today },
      select: { calories: true, mealType: true },
    }),
    prisma.waterEntry.aggregate({
      where: { userId, date: today },
      _sum: { ml: true },
    }),
    prisma.diaryNote.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { mood: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { goal: true, goalPace: true, sex: true },
    }),
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: weightEntryOrderNewestFirst,
      select: { weightKg: true },
    }),
    prisma.mealEntry.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 400,
    }),
    prisma.streakFreeze.findMany({
      where: { userId },
      select: { date: true },
      take: 100,
    }),
  ]);

  const mealDates = recentMeals.map((entry) => entry.date);
  const frozenDates = freezes.map((entry) => entry.date);
  const streakStats = computeStreakStats(mealDates, frozenDates, today);
  const weekStats = computeLastWeekStats(mealDates, today, timezone);

  const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const calorieTarget = computeCalorieTarget({
    goal: user?.goal,
    goalPace: user?.goalPace,
    sex: user?.sex,
    latestWeightKg: latestWeight?.weightKg ?? null,
  });

  return {
    today,
    mealCount: meals.length,
    totalCalories,
    calorieTarget,
    waterMl: waterTotal._sum.ml ?? 0,
    streak: streakStats.streak,
    streakBeforeToday: streakStats.streakBeforeToday,
    loggedToday: streakStats.loggedToday,
    mood: diary?.mood ?? null,
    hasBreakfast: meals.some((meal) => meal.mealType === "BREAKFAST"),
    hasLunch: meals.some((meal) => meal.mealType === "LUNCH"),
    hasDinner: meals.some((meal) => meal.mealType === "DINNER"),
    daysLoggedLastWeek: weekStats.daysLoggedLastWeek,
    daysInLastWeek: weekStats.daysInLastWeek,
  };
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidOk = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!vapidOk) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const now = new Date();

  try {
    const users = await prisma.user.findMany({
      where: {
        pushSubscriptions: { some: {} },
      },
      select: {
        id: true,
        timezone: true,
        pushSubscriptions: {
          select: { endpoint: true, p256dh: true, auth: true },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];
    const preview: Array<{ userId: string; kind: ReminderKind; title: string; body: string }> = [];

    for (const user of users) {
      const timezone = resolvePushTimezone(user.timezone);
      const hour = localHour(timezone, now);
      const weekday = localWeekday(timezone, now);
      const kinds = remindersForLocalTime(hour, weekday);
      if (kinds.length === 0) {
        skipped += 1;
        continue;
      }

      const today = toDateKeyTz(now, timezone);
      const ctx = await loadUserReminderContext(user.id, today, timezone);

      for (const kind of kinds) {
        const alreadySent = await prisma.pushReminderLog.findUnique({
          where: {
            userId_kind_date: { userId: user.id, kind, date: today },
          },
          select: { id: true },
        });
        if (alreadySent) {
          skipped += 1;
          continue;
        }

        const payload = buildReminderPayload(kind, ctx, { userId: user.id });
        if (!payload) {
          skipped += 1;
          continue;
        }

        if (dryRun) {
          preview.push({
            userId: user.id,
            kind,
            title: payload.title,
            body: payload.body,
          });
          continue;
        }

        // Claim the reminder slot before send to avoid double-delivery on overlapping crons.
        try {
          await prisma.pushReminderLog.create({
            data: { userId: user.id, kind, date: today },
          });
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code === "P2002") {
            skipped += 1;
            continue;
          }
          throw error;
        }

        let delivered = false;
        for (const sub of user.pushSubscriptions) {
          try {
            await sendPushNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
            );
            sent += 1;
            delivered = true;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("410") || message.includes("404")) {
              await prisma.pushSubscription.deleteMany({
                where: { userId: user.id, endpoint: sub.endpoint },
              });
            }
            errors.push(`${user.id}/${kind}: ${message}`);
          }
        }

        if (!delivered) {
          await prisma.pushReminderLog.deleteMany({
            where: { userId: user.id, kind, date: today },
          });
        }
      }
    }

    return NextResponse.json({
      sent,
      skipped,
      dryRun,
      preview: preview.slice(0, 20),
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
