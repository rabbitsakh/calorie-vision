import assert from "node:assert/strict";
import { test } from "node:test";
import {
  macrosDivergeFromCalories,
  reconcileCalorieEdit,
  scaleMacrosToCalories,
} from "./macro-scale.ts";

test("правка ккал пропорционально двигает БЖУ, пока их не трогали", () => {
  const scaled = scaleMacrosToCalories(200, 400, { protein: 10, fat: 8, carbs: 20 });
  assert.equal(scaled.protein, 20);
  assert.equal(scaled.fat, 16);
  assert.equal(scaled.carbs, 40);

  const kept = reconcileCalorieEdit({
    name: "Гречка",
    previousKcal: 200,
    nextKcal: 400,
    stored: { protein: 10, fat: 8, carbs: 20 },
    sent: { protein: 10, fat: 8, carbs: 20 },
    portionGrams: 200,
  });
  assert.equal(kept.macros.protein, 20);
  assert.equal(kept.warning, null);
});

test("если правили и ккал, и БЖУ, и они не сходятся — предупреждение без перезаписи", () => {
  assert.equal(
    macrosDivergeFromCalories({
      name: "Гречка",
      kcal: 400,
      protein: 5,
      fat: 1,
      carbs: 10,
      portionGrams: 200,
    }),
    true,
  );
  const clash = reconcileCalorieEdit({
    name: "Гречка",
    previousKcal: 200,
    nextKcal: 400,
    stored: { protein: 10, fat: 8, carbs: 20 },
    sent: { protein: 5, fat: 1, carbs: 10 },
    portionGrams: 200,
  });
  assert.equal(clash.macros.protein, 5);
  assert.match(clash.warning ?? "", /не сходятся/);
});
