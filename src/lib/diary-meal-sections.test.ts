import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchesDiarySourceFilter,
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


test("matchesDiarySourceFilter photo/text/low confidence", () => {
  const photo = {
    kind: "single" as const,
    entry: {
      imagePath: "/x.jpg",
      confidence: 0.9,
      mealType: "LUNCH",
      recognitionSource: "gigachat",
    } as never,
  };
  const textItem = {
    kind: "single" as const,
    entry: { imagePath: null, confidence: 0.4, mealType: "LUNCH" } as never,
  };
  assert.equal(matchesDiarySourceFilter(photo, "PHOTO", 0.55), true);
  assert.equal(matchesDiarySourceFilter(photo, "TEXT", 0.55), false);
  assert.equal(matchesDiarySourceFilter(textItem, "TEXT", 0.55), true);
  assert.equal(matchesDiarySourceFilter(textItem, "LOW_CONFIDENCE", 0.55), true);
  assert.equal(matchesDiarySourceFilter(photo, "LOW_CONFIDENCE", 0.55), false);
});

test("TEXT filter keeps name-lookup meals that cached a product image", () => {
  const lookupWithImage = {
    kind: "single" as const,
    entry: {
      imagePath: "/api/uploads/product.webp",
      confidence: 0.8,
      mealType: "BREAKFAST",
      recognitionSource: "gigachat-lookup",
    } as never,
  };
  const offSearchWithImage = {
    kind: "single" as const,
    entry: {
      imagePath: "/api/uploads/off.webp",
      confidence: 0.85,
      mealType: "SNACK",
      recognitionSource: "openfoodfacts-search",
    } as never,
  };
  assert.equal(matchesDiarySourceFilter(lookupWithImage, "TEXT", 0.55), true);
  assert.equal(matchesDiarySourceFilter(lookupWithImage, "PHOTO", 0.55), false);
  assert.equal(matchesDiarySourceFilter(offSearchWithImage, "TEXT", 0.55), true);
  assert.equal(matchesDiarySourceFilter(offSearchWithImage, "PHOTO", 0.55), false);
});

test("PHOTO filter keeps camera meals; barcode sources stay photo-adjacent", () => {
  const plate = {
    kind: "single" as const,
    entry: {
      imagePath: "/api/uploads/plate.webp",
      confidence: 0.7,
      recognitionSource: "gigachat-plate",
    } as never,
  };
  const barcode = {
    kind: "single" as const,
    entry: {
      imagePath: "/api/uploads/sku.webp",
      confidence: 0.9,
      recognitionSource: "openfoodfacts-barcode",
    } as never,
  };
  assert.equal(matchesDiarySourceFilter(plate, "PHOTO", 0.55), true);
  assert.equal(matchesDiarySourceFilter(plate, "TEXT", 0.55), false);
  assert.equal(matchesDiarySourceFilter(barcode, "PHOTO", 0.55), true);
  assert.equal(matchesDiarySourceFilter(barcode, "TEXT", 0.55), false);
});
