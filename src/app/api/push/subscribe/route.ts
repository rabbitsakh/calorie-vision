import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { isValidIanaTimezone } from "@/lib/device-timezone";
import { prisma } from "@/lib/prisma";
import { quietFirstRunPrefs } from "@/lib/push-reminder-schedule";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Device IANA timezone — used so reminder cron matches local hours. */
  timezone?: string | null;
};

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const count = await prisma.pushSubscription.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ subscribed: count > 0, count });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось проверить подписку" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as SubscribeBody;
    if (!body.endpoint?.trim() || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "Некорректная подписка" }, { status: 400 });
    }

    const deviceTz = body.timezone?.trim() || null;
    const userUpdate: {
      timezone?: string;
      pushReminderPrefs?: Prisma.InputJsonValue;
    } = {};
    if (deviceTz && isValidIanaTimezone(deviceTz)) {
      userUpdate.timezone = deviceTz;
    }

    // Seed quieter first-run prefs only when still unset.
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { pushReminderPrefs: true },
    });
    if (current?.pushReminderPrefs == null) {
      userUpdate.pushReminderPrefs = quietFirstRunPrefs() as Prisma.InputJsonValue;
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: userUpdate,
      });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: session.user.id,
          endpoint: body.endpoint.trim(),
        },
      },
      create: {
        userId: session.user.id,
        endpoint: body.endpoint.trim(),
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить подписку" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const endpoint = request.nextUrl.searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ error: "Укажите endpoint" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить подписку" }, { status: 500 });
  }
}
