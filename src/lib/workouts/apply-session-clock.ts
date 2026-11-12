import type { Prisma, PrismaClient } from "@prisma/client";
import {
  planAutoClock,
  planClockOnLoggedSet,
  planUndoAutoClose,
  AUTO_CLOSE_UNDO_MS,
} from "@/lib/workouts/session-autoclose";

type Db = PrismaClient | Prisma.TransactionClient;

function setTimesOf(
  exercises: Array<{ sets: Array<{ createdAt: Date; completed: boolean }> }>,
): Date[] {
  const times: Date[] = [];
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.completed === false) continue;
      times.push(set.createdAt);
    }
  }
  return times;
}

/**
 * Проставляет начало с первого подхода.
 * Не завершает тренировку. Свежее автозакрытие (endedBy = auto) снова открывает.
 */
export async function sweepIdleSessions(db: Db, userId: string, now = new Date()): Promise<number> {
  let changed = 0;
  const accidental = await db.workoutSession.findMany({
    where: {
      userId,
      endedBy: "auto",
      endedAt: { gte: new Date(now.getTime() - AUTO_CLOSE_UNDO_MS) },
    },
    select: { id: true, endedAt: true, endedBy: true },
  });
  for (const row of accidental) {
    const patch = planUndoAutoClose({
      endedAt: row.endedAt,
      endedBy: row.endedBy,
      now,
    });
    if (!patch) continue;
    await db.workoutSession.update({ where: { id: row.id }, data: patch });
    changed += 1;
  }

  const open = await db.workoutSession.findMany({
    where: { userId, endedAt: null },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      endedBy: true,
      exercises: { select: { sets: { select: { createdAt: true, completed: true } } } },
    },
  });
  for (const row of open) {
    const patch = planAutoClock({
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      endedBy: row.endedBy,
      setTimes: setTimesOf(row.exercises),
      now,
    });
    if (!patch) continue;
    await db.workoutSession.update({ where: { id: row.id }, data: patch });
    changed += 1;
  }
  return changed;
}

/** Первый подход запускает часы. Автозакрытую тренировку подход снова открывает. */
export async function noteLoggedSet(db: Db, sessionId: string, at = new Date()): Promise<void> {
  const row = await db.workoutSession.findUnique({
    where: { id: sessionId },
    select: { startedAt: true, endedAt: true, endedBy: true },
  });
  if (!row) return;
  const patch = planClockOnLoggedSet(row, at);
  if (!patch) return;
  await db.workoutSession.update({ where: { id: sessionId }, data: patch });
}
