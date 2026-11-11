import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { parseSetCreateForKind } from "@/lib/workouts/set-fields";
import { isSetType, parseRpe, parseSetType } from "@/lib/workouts/set-meta";
import { noteLoggedSet } from "@/lib/workouts/apply-session-clock";
import { assignSortOrders, clampSetIndex } from "@/lib/workouts/set-order";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";
import { grantGymChestForDate } from "@/lib/gym-reward-grant";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ exerciseId: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireSession();
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
      setType?: unknown;
      completed?: unknown;
      rpe?: unknown;
      /** Вернуть удалённый подход на прежний индекс. Не запускает часы заново. */
      insertAt?: unknown;
      restore?: unknown;
    };

    const setType = parseSetType(body.setType);
    const completed = body.completed === false ? false : true;
    const rpe = parseRpe(body.rpe);
    if (body.rpe !== undefined && rpe === null && body.rpe !== null && body.rpe !== "") {
      return NextResponse.json({ error: "RPE от 1 до 10" }, { status: 400 });
    }
    if (body.setType !== undefined && !isSetType(body.setType) && body.setType !== "") {
      return NextResponse.json({ error: "Тип подхода: warmup/working/drop/failure" }, { status: 400 });
    }

    const parsed = parseSetCreateForKind(kind, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const restore = body.restore === true;
    const insertAt =
      typeof body.insertAt === "number" && Number.isFinite(body.insertAt)
        ? Math.floor(body.insertAt)
        : null;

    const existing = await prisma.workoutSet.findMany({
      where: { exerciseId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, sortOrder: true },
    });
    const tail = (existing.at(-1)?.sortOrder ?? -1) + 1;

    await prisma.$transaction(async (tx) => {
      const created = await tx.workoutSet.create({
        data: {
          exerciseId,
          ...parsed.fields,
          setType,
          completed,
          rpe: rpe ?? null,
          sortOrder: tail,
        },
      });
      if (insertAt == null) return;
      const index = clampSetIndex(existing.length, insertAt);
      const ids = existing.map((row) => row.id);
      ids.splice(index, 0, created.id);
      const next = assignSortOrders(ids.map((id) => ({ id })));
      for (const row of next) {
        await tx.workoutSet.update({
          where: { id: row.id },
          data: { sortOrder: row.sortOrder },
        });
      }
    });
    if (completed && !restore) {
      await noteLoggedSet(prisma, owned.sessionId);
    }

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.sessionId },
      include: sessionInclude,
    });
    if (row.endedAt) await grantGymChestForDate(session.user.id, row.date);
    return NextResponse.json({ session: serializeSessionDetail(row) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/exercises/[exerciseId]/sets", error);
    return NextResponse.json({ error: "Не удалось добавить подход" }, { status: 500 });
  }
}
