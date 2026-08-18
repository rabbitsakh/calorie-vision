import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) {
      return response;
    }

    const [userCount, mealCount, weightCount, photoCount] = await Promise.all([
      prisma.user.count(),
      prisma.mealEntry.count(),
      prisma.weightEntry.count(),
      prisma.mealEntry.count({
        where: { imagePath: { not: null } },
      }),
    ]);

    return NextResponse.json({
      userCount,
      mealCount,
      weightCount,
      photoCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
