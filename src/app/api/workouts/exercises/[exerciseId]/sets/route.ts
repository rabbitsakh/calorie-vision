import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ exerciseId: string }> };

function parsePositiveNumber(raw: unknown, label: string): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  if (label === "reps" && (!Number.isInteger(n) || n > 500)) {
    return null;
  }
  if (label === "weight" && n > 1000) {
    return null;
  }
  return n;
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { exerciseId } = await context.params;
    const owned = await prisma.workoutExercise.findFirst({
      where: { id: exerciseId, session: { userId: session.user.id } },
      select: { id: true, sessionId: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Упражнение не найдено" }, { status: 404 });
    }

    const body = (await request.json()) as { weightKg?: unknown; reps?: unknown };
    const weightKg = parsePositiveNumber(body.weightKg, "weight");
    const reps = parsePositiveNumber(body.reps, "reps");
    if (weightKg === null || reps === null || reps === 0) {
      return NextResponse.json({ error: "Укажите кг и число повторений" }, { status: 400 });
    }

    const maxOrder = await prisma.workoutSet.aggregate({
      where: { exerciseId },
      _max: { sortOrder: true },
    });

    await prisma.workoutSet.create({
      data: {
        exerciseId,
        weightKg,
        reps: Math.floor(reps),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/exercises/[exerciseId]/sets", error);
    return NextResponse.json({ error: "Не удалось добавить подход" }, { status: 500 });
  }
}
