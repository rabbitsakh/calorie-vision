/**
 * Починка явно сломанной длительности старых тренировок по времени подходов.
 * На проде сам не запускать: сначала сухой прогон и просмотр отчёта.
 *
 * Сухой прогон (по умолчанию):
 *   npx tsx scripts/repair-workout-durations.ts
 *   npx tsx scripts/repair-workout-durations.ts --out /tmp/duration-repair.json
 *
 * Применить:
 *   npx tsx scripts/repair-workout-durations.ts --apply --out /tmp/duration-repair.json
 *
 * Откат:
 *   npx tsx scripts/repair-workout-durations.ts --rollback /tmp/duration-repair.json
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { decideDurationRepair } from "../src/lib/workouts/duration-repair.ts";

type RollbackRow = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  pausedAt: string | null;
};

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] ?? null;
}

async function rollback(path: string): Promise<void> {
  const raw = await import("node:fs").then((fs) => fs.readFileSync(path, "utf8"));
  const report = JSON.parse(raw) as { rollback?: RollbackRow[] };
  const rows = report.rollback ?? [];
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      await tx.workoutSession.update({
        where: { id: row.id },
        data: {
          startedAt: row.startedAt ? new Date(row.startedAt) : null,
          endedAt: row.endedAt ? new Date(row.endedAt) : null,
          endedBy: row.endedBy,
          pausedAt: row.pausedAt ? new Date(row.pausedAt) : null,
        },
      });
    }
  });
  console.info(`Откат длительности: ${rows.length}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const rollbackPath = argValue(argv, "--rollback");
  if (rollbackPath) {
    await rollback(rollbackPath);
    return;
  }
  const apply = argv.includes("--apply");
  const outPath = argValue(argv, "--out");
  const now = new Date();

  const sessions = await prisma.workoutSession.findMany({
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      endedBy: true,
      pausedAt: true,
      exercises: { select: { sets: { select: { createdAt: true, completed: true } } } },
    },
  });

  const fixes: Array<{ id: string; startedAt: Date; endedAt: Date; reason: string }> = [];
  const uncertain: Array<{ id: string; reason: string }> = [];
  const rollbackRows: RollbackRow[] = [];
  let skipped = 0;

  for (const session of sessions) {
    const setTimes = session.exercises.flatMap((exercise) =>
      exercise.sets.filter((set) => set.completed !== false).map((set) => set.createdAt),
    );
    const decision = decideDurationRepair(
      {
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        endedBy: session.endedBy,
        setTimes,
      },
      now,
    );
    if (decision.action === "fix") {
      fixes.push({
        id: session.id,
        startedAt: decision.startedAt,
        endedAt: decision.endedAt,
        reason: decision.reason,
      });
      rollbackRows.push({
        id: session.id,
        startedAt: session.startedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
        endedBy: session.endedBy,
        pausedAt: session.pausedAt?.toISOString() ?? null,
      });
    } else if (decision.action === "uncertain") {
      uncertain.push({ id: session.id, reason: decision.reason });
    } else {
      skipped += 1;
    }
  }

  console.info(
    [
      apply ? "Применение" : "Сухой прогон",
      `исправить: ${fixes.length}`,
      `сомнительных (не трогаем): ${uncertain.length}`,
      `без изменений: ${skipped}`,
    ].join("\n"),
  );
  for (const row of fixes.slice(0, 30)) {
    console.info(
      `  ${row.id}: ${row.reason} → ${row.startedAt.toISOString()} … ${row.endedAt.toISOString()}`,
    );
  }
  for (const row of uncertain.slice(0, 20)) {
    console.info(`  ? ${row.id}: ${row.reason}`);
  }

  if (apply && fixes.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of fixes) {
        await tx.workoutSession.update({
          where: { id: row.id },
          data: {
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            endedBy: "auto",
            pausedAt: null,
          },
        });
      }
    });
    console.info("Длительности записаны. Сохраните отчёт для отката.");
  } else if (!apply) {
    console.info("База не изменялась.");
  }

  if (outPath) {
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          version: 1,
          mode: apply ? "apply" : "dry-run",
          fixes: fixes.map((row) => ({
            ...row,
            startedAt: row.startedAt.toISOString(),
            endedAt: row.endedAt.toISOString(),
          })),
          uncertain,
          rollback: rollbackRows,
        },
        null,
        2,
      ),
    );
    console.info(`Отчёт: ${outPath}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
