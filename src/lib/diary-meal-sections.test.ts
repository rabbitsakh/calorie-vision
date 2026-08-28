import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diaryHasMealTypes,
  mealTypeForListItem,
  organizeDiaryByMealType,
  sectionLabel,
} from "./diary-meal-sections.ts";
import type { MealEntry } from "@/types";

function entry(partial: Partial<MealEntry> & Pick<MealEntry, "id" | "dishName" | "calories">): MealEntry {
  return {
    date: "2026-08-19",
    protein: null,
    fat: null,
    carbs: null,
    portionGrams: null,
    confidence: null,
    imagePath: null,
    mealGroupId: null,
    mealType: null,
    wasCorrected: false,
    originalDish: null,
    originalCalories: null,
    createdAt: "2026-08-19T12:00:00.000Z",
    ...partial,
  };
}

test("organizeDiaryByMealType groups by slot order", () => {
  const items = organizeDiaryByMealType([
    { kind: "single", entry: entry({ id: "1", dishName: "Ужин", calories: 400, mealType: "DINNER" }) },
    { kind: "single", entry: entry({ id: "2", dishName: "Завтрак", calories: 300, mealType: "BREAKFAST" }) },
    { kind: "single", entry: entry({ id: "3", dishName: "Без типа", calories: 100 }) },
  ]);

  assert.deepEqual(
    items.map((item) => (item.kind === "single" ? item.entry.dishName : "")),
    ["Завтрак", "Ужин", "Без типа"],
  );
});

test("organizeDiaryByMealType keeps chronological order when no types", () => {
  const input = [
    { kind: "single" as const, entry: entry({ id: "1", dishName: "A", calories: 100 }) },
    { kind: "single" as const, entry: entry({ id: "2", dishName: "B", calories: 200 }) },
  ];
  assert.equal(diaryHasMealTypes(input), false);
  assert.deepEqual(organizeDiaryByMealType(input), input);
});

test("mealTypeForListItem reads group head entry", () => {
  assert.equal(
    mealTypeForListItem({
      kind: "group",
      groupId: "g1",
      entries: [entry({ id: "1", dishName: "A", calories: 100, mealType: "LUNCH" })],
      imagePath: null,
      totalCalories: 100,
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      totalFiber: 0,
      totalSugar: 0,
      createdAt: "2026-08-19T12:00:00.000Z",
    }),
    "LUNCH",
  );
});

test("sectionLabel maps untagged", () => {
  assert.equal(sectionLabel("UNTAGGED"), "Без типа");
  assert.equal(sectionLabel("BREAKFAST"), "Завтрак");
});
