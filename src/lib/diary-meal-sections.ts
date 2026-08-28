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
