import type { FoodRecognitionResult } from "@/lib/food-recognition";

type RawRecognition = {
  dishName?: unknown;
  calories?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbs?: unknown;
  portionGrams?: unknown;
  confidence?: unknown;
  alternatives?: unknown;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
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

export function parseFoodRecognitionResponse(text: string): FoodRecognitionResult {
  let parsed: RawRecognition;

  try {
    parsed = JSON.parse(extractJson(text)) as RawRecognition;
  } catch {
    throw new Error("Модель вернула некорректный JSON");
  }

  const dishName =
    typeof parsed.dishName === "string" && parsed.dishName.trim()
      ? parsed.dishName.trim()
      : "Не удалось распознать блюдо";

  const calories = Math.max(0, Math.round(toNumber(parsed.calories) ?? 0));
  const confidenceRaw = toNumber(parsed.confidence) ?? 0.5;
  const confidence = Math.min(1, Math.max(0, confidenceRaw));

  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const alt = item as { dishName?: unknown; calories?: unknown };
          const name =
            typeof alt.dishName === "string" && alt.dishName.trim()
              ? alt.dishName.trim()
              : null;
          const altCalories = toNumber(alt.calories);
          if (!name || altCalories === undefined) return null;
          return { dishName: name, calories: Math.max(0, Math.round(altCalories)) };
        })
        .filter((item): item is { dishName: string; calories: number } => item !== null)
        .slice(0, 3)
    : undefined;

  return {
    dishName,
    calories,
    protein: toNumber(parsed.protein),
    fat: toNumber(parsed.fat),
    carbs: toNumber(parsed.carbs),
    portionGrams: toNumber(parsed.portionGrams)
      ? Math.round(toNumber(parsed.portionGrams)!)
      : undefined,
    confidence,
    alternatives: alternatives?.length ? alternatives : undefined,
  };
}
