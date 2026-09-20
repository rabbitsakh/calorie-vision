import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import {
  parseCardioDistanceKm,
  parseCardioDurationSec,
  parseStrengthReps,
  parseStrengthWeight,
} from "@/lib/workouts/set-fields";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ exerciseId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { exerciseId } = await context.params;
    const owned = await prisma.workoutExercise.findFirst({
      where: { id: exerciseId, session: { userId: session.user.id } },
      select: { id: true, sessionId: true, kind: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    const kind = parseExerciseKind(owned.kind);
    const body = (await request.json()) as {
      weightKg?: unknown;
      reps?: unknown;
      distanceKm?: unknown;
      durationSec?: unknown;
    };

    const maxOrder = await prisma.workoutSet.aggregate({
      where: { exerciseId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    if (kind === "cardio") {
      const distanceKm = parseCardioDistanceKm(body.distanceKm ?? 0);
      const durationSec = parseCardioDurationSec(body.durationSec);
      if (distanceKm === null || durationSec === null) {
        return NextResponse.json(
          { error: "Укажите дистанцию (км) и время (сек)" },
          { status: 400 },
        );
      }
      if (distanceKm === 0 && durationSec === 0) {
        return NextResponse.json({ error: "Укажите дистанцию или время" }, { status: 400 });
      }
      // Require at least duration; distance may be 0 for stationary bike time-only.
      await prisma.workoutSet.create({
        data: {
          exerciseId,
          weightKg: null,
          reps: null,
          distanceKm,
          durationSec,
          sortOrder,
        },
      });
    } else {
      const weightKg = parseStrengthWeight(body.weightKg);
      const reps = parseStrengthReps(body.reps);
      if (weightKg === null || reps === null) {
        return NextResponse.json({ error: "Укажите кг и число повторений" }, { status: 400 });
      }
      await prisma.workoutSet.create({
        data: {
          exerciseId,
          weightKg,
          reps,
          distanceKm: null,
          durationSec: null,
          sortOrder,
        },
      });
    }

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/exercises/[exerciseId]/sets", error);
    return NextResponse.json({ error: "Не удалось добавить подход" }, { status: 500 });
  }
}
