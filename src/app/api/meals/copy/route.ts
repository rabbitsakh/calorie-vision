import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { fromDate: string; toDate: string };
    const fromDate = requireDateKey(body.fromDate);
    const toDate = requireDateKey(body.toDate);
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "Укажите корректные даты" }, { status: 400 });
    }

    const source = await prisma.mealEntry.findMany({
      where: { userId: session.user.id, date: fromDate },
    });

    if (source.length === 0) {
      return NextResponse.json({ error: "За этот день нет записей для копирования" }, { status: 404 });
    }

    await prisma.mealEntry.createMany({
      data: source.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => ({
        ...rest,
        date: toDate,
        mealGroupId: null, // new group per copy
      })),
    });

    return NextResponse.json({ copied: source.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось скопировать записи" }, { status: 500 });
  }
}
