import { DEFAULT_SNACK_BAR_GRAMS, looksLikeSnackBarName } from "@/lib/portion-unit";

export type PackNutrition = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams: number;
  /** True when pack/serving weight came from product data, not a 100 g default. */
  explicitPackGrams?: boolean;
  barcode?: string;
  brand?: string;
  imageUrl?: string;
};

type OffNutriments = {
  "energy-kcal_100g"?: number | string;
  "energy-kcal"?: number | string;
  proteins_100g?: number | string;
  fat_100g?: number | string;
  carbohydrates_100g?: number | string;
  fiber_100g?: number | string;
  sugars_100g?: number | string;
  /** Some OFF records only expose sugars without the _100g suffix. */
  sugars?: number | string;
};

function offNutrimentNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

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
  image_front_url?: string;
  image_url?: string;
  image_front_small_url?: string;
  image_small_url?: string;
};

const USER_AGENT = "CalorieVision/1.0 (https://calorievision.ru)";
const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";

// In-process cache (5 min TTL) to avoid duplicate network calls for repeated scans.
const OFF_CACHE_TTL_MS = 5 * 60 * 1000;
type OffCacheEntry = { value: PackNutrition | null; ts: number };
const offBarcodeCache = new Map<string, OffCacheEntry>();
const offSearchCache = new Map<string, OffCacheEntry>();

function offCacheGet(cache: Map<string, OffCacheEntry>, key: string): PackNutrition | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > OFF_CACHE_TTL_MS) { cache.delete(key); return undefined; }
  return entry.value;
}
function offCacheSet(cache: Map<string, OffCacheEntry>, key: string, value: PackNutrition | null): void {
  cache.set(key, { value, ts: Date.now() });
}

function decodeOffText(value: string): string {
  if (!value.includes("&")) {
    return value;
  }

  let current = value;
  for (let index = 0; index < 3; index += 1) {
    const next = current
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*34;/g, '"')
      .replace(/&#x0*22;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#0*39;/g, "'")
      .replace(/&#x0*27;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ");
    if (next === current) {
      break;
    }
    current = next;
  }

  return current;
}

function pickOffImageUrl(product: OffProduct): string | undefined {
  const candidates = [
    product.image_front_url,
    product.image_url,
    product.image_front_small_url,
    product.image_small_url,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      candidate.startsWith("https://") &&
      /openfoodfacts\.(org|net)/i.test(candidate) &&
      !/\.svg(?:$|\?)/i.test(candidate)
    ) {
      return candidate;
    }
  }

  return undefined;
}

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

  const nameText = [product.product_name_ru, product.product_name, product.brands]
    .filter(Boolean)
    .join(" ");
  const fromName = parsePackGrams(nameText);
  if (fromName !== undefined && fromName >= 20 && fromName <= 150) {
    return { grams: fromName, explicit: true };
  }

  if (looksLikeSnackBarName(nameText)) {
    return { grams: DEFAULT_SNACK_BAR_GRAMS, explicit: true };
  }

  return { grams: 100, explicit: false };
}

export function portionGramsForPack(packGrams: number): number {
  return packGrams > 500 ? 100 : packGrams;
}

export function nutritionFromPer100g(
  per100g: {
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
  },
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
    fiber: scaleMacro(per100g.fiber),
    sugar: scaleMacro(per100g.sugar),
    portionGrams: grams,
  };
}

export function offProductToNutrition(
  product: OffProduct,
  preferredGrams?: number,
): PackNutrition | null {
  const nutriments = product.nutriments ?? {};
  // Use only the per-100g field — "energy-kcal" without suffix is per-serving in OFF schema
  // and would produce wrong calorie density if product_quantity differs from serving_quantity.
  const kcal100 = offNutrimentNumber(nutriments["energy-kcal_100g"]);
  if (kcal100 === undefined || kcal100 <= 0) {
    return null;
  }

  const { grams: packGrams, explicit } = resolvePackGrams(product, preferredGrams);
  const grams = portionGramsForPack(packGrams);
  const scaled = nutritionFromPer100g(
    {
      calories: kcal100,
      protein: offNutrimentNumber(nutriments.proteins_100g),
      fat: offNutrimentNumber(nutriments.fat_100g),
      carbs: offNutrimentNumber(nutriments.carbohydrates_100g),
      fiber: offNutrimentNumber(nutriments.fiber_100g),
      sugar:
        offNutrimentNumber(nutriments.sugars_100g) ?? offNutrimentNumber(nutriments.sugars),
    },
    grams,
  );
  if (!scaled) {
    return null;
  }

  const name = decodeOffText((product.product_name_ru || product.product_name || "").trim());
  const brand = decodeOffText(product.brands?.split(",")[0]?.trim() ?? "");
  const dishName = [brand, name].filter(Boolean).join(" ").trim() || "Продукт";

  return {
    ...scaled,
    dishName,
    barcode: product.code,
    brand: brand || undefined,
    explicitPackGrams: explicit,
    imageUrl: pickOffImageUrl(product),
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
  const cached = offCacheGet(offBarcodeCache, barcode);
  if (cached !== undefined) {
    return cached;
  }

  const data = (await offGetJson(`${PRODUCT_URL}/${encodeURIComponent(barcode)}.json`)) as
    | { status?: number; product?: OffProduct }
    | null;
  const result = data?.status === 1 && data.product ? offProductToNutrition(data.product) : null;
  offCacheSet(offBarcodeCache, barcode, result);
  return result;
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

  const cached = offCacheGet(offSearchCache, trimmed.toLowerCase());
  if (cached !== undefined) {
    return cached;
  }

  const url = `${SEARCH_URL}?${new URLSearchParams({
    search_terms: trimmed,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "5",
    lc: "ru",
    cc: "ru",
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

  // Only return a result when it actually matches the query — never silently substitute
  // an unrelated product that happened to be first in the result list.
  const result = matches.find((item) => offMatchesQuery(trimmed, item.dishName)) ?? null;
  offCacheSet(offSearchCache, trimmed.toLowerCase(), result);
  return result;
}
