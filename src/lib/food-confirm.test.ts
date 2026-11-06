import assert from "node:assert/strict";
import { test } from "node:test";
import { barcodeProductToRecognition } from "./barcode-catalog.ts";
import {
  FOOD_CONFIRM_PORTION_SKIM,
  foodConfirmEnergyWarning,
  foodConfirmFromPhotoDraft,
  foodConfirmFromQuickMeal,
  foodConfirmFromRecognition,
  foodConfirmMissingPortionError,
  foodConfirmNutritionNote,
  foodConfirmToSaveInputs,
  per100FromLookup,
  portionAfterProductLookup,
  prepareFoodConfirmSave,
  withFoodConfirmGrams,
} from "./food-confirm.ts";
import { enrichUnsetMealNutrition } from "./assistant-meal-nutrition.ts";

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
  assert.equal(blocked.error, foodConfirmMissingPortionError("Мука"));
  assert.doesNotMatch(blocked.error, /подставим|100 г сами/);
  assert.equal(FOOD_CONFIRM_PORTION_SKIM, "проверь порцию.");
  assert.doesNotMatch(FOOD_CONFIRM_PORTION_SKIM, /подставим|100/);

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

test("поиск не подставляет 100 г: пустая порция остаётся плотностью на 100 г", () => {
  assert.equal(
    portionAfterProductLookup({ currentGrams: null, originalGrams: null, lookedGrams: 100 }),
    null,
  );
  assert.equal(portionAfterProductLookup({ currentGrams: 180, lookedGrams: 100 }), 180);
  assert.equal(portionAfterProductLookup({ originalGrams: 930, lookedGrams: 100 }), 930);
  assert.equal(portionAfterProductLookup({ lookedGrams: 330 }), 330);
  const per = per100FromLookup({ calories: 80, protein: 2, fat: 1, carbs: 12, portionGrams: 100 });
  assert.equal(per.calories, 80);
  assert.equal(per.protein, 2);
  const scaled = withFoodConfirmGrams(
    {
      name: "Мука",
      grams: null,
      unit: "г",
      kcal: null,
      protein: null,
      fat: null,
      carbs: null,
      mealSlot: null,
      per100: per,
      source: "barcode",
    },
    50,
  );
  assert.equal(scaled.kcal, 40);
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

test("типовая оценка протеина пересчитывается с 100 г на 70 г и дальше на новую порцию", () => {
  const [meal] = enrichUnsetMealNutrition(
    [{ name: "Протеин изолят", grams: 70, unit: "г", kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "Вот твоя запись:\n- Протеин изолят (70 г)",
  );
  const dish = foodConfirmFromQuickMeal(meal!);
  assert.equal(dish.grams, 70);
  assert.equal(dish.kcal, 259);
  assert.equal(dish.protein, 59.5);
  assert.equal(dish.fat, 0.7);
  assert.equal(dish.carbs, 2.1);
  assert.equal(foodConfirmNutritionNote(dish), "Типовая оценка по справочнику");
  const larger = withFoodConfirmGrams(dish, 140);
  assert.equal(larger.grams, 140);
  assert.equal(larger.kcal, 518);
  assert.equal(larger.protein, 119);
  assert.equal(larger.fat, 1.4);
  assert.equal(larger.carbs, 4.2);
  assert.equal(larger.nutritionBasis, "estimate");
});

test("без порции справочник не пишет 100 г и не заполняет ккал как съеденные", () => {
  const [meal] = enrichUnsetMealNutrition(
    [{ name: "Протеин изолят", kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "протеин изолят",
  );
  const dish = foodConfirmFromQuickMeal(meal!);
  assert.equal(dish.grams, null);
  assert.equal(dish.kcal, null);
  assert.equal(dish.per100?.calories, 370);
  assert.equal(dish.nutritionBasis, "estimate");
  const blocked = prepareFoodConfirmSave([dish]);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.doesNotMatch(blocked.error, /подставим/);
  const filled = withFoodConfirmGrams(dish, 70);
  assert.equal(filled.grams, 70);
  assert.equal(filled.kcal, 259);
});

test("реальный ноль нутриента остаётся нулём и сохраняется нулём", () => {
  const [butter] = enrichUnsetMealNutrition(
    [{ name: "Масло сливочное", grams: 10, unit: "г", kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "масло сливочное 10 г",
  );
  assert.equal(butter?.kcal, 75);
  assert.equal(butter?.protein, 0);
  assert.equal(butter?.fat, 8);
  assert.equal(butter?.carbs, 0);
  assert.equal(butter?.nutritionBasis, "estimate");
  const dish = foodConfirmFromQuickMeal(butter!);
  const doubled = withFoodConfirmGrams(dish, 20);
  assert.equal(doubled.kcal, 150);
  assert.equal(doubled.protein, 0);
  assert.equal(doubled.carbs, 0);
  assert.equal(doubled.fat, 16);
  const prepared = prepareFoodConfirmSave([dish]);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const [input] = foodConfirmToSaveInputs(prepared.ready, "2026-11-06");
  assert.equal(input?.calories, 75);
  assert.equal(input?.protein, 0);
  assert.equal(input?.carbs, 0);
  assert.equal(input?.fat, 8);
});

test("явно названный ноль не подменяется справочником, неизвестное блюдо не маскируется нулём", () => {
  const [stated] = enrichUnsetMealNutrition(
    [{ name: "Протеин изолят", grams: 70, kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "Протеин изолят (70 г): 0 ккал, белки 0 г, жиры 0 г, углеводы 0 г",
  );
  assert.equal(stated?.kcal, 0);
  assert.equal(stated?.protein, 0);
  assert.equal(stated?.nutritionBasis, undefined);
  const statedDish = foodConfirmFromQuickMeal(stated!);
  assert.equal(statedDish.kcal, 0);
  assert.equal(statedDish.protein, 0);
  assert.equal(foodConfirmNutritionNote(statedDish), null);

  const [unknown] = enrichUnsetMealNutrition(
    [{ name: "Кварцевый мусс zzq", grams: 40, kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "Кварцевый мусс zzq 40 г",
  );
  assert.equal(unknown?.kcal, undefined);
  assert.equal(unknown?.protein, undefined);
  assert.equal(unknown?.grams, 40);
  assert.equal(unknown?.nutritionBasis, "unknown");
  const dish = foodConfirmFromQuickMeal(unknown!);
  assert.equal(dish.kcal, null);
  assert.equal(dish.protein, null);
  assert.equal(dish.fat, null);
  assert.equal(dish.carbs, null);
  assert.equal(foodConfirmNutritionNote(dish), "КБЖУ не определены — нужно уточнить");
  const blocked = prepareFoodConfirmSave([dish]);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.match(blocked.error, /не определены/);
});

test("названные в тексте калории важнее справочника, частичный ноль у курицы не трогаем", () => {
  const [stated] = enrichUnsetMealNutrition(
    [{ name: "Протеин изолят", grams: 70, kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "Протеин изолят (70 г): 260 ккал, белки 60 г, жиры 1 г, углеводы 2 г",
  );
  assert.equal(stated?.kcal, 260);
  assert.equal(stated?.protein, 60);
  assert.equal(stated?.fat, 1);
  assert.equal(stated?.carbs, 2);
  assert.equal(stated?.nutritionBasis, undefined);

  const [apple] = enrichUnsetMealNutrition(
    [{ name: "Яблоко", grams: 90, unit: "г", kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "яблоко 90 г",
  );
  assert.equal(apple?.kcal, 48);
  assert.equal(apple?.protein, 0);
  assert.equal(apple?.fat, 0);
  assert.equal(apple?.carbs, 11);
  assert.equal(apple?.nutritionBasis, "estimate");

  const [tea] = enrichUnsetMealNutrition(
    [{ name: "Чай", grams: 250, unit: "мл", kcal: 0, protein: 0, fat: 0, carbs: 0 }],
    "чай 250 мл",
  );
  assert.equal(tea?.kcal, 40);
  assert.equal(tea?.protein, 0);
  assert.equal(tea?.fat, 0);
  assert.equal(tea?.carbs, 10);
  assert.equal(tea?.unit, "мл");

  const [chicken] = enrichUnsetMealNutrition(
    [{ name: "Курица", grams: 120, kcal: 250, protein: 30, fat: 12, carbs: 0 }],
    "курица 120 г",
  );
  assert.equal(chicken?.kcal, 250);
  assert.equal(chicken?.carbs, 0);
  assert.equal(chicken?.nutritionBasis, undefined);
});
