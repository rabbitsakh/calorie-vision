import assert from "node:assert/strict";
import { test } from "node:test";
import { isBetterStickerResult, shouldRunStickerPass } from "./ai/sticker-vision.ts";

test("sticker pass runs for empty label nutrition", () => {
  assert.equal(
    shouldRunStickerPass({
      dishName: "Салат цезарь",
      calories: 0,
      confidence: 0.5,
      photoKind: "label",
    }),
    true,
  );
});

test("sticker pass does not run for factory package photos", () => {
  assert.equal(
    shouldRunStickerPass({
      dishName: "Оливье",
      calories: 0,
      confidence: 0.55,
      photoKind: "package",
    }),
    false,
  );
});

test("sticker pass skips when macros already present", () => {
  assert.equal(
    shouldRunStickerPass({
      dishName: "Греческий салат",
      calories: 320,
      protein: 8,
      fat: 22,
      carbs: 12,
      confidence: 0.8,
      photoKind: "label",
      portionGrams: 250,
    }),
    false,
  );
});

test("prefers candidate with sticker calories", () => {
  assert.equal(
    isBetterStickerResult(
      { dishName: "Салат", calories: 0, confidence: 0.4, photoKind: "label" },
      {
        dishName: "Салат цезарь",
        calories: 410,
        protein: 18,
        fat: 28,
        carbs: 14,
        confidence: 0.85,
        photoKind: "label",
        portionGrams: 280,
      },
    ),
    true,
  );
});
