import assert from "node:assert/strict";
import { test } from "node:test";
import {
  combineRecognitionItems,
  countIncompleteMultiDishItems,
  flattenRecognitionItems,
  isMultiItemRecognition,
  mergeMultiDishRecognition,
  reconcileMultiDishFromItems,
} from "./recognition-items.ts";

test("treats a single dish as one item", () => {
  const result = flattenRecognitionItems({
    dishName: "Борщ",
    calories: 250,
    confidence: 0.8,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].dishName, "Борщ");
  assert.equal(isMultiItemRecognition({ dishName: "Борщ", calories: 250, confidence: 0.8 }), false);
});

test("combines plate items into a list with totals", () => {
  const combined = combineRecognitionItems(
    [
      { dishName: "Стейк", calories: 400, protein: 40, fat: 20, carbs: 0, portionGrams: 150, confidence: 0.7 },
      { dishName: "Картофель", calories: 180, protein: 4, fat: 6, carbs: 28, portionGrams: 200, confidence: 0.8 },
      { dishName: "Салат", calories: 90, protein: 2, fat: 7, carbs: 4, portionGrams: 80, confidence: 0.6 },
    ],
    { dishName: "Обед", calories: 0, confidence: 0.5, photoKind: "meal" },
  );

  assert.equal(isMultiItemRecognition(combined), true);
  assert.equal(combined.dishName, "Стейк, Картофель, Салат");
  assert.equal(combined.calories, 670);
  assert.equal(combined.protein, 46);
  assert.equal(combined.source, "gigachat-plate");
  assert.equal(flattenRecognitionItems(combined).length, 3);
});

test("combineRecognitionItems prefers item totals when base calories diverge", () => {
  const combined = combineRecognitionItems(
    [
      { dishName: "Стейк", calories: 400, confidence: 0.7 },
      { dishName: "Картофель", calories: 180, confidence: 0.8 },
    ],
    { dishName: "Стейк, Картофель", calories: 200, confidence: 0.5, photoKind: "meal" },
  );

  assert.equal(combined.calories, 580);
});


test("reconcileMultiDishFromItems forces parent totals after incomplete fill", () => {
  const reconciled = reconcileMultiDishFromItems({
    dishName: "Стейк, картофель",
    calories: 600,
    confidence: 0.7,
    photoKind: "meal",
    items: [
      { dishName: "Стейк", calories: 400, portionGrams: 180, confidence: 0.8 },
      { dishName: "Картофель", calories: 220, portionGrams: 200, confidence: 0.7 },
    ],
  });
  assert.equal(reconciled.calories, 620);
  assert.equal(countIncompleteMultiDishItems(reconciled), 0);
});

test("mergeMultiDishRecognition fills incomplete item without dropping good ones", () => {
  const merged = mergeMultiDishRecognition(
    {
      dishName: "Стейк, картофель",
      calories: 400,
      confidence: 0.6,
      photoKind: "meal",
      items: [
        { dishName: "Стейк", calories: 400, portionGrams: 180, confidence: 0.8 },
        { dishName: "Картофель", calories: 0, portionGrams: 0, confidence: 0.4 },
      ],
    },
    {
      dishName: "Стейк, картофель",
      calories: 620,
      confidence: 0.7,
      photoKind: "meal",
      items: [
        { dishName: "Стейк", calories: 390, portionGrams: 170, confidence: 0.7 },
        { dishName: "Картофель", calories: 220, portionGrams: 200, confidence: 0.75 },
      ],
    },
  );
  assert.equal(merged.items?.[0]?.dishName, "Стейк");
  assert.equal(merged.items?.[0]?.calories, 400);
  assert.equal(merged.items?.[1]?.calories, 220);
  assert.equal(merged.calories, 620);
});
