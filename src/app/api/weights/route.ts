import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value >= 20 && value <= 300;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 50) : 10;

    const [entries, first, current] = await Promise.all([
      prisma.weightEntry.findMany({
        where: { userId: session.user.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: { date: "asc" },
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: { date: "desc" },
      }),
    ]);

    const changeKg =
      first && current ? Math.round((current.weightKg - first.weightKg) * 10) / 10 : null;

    return NextResponse.json({
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        weightKg: entry.weightKg,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      firstWeightKg: first?.weightKg ?? null,
      firstWeightDate: first?.date ?? null,
      currentWeightKg: current?.weightKg ?? null,
      currentWeightDate: current?.date ?? null,
      weightChangeKg: changeKg,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить вес" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as { date?: string; weightKg?: number };
    const date = requireDateKey(body.date);
    if (!date || !isValidWeight(Number(body.weightKg))) {
      return NextResponse.json({ error: "Укажите дату и вес от 20 до 300 кг" }, { status: 400 });
    }

    const weightKg = Math.round(Number(body.weightKg) * 10) / 10;

    const entry = await prisma.weightEntry.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      create: { userId: session.user.id, date, weightKg },
      update: { weightKg },
    });

    return NextResponse.json({
      date: entry.date,
      weightKg: entry.weightKg,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить вес" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));
    if (!date) {
      return NextResponse.json({ error: "Укажите date=YYYY-MM-DD" }, { status: 400 });
    }

    await prisma.weightEntry.deleteMany({
      where: { userId: session.user.id, date },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить вес" }, { status: 500 });
  }
}
