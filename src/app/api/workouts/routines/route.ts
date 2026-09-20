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
} from "@/lib/workouts/routines";
import { parseOptionalNote } from "@/lib/workouts/set-meta";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const rows = await prisma.workoutRoutine.findMany({
      where: { userId: session.user.id },
      include: routineInclude,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ routines: rows.map(serializeRoutine) });
  } catch (error) {
    console.error("GET /api/workouts/routines", error);
    return NextResponse.json({ error: "Не удалось загрузить шаблоны" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json()) as {
      name?: string;
      note?: string | null;
      muscleGroups?: unknown;
      exercises?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) {
      return NextResponse.json({ error: "Укажите название шаблона" }, { status: 400 });
    }

    const muscleGroups = parseMuscleGroupKeys(body.muscleGroups);
    if (!muscleGroups) {
      return NextResponse.json({ error: "Выберите хотя бы одну группу мышц" }, { status: 400 });
    }

    const exercises = normalizeRoutineExerciseInputs(body.exercises);
    if (!exercises) {
      return NextResponse.json({ error: "Добавьте хотя бы одно упражнение" }, { status: 400 });
    }

    const note = parseOptionalNote(body.note);
    if (note === undefined) {
      /* ignore invalid */
    }

    const maxOrder = await prisma.workoutRoutine.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.workoutRoutine.create({
        data: {
          userId: session.user.id,
          name,
          note: note === undefined ? null : note,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          muscles: {
            create: muscleGroups.map((groupKey) => ({ groupKey })),
          },
          exercises: {
            create: exercises.map((ex, i) => ({
              name: ex.name,
              kind: ex.kind,
              muscleGroup: ex.muscleGroup,
              sortOrder: i,
              plannedSets:
                ex.plannedSets.length > 0 ? plannedSetsToJson(ex.plannedSets) : undefined,
            })),
          },
        },
        include: routineInclude,
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

      return row;
    });

    return NextResponse.json({ routine: serializeRoutine(created) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/routines", error);
    return NextResponse.json({ error: "Не удалось создать шаблон" }, { status: 500 });
  }
}
