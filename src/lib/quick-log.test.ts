import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichQuickMealsFromText,
  portionFromUserText,
  quickHeader,
  quickSaveLabel,
  quickSlotTag,
  quickTotals,
  rescaleQuickMeal,
  splitQuickPortion,
} from "./quick-log.ts";

test("splitQuickPortion reads «(200 г)» and trailing «100 мл»", () => {
  assert.deepEqual(splitQuickPortion("Творог обезжиренный (200 г)"), {
    base: "Творог обезжиренный",
    grams: 200,
    unit: "г",
  });
  assert.deepEqual(splitQuickPortion("Молоко 2,5% 100 мл"), { base: "Молоко 2,5%", grams: 100, unit: "мл" });
  assert.deepEqual(splitQuickPortion("Молоко 100мл"), { base: "Молоко", grams: 100, unit: "мл" });
  assert.equal(splitQuickPortion("Мороженое").grams, null);
});

test("enrichQuickMealsFromText restores grams AI dropped from the name", () => {
  const enriched = enrichQuickMealsFromText(
    [{ name: "Молоко", kcal: 60, protein: 3, fat: 3, carbs: 5, note: "перекус" }],
    "Молоко 100мл",
  );
  assert.equal(enriched[0]!.name, "Молоко (100 мл)");
  assert.deepEqual(portionFromUserText("Молоко 100мл", "Молоко"), {
    base: "Молоко",
    grams: 100,
    unit: "мл",
  });
  const defaulted = enrichQuickMealsFromText([{ name: "Творог", kcal: 120 }], "творог");
  assert.equal(defaulted[0]!.name, "Творог (100 г)");
});

test("rescaleQuickMeal scales kcal and macros with grams", () => {
  const next = rescaleQuickMeal(
    { name: "Подушечки (50 г)", kcal: 215, protein: 3.5, fat: 7.5, carbs: 33.5, note: "завтрак" },
    100,
  );
  assert.equal(next.name, "Подушечки (100 г)");
  assert.equal(next.kcal, 430);
  assert.equal(next.carbs, 67);
  assert.equal(next.note, "завтрак");
  const same = { name: "Кофе", kcal: 5 };
  assert.equal(rescaleQuickMeal(same, 300), same);
});

test("totals, slot tag and save label", () => {
  const meals = [
    { name: "Творог (200 г)", kcal: 147, protein: 44, fat: 0.7, carbs: 6.7, note: "завтрак", time: "07:00" },
    { name: "Молоко (100 мл)", kcal: 48, protein: 1.2, fat: 1, carbs: 2, note: "завтрак" },
  ];
  assert.deepEqual(quickTotals(meals), { kcal: 195, protein: 45, fat: 2, carbs: 9 });
  assert.equal(quickSlotTag(meals), "Завтрак · 07:00");
  assert.equal(quickSaveLabel(meals, 195), "Записать в завтрак · 195 ккал");
  assert.equal(quickSaveLabel([{ name: "Кофе", kcal: 5 }], 5), "Записать · 5 ккал");
  assert.equal(quickHeader(4), "Нашёл 4 блюда — проверь граммы");
  assert.equal(quickHeader(5), "Нашёл 5 блюд — проверь граммы");
  assert.equal(quickHeader(1), "Нашёл блюдо — проверь граммы");
});
