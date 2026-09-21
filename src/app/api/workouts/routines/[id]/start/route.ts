import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROGRESS_RATE, parseProgressRate } from "@/lib/workouts/load";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import {
  parsePlannedSets,
  routineInclude,
  serializeRoutine,
} from "@/lib/workouts/routines";
import {
  serializeSessionDetail,
  sessionInclude,
} from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Start a new session from a routine.
 * Body: { date, copySets?: boolean (default true → planned as incomplete), progressRate? }
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id: routineId } = await context.params;
    const routine = await prisma.workoutRoutine.findFirst({
      where: { id: routineId, userId: session.user.id },
      include: routineInclude,
    });
    if (!routine) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }

    const muscleKeys = routine.muscles.map((m) => m.groupKey);
    if (muscleKeys.length === 0) {
      return NextResponse.json({ error: "У шаблона нет групп мышц" }, { status: 400 });
    }
    if (routine.exercises.length === 0) {
      return NextResponse.json({ error: "У шаблона нет упражнений" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
      copySets?: boolean;
      progressRate?: unknown;
    };
    const date = requireDateKey(body.date ?? null);
    if (!date) {
      return NextResponse.json({ error: "Укажите дату" }, { status: 400 });
    }
    const copySets = body.copySets !== false;
    const progressRate = parseProgressRate(body.progressRate ?? DEFAULT_PROGRESS_RATE);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.workoutSession.create({
        data: {
          userId: session.user.id,
          date,
          progressRate,
          note: routine.note,
          startedAt: new Date(),
          muscles: {
            create: muscleKeys.map((groupKey) => ({ groupKey })),
          },
        },
      });

      const exercises = [...routine.exercises].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );

      for (const [i, ex] of exercises.entries()) {
        const createdEx = await tx.workoutExercise.create({
          data: {
            sessionId: row.id,
            name: ex.name,
            kind: ex.kind ?? "strength",
            muscleGroup: ex.muscleGroup,
            sortOrder: i,
            ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
            blockMode: ex.blockMode ?? "normal",
            ...(ex.circuitRounds != null ? { circuitRounds: ex.circuitRounds } : {}),
          },
        });

        if (copySets) {
          const planned = parsePlannedSets(ex.plannedSets);
          if (planned.length > 0) {
            await tx.workoutSet.createMany({
              data: planned.map((s, j) => ({
                exerciseId: createdEx.id,
                weightKg: s.weightKg,
                reps: s.reps,
                distanceKm: s.distanceKm,
                durationSec: s.durationSec,
                setType: s.setType,
                completed: false,
                sortOrder: j,
              })),
            });
          }
        }
      }

      await touchExerciseLibraryMany(
        tx,
        session.user.id,
        exercises.map((ex) => ({
          name: ex.name,
          kind: ex.kind,
          muscleGroup: ex.muscleGroup,
        })),
      );

      return tx.workoutSession.findFirstOrThrow({
        where: { id: row.id },
        include: sessionInclude,
      });
    });

    return NextResponse.json(
      {
        session: serializeSessionDetail(created),
        routine: serializeRoutine(routine),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workouts/routines/[id]/start", error);
    return NextResponse.json({ error: "Не удалось начать тренировку" }, { status: 500 });
  }
}
