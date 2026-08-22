/**
 * USDA FoodData Central search — fallback when Open Food Facts misses.
 * https://fdc.nal.usda.gov/api-guide.html
 */

export type UsdaPackNutrition = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams: number;
  source: "usda-fdc";
};

const FDC_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  value: UsdaPackNutrition | null;
  expiresAt: number;
};

const searchCache = new Map<string, CacheEntry>();

const NUTRIENT = {
  ENERGY: 1008,
  PROTEIN: 1003,
  FAT: 1004,
  CARBS: 1005,
  FIBER: 1079,
  SUGAR: 2000,
} as const;

function fdcApiKey(): string | null {
  const key = process.env.USDA_FDC_API_KEY?.trim() || process.env.FDC_API_KEY?.trim();
  return key || null;
}

function nutrientValue(
  nutrients: Array<{ nutrientId?: number; value?: number }> | undefined,
  id: number,
): number | undefined {
  const hit = nutrients?.find((entry) => entry.nutrientId === id);
  if (hit?.value === undefined || !Number.isFinite(hit.value)) {
    return undefined;
  }
  return hit.value;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function resetUsdaSearchCacheForTests(): void {
  searchCache.clear();
}

/** Search FDC for a typical 100 g portion (scaled to portionGrams). */
export async function searchUsdaFoodDataCentral(
  query: string,
  portionGrams = 100,
): Promise<UsdaPackNutrition | null> {
  const apiKey = fdcApiKey();
  if (!apiKey) {
    return null;
  }

  const normalized = normalizeQuery(query);
  if (!normalized) {
    return null;
  }

  const cached = searchCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const url = new URL(FDC_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query.trim());
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      searchCache.set(normalized, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const data = (await response.json()) as {
      foods?: Array<{
        description?: string;
        foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
        servingSize?: number;
        servingSizeUnit?: string;
      }>;
    };

    const food = data.foods?.find(
      (entry) => nutrientValue(entry.foodNutrients, NUTRIENT.ENERGY) !== undefined,
    );
    if (!food) {
      searchCache.set(normalized, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const per100Calories = nutrientValue(food.foodNutrients, NUTRIENT.ENERGY) ?? 0;
    if (per100Calories <= 0) {
      searchCache.set(normalized, { value: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const scale = portionGrams / 100;
    const scaleOpt = (value: number | undefined) =>
      value !== undefined ? Math.round(value * scale * 10) / 10 : undefined;

    const result: UsdaPackNutrition = {
      dishName: food.description?.trim() || query.trim(),
      calories: Math.round(per100Calories * scale),
      protein: scaleOpt(nutrientValue(food.foodNutrients, NUTRIENT.PROTEIN)),
      fat: scaleOpt(nutrientValue(food.foodNutrients, NUTRIENT.FAT)),
      carbs: scaleOpt(nutrientValue(food.foodNutrients, NUTRIENT.CARBS)),
      fiber: scaleOpt(nutrientValue(food.foodNutrients, NUTRIENT.FIBER)),
      sugar: scaleOpt(nutrientValue(food.foodNutrients, NUTRIENT.SUGAR)),
      portionGrams,
      source: "usda-fdc",
    };

    searchCache.set(normalized, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.warn("USDA FDC search failed", error);
    searchCache.set(normalized, { value: null, expiresAt: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}
