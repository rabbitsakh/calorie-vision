import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { sessionInclude } from "@/lib/workouts/serialize";
import { bestPaceDeltaSec, buildExerciseTimeline, topWeightDeltaKg } from "@/lib/workouts/timeline";

export const dynamic = "force-dynamic";

/** GET ?name=Жим+лёжа — timeline of top weight / load / cardio for one exercise. */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ error: "Укажите name=" }, { status: 400 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 30) : 12;

    const history = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: sessionInclude,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 120,
    });

    const points = buildExerciseTimeline(history, name, { limit });
    return NextResponse.json({
      name,
      points,
      topWeightDeltaKg: topWeightDeltaKg(points),
      bestPaceDeltaSec: bestPaceDeltaSec(points),
    });
  } catch (error) {
    console.error("GET /api/workouts/exercise-history", error);
    return NextResponse.json({ error: "Не удалось загрузить историю" }, { status: 500 });
  }
}
