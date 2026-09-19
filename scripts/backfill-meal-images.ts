import { backfillMealImagesAndCompress } from "../src/lib/backfill-meal-images.ts";

async function main() {
  const result = await backfillMealImagesAndCompress({});
  console.info(
    `Meal images: scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} recompressed=${result.recompressed}`,
  );
  if (result.failedDishNames.length > 0) {
    console.info(`Failed dishes: ${result.failedDishNames.join(" · ")}`);
  }
}

main().catch((error: unknown) => {
  console.error("Meal image backfill failed", error);
  process.exitCode = 1;
});
