import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import {
  computeExercisePrs,
  formatPrSummary,
  mergeExercisePrs,
} from "@/lib/workouts/prs";
import { sessionInclude } from "@/lib/workouts/serialize";
import { bestPaceDeltaSec, buildExerciseTimeline, topWeightDeltaKg } from "@/lib/workouts/timeline";

export const dynamic = "force-dynamic";

/** GET ?name=Жим+лёжа — timeline + PRs + chart series for one exercise. */
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
    const key = normalizeExerciseName(name);
    const prParts = [];
    let latestKind = points.at(-1)?.kind ?? "strength";
    for (const row of history) {
      for (const ex of row.exercises) {
        if (normalizeExerciseName(ex.name) !== key) continue;
        latestKind = parseExerciseKind(ex.kind);
        prParts.push(computeExercisePrs(ex.kind, ex.sets));
      }
    }
    const prs = mergeExercisePrs(prParts);

    const chart = points.map((p) => ({
      date: p.date,
      weight: p.topWeightKg,
      volume: p.totalLoad,
      pace: p.bestPaceSecPerKm,
      distance: p.distanceKm,
      duration: p.durationSec,
      reps: p.topReps,
    }));

    return NextResponse.json({
      name,
      kind: latestKind,
      points,
      chart,
      prs,
      prSummary: prs ? formatPrSummary(prs) : null,
      topWeightDeltaKg: topWeightDeltaKg(points),
      bestPaceDeltaSec: bestPaceDeltaSec(points),
    });
  } catch (error) {
    console.error("GET /api/workouts/exercise-history", error);
    return NextResponse.json({ error: "Не удалось загрузить историю" }, { status: 500 });
  }
}
