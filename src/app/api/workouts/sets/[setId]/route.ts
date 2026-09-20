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
import { isSetType, parseRpe, parseSetType } from "@/lib/workouts/set-meta";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ setId: string }> };

async function ownedSet(userId: string, setId: string) {
  return prisma.workoutSet.findFirst({
    where: { id: setId, exercise: { session: { userId } } },
    select: {
      id: true,
      exercise: { select: { sessionId: true, kind: true } },
    },
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { setId } = await context.params;
    const owned = await ownedSet(session.user.id, setId);
    if (!owned) {
      return NextResponse.json({ error: "Подход не найден" }, { status: 404 });
    }

    const kind = parseExerciseKind(owned.exercise.kind);
    const body = (await request.json()) as {
      weightKg?: unknown;
      reps?: unknown;
      distanceKm?: unknown;
      durationSec?: unknown;
      setType?: unknown;
      completed?: unknown;
      rpe?: unknown;
    };

    const data: {
      weightKg?: number | null;
      reps?: number | null;
      distanceKm?: number | null;
      durationSec?: number | null;
      setType?: string;
      completed?: boolean;
      rpe?: number | null;
    } = {};

    if (body.setType !== undefined) {
      if (!isSetType(body.setType)) {
        return NextResponse.json({ error: "Тип подхода: warmup/working/drop/failure" }, { status: 400 });
      }
      data.setType = parseSetType(body.setType);
    }
    if (body.completed !== undefined) {
      data.completed = Boolean(body.completed);
    }
    if (body.rpe !== undefined) {
      const rpe = parseRpe(body.rpe);
      if (body.rpe !== null && body.rpe !== "" && rpe === null) {
        return NextResponse.json({ error: "RPE от 1 до 10" }, { status: 400 });
      }
      data.rpe = rpe ?? null;
    }

    if (kind === "cardio") {
      if (body.distanceKm !== undefined) {
        const distanceKm = parseCardioDistanceKm(body.distanceKm);
        if (distanceKm === null) {
          return NextResponse.json({ error: "Некорректная дистанция" }, { status: 400 });
        }
        data.distanceKm = distanceKm;
      }
      if (body.durationSec !== undefined) {
        const durationSec = parseCardioDurationSec(body.durationSec);
        if (durationSec === null) {
          return NextResponse.json({ error: "Некорректное время" }, { status: 400 });
        }
        data.durationSec = durationSec;
      }
      data.weightKg = null;
      data.reps = null;
    } else {
      if (body.weightKg !== undefined) {
        const weightKg = parseStrengthWeight(body.weightKg);
        if (weightKg === null) {
          return NextResponse.json({ error: "Некорректный вес" }, { status: 400 });
        }
        data.weightKg = weightKg;
      }
      if (body.reps !== undefined) {
        const reps = parseStrengthReps(body.reps);
        if (reps === null) {
          return NextResponse.json({ error: "Некорректные повторения" }, { status: 400 });
        }
        data.reps = reps;
      }
      if (body.weightKg !== undefined || body.reps !== undefined) {
        data.distanceKm = null;
        data.durationSec = null;
      }
    }

    await prisma.workoutSet.update({ where: { id: setId }, data });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.exercise.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("PATCH /api/workouts/sets/[setId]", error);
    return NextResponse.json({ error: "Не удалось сохранить подход" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { setId } = await context.params;
    const owned = await ownedSet(session.user.id, setId);
    if (!owned) {
      return NextResponse.json({ error: "Подход не найден" }, { status: 404 });
    }

    await prisma.workoutSet.delete({ where: { id: setId } });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.exercise.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("DELETE /api/workouts/sets/[setId]", error);
    return NextResponse.json({ error: "Не удалось удалить подход" }, { status: 500 });
  }
}
