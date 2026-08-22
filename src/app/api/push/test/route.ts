import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/push";
import { withBasePath } from "@/lib/paths";
import { REMINDER_SCHEDULE, reminderKindLabel } from "@/lib/push-reminder-schedule";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const vapidOk = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    if (!vapidOk) {
      return NextResponse.json({ error: "Push не настроен на сервере" }, { status: 503 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: session.user.id },
      select: { endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "Сначала включите напоминания на этом устройстве" },
        { status: 400 },
      );
    }

    const kinds = REMINDER_SCHEDULE.map((slot) => reminderKindLabel(slot.kind)).join(", ");
    const payload = {
      title: "Тест: Calorie Vision",
      body: `Уведомления работают. Расписание: ${kinds}.`,
      url: withBasePath("/profile"),
      tag: "cv-test",
    };

    let delivered = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        delivered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("410") || message.includes("404")) {
          await prisma.pushSubscription.deleteMany({
            where: { userId: session.user.id, endpoint: sub.endpoint },
          });
        }
        errors.push(message);
      }
    }

    if (delivered === 0) {
      return NextResponse.json(
        { error: errors[0] ?? "Не удалось отправить тестовое уведомление" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      delivered,
      message: "Тестовое уведомление отправлено",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось отправить тест" }, { status: 500 });
  }
}
