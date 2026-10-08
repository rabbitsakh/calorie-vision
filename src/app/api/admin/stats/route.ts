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

    const [userCount, mealCount, weightCount, photoCount, workoutSessionCount, workoutFinishedCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.mealEntry.count(),
        prisma.weightEntry.count(),
        prisma.mealEntry.count({
          where: { imagePath: { not: null } },
        }),
        prisma.workoutSession.count(),
        prisma.workoutSession.count({
          where: { endedAt: { not: null } },
        }),
      ]);

    return NextResponse.json({
      userCount,
      mealCount,
      weightCount,
      photoCount,
      workoutSessionCount,
      workoutFinishedCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
