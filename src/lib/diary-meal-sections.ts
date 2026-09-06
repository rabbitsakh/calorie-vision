import type { MealListItem } from "@/lib/meal-groups";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";

export type MealTypeSection = MealType | "UNTAGGED";

export const MEAL_TYPE_SECTION_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export const MEAL_TYPE_SECTIONS: MealTypeSection[] = [...MEAL_TYPE_SECTION_ORDER, "UNTAGGED"];

export function mealTypeForListItem(item: MealListItem): MealTypeSection {
  if (item.kind === "single") {
    return item.entry.mealType ?? "UNTAGGED";
  }
  return item.entries[0]?.mealType ?? "UNTAGGED";
}

export function diaryHasMealTypes(items: MealListItem[]): boolean {
  return items.some((item) => {
    if (item.kind === "single") return Boolean(item.entry.mealType);
    return item.entries.some((entry) => entry.mealType);
  });
}

/** Reorder diary rows into breakfast → lunch → dinner → snack → untagged. */
export function organizeDiaryByMealType(items: MealListItem[]): MealListItem[] {
  if (!diaryHasMealTypes(items)) {
    return items;
  }

  const buckets = new Map<MealTypeSection, MealListItem[]>();
  for (const type of MEAL_TYPE_SECTIONS) {
    buckets.set(type, []);
  }

  for (const item of items) {
    buckets.get(mealTypeForListItem(item))!.push(item);
  }

  return MEAL_TYPE_SECTIONS.flatMap((type) => buckets.get(type)!);
}

export function sectionLabel(section: MealTypeSection): string {
  if (section === "UNTAGGED") return "Без типа";
  return MEAL_TYPE_LABELS[section];
}


export type DiarySourceFilter = "ALL" | "PHOTO" | "TEXT" | "LOW_CONFIDENCE";

/** Camera / plate / label vision — always «С фото». */
const CAMERA_RECOGNITION_SOURCES = new Set([
  "gigachat",
  "gigachat-plate",
  "label",
]);

/**
 * Name / catalog lookup (FoodAddPanel «текстом»).
 * These often cache a remote product image into `imagePath`, so photo presence
 * alone must not decide the TEXT filter.
 */
const TEXT_RECOGNITION_SOURCES = new Set([
  "gigachat-lookup",
  "openfoodfacts-search",
  "ru-nutrition-table",
]);

/** Barcode scan / typed barcode — treat as photo-adjacent (scanner), not name text. */
const BARCODE_RECOGNITION_SOURCES = new Set([
  "openfoodfacts-barcode",
  "gigachat-barcode",
  "ru-sku-cache",
]);

type DiarySourceEntry = {
  imagePath?: string | null;
  recognitionSource?: string | null;
};

export function listItemHasPhoto(item: MealListItem): boolean {
  if (item.kind === "single") return Boolean(item.entry.imagePath);
  return Boolean(item.imagePath) || item.entries.some((entry) => Boolean(entry.imagePath));
}

/** True when the meal was added by photographing (or barcode), not by typing a name. */
export function entryIsPhotoLogged(entry: DiarySourceEntry): boolean {
  const source = entry.recognitionSource?.trim() || "";
  if (CAMERA_RECOGNITION_SOURCES.has(source)) return true;
  if (TEXT_RECOGNITION_SOURCES.has(source)) return false;
  if (BARCODE_RECOGNITION_SOURCES.has(source)) return true;
  // Legacy / correction-memory / unknown: fall back to whether an image is attached.
  return Boolean(entry.imagePath);
}

export function entryIsTextLogged(entry: DiarySourceEntry): boolean {
  return !entryIsPhotoLogged(entry);
}

export function listItemIsPhotoLogged(item: MealListItem): boolean {
  if (item.kind === "single") return entryIsPhotoLogged(item.entry);
  return item.entries.some((entry) => entryIsPhotoLogged(entry));
}

export function listItemIsTextLogged(item: MealListItem): boolean {
  if (item.kind === "single") return entryIsTextLogged(item.entry);
  // Multi-dish groups come from one plate photo — only all-text groups count as text.
  return item.entries.length > 0 && item.entries.every((entry) => entryIsTextLogged(entry));
}

export function listItemMinConfidence(item: MealListItem): number | null {
  const values =
    item.kind === "single"
      ? [item.entry.confidence]
      : item.entries.map((entry) => entry.confidence);
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

export function listItemIsLowConfidence(item: MealListItem, threshold: number): boolean {
  const min = listItemMinConfidence(item);
  return min != null && min < threshold;
}

export function matchesDiarySourceFilter(
  item: MealListItem,
  filter: DiarySourceFilter,
  lowConfidenceThreshold: number,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "PHOTO") return listItemIsPhotoLogged(item);
  if (filter === "TEXT") return listItemIsTextLogged(item);
  return listItemIsLowConfidence(item, lowConfidenceThreshold);
}
