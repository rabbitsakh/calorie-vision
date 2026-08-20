import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const foods = await prisma.customFood.findMany({
      where: { userId: session.user.id },
      orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      foods: foods.map((food) => ({ ...food, name: decodeHtmlEntities(food.name) })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as {
      name: string;
      calories: number;
      protein?: number | null;
      fat?: number | null;
      carbs?: number | null;
      fiber?: number | null;
      sugar?: number | null;
      portionGrams?: number | null;
    };

    if (!body.name?.trim() || !Number.isFinite(body.calories) || body.calories <= 0) {
      return NextResponse.json({ error: "Укажите название и калории" }, { status: 400 });
    }

    const food = await prisma.customFood.create({
      data: {
        userId: session.user.id,
        name: decodeHtmlEntities(body.name.trim()),
        calories: Math.round(body.calories),
        protein: body.protein ?? null,
        fat: body.fat ?? null,
        carbs: body.carbs ?? null,
        fiber: body.fiber ?? null,
        sugar: body.sugar ?? null,
        portionGrams: body.portionGrams ?? null,
      },
    });

    return NextResponse.json({ food });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { id } = (await request.json()) as { id: string };
    await prisma.customFood.deleteMany({ where: { id, userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка удаления" }, { status: 500 });
  }
}
