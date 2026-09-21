import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { isExerciseKind, parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { isBlockMode, parseBlockMode, parseCircuitRounds } from "@/lib/workouts/block-mode";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { parseOptionalNote } from "@/lib/workouts/set-meta";
import { nextSupersetLetter, parseSupersetGroup } from "@/lib/workouts/supersets";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ exerciseId: string }> };

async function ownedExercise(userId: string, exerciseId: string) {
  return prisma.workoutExercise.findFirst({
    where: { id: exerciseId, session: { userId } },
    select: { id: true, sessionId: true, sortOrder: true },
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
      note?: unknown;
      /** "up" | "down" — swap sortOrder with neighbor */
      move?: "up" | "down";
      /** Superset/circuit letter A–Z, or null to clear */
      supersetGroup?: unknown;
      /** Link this exercise with another into a new/shared superset */
      linkSupersetWith?: string;
      blockMode?: unknown;
      circuitRounds?: unknown;
    };

    if (body.move === "up" || body.move === "down") {
      const siblings = await prisma.workoutExercise.findMany({
        where: { sessionId: owned.sessionId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, sortOrder: true },
      });
      const idx = siblings.findIndex((s) => s.id === exerciseId);
      if (idx < 0) {
        return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
      }
      const swapWith = body.move === "up" ? siblings[idx - 1] : siblings[idx + 1];
      if (swapWith) {
        await prisma.$transaction([
          prisma.workoutExercise.update({
            where: { id: exerciseId },
            data: { sortOrder: swapWith.sortOrder },
          }),
          prisma.workoutExercise.update({
            where: { id: swapWith.id },
            data: { sortOrder: owned.sortOrder },
          }),
        ]);
      }
      const row = await prisma.workoutSession.findFirstOrThrow({
        where: { id: owned.sessionId },
        include: sessionInclude,
      });
      return NextResponse.json({ session: serializeSessionDetail(row) });
    }

    const data: {
      name?: string;
      muscleGroup?: string | null;
      kind?: string;
      note?: string | null;
      supersetGroup?: string | null;
      blockMode?: string;
      circuitRounds?: number | null;
    } = {};
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
        return NextResponse.json(
          { error: "Тип: strength / cardio / bodyweight / duration / weighted_bw / assisted" },
          { status: 400 },
        );
      }
      data.kind = parseExerciseKind(body.kind);
    }
    if (body.note !== undefined) {
      const note = parseOptionalNote(body.note);
      if (note === undefined) {
        return NextResponse.json({ error: "Некорректная заметка" }, { status: 400 });
      }
      data.note = note;
    }
    if (body.supersetGroup !== undefined) {
      const sg = parseSupersetGroup(body.supersetGroup);
      if (sg === undefined) {
        return NextResponse.json({ error: "Некорректный суперсет" }, { status: 400 });
      }
      data.supersetGroup = sg;
    }
    if (body.blockMode !== undefined) {
      if (!isBlockMode(body.blockMode) && body.blockMode !== null) {
        return NextResponse.json(
          { error: "Режим: normal / circuit / rest_pause" },
          { status: 400 },
        );
      }
      data.blockMode = parseBlockMode(body.blockMode);
      if (data.blockMode !== "circuit") data.circuitRounds = null;
    }
    if (body.circuitRounds !== undefined) {
      data.circuitRounds =
        body.circuitRounds == null || body.circuitRounds === ""
          ? null
          : parseCircuitRounds(body.circuitRounds);
    }

    if (typeof body.linkSupersetWith === "string" && body.linkSupersetWith.trim()) {
      const otherId = body.linkSupersetWith.trim();
      const siblings = await prisma.workoutExercise.findMany({
        where: { sessionId: owned.sessionId },
        select: { id: true, supersetGroup: true },
      });
      const other = siblings.find((s) => s.id === otherId);
      if (!other) {
        return NextResponse.json({ error: "Второе упражнение не найдено" }, { status: 404 });
      }
      const letter =
        other.supersetGroup?.trim() ||
        siblings.find((s) => s.id === exerciseId)?.supersetGroup?.trim() ||
        nextSupersetLetter(siblings.map((s) => s.supersetGroup));
      await prisma.$transaction([
        prisma.workoutExercise.update({
          where: { id: exerciseId },
          data: { supersetGroup: letter },
        }),
        prisma.workoutExercise.update({
          where: { id: otherId },
          data: { supersetGroup: letter },
        }),
      ]);
    } else if (Object.keys(data).length > 0) {
      await prisma.workoutExercise.update({ where: { id: exerciseId }, data });
    }

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
