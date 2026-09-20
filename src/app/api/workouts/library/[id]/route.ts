import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { serializeLibraryEntry } from "@/lib/workouts/library";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutExerciseLibrary.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      kind?: unknown;
      muscleGroup?: string | null;
    };

    const data: {
      name?: string;
      nameNorm?: string;
      kind?: string;
      defaultMuscleGroup?: string | null;
    } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 120);
      if (!name) {
        return NextResponse.json({ error: "Укажите название" }, { status: 400 });
      }
      const nameNorm = normalizeExerciseName(name);
      const clash = await prisma.workoutExerciseLibrary.findFirst({
        where: { userId: session.user.id, nameNorm, NOT: { id } },
      });
      if (clash) {
        return NextResponse.json({ error: "Такое упражнение уже есть" }, { status: 409 });
      }
      data.name = name;
      data.nameNorm = nameNorm;
    }
    if (body.kind !== undefined) {
      data.kind = parseExerciseKind(body.kind, parseExerciseKind(existing.kind, "strength"));
    }
    if (body.muscleGroup !== undefined) {
      if (body.muscleGroup == null || body.muscleGroup === "") {
        data.defaultMuscleGroup = null;
      } else if (!isMuscleGroupKey(String(body.muscleGroup))) {
        return NextResponse.json({ error: "Некорректная группа мышц" }, { status: 400 });
      } else {
        data.defaultMuscleGroup = String(body.muscleGroup);
      }
    }

    const updated = await prisma.workoutExerciseLibrary.update({
      where: { id },
      data,
    });
    return NextResponse.json({ entry: serializeLibraryEntry(updated) });
  } catch (error) {
    console.error("PATCH /api/workouts/library/[id]", error);
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutExerciseLibrary.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    await prisma.workoutExerciseLibrary.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workouts/library/[id]", error);
    return NextResponse.json({ error: "Не удалось удалить" }, { status: 500 });
  }
}
