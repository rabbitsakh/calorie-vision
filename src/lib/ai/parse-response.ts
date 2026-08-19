import type { FoodRecognitionResult, PhotoKind } from "../food-types";

const PHOTO_KINDS = new Set<PhotoKind>(["meal", "package", "label", "barcode"]);
const MAX_PLATE_ITEMS = 8;

type RawRecognition = {
  dishName?: unknown;
  brand?: unknown;
  barcode?: unknown;
  photoKind?: unknown;
  calories?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbs?: unknown;
  portionGrams?: unknown;
  confidence?: unknown;
  alternatives?: unknown;
  per100g?: unknown;
  items?: unknown;
};

function toNumber(value: unknown): number | undefined {
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

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function parsePer100g(value: unknown): {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const calories = toNumber(raw.calories);
  if (calories === undefined || calories <= 0) {
    return undefined;
  }
  return {
    calories,
    protein: toNumber(raw.protein),
    fat: toNumber(raw.fat),
    carbs: toNumber(raw.carbs),
    fiber: toNumber(raw.fiber) || undefined,
    sugar: toNumber(raw.sugar) || undefined,
    saturatedFat: toNumber(raw.saturatedFat) || undefined,
  };
}

function parsePhotoKind(value: unknown): PhotoKind | undefined {
  return typeof value === "string" && PHOTO_KINDS.has(value as PhotoKind)
    ? (value as PhotoKind)
    : undefined;
}

function parseRecognitionObject(parsed: RawRecognition, includeItems: boolean): FoodRecognitionResult {
  const dishName =
    typeof parsed.dishName === "string" && parsed.dishName.trim()
      ? parsed.dishName.trim()
      : "Не удалось распознать блюдо";

  const calories = Math.max(0, Math.round(toNumber(parsed.calories) ?? 0));
  const confidenceRaw = toNumber(parsed.confidence) ?? 0.5;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));
  const barcode = typeof parsed.barcode === "string" ? parsed.barcode.trim() : undefined;
  const brand = typeof parsed.brand === "string" && parsed.brand.trim() ? parsed.brand.trim() : undefined;

  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const alt = item as {
            dishName?: unknown;
            calories?: unknown;
            protein?: unknown;
            fat?: unknown;
            carbs?: unknown;
            portionGrams?: unknown;
          };
          const name =
            typeof alt.dishName === "string" && alt.dishName.trim()
              ? alt.dishName.trim()
              : null;
          const altCalories = toNumber(alt.calories);
          if (!name || altCalories === undefined) return null;
          return {
            dishName: name,
            calories: Math.max(0, Math.round(altCalories)),
            protein: toNumber(alt.protein),
            fat: toNumber(alt.fat),
            carbs: toNumber(alt.carbs),
            portionGrams: toNumber(alt.portionGrams)
              ? Math.round(toNumber(alt.portionGrams)!)
              : undefined,
          };
        })
        .filter(
          (item): item is NonNullable<typeof item> => item !== null,
        )
        .slice(0, 3)
    : undefined;

  const result: FoodRecognitionResult = {
    dishName,
    calories,
    protein: toNumber(parsed.protein),
    fat: toNumber(parsed.fat),
    carbs: toNumber(parsed.carbs),
    fiber: toNumber((parsed as Record<string, unknown>).fiber) || undefined,
    sugar: toNumber((parsed as Record<string, unknown>).sugar) || undefined,
    saturatedFat: toNumber((parsed as Record<string, unknown>).saturatedFat) || undefined,
    portionGrams: toNumber(parsed.portionGrams)
      ? Math.round(toNumber(parsed.portionGrams)!)
      : undefined,
    confidence,
    alternatives: alternatives?.length ? alternatives : undefined,
    photoKind: parsePhotoKind(parsed.photoKind),
    barcode: barcode || undefined,
    brand,
    per100g: parsePer100g(parsed.per100g),
  };

  if (!includeItems || !Array.isArray(parsed.items)) {
    return result;
  }

  const items = parsed.items
    .filter((item): item is RawRecognition => Boolean(item) && typeof item === "object")
    .map((item) => parseRecognitionObject(item, false))
    .filter((item) => item.dishName && !/не удалось распознать/i.test(item.dishName))
    .slice(0, MAX_PLATE_ITEMS);

  if (items.length >= 2) {
    result.items = items.map((item) => ({
      ...item,
      photoKind: item.photoKind ?? result.photoKind ?? "meal",
    }));
  }

  return result;
}

export function parseFoodRecognitionResponse(text: string): FoodRecognitionResult {
  let parsed: RawRecognition;

  try {
    parsed = JSON.parse(extractJson(text)) as RawRecognition;
  } catch {
    throw new Error("Модель вернула некорректный JSON");
  }

  return parseRecognitionObject(parsed, true);
}
