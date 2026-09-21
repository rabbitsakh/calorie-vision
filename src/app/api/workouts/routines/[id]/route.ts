import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import { parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import {
  normalizeRoutineExerciseInputs,
  plannedSetsToJson,
  routineInclude,
  serializeRoutine,
  parsePlanLabel,
  parseWeekdays,
} from "@/lib/workouts/routines";
import { parseOptionalNote } from "@/lib/workouts/set-meta";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const row = await prisma.workoutRoutine.findFirst({
      where: { id, userId: session.user.id },
      include: routineInclude,
    });
    if (!row) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }
    return NextResponse.json({ routine: serializeRoutine(row) });
  } catch (error) {
    console.error("GET /api/workouts/routines/[id]", error);
    return NextResponse.json({ error: "Не удалось загрузить шаблон" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutRoutine.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      note?: string | null;
      muscleGroups?: unknown;
      exercises?: unknown;
      sortOrder?: number;
      weekdays?: unknown;
      planLabel?: unknown;
    };

    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 120) : undefined;
    if (body.name !== undefined && !name) {
      return NextResponse.json({ error: "Укажите название шаблона" }, { status: 400 });
    }

    const note = parseOptionalNote(body.note);
    const muscleGroups =
      body.muscleGroups !== undefined ? parseMuscleGroupKeys(body.muscleGroups) : undefined;
    if (body.muscleGroups !== undefined && !muscleGroups) {
      return NextResponse.json({ error: "Выберите хотя бы одну группу мышц" }, { status: 400 });
    }

    const exercises =
      body.exercises !== undefined ? normalizeRoutineExerciseInputs(body.exercises) : undefined;
    if (body.exercises !== undefined && !exercises) {
      return NextResponse.json({ error: "Добавьте хотя бы одно упражнение" }, { status: 400 });
    }

    const weekdays =
      body.weekdays !== undefined ? parseWeekdays(body.weekdays) : undefined;
    const planLabel =
      body.planLabel !== undefined ? parsePlanLabel(body.planLabel) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (muscleGroups) {
        await tx.workoutRoutineMuscle.deleteMany({ where: { routineId: id } });
        await tx.workoutRoutineMuscle.createMany({
          data: muscleGroups.map((groupKey) => ({ routineId: id, groupKey })),
        });
      }
      if (exercises) {
        await tx.workoutRoutineExercise.deleteMany({ where: { routineId: id } });
        await tx.workoutRoutineExercise.createMany({
          data: exercises.map((ex, i) => ({
            routineId: id,
            name: ex.name,
            kind: ex.kind,
            muscleGroup: ex.muscleGroup,
            sortOrder: i,
            plannedSets:
              ex.plannedSets.length > 0 ? plannedSetsToJson(ex.plannedSets) : undefined,
            ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
            blockMode: ex.blockMode,
            ...(ex.circuitRounds != null ? { circuitRounds: ex.circuitRounds } : {}),
          })),
        });
        await touchExerciseLibraryMany(
          tx,
          session.user.id,
          exercises.map((ex) => ({
            name: ex.name,
            kind: ex.kind,
            muscleGroup: ex.muscleGroup,
          })),
        );
      }

      return tx.workoutRoutine.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(note !== undefined ? { note } : {}),
          ...(typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
            ? { sortOrder: Math.round(body.sortOrder) }
            : {}),
          ...(weekdays !== undefined ? { weekdays } : {}),
          ...(planLabel !== undefined ? { planLabel } : {}),
        },
        include: routineInclude,
      });
    });

    return NextResponse.json({ routine: serializeRoutine(updated) });
  } catch (error) {
    console.error("PATCH /api/workouts/routines/[id]", error);
    return NextResponse.json({ error: "Не удалось обновить шаблон" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutRoutine.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }

    await prisma.workoutRoutine.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workouts/routines/[id]", error);
    return NextResponse.json({ error: "Не удалось удалить шаблон" }, { status: 500 });
  }
}
