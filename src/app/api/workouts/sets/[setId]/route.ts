import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { serializeSessionDetail, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ setId: string }> };

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

async function ownedSet(userId: string, setId: string) {
  return prisma.workoutSet.findFirst({
    where: { id: setId, exercise: { session: { userId } } },
    select: { id: true, exercise: { select: { sessionId: true } } },
  });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { setId } = await context.params;
    const owned = await ownedSet(session.user.id, setId);
    if (!owned) {
      return NextResponse.json({ error: "Подход не найден" }, { status: 404 });
    }

    const body = (await request.json()) as { weightKg?: unknown; reps?: unknown };
    const data: { weightKg?: number; reps?: number } = {};
    if (body.weightKg !== undefined) {
      const weightKg = parsePositiveNumber(body.weightKg, "weight");
      if (weightKg === null) {
        return NextResponse.json({ error: "Некорректный вес" }, { status: 400 });
      }
      data.weightKg = weightKg;
    }
    if (body.reps !== undefined) {
      const reps = parsePositiveNumber(body.reps, "reps");
      if (reps === null || reps === 0) {
        return NextResponse.json({ error: "Некорректные повторения" }, { status: 400 });
      }
      data.reps = Math.floor(reps);
    }

    await prisma.workoutSet.update({ where: { id: setId }, data });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.exercise.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("PATCH /api/workouts/sets/[setId]", error);
    return NextResponse.json({ error: "Не удалось сохранить подход" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { setId } = await context.params;
    const owned = await ownedSet(session.user.id, setId);
    if (!owned) {
      return NextResponse.json({ error: "Подход не найден" }, { status: 404 });
    }

    await prisma.workoutSet.delete({ where: { id: setId } });

    const row = await prisma.workoutSession.findFirstOrThrow({
      where: { id: owned.exercise.sessionId },
      include: sessionInclude,
    });
    return NextResponse.json({ session: serializeSessionDetail(row) });
  } catch (error) {
    console.error("DELETE /api/workouts/sets/[setId]", error);
    return NextResponse.json({ error: "Не удалось удалить подход" }, { status: 500 });
  }
}
