import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isExerciseKind, parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ exerciseId: string }> };

async function ownedExercise(userId: string, exerciseId: string) {
  return prisma.workoutExercise.findFirst({
    where: { id: exerciseId, session: { userId } },
    select: { id: true, sessionId: true },
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { exerciseId } = await context.params;
    const owned = await ownedExercise(session.user.id, exerciseId);
    if (!owned) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      muscleGroup?: string | null;
      kind?: unknown;
    };

    const data: { name?: string; muscleGroup?: string | null; kind?: string } = {};
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
      if (!name) {
        return NextResponse.json({ error: "Укажите название упражнения" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.muscleGroup !== undefined) {
      if (body.muscleGroup == null || body.muscleGroup === "") {
        data.muscleGroup = null;
      } else if (!isMuscleGroupKey(body.muscleGroup)) {
        return NextResponse.json({ error: "Некорректная группа мышц" }, { status: 400 });
      } else {
        data.muscleGroup = body.muscleGroup;
      }
    }
    if (body.kind !== undefined) {
      if (!isExerciseKind(body.kind)) {
        return NextResponse.json({ error: "Тип: strength или cardio" }, { status: 400 });
      }
      data.kind = parseExerciseKind(body.kind);
    }

    await prisma.workoutExercise.update({ where: { id: exerciseId }, data });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("PATCH /api/workouts/exercises/[exerciseId]", error);
    return NextResponse.json({ error: "Не удалось сохранить упражнение" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { exerciseId } = await context.params;
    const owned = await ownedExercise(session.user.id, exerciseId);
    if (!owned) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    await prisma.workoutExercise.delete({ where: { id: exerciseId } });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("DELETE /api/workouts/exercises/[exerciseId]", error);
    return NextResponse.json({ error: "Не удалось удалить упражнение" }, { status: 500 });
  }
}
