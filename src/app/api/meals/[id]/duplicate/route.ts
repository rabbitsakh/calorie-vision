import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const { id } = await params;
    const source = await prisma.mealEntry.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!source) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      mealGroupId: _group,
      ...rest
    } = source;

    const entry = await prisma.mealEntry.create({
      data: {
        ...rest,
        mealGroupId: null,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось дублировать запись" }, { status: 500 });
  }
}
