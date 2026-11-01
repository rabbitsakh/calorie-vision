import { NextRequest, NextResponse } from "next/server";
import { notFoundResourceResponse } from "@/lib/api-auth-guards";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildExerciseHistoryByNormName,
  historyForExerciseName,
} from "@/lib/workouts/history";
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
  const summaries = history.map(serializeSessionSummary);
  const prev = findPreviousSession(toProgressRows(summaries), detail.muscleKeys, {
    excludeSessionId: detail.id,
  });
  const progress = buildProgressSummary({
    targetGroups: detail.muscleKeys,
    currentLoad: detail.totalLoad,
    previous: prev,
    progressRate: detail.progressRate,
  });

  const byNorm = buildExerciseHistoryByNormName(history, { excludeSessionId: detail.id });
  const exercises = detail.exercises.map((ex) => {
    const last = historyForExerciseName(byNorm, ex.name);
    return {
      ...ex,
      lastTime: last
        ? {
            date: last.date,
            kind: last.kind,
            sets: last.sets,
          }
        : null,
    };
  });

  return {
    session: { ...detail, exercises },
    progress,
  };
}

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { id } = await context.params;
    const row = await loadOwnedSession(session.user.id, id);
    if (!row) {
      const miss = notFoundResourceResponse("Тренировка");
      return NextResponse.json({ error: miss.error }, { status: miss.status });
    }

    return NextResponse.json(await withProgress(session.user.id, serializeSessionDetail(row)));
  } catch (error) {
    console.error("GET /api/workouts/[id]", error);
    return NextResponse.json({ error: "Не удалось загрузить тренировку" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { id } = await context.params;
    const existing = await loadOwnedSession(session.user.id, id);
    if (!existing) {
      const miss = notFoundResourceResponse("Тренировка");
      return NextResponse.json({ error: miss.error }, { status: miss.status });
    }

    const body = (await request.json()) as {
      date?: string;
      note?: string | null;
      muscleGroups?: unknown;
      progressRate?: unknown;
      /** start | pause | resume | finish — live session clock */
      clock?: "start" | "pause" | "resume" | "finish";
      /** Manual wall-clock edit (ISO). Prefer over `clock` when both sent. */
      startedAt?: string | null;
      endedAt?: string | null;
      pausedMs?: number;
    };

    const data: {
      date?: string;
      note?: string | null;
      progressRate?: number;
      startedAt?: Date | null;
      endedAt?: Date | null;
      pausedAt?: Date | null;
      pausedMs?: number;
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

    const wantsTimeEdit =
      body.startedAt !== undefined || body.endedAt !== undefined;
    if (wantsTimeEdit) {
      const { normalizeSessionClockTimes } = await import("@/lib/workouts/session-clock");
      const nextStart =
        body.startedAt !== undefined ? body.startedAt : existing.startedAt?.toISOString() ?? null;
      const nextEnd =
        body.endedAt !== undefined ? body.endedAt : existing.endedAt?.toISOString() ?? null;
      const normalized = normalizeSessionClockTimes({
        startedAt: nextStart,
        endedAt: nextEnd,
        pausedMs:
          typeof body.pausedMs === "number" && Number.isFinite(body.pausedMs)
            ? body.pausedMs
            : 0,
      });
      if (!normalized.ok) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }
      Object.assign(data, normalized.data);
    } else if (body.clock === "start") {
      data.startedAt = existing.startedAt ?? new Date();
      data.endedAt = null;
      data.pausedAt = null;
      if (!existing.startedAt) data.pausedMs = 0;
    } else if (body.clock === "pause") {
      if (!existing.startedAt || existing.endedAt) {
        return NextResponse.json({ error: "Нельзя поставить на паузу" }, { status: 400 });
      }
      if (!existing.pausedAt) {
        const { applyPause } = await import("@/lib/workouts/session-clock");
        const p = applyPause({
          startedAt: existing.startedAt,
          endedAt: existing.endedAt,
          pausedAt: existing.pausedAt,
          pausedMs: existing.pausedMs,
        });
        data.pausedAt = p.pausedAt;
        data.pausedMs = p.pausedMs;
      }
    } else if (body.clock === "resume") {
      if (!existing.startedAt || existing.endedAt || !existing.pausedAt) {
        return NextResponse.json({ error: "Нельзя продолжить" }, { status: 400 });
      }
      const { applyResume } = await import("@/lib/workouts/session-clock");
      const r = applyResume({
        startedAt: existing.startedAt,
        endedAt: existing.endedAt,
        pausedAt: existing.pausedAt,
        pausedMs: existing.pausedMs,
      });
      data.pausedAt = r.pausedAt;
      data.pausedMs = r.pausedMs;
    } else if (body.clock === "finish") {
      if (!existing.startedAt) {
        data.startedAt = new Date();
      }
      if (existing.pausedAt) {
        const { applyResume } = await import("@/lib/workouts/session-clock");
        const r = applyResume({
          startedAt: existing.startedAt ?? new Date(),
          endedAt: null,
          pausedAt: existing.pausedAt,
          pausedMs: existing.pausedMs,
        });
        data.pausedAt = null;
        data.pausedMs = r.pausedMs;
      }
      data.endedAt = new Date();
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
    const { session, response } = await requireSession();
    if (response) return response;

    const { id } = await context.params;
    const existing = await prisma.workoutSession.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      const miss = notFoundResourceResponse("Тренировка");
      return NextResponse.json({ error: miss.error }, { status: miss.status });
    }

    await prisma.workoutSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/workouts/[id]", error);
    return NextResponse.json({ error: "Не удалось удалить тренировку" }, { status: 500 });
  }
}
