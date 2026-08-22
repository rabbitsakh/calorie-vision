import assert from "node:assert/strict";
import { test } from "node:test";
import { combineRecognitionItems, flattenRecognitionItems, isMultiItemRecognition } from "./recognition-items.ts";

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
