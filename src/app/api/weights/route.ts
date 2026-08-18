import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  computeWeightChangeKg,
  weightEntryOrderNewestFirst,
  weightEntryOrderOldestFirst,
} from "@/lib/weight-entries";

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
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 20;

    const [entries, first, current] = await Promise.all([
      prisma.weightEntry.findMany({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
        take: limit,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderOldestFirst,
      }),
      prisma.weightEntry.findFirst({
        where: { userId: session.user.id },
        orderBy: weightEntryOrderNewestFirst,
      }),
    ]);

    const changeKg = computeWeightChangeKg(first, current);

    return NextResponse.json({
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        weightKg: entry.weightKg,
        measuredAt: entry.measuredAt.toISOString(),
        createdAt: entry.createdAt.toISOString(),
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

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as { date?: string; weightKg?: number; measuredAt?: string };
    const date = requireDateKey(body.date);
    if (!date || !isValidWeight(Number(body.weightKg))) {
      return NextResponse.json({ error: "Укажите дату и вес от 20 до 300 кг" }, { status: 400 });
    }

    const weightKg = Math.round(Number(body.weightKg) * 10) / 10;
    const measuredAt = body.measuredAt ? new Date(body.measuredAt) : new Date();

    const entry = await prisma.weightEntry.create({
      data: {
        userId: session.user.id,
        date,
        weightKg,
        measuredAt: isNaN(measuredAt.getTime()) ? new Date() : measuredAt,
      },
    });

    return NextResponse.json({
      id: entry.id,
      date: entry.date,
      weightKg: entry.weightKg,
      measuredAt: entry.measuredAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить вес" }, { status: 500 });
  }
}

// Keep PUT for backward compat (profile API uses it to read weightKg for given date)
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
    const existing = await prisma.weightEntry.findFirst({
      where: { userId: session.user.id, date },
      orderBy: weightEntryOrderOldestFirst,
    });

    const entry = existing
      ? await prisma.weightEntry.update({
          where: { id: existing.id },
          data: { weightKg },
        })
      : await prisma.weightEntry.create({
          data: { userId: session.user.id, date, weightKg },
        });

    return NextResponse.json({
      id: entry.id,
      date: entry.date,
      weightKg: entry.weightKg,
      measuredAt: entry.measuredAt.toISOString(),
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

    const id = request.nextUrl.searchParams.get("id");
    const date = requireDateKey(request.nextUrl.searchParams.get("date"));

    if (id) {
      const entry = await prisma.weightEntry.findFirst({
        where: { id, userId: session.user.id },
      });
      if (!entry) {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
      await prisma.weightEntry.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (date) {
      await prisma.weightEntry.deleteMany({
        where: { userId: session.user.id, date },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Укажите id или date" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить вес" }, { status: 500 });
  }
}
