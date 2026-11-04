import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcilePortionEnergy } from "./recognition-nutrition.ts";

test("подушечки: БЖУ тяжелее порции — это подпись на 100 г", () => {
  const fixed = reconcilePortionEnergy({
    dishName: "подушечки лавилето",
    calories: 22,
    protein: 7,
    fat: 5,
    carbs: 70,
    portionGrams: 50,
  });
  assert.equal(fixed.carbs, 35);
  assert.equal(fixed.protein, 3.5);
  assert.ok(fixed.calories > 150 && fixed.calories < 200);
});

test("батончик: ккал выше 9 на грамм заменяются на сумму БЖУ", () => {
  const fixed = reconcilePortionEnergy({
    dishName: "Протеиновый батончик",
    calories: 710,
    protein: 15,
    fat: 6.5,
    carbs: 9.3,
    portionGrams: 50,
  });
  assert.equal(fixed.protein, 15);
  assert.equal(fixed.calories, 156);
});

test("пиво не подгоняется под 4/9/4", () => {
  const beer = reconcilePortionEnergy({
    dishName: "Пиво светлое",
    calories: 210,
    protein: 2,
    fat: 0,
    carbs: 16,
    portionGrams: 500,
  });
  assert.equal(beer.calories, 210);
  assert.equal(beer.carbs, 16);
});

test("салат без общей базы не переписывается", () => {
  const salad = reconcilePortionEnergy({
    dishName: "Салат Дальневосточный",
    calories: 445,
    protein: 2.8,
    fat: 6.9,
    carbs: 0.7,
    portionGrams: 69,
  });
  assert.equal(salad.calories, 445);
  assert.equal(salad.protein, 2.8);
  assert.equal(salad.fat, 6.9);
});
