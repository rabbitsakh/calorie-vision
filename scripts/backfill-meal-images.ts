import { backfillMealImages } from "../src/lib/backfill-meal-images.ts";

function envInt(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function envFlag(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Lookup-only backfill (no /uploads recompress).
 * Optional: BACKFILL_LIMIT=25 BACKFILL_NEWEST_FIRST=1
 */
async function main() {
  const limit = envInt("BACKFILL_LIMIT");
  const newestFirst = envFlag("BACKFILL_NEWEST_FIRST") || limit !== undefined;

  const result = await backfillMealImages({
    ...(limit !== undefined ? { limit } : {}),
    newestFirst,
  });

  console.info(
    `Meal images: scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} repaired=${result.repaired}` +
      (limit !== undefined ? ` limit=${limit}` : ""),
  );
  if (result.failedDishNames.length > 0) {
    console.info(`Failed dishes: ${result.failedDishNames.join(" · ")}`);
  }
}

main().catch((error: unknown) => {
  console.error("Meal image backfill failed", error);
  process.exitCode = 1;
});
