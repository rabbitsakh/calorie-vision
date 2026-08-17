export type PackNutrition = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams: number;
  /** True when pack/serving weight came from product data, not a 100 g default. */
  explicitPackGrams?: boolean;
  barcode?: string;
  brand?: string;
};

type OffNutriments = {
  "energy-kcal_100g"?: number;
  "energy-kcal"?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_ru?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
};

const USER_AGENT = "CalorieVision/1.0 (https://calorievision.ru)";
const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";

export function parsePackGrams(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase().replace(",", ".");

  // `\b` does not work after Cyrillic letters (they are non-word chars in JS regex).
  const kg = normalized.match(/(\d+(?:\.\d+)?)\s*(?:кг|kg)(?![a-zа-яё])/);
  if (kg) {
    return Math.round(Number(kg[1]) * 1000);
  }

  const grams = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:гр(?:амм[аов]*)?|g(?:rams?)?|г)(?![a-zа-яё])/,
  );
  if (grams) {
    return Math.round(Number(grams[1]));
  }

  const milliliters = normalized.match(/(\d+(?:\.\d+)?)\s*(?:мл|ml)(?![a-zа-яё])/);
  if (milliliters) {
    return Math.round(Number(milliliters[1]));
  }

  const plain = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) {
    return Math.round(Number(plain[1]));
  }
  return undefined;
}

/** Pick net/serving weight from Open Food Facts fields (quantity first, then serving). */
export function resolvePackGrams(
  product: OffProduct,
  preferredGrams?: number,
): { grams: number; explicit: boolean } {
  if (preferredGrams !== undefined && preferredGrams > 0) {
    return { grams: preferredGrams, explicit: true };
  }

  const fromNet =
    parsePackGrams(product.product_quantity) ?? parsePackGrams(product.quantity);
  if (fromNet !== undefined) {
    return { grams: fromNet, explicit: true };
  }

  const fromServing =
    parsePackGrams(product.serving_quantity) ?? parsePackGrams(product.serving_size);
  if (fromServing !== undefined) {
    return { grams: fromServing, explicit: true };
  }

  return { grams: 100, explicit: false };
}

export function portionGramsForPack(packGrams: number): number {
  return packGrams > 500 ? 100 : packGrams;
}

export function nutritionFromPer100g(
  per100g: { calories: number; protein?: number; fat?: number; carbs?: number },
  grams: number,
): PackNutrition | null {
  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(per100g.calories)) {
    return null;
  }

  const ratio = grams / 100;
  const scaleMacro = (value: number | undefined) =>
    value === undefined ? undefined : Math.round(value * ratio * 10) / 10;

  return {
    dishName: "",
    calories: Math.max(0, Math.round(per100g.calories * ratio)),
    protein: scaleMacro(per100g.protein),
    fat: scaleMacro(per100g.fat),
    carbs: scaleMacro(per100g.carbs),
    portionGrams: grams,
  };
}

export function offProductToNutrition(
  product: OffProduct,
  preferredGrams?: number,
): PackNutrition | null {
  const nutriments = product.nutriments ?? {};
  const kcal100 = nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"];
  if (typeof kcal100 !== "number" || !Number.isFinite(kcal100) || kcal100 <= 0) {
    return null;
  }

  const { grams: packGrams, explicit } = resolvePackGrams(product, preferredGrams);
  const grams = portionGramsForPack(packGrams);
  const scaled = nutritionFromPer100g(
    {
      calories: kcal100,
      protein: nutriments.proteins_100g,
      fat: nutriments.fat_100g,
      carbs: nutriments.carbohydrates_100g,
    },
    grams,
  );
  if (!scaled) {
    return null;
  }

  const name = (product.product_name_ru || product.product_name || "").trim();
  const brand = product.brands?.split(",")[0]?.trim();
  const dishName = [brand, name].filter(Boolean).join(" ").trim() || "Продукт";

  return {
    ...scaled,
    dishName,
    barcode: product.code,
    brand,
    explicitPackGrams: explicit,
  };
}

async function offGetJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupOpenFoodFactsByBarcode(barcode: string): Promise<PackNutrition | null> {
  const data = (await offGetJson(`${PRODUCT_URL}/${encodeURIComponent(barcode)}.json`)) as
    | { status?: number; product?: OffProduct }
    | null;
  if (!data || data.status !== 1 || !data.product) {
    return null;
  }
  return offProductToNutrition(data.product);
}

export function offMatchesQuery(query: string, dishName: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/gi, " ")
      .trim();

  const q = normalize(query);
  const n = normalize(dishName);
  if (!q || !n) {
    return false;
  }
  if (n.includes(q) || q.includes(n)) {
    return true;
  }

  const tokens = q.split(" ").filter((token) => token.length > 2);
  if (tokens.length === 0) {
    return false;
  }

  const matched = tokens.filter((token) => n.includes(token));
  return matched.length >= Math.ceil(tokens.length / 2);
}

export async function searchOpenFoodFacts(query: string): Promise<PackNutrition | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return null;
  }

  const url = `${SEARCH_URL}?${new URLSearchParams({
    search_terms: trimmed,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "5",
  }).toString()}`;

  const data = (await offGetJson(url)) as { products?: OffProduct[] } | null;
  const products = data?.products ?? [];
  const matches: PackNutrition[] = [];
  for (const product of products) {
    const nutrition = offProductToNutrition(product);
    if (nutrition) {
      matches.push(nutrition);
    }
  }

  return matches.find((item) => offMatchesQuery(trimmed, item.dishName)) ?? matches[0] ?? null;
}
