/**
 * Привязка пользовательских упражнений к справочнику.
 * Уверенные совпадения переименовываются в каноническое название,
 * чтобы история, рекорды и 1RM склеились. Сомнительные не меняются.
 *
 * Сухой прогон (по умолчанию):
 *   npx tsx scripts/link-exercise-catalog.ts
 *   npx tsx scripts/link-exercise-catalog.ts --out /tmp/catalog-link-report.json
 *
 * Применить:
 *   npx tsx scripts/link-exercise-catalog.ts --apply --out /tmp/catalog-link-report.json
 *
 * Откат по отчёту, который записал --apply:
 *   npx tsx scripts/link-exercise-catalog.ts --rollback /tmp/catalog-link-report.json
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { catalogById } from "../src/lib/workouts/exercise-catalog.ts";
import { matchExerciseName } from "../src/lib/workouts/catalog-link.ts";
import { normalizeExerciseName } from "../src/lib/workouts/exercise-name.ts";

type LibraryRow = {
  id: string;
  userId: string;
  name: string;
  nameNorm: string;
  kind: string;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: Date;
  catalogId: string | null;
};

type Report = {
  version: 1;
  mode: "dry-run" | "apply";
  confident: number;
  uncertain: number;
  skipped: number;
  renamedExercises: number;
  renamedRoutines: number;
  mergedLibrary: number;
  uncertainSamples: Array<{ name: string; candidate: string; score: number; reason: string }>;
  rollback?: {
    exercises: Array<{ id: string; name: string; catalogId: string | null }>;
    routineExercises: Array<{ id: string; name: string }>;
    libraryUpdates: LibraryRow[];
    libraryDeleted: LibraryRow[];
  };
};

function argValue(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  return argv[index + 1] ?? null;
}

function serializeLibrary(row: LibraryRow): LibraryRow {
  return {
    ...row,
    lastUsedAt: new Date(row.lastUsedAt),
  };
}

async function rollback(path: string): Promise<void> {
  const raw = await import("node:fs").then((fs) => fs.readFileSync(path, "utf8"));
  const report = JSON.parse(raw) as Report;
  const data = report.rollback;
  if (!data) {
    throw new Error("В отчёте нет блока rollback — откатывать нечего");
  }
  await prisma.$transaction(async (tx) => {
    for (const row of data.libraryDeleted) {
      await tx.workoutExerciseLibrary.create({
        data: {
          id: row.id,
          userId: row.userId,
          name: row.name,
          nameNorm: row.nameNorm,
          kind: row.kind,
          defaultMuscleGroup: row.defaultMuscleGroup,
          useCount: row.useCount,
          lastUsedAt: new Date(row.lastUsedAt),
          catalogId: row.catalogId,
        },
      });
    }
    for (const row of data.libraryUpdates) {
      await tx.workoutExerciseLibrary.update({
        where: { id: row.id },
        data: {
          name: row.name,
          nameNorm: row.nameNorm,
          kind: row.kind,
          defaultMuscleGroup: row.defaultMuscleGroup,
          useCount: row.useCount,
          lastUsedAt: new Date(row.lastUsedAt),
          catalogId: row.catalogId,
        },
      });
    }
    for (const row of data.exercises) {
      await tx.workoutExercise.update({
        where: { id: row.id },
        data: { name: row.name, catalogId: row.catalogId },
      });
    }
    for (const row of data.routineExercises) {
      await tx.workoutRoutineExercise.update({
        where: { id: row.id },
        data: { name: row.name },
      });
    }
  });
  console.info(
    `Откат: упражнения ${data.exercises.length}, шаблоны ${data.routineExercises.length}, библиотека ${data.libraryUpdates.length}+${data.libraryDeleted.length}`,
  );
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

  const [library, exercises, routines] = await Promise.all([
    prisma.workoutExerciseLibrary.findMany(),
    prisma.workoutExercise.findMany({ select: { id: true, name: true, catalogId: true } }),
    prisma.workoutRoutineExercise.findMany({ select: { id: true, name: true } }),
  ]);

  const report: Report = {
    version: 1,
    mode: apply ? "apply" : "dry-run",
    confident: 0,
    uncertain: 0,
    skipped: 0,
    renamedExercises: 0,
    renamedRoutines: 0,
    mergedLibrary: 0,
    uncertainSamples: [],
    rollback: {
      exercises: [],
      routineExercises: [],
      libraryUpdates: [],
      libraryDeleted: [],
    },
  };

  const exercisePatches: Array<{ id: string; name: string; catalogId: string }> = [];
  for (const row of exercises) {
    const match = matchExerciseName(row.name);
    if (match.status === "uncertain") {
      report.uncertain += 1;
      if (report.uncertainSamples.length < 40) {
        report.uncertainSamples.push({
          name: row.name,
          candidate: match.name,
          score: match.score,
          reason: match.reason,
        });
      }
      continue;
    }
    if (match.status !== "confident") {
      report.skipped += 1;
      continue;
    }
    report.confident += 1;
    const canonical = catalogById(match.catalogId);
    if (!canonical) continue;
    if (normalizeExerciseName(row.name) === canonical.nameNorm && row.catalogId === canonical.id) {
      continue;
    }
    report.rollback?.exercises.push({ id: row.id, name: row.name, catalogId: row.catalogId });
    exercisePatches.push({ id: row.id, name: canonical.name, catalogId: canonical.id });
  }

  const routinePatches: Array<{ id: string; name: string }> = [];
  for (const row of routines) {
    const match = matchExerciseName(row.name);
    if (match.status !== "confident") continue;
    const canonical = catalogById(match.catalogId);
    if (!canonical || normalizeExerciseName(row.name) === canonical.nameNorm) continue;
    report.rollback?.routineExercises.push({ id: row.id, name: row.name });
    routinePatches.push({ id: row.id, name: canonical.name });
  }

  const byUser = new Map<string, LibraryRow[]>();
  for (const row of library) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  type LibraryPlan = {
    keeperId: string;
    data: {
      name: string;
      nameNorm: string;
      catalogId: string;
      useCount: number;
      lastUsedAt: Date;
      kind: string;
      defaultMuscleGroup: string | null;
    };
    deleteIds: string[];
    before: LibraryRow[];
  };
  const libraryPlans: LibraryPlan[] = [];

  for (const rows of byUser.values()) {
    const groups = new Map<string, LibraryRow[]>();
    for (const row of rows) {
      const match = matchExerciseName(row.name);
      if (match.status !== "confident") continue;
      const list = groups.get(match.catalogId) ?? [];
      list.push(row);
      groups.set(match.catalogId, list);
    }
    for (const [catalogId, group] of groups) {
      const canonical = catalogById(catalogId);
      if (!canonical) continue;
      const occupied = rows.find(
        (row) => row.nameNorm === canonical.nameNorm && !group.some((item) => item.id === row.id),
      );
      if (occupied) {
        report.uncertain += 1;
        if (report.uncertainSamples.length < 40) {
          report.uncertainSamples.push({
            name: group.map((row) => row.name).join(" / "),
            candidate: canonical.name,
            score: 1,
            reason: "каноническое имя уже занято другой записью библиотеки",
          });
        }
        continue;
      }
      const keeper = [...group].sort((a, b) => b.useCount - a.useCount || b.lastUsedAt.getTime() - a.lastUsedAt.getTime())[0]!;
      const useCount = group.reduce((sum, row) => sum + row.useCount, 0);
      const lastUsedAt = group.reduce(
        (max, row) => (row.lastUsedAt > max ? row.lastUsedAt : max),
        keeper.lastUsedAt,
      );
      libraryPlans.push({
        keeperId: keeper.id,
        data: {
          name: canonical.name,
          nameNorm: canonical.nameNorm,
          catalogId,
          useCount,
          lastUsedAt,
          kind: canonical.kind,
          defaultMuscleGroup: keeper.defaultMuscleGroup ?? canonical.primary[0] ?? null,
        },
        deleteIds: group.filter((row) => row.id !== keeper.id).map((row) => row.id),
        before: group.map(serializeLibrary),
      });
    }
  }

  report.renamedExercises = exercisePatches.length;
  report.renamedRoutines = routinePatches.length;
  report.mergedLibrary = libraryPlans.reduce((sum, plan) => sum + plan.deleteIds.length, 0);

  console.info(
    [
      apply ? "Применение" : "Сухой прогон",
      `уверенных названий: ${report.confident}`,
      `переименовать упражнения: ${report.renamedExercises}`,
      `переименовать в шаблонах: ${report.renamedRoutines}`,
      `слить строки библиотеки: ${report.mergedLibrary}`,
      `сомнительных: ${report.uncertain}`,
      `без совпадения: ${report.skipped}`,
    ].join("\n"),
  );
  if (report.uncertainSamples.length > 0) {
    console.info("Сомнительные (не трогаем):");
    for (const sample of report.uncertainSamples) {
      console.info(`  «${sample.name}» → «${sample.candidate}» (${sample.score}) — ${sample.reason}`);
    }
  }

  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const plan of libraryPlans) {
        const keeper = plan.before.find((row) => row.id === plan.keeperId);
        if (keeper) report.rollback?.libraryUpdates.push(keeper);
        for (const row of plan.before) {
          if (row.id !== plan.keeperId) report.rollback?.libraryDeleted.push(row);
        }
        await tx.workoutExerciseLibrary.update({ where: { id: plan.keeperId }, data: plan.data });
        if (plan.deleteIds.length > 0) {
          await tx.workoutExerciseLibrary.deleteMany({ where: { id: { in: plan.deleteIds } } });
        }
      }
      for (const patch of exercisePatches) {
        await tx.workoutExercise.update({
          where: { id: patch.id },
          data: { name: patch.name, catalogId: patch.catalogId },
        });
      }
      for (const patch of routinePatches) {
        await tx.workoutRoutineExercise.update({
          where: { id: patch.id },
          data: { name: patch.name },
        });
      }
    });
    console.info("Изменения записаны. Файл отчёта нужен для отката.");
  } else {
    console.info("База не изменялась. Для записи добавьте --apply и сохраните отчёт через --out.");
  }

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
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
