import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { isAllowedImageUrl } from "@/lib/food-image";
import { applyMealPhotoFromUrl, searchMealPhotoCandidates } from "@/lib/meal-photo-search";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/meals/[id]/image
 * - { imageUrl } — cache and set meal photo
 * - { query } — auto-pick first search hit and set
 * - { clear: true } — remove photo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      imageUrl?: string;
      query?: string;
      clear?: boolean;
    };

    const existing = await prisma.mealEntry.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, dishName: true, imagePath: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    if (body.clear) {
      await prisma.mealEntry.update({
        where: { id },
        data: { imagePath: null },
      });
      return NextResponse.json({ ok: true, imagePath: null });
    }

    let remoteUrl = body.imageUrl?.trim() ?? "";
    if (!remoteUrl && body.query?.trim()) {
      const candidates = await searchMealPhotoCandidates(body.query.trim(), 5);
      remoteUrl = candidates[0]?.url ?? "";
    }
    if (!remoteUrl) {
      const candidates = await searchMealPhotoCandidates(existing.dishName, 5);
      remoteUrl = candidates[0]?.url ?? "";
    }

    if (!remoteUrl || !isAllowedImageUrl(remoteUrl)) {
      return NextResponse.json(
        { error: "Не нашли подходящее фото. Попробуйте другой запрос." },
        { status: 404 },
      );
    }

    const imagePath = await applyMealPhotoFromUrl(remoteUrl, { ownerUserId: session.user.id });
    if (!imagePath) {
      return NextResponse.json({ error: "Не удалось сохранить изображение" }, { status: 502 });
    }

    await prisma.mealEntry.update({
      where: { id },
      data: { imagePath },
    });

    return NextResponse.json({ ok: true, imagePath });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось обновить фото" }, { status: 500 });
  }
}
