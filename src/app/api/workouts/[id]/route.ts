import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildProgressSummary,
  findPreviousSession,
  parseProgressRate,
  type SessionLikeForProgress,
} from "@/lib/workouts/load";
import { parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import {
  serializeSessionDetail,
  serializeSessionSummary,
  sessionInclude,
} from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function toProgressRows(
  sessions: Array<ReturnType<typeof serializeSessionSummary>>,
): SessionLikeForProgress[] {
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    createdAt: s.createdAt,
    muscleKeys: s.muscleKeys,
    totalLoad: s.totalLoad,
    loadByGroup: s.loadByGroup,
  }));
}

async function loadOwnedSession(userId: string, id: string) {
  return prisma.workoutSession.findFirst({
    where: { id, userId },
    include: sessionInclude,
  });
}

async function withProgress(userId: string, detail: ReturnType<typeof serializeSessionDetail>) {
  const history = await prisma.workoutSession.findMany({
    where: { userId },
    include: sessionInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  const prev = findPreviousSession(toProgressRows(history.map(serializeSessionSummary)), detail.muscleKeys, {
    excludeSessionId: detail.id,
  });
  const progress = buildProgressSummary({
    targetGroups: detail.muscleKeys,
    currentLoad: detail.totalLoad,
    previous: prev,
    progressRate: detail.progressRate,
  });
  return { session: detail, progress };
}

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const row = await loadOwnedSession(session.user.id, id);
    if (!row) {
      return NextResponse.json({ error: "Тренировка не найдена" }, { status: 404 });
    }

    return NextResponse.json(await withProgress(session.user.id, serializeSessionDetail(row)));
  } catch (error) {
    console.error("GET /api/workouts/[id]", error);
    return NextResponse.json({ error: "Не удалось загрузить тренировку" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await loadOwnedSession(session.user.id, id);
    if (!existing) {
      return NextResponse.json({ error: "Тренировка не найдена" }, { status: 404 });
    }

    const body = (await request.json()) as {
      date?: string;
      note?: string | null;
      muscleGroups?: unknown;
      progressRate?: unknown;
    };

    const data: {
      date?: string;
      note?: string | null;
      progressRate?: number;
    } = {};

    if (body.date !== undefined) {
      const date = requireDateKey(body.date);
      if (!date) {
        return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
      }
      data.date = date;
    }
    if (body.note !== undefined) {
      data.note =
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null;
    }
    if (body.progressRate !== undefined) {
      data.progressRate = parseProgressRate(body.progressRate);
    }

    const muscleGroups =
      body.muscleGroups !== undefined ? parseMuscleGroupKeys(body.muscleGroups) : undefined;
    if (body.muscleGroups !== undefined && !muscleGroups) {
      return NextResponse.json({ error: "Выберите хотя бы одну группу мышц" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (muscleGroups) {
        await tx.workoutSessionMuscle.deleteMany({ where: { sessionId: id } });
        await tx.workoutSessionMuscle.createMany({
          data: muscleGroups.map((groupKey) => ({ sessionId: id, groupKey })),
        });
      }
      return tx.workoutSession.update({
        where: { id },
        data,
        include: sessionInclude,
      });
    });

    return NextResponse.json(await withProgress(session.user.id, serializeSessionDetail(updated)));
  } catch (error) {
    console.error("PATCH /api/workouts/[id]", error);
    return NextResponse.json({ error: "Не удалось сохранить тренировку" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutSession.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Тренировка не найдена" }, { status: 404 });
    }

    await prisma.workoutSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workouts/[id]", error);
    return NextResponse.json({ error: "Не удалось удалить тренировку" }, { status: 500 });
  }
}
