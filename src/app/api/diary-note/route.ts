import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const date = requireDateKey(request.nextUrl.searchParams.get("date"));
    if (!date) return NextResponse.json({ error: "Укажите date" }, { status: 400 });

    const note = await prisma.diaryNote.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    });

    return NextResponse.json({ note: note ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { date: string; note: string; mood?: number | null };
    const date = requireDateKey(body.date);
    if (!date) return NextResponse.json({ error: "Укажите корректную дату" }, { status: 400 });

    const noteText = body.note?.trim().slice(0, 500) ?? "";
    const mood = typeof body.mood === "number" && body.mood >= 1 && body.mood <= 5
      ? Math.round(body.mood)
      : null;

    if (!noteText && mood === null) {
      // Delete if both empty
      await prisma.diaryNote.deleteMany({
        where: { userId: session.user.id, date },
      });
      return NextResponse.json({ note: null });
    }

    const note = await prisma.diaryNote.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      create: { userId: session.user.id, date, note: noteText, mood },
      update: { note: noteText, mood },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
