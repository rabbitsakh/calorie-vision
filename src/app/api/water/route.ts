import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { resolveWaterTargetMl } from "@/lib/water-target";

export const dynamic = "force-dynamic";

async function waterTargetForUser(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { waterTargetMl: true },
  });
  return resolveWaterTargetMl(user?.waterTargetMl);
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));
    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    const [entries, target] = await Promise.all([
      prisma.waterEntry.findMany({
        where: { userId: session.user.id, date },
        orderBy: { createdAt: "asc" },
      }),
      waterTargetForUser(session.user.id),
    ]);

    const totalMl = entries.reduce((sum, e) => sum + e.ml, 0);
    return NextResponse.json({ totalMl, target, entries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { date: string; ml: number };
    const date = requireDateKey(body.date);
    if (!date) return NextResponse.json({ error: "Укажите корректную дату" }, { status: 400 });

    const ml = Math.round(body.ml);
    if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) {
      return NextResponse.json({ error: "Укажите объём от 1 до 5000 мл" }, { status: 400 });
    }

    const entry = await prisma.waterEntry.create({
      data: { userId: session.user.id, date, ml },
    });

    const [all, target] = await Promise.all([
      prisma.waterEntry.findMany({
        where: { userId: session.user.id, date },
      }),
      waterTargetForUser(session.user.id),
    ]);
    const totalMl = all.reduce((sum, e) => sum + e.ml, 0);

    return NextResponse.json({ entry, totalMl, target });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { id: string };
    await prisma.waterEntry.deleteMany({
      where: { id: body.id, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
