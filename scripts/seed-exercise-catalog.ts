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
import {
  EXERCISE_CATALOG,
  planCatalogUpsert,
  toCatalogSeedData,
} from "../src/lib/workouts/exercise-catalog.ts";

function wantsDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

async function main(): Promise<void> {
  const dry = wantsDryRun(process.argv.slice(2));
  const rows = EXERCISE_CATALOG.map(toCatalogSeedData);
  console.info(`Справочник: ${rows.length} упражнений`);
  if (dry) {
    console.info("Сухой прогон: база не изменялась. Запись идёт upsert по id: синонимы обновляются, новые позиции добавляются, старые id не удаляются.");
    return;
  }
  const existing = await prisma.exerciseCatalog.findMany({ select: { id: true } });
  const plan = planCatalogUpsert(
    existing.map((row) => row.id),
    rows,
  );
  console.info(
    `Уже в базе: ${existing.length}. Обновить: ${plan.updates.length}. Добавить: ${plan.inserts.length}. Оставить как есть: ${plan.kept.length}.`,
  );
  for (const row of rows) {
    const { id, ...data } = row;
    await prisma.exerciseCatalog.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
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
