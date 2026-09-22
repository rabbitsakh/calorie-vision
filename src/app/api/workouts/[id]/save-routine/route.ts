import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import {
  plannedSetsToJson,
  routineInclude,
  serializeRoutine,
  type PlannedSet,
} from "@/lib/workouts/routines";
import { sessionInclude } from "@/lib/workouts/serialize";
import { parseOptionalNote, parseSetType } from "@/lib/workouts/set-meta";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Save a past session as a named routine/template.
 * Body: { name?, note?, includeSets?: boolean (default true) }
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { id: sessionId } = await context.params;
    const source = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      include: sessionInclude,
    });
    if (!source) {
      return NextResponse.json({ error: "Тренировка не найдена" }, { status: 404 });
    }

    const muscleKeys = source.muscles.map((m) => m.groupKey);
    if (muscleKeys.length === 0) {
      return NextResponse.json({ error: "У тренировки нет групп мышц" }, { status: 400 });
    }
    if (source.exercises.length === 0) {
      return NextResponse.json({ error: "Сначала добавьте упражнения" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      note?: string | null;
      includeSets?: boolean;
    };

    const defaultName =
      source.note?.trim() ||
      source.muscles.map((m) => m.groupKey).join(" · ") ||
      `Тренировка ${source.date}`;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : defaultName.slice(0, 120);
    const note =
      body.note !== undefined
        ? parseOptionalNote(body.note) ?? null
        : source.note;
    const includeSets = body.includeSets !== false;

    const exercises = [...source.exercises].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );

    const maxOrder = await prisma.workoutRoutine.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.workoutRoutine.create({
        data: {
          userId: session.user.id,
          name,
          note: typeof note === "string" || note === null ? note : source.note,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          muscles: {
            create: muscleKeys.map((groupKey) => ({ groupKey })),
          },
          exercises: {
            create: exercises.map((ex, i) => {
              const planned: PlannedSet[] = includeSets
                ? [...ex.sets]
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
                    .map((s) => ({
                      weightKg: s.weightKg,
                      reps: s.reps,
                      distanceKm: s.distanceKm,
                      durationSec: s.durationSec,
                      setType: parseSetType(s.setType, "working"),
                    }))
                : [];
              return {
                name: ex.name,
                kind: ex.kind ?? "strength",
                muscleGroup: ex.muscleGroup,
                sortOrder: i,
                plannedSets: planned.length > 0 ? plannedSetsToJson(planned) : undefined,
                ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
                blockMode: ex.blockMode ?? "normal",
                ...(ex.circuitRounds != null ? { circuitRounds: ex.circuitRounds } : {}),
              };
            }),
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
    console.error("POST /api/workouts/[id]/save-routine", error);
    return NextResponse.json({ error: "Не удалось сохранить шаблон" }, { status: 500 });
  }
}
