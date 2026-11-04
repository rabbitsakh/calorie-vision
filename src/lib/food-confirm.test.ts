import assert from "node:assert/strict";
import { test } from "node:test";
import { barcodeProductToRecognition } from "./barcode-catalog.ts";
import {
  foodConfirmEnergyWarning,
  foodConfirmFromPhotoDraft,
  foodConfirmFromQuickMeal,
  foodConfirmFromRecognition,
  foodConfirmToSaveInputs,
  prepareFoodConfirmSave,
  withFoodConfirmGrams,
} from "./food-confirm.ts";

test("чат, фото и штрихкод сходятся в одну проверку и одно тело сохранения", () => {
  const chat = foodConfirmFromQuickMeal({
    name: "Гречка",
    grams: 180,
    unit: "г",
    kcal: 210,
    protein: 7,
    fat: 2,
    carbs: 40,
    mealSlot: "LUNCH",
  });
  const photo = foodConfirmFromPhotoDraft({
    dishName: "Омлет",
    calories: 280,
    protein: 18,
    fat: 20,
    carbs: 4,
    portionGrams: 200,
    mealType: "BREAKFAST",
  });
  const barcode = foodConfirmFromRecognition(
    barcodeProductToRecognition({
      barcode: "4006381333931",
      name: "Творог",
      kcalPer100: 121,
      proteinPer100: 16,
      fatPer100: 5,
      carbsPer100: 3,
      packGrams: 1000,
      source: "openfoodfacts",
      userContributed: false,
    }),
    "barcode",
  );

  for (const dish of [chat, photo, barcode]) {
    const prepared = prepareFoodConfirmSave([dish]);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const [input] = foodConfirmToSaveInputs(prepared.ready, "2026-11-04");
    assert.equal(typeof input?.portionGrams, "number");
    assert.notEqual(input?.portionGrams, undefined);
    assert.ok((input?.calories ?? 0) > 0);
  }
  assert.equal(barcode.grams, 1000);
  assert.equal(barcode.kcal, 1210);
  assert.equal(chat.mealSlot, "LUNCH");
});

test("неизвестная порция штрихкода не становится 100 г и не сохраняется молча", () => {
  const dish = foodConfirmFromRecognition(
    barcodeProductToRecognition({
      barcode: "4006381333931",
      name: "Мука",
      kcalPer100: 340,
      proteinPer100: 10,
      fatPer100: 1,
      carbsPer100: 70,
      source: "openfoodfacts",
      userContributed: false,
    }),
    "barcode",
  );
  assert.equal(dish.grams, null);
  assert.equal(dish.kcal, null);
  assert.equal(dish.per100?.calories, 340);
  const blocked = prepareFoodConfirmSave([dish]);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.match(blocked.error, /порци/i);

  const filled = withFoodConfirmGrams(dish, 50);
  assert.equal(filled.grams, 50);
  assert.equal(filled.kcal, 170);
  const saved = prepareFoodConfirmSave([filled]);
  assert.equal(saved.ok, true);
});

test("первая порция в чате не пересчитывает ккал от выдуманных 100 г", () => {
  const dish = foodConfirmFromQuickMeal({ name: "Чебурек", kcal: 300, protein: 12, fat: 16, carbs: 28 });
  assert.equal(dish.grams, null);
  const next = withFoodConfirmGrams(dish, 180);
  assert.equal(next.grams, 180);
  assert.equal(next.kcal, 300);
  const again = withFoodConfirmGrams(next, 90);
  assert.equal(again.kcal, 150);
});

test("несколько блюд: неразобранная строка не ломает остальные, ккал сверяются с БЖУ", () => {
  const ready = foodConfirmFromQuickMeal({
    name: "Сырники",
    grams: 150,
    unit: "г",
    kcal: 300,
    protein: 20,
    fat: 15,
    carbs: 25,
  });
  const unparsed = foodConfirmFromQuickMeal({ name: "Желе из ряженки", unparsed: true });
  const odd = foodConfirmFromQuickMeal({
    name: "Батончик",
    grams: 50,
    unit: "г",
    kcal: 710,
    protein: 5,
    fat: 5,
    carbs: 5,
  });
  assert.match(foodConfirmEnergyWarning(odd) ?? "", /не сходятся/i);
  const prepared = prepareFoodConfirmSave([ready, unparsed, odd]);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.ready.length, 2);
  assert.equal(prepared.skipped, 1);
  assert.equal(prepared.warnings.length, 1);
  const inputs = foodConfirmToSaveInputs(prepared.ready, "2026-11-04");
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0]?.portionGrams, 150);
});
