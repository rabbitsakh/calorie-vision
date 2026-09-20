import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROGRESS_RATE, parseProgressRate } from "@/lib/workouts/load";
import {
  serializeSessionDetail,
  serializeSessionSummary,
  sessionInclude,
} from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Clone exercises (+ optional sets) from this session into a new session on a date.
 * Body: { date, copySets?: boolean, progressRate? }
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id: sourceId } = await context.params;
    const source = await prisma.workoutSession.findFirst({
      where: { id: sourceId, userId: session.user.id },
      include: sessionInclude,
    });
    if (!source) {
      return NextResponse.json({ error: "Исходная тренировка не найдена" }, { status: 404 });
    }

    const body = (await request.json()) as {
      date?: string;
      copySets?: boolean;
      progressRate?: unknown;
    };
    const date = requireDateKey(body.date ?? null);
    if (!date) {
      return NextResponse.json({ error: "Укажите дату" }, { status: 400 });
    }
    const copySets = body.copySets !== false;
    const progressRate = parseProgressRate(body.progressRate ?? source.progressRate ?? DEFAULT_PROGRESS_RATE);
    const muscleKeys = source.muscles.map((m) => m.groupKey);
    if (muscleKeys.length === 0) {
      return NextResponse.json({ error: "У исходной тренировки нет групп мышц" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.workoutSession.create({
        data: {
          userId: session.user.id,
          date,
          progressRate,
          note: source.note,
          muscles: {
            create: muscleKeys.map((groupKey) => ({ groupKey })),
          },
        },
      });

      const exercises = [...source.exercises].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );
      for (const [i, ex] of exercises.entries()) {
        const createdEx = await tx.workoutExercise.create({
          data: {
            sessionId: row.id,
            name: ex.name,
            kind: ex.kind ?? "strength",
            muscleGroup: ex.muscleGroup,
            note: ex.note,
            sortOrder: i,
          },
        });
        if (copySets) {
          const sets = [...ex.sets].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
          );
          if (sets.length > 0) {
            await tx.workoutSet.createMany({
              data: sets.map((s, j) => ({
                exerciseId: createdEx.id,
                weightKg: s.weightKg,
                reps: s.reps,
                distanceKm: s.distanceKm,
                durationSec: s.durationSec,
                setType: s.setType ?? "working",
                completed: s.completed !== false,
                rpe: s.rpe,
                sortOrder: j,
              })),
            });
          }
        }
      }

      return tx.workoutSession.findFirstOrThrow({
        where: { id: row.id },
        include: sessionInclude,
      });
    });

    return NextResponse.json(
      {
        session: serializeSessionDetail(created),
        source: serializeSessionSummary(source),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/workouts/[id]/repeat", error);
    return NextResponse.json({ error: "Не удалось повторить тренировку" }, { status: 500 });
  }
}
