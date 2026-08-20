import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
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
