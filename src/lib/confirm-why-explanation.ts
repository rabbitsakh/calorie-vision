/**
 * One-line «Почему так» for confirm — source path + kcal basis + soft doubt.
 */

import { RECOGNITION_SOURCE_LABELS, type FoodRecognitionResult } from "@/lib/food-types";
import {
  confidenceWhyHint,
  getConfidenceTone,
} from "@/lib/recognition-confidence-ui";
import { describeNutritionBasis } from "@/lib/recognition-nutrition";

const DEFAULT_LOW_CONFIDENCE = 0.55;
const MAX_SUMMARY_CHARS = 160;

export type WhyTheseCalories = {
  summary: string;
  detail: string | null;
};

function sourcePath(
  item: Pick<FoodRecognitionResult, "source" | "photoKind" | "lookupMode">,
): string {
  if (item.source && RECOGNITION_SOURCE_LABELS[item.source]) {
    return RECOGNITION_SOURCE_LABELS[item.source]!;
  }
  if (item.photoKind === "label") return RECOGNITION_SOURCE_LABELS.label!;
  if (item.photoKind === "barcode") return "Оценка по штрихкоду";
  if (item.photoKind === "package") return "Оценка по упаковке";
  if (item.lookupMode === "generic") return "Типичные значения по названию";
  if (item.lookupMode === "branded") return "По бренду";
  return "Оценка по фото блюда";
}

function clip(text: string): string {
  if (text.length <= MAX_SUMMARY_CHARS) return text;
  return `${text.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`;
}

function basisAlreadyTellsStory(
  item: Pick<FoodRecognitionResult, "source" | "photoKind" | "lookupMode">,
): boolean {
  return (
    item.lookupMode != null ||
    item.source === "openfoodfacts-barcode" ||
    item.source === "gigachat-barcode" ||
    item.source === "label" ||
    item.photoKind === "label"
  );
}

/**
 * Always returns a short explanation for a normal recognition result.
 */
export function explainWhyTheseCalories(
  item: Pick<
    FoodRecognitionResult,
    | "dishName"
    | "brand"
    | "portionGrams"
    | "calories"
    | "photoKind"
    | "source"
    | "per100g"
    | "lookupMode"
    | "confidence"
  >,
  opts?: { lowConfidenceThreshold?: number },
): WhyTheseCalories {
  const path = sourcePath(item);
  const basis = describeNutritionBasis(item);
  const tone = getConfidenceTone(
    typeof item.confidence === "number" ? item.confidence : 1,
    opts?.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE,
  );
  const doubt = confidenceWhyHint(tone, {
    photoKind: item.photoKind,
    source: item.source,
    dishName: item.dishName,
  });

  let summary: string;
  if (!basis) {
    summary = path;
  } else if (basisAlreadyTellsStory(item) || basis.toLowerCase().includes(path.toLowerCase().slice(0, 10))) {
    summary = basis;
  } else {
    summary = `${path} · ${basis}`;
  }

  const detail =
    doubt && !summary.toLowerCase().includes(doubt.toLowerCase().slice(0, 18))
      ? doubt
      : null;

  return { summary: clip(summary), detail };
}

type DiaryWhyEntry = {
  dishName: string;
  calories: number;
  portionGrams?: number | null;
  confidence?: number | null;
  recognitionSource?: string | null;
  photoKind?: string | null;
  brand?: string | null;
  lookupMode?: string | null;
  imagePath?: string | null;
};

/**
 * Wave W — short «Почему так» for a saved diary row (no second dashboard).
 * Returns null when there's nothing useful to say.
 */
export function explainWhyDiaryEntry(
  entry: DiaryWhyEntry,
  opts?: { lowConfidenceThreshold?: number },
): WhyTheseCalories | null {
  const source = entry.recognitionSource?.trim() || undefined;
  const photoKind = entry.photoKind?.trim() || undefined;
  const lookupMode =
    entry.lookupMode === "generic" || entry.lookupMode === "branded"
      ? entry.lookupMode
      : undefined;
  if (!source && !photoKind && !lookupMode && !entry.imagePath) {
    return null;
  }
  return explainWhyTheseCalories(
    {
      dishName: entry.dishName,
      brand: entry.brand ?? undefined,
      portionGrams: entry.portionGrams ?? undefined,
      calories: entry.calories,
      photoKind: photoKind as FoodRecognitionResult["photoKind"],
      source,
      lookupMode,
      confidence: typeof entry.confidence === "number" ? entry.confidence : 1,
    },
    opts,
  );
}
