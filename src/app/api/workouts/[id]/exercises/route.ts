import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  defaultExerciseKind,
  parseExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id: sessionId } = await context.params;
    const owned = await prisma.workoutSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      include: { muscles: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Тренировка не найдена" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      muscleGroup?: string | null;
      kind?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) {
      return NextResponse.json({ error: "Укажите название упражнения" }, { status: 400 });
    }

    let muscleGroup: string | null = null;
    if (body.muscleGroup != null && String(body.muscleGroup).trim()) {
      const key = String(body.muscleGroup).trim();
      if (!isMuscleGroupKey(key)) {
        return NextResponse.json({ error: "Некорректная группа мышц" }, { status: 400 });
      }
      muscleGroup = key;
    }

    const fallbackKind = defaultExerciseKind(owned.muscles.map((m) => m.groupKey));
    const kind =
      body.kind !== undefined
        ? parseExerciseKind(body.kind, fallbackKind)
        : muscleGroup === "cardio"
          ? "cardio"
          : fallbackKind;

    const maxOrder = await prisma.workoutExercise.aggregate({
      where: { sessionId },
      _max: { sortOrder: true },
    });

    await prisma.workoutExercise.create({
      data: {
        sessionId,
        name,
        kind,
        muscleGroup,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: sessionId },
      include: sessionInclude,
    });

    return NextResponse.json({ session: serializeSessionDetail(row) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/[id]/exercises", error);
    return NextResponse.json({ error: "Не удалось добавить упражнение" }, { status: 500 });
  }
}
