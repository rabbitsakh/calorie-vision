/**
 * Сид общего справочника упражнений.
 *
 * Сухой прогон (ничего не пишет):
 *   npx tsx scripts/seed-exercise-catalog.ts --dry-run
 *
 * Запись (идемпотентный upsert, историю тренировок не трогает):
 *   npx tsx scripts/seed-exercise-catalog.ts
 */
import { prisma } from "../src/lib/prisma.ts";
import { EXERCISE_CATALOG } from "../src/lib/workouts/exercise-catalog.ts";

function wantsDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

async function main(): Promise<void> {
  const dry = wantsDryRun(process.argv.slice(2));
  console.info(`Справочник: ${EXERCISE_CATALOG.length} упражнений`);
  if (dry) {
    console.info("Сухой прогон: база не изменялась");
    return;
  }
  for (const row of EXERCISE_CATALOG) {
    await prisma.exerciseCatalog.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        nameNorm: row.nameNorm,
        tracking: row.tracking,
        kind: row.kind,
        primaryMuscles: row.primary,
        secondaryMuscles: row.secondary,
        equipment: row.equipment,
        synonyms: row.synonyms,
        defaultRestSec: row.defaultRestSec,
        sortOrder: row.sortOrder,
      },
      update: {
        name: row.name,
        nameNorm: row.nameNorm,
        tracking: row.tracking,
        kind: row.kind,
        primaryMuscles: row.primary,
        secondaryMuscles: row.secondary,
        equipment: row.equipment,
        synonyms: row.synonyms,
        defaultRestSec: row.defaultRestSec,
        sortOrder: row.sortOrder,
      },
    });
  }
  console.info("Справочник записан");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
