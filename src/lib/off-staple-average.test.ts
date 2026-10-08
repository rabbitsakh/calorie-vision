import assert from "node:assert/strict";
import { test } from "node:test";
import { averagePackNutritionHits } from "./off-staple-average.ts";
import type { PackNutrition } from "./open-food-facts.ts";

function hit(
  dishName: string,
  per100: { calories: number; protein?: number; fat?: number; carbs?: number },
  brand?: string,
): PackNutrition {
  return {
    dishName,
    calories: per100.calories,
    protein: per100.protein,
    fat: per100.fat,
    carbs: per100.carbs,
    portionGrams: 100,
    brand,
    per100g: per100,
  };
}

test("averagePackNutritionHits medians unbranded staples", () => {
  const avg = averagePackNutritionHits(
    "творог 5%",
    [
      hit("Творог 5%", { calories: 100, protein: 16, fat: 5, carbs: 3 }),
      hit("Творог 5% мягкий", { calories: 120, protein: 18, fat: 5, carbs: 3 }),
      hit("Творог 5%", { calories: 140, protein: 20, fat: 5, carbs: 3 }),
      // Strong brand — ignored for generic average
      hit("Творог 5%", { calories: 200, protein: 10, fat: 10, carbs: 5 }, "Простоквашино"),
    ],
    { portionGrams: 150, minHits: 2 },
  );
  assert.ok(avg);
  // median kcal/100 of 100,120,140 = 120 → 150g = 180
  assert.equal(avg!.calories, 180);
  assert.equal(avg!.portionGrams, 150);
  assert.equal(avg!.brand, undefined);
});

test("averagePackNutritionHits needs at least minHits", () => {
  const avg = averagePackNutritionHits(
    "киноа",
    [hit("Киноа варёная", { calories: 120, protein: 4, fat: 2, carbs: 21 })],
    { minHits: 2 },
  );
  assert.equal(avg, null);
});
