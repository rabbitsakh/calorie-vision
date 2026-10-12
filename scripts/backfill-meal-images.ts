import { backfillMealImagesAndCompress } from "../src/lib/backfill-meal-images.ts";

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

async function main() {
  const limit = envInt("BACKFILL_LIMIT");
  const skipRecompress = envFlag("BACKFILL_SKIP_RECOMPRESS");
  const newestFirst = envFlag("BACKFILL_NEWEST_FIRST") || limit !== undefined;

  const result = await backfillMealImagesAndCompress({
    ...(limit !== undefined ? { limit } : {}),
    skipRecompress,
    newestFirst,
  });

  console.info(
    `Meal images: scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} recompressed=${result.recompressed}` +
      (limit !== undefined ? ` limit=${limit}` : "") +
      (skipRecompress ? " skipRecompress" : ""),
  );
  if (result.failedDishNames.length > 0) {
    console.info(`Failed dishes: ${result.failedDishNames.join(" · ")}`);
  }
}

main().catch((error: unknown) => {
  console.error("Meal image backfill failed", error);
  process.exitCode = 1;
});
