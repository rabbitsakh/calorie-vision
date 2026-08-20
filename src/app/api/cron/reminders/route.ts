import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import { sendPushNotification } from "@/lib/push";
import { withBasePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

const WATER_DAILY_TARGET_ML = 2000;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function localHour(timezone: string | null | undefined): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone ?? undefined,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "12");
}

type ReminderKind = "breakfast" | "streak" | "water";

function reminderForHour(hour: number): ReminderKind | null {
  if (hour === 8) return "breakfast";
  if (hour === 14) return "water";
  if (hour === 20) return "streak";
  return null;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidOk = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!vapidOk) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

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

    for (const user of users) {
      const hour = localHour(user.timezone);
      const kind = reminderForHour(hour);
      if (!kind) {
        skipped += 1;
        continue;
      }

      const today = toDateKeyTz(new Date(), user.timezone);

      const [mealCount, waterTotal] = await Promise.all([
        prisma.mealEntry.count({ where: { userId: user.id, date: today } }),
        prisma.waterEntry.aggregate({
          where: { userId: user.id, date: today },
          _sum: { ml: true },
        }),
      ]);

      let payload: { title: string; body: string; url: string; tag: string } | null = null;

      if (kind === "breakfast" && mealCount === 0) {
        payload = {
          title: "Доброе утро!",
          body: "Не забудьте записать завтрак — серия начинается с первого приёма пищи.",
          url: withBasePath("/ration"),
          tag: "cv-breakfast",
        };
      } else if (kind === "water" && (waterTotal._sum.ml ?? 0) < WATER_DAILY_TARGET_ML / 2) {
        payload = {
          title: "Время пить воду",
          body: `Сегодня ${waterTotal._sum.ml ?? 0} мл из ${WATER_DAILY_TARGET_ML} — добавьте стакан воды.`,
          url: withBasePath("/ration"),
          tag: "cv-water",
        };
      } else if (kind === "streak" && mealCount === 0) {
        payload = {
          title: "Сохраните серию!",
          body: "Сегодня ещё нет записей — добавьте хотя бы один приём пищи до конца дня.",
          url: withBasePath("/ration"),
          tag: "cv-streak",
        };
      }

      if (!payload) {
        skipped += 1;
        continue;
      }

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
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("410") || message.includes("404")) {
            await prisma.pushSubscription.deleteMany({
              where: { userId: user.id, endpoint: sub.endpoint },
            });
          }
          errors.push(`${user.id}: ${message}`);
        }
      }
    }

    return NextResponse.json({ sent, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
