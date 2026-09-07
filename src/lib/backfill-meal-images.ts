import { dishImageLookupQueries, mealNeedsImage, normalizeDishName, shouldSkipDishName } from "./meal-image";
import { searchOpenFoodFactsBest } from "./open-food-facts";
import { prisma } from "./prisma";
import { cacheRemoteImage, recompressStoredImages } from "./upload";

export type BackfillMealImagesOptions = {
  userId?: string;
  date?: string;
  limit?: number;
};

export type BackfillMealImagesResult = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Cleared or replaced wrong Wikipedia portraits on text/barcode rows. */
  repaired: number;
};

/** Sources that auto-attached product art (wiki fallback used to invent portraits). */
const LOOKUP_IMAGE_SOURCES = new Set([
  "gigachat-lookup",
  "gigachat-barcode",
  "openfoodfacts-search",
  "openfoodfacts-barcode",
  "ru-sku-cache",
  "ru-nutrition-table",
]);

async function lookupOffImageOnly(dishName: string): Promise<string | undefined> {
  const queries = dishImageLookupQueries(dishName, 5);
  if (queries.length === 0) {
    return undefined;
  }

  const off = await searchOpenFoodFactsBest(queries);
  if (off?.imageUrl) {
    const cached = await cacheRemoteImage(off.imageUrl);
    if (cached) {
      return cached;
    }
  }

  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Replace or clear auto-attached photos on text/barcode meals.
 * Prefer OFF packaging art; otherwise leave empty rather than a Wikipedia portrait.
 */
async function repairLookupMealImages(
  options: BackfillMealImagesOptions,
): Promise<number> {
  if (!options.userId) {
    return 0;
  }

  const meals = await prisma.mealEntry.findMany({
    where: {
      userId: options.userId,
      ...(options.date ? { date: options.date } : {}),
      imagePath: { not: null },
      recognitionSource: { in: [...LOOKUP_IMAGE_SOURCES] },
    },
    select: {
      id: true,
      dishName: true,
      imagePath: true,
      recognitionSource: true,
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 25,
  });

  let repaired = 0;
  for (const meal of meals) {
    if (shouldSkipDishName(meal.dishName)) {
      continue;
    }
    try {
      const offPath = await lookupOffImageOnly(meal.dishName);
      if (offPath && offPath !== meal.imagePath) {
        await prisma.mealEntry.update({
          where: { id: meal.id },
          data: { imagePath: offPath },
        });
        repaired += 1;
      } else if (!offPath) {
        await prisma.mealEntry.update({
          where: { id: meal.id },
          data: { imagePath: null },
        });
        repaired += 1;
      }
    } catch (error) {
      console.error("Failed to repair meal image", meal.dishName, error);
    }
    await delay(120);
  }

  return repaired;
}

export async function backfillMealImages(
  options: BackfillMealImagesOptions = {},
): Promise<BackfillMealImagesResult> {
  const result: BackfillMealImagesResult = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    repaired: 0,
  };

  result.repaired = await repairLookupMealImages(options);

  const meals = await prisma.mealEntry.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.date ? { date: options.date } : {}),
    },
    select: {
      id: true,
      dishName: true,
      imagePath: true,
    },
    orderBy: { createdAt: "asc" },
  });

  result.scanned = meals.length;

  const missing = meals.filter((meal: { id: string; dishName: string; imagePath: string | null }) =>
    mealNeedsImage(meal.imagePath),
  );
  if (missing.length === 0) {
    return result;
  }

  const knownImages = new Map<string, string>();
  for (const meal of meals) {
    if (!meal.imagePath || mealNeedsImage(meal.imagePath) || shouldSkipDishName(meal.dishName)) {
      continue;
    }

    const key = normalizeDishName(meal.dishName);
    if (key && !knownImages.has(key)) {
      knownImages.set(key, meal.imagePath);
    }
  }

  const pendingByName = new Map<string, string[]>();
  for (const meal of missing) {
    if (shouldSkipDishName(meal.dishName)) {
      result.skipped += 1;
      continue;
    }

    const key = normalizeDishName(meal.dishName);
    const existing = knownImages.get(key);
    if (existing) {
      await prisma.mealEntry.update({
        where: { id: meal.id },
        data: { imagePath: existing },
      });
      result.updated += 1;
      continue;
    }

    const bucket = pendingByName.get(key) ?? [];
    bucket.push(meal.id);
    pendingByName.set(key, bucket);
  }

  let lookups = 0;
  for (const [key, ids] of pendingByName) {
    if (options.limit !== undefined && lookups >= options.limit) {
      result.skipped += ids.length;
      continue;
    }

    const sample = missing.find(
      (meal: { id: string; dishName: string; imagePath: string | null }) =>
        normalizeDishName(meal.dishName) === key,
    );
    const dishName = sample?.dishName ?? key;

    try {
      const imagePath = await lookupOffImageOnly(dishName);
      lookups += 1;

      if (!imagePath) {
        result.failed += ids.length;
        continue;
      }

      knownImages.set(key, imagePath);
      await prisma.mealEntry.updateMany({
        where: { id: { in: ids } },
        data: { imagePath },
      });
      result.updated += ids.length;
    } catch (error) {
      console.error("Failed to backfill meal image", dishName, error);
      result.failed += ids.length;
    }

    await delay(200);
  }

  return result;
}

export async function backfillMealImagesAndCompress(
  options: BackfillMealImagesOptions = {},
): Promise<BackfillMealImagesResult & { recompressed: number }> {
  const recompressed = await recompressStoredImages();
  const filled = await backfillMealImages(options);
  return { ...filled, recompressed };
}
