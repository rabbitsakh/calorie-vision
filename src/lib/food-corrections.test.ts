import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFoodCorrection,
  correctionTokenOverlap,
  foodCorrectionKey,
  mergeRememberedCorrection,
  pickFoodCorrection,
} from "./food-corrections.ts";

test("normalizes dish names for correction lookup", () => {
  assert.equal(foodCorrectionKey("  Греческий   йогурт! "), "греческий йогурт");
  assert.equal(foodCorrectionKey("творог 5%"), "творог 5%");
});

test("applies a stored correction to recognition output", () => {
  const corrected = applyFoodCorrection(
    {
      dishName: "салат",
      calories: 120,
      confidence: 0.4,
      source: "gigachat",
    },
    {
      correctedName: "Греческий салат",
      calories: 280,
      protein: 12,
      fat: 18,
      carbs: 14,
      portionGrams: 250,
      useCount: 3,
    },
  );

  assert.equal(corrected.dishName, "Греческий салат");
  assert.equal(corrected.calories, 280);
  assert.equal(corrected.source, "correction-memory");
  assert.equal(corrected.confidence >= 0.85, true);
});

test("merges repeated corrections with running averages", () => {
  const merged = mergeRememberedCorrection(
    {
      correctedName: "Овсянка",
      calories: 300,
      protein: 10,
      fat: 5,
      carbs: 50,
      portionGrams: 250,
      useCount: 2,
    },
    {
      originalDish: "каша",
      dishName: "Овсянка",
      calories: 320,
      protein: 12,
      fat: 6,
      carbs: 52,
      portionGrams: 260,
    },
  );

  assert.equal(merged.useCount, 3);
  assert.equal(merged.calories, 307);
  assert.equal(merged.protein, 10.7);
});

test("finds partial correction matches for close names", () => {
  const picked = pickFoodCorrection("салат цезарь с курицей", [
    {
      originalKey: "салат цезарь",
      correctedName: "Цезарь с курицей",
      calories: 420,
      protein: null,
      fat: null,
      carbs: null,
      portionGrams: null,
      useCount: 1,
    },
  ]);

  assert.equal(picked?.correctedName, "Цезарь с курицей");
});

test("applies corrections to each plate item", () => {
  const rows = [
    {
      originalKey: "картофель",
      correctedName: "Картофель запечённый",
      calories: 160,
      protein: 4,
      fat: 5,
      carbs: 26,
      portionGrams: 180,
      useCount: 2,
    },
  ];

  const items = [
    {
      dishName: "Стейк",
      calories: 400,
      confidence: 0.7,
      photoKind: "meal" as const,
    },
    {
      dishName: "Картофель",
      calories: 180,
      confidence: 0.8,
      photoKind: "meal" as const,
    },
  ];

  const correctedItems = items.map((item) => {
    const match = pickFoodCorrection(item.dishName, rows);
    return match ? applyFoodCorrection(item, match) : item;
  });

  assert.equal(correctedItems[0]?.dishName, "Стейк");
  assert.equal(correctedItems[1]?.dishName, "Картофель запечённый");
  assert.equal(correctedItems[1]?.calories, 160);
});

test("matches corrections by token overlap", () => {
  assert.ok(correctionTokenOverlap("греческий салат с фетой", "салат греческий") >= 0.66);

  const picked = pickFoodCorrection("греческий салат с фетой", [
    {
      originalKey: "салат греческий",
      correctedName: "Греческий салат",
      calories: 260,
      protein: null,
      fat: null,
      carbs: null,
      portionGrams: null,
      useCount: 2,
    },
  ]);

  assert.equal(picked?.correctedName, "Греческий салат");
});

test("ignores unsafe grain-to-soup corrections", () => {
  const picked = pickFoodCorrection("овсянка по-новому", [
    {
      originalKey: "овсянка",
      correctedName: "суп Том Ям",
      calories: 148,
      protein: null,
      fat: null,
      carbs: null,
      portionGrams: 40,
      useCount: 5,
    },
  ]);

  assert.equal(picked, null);
});
