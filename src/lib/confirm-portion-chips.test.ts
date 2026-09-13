import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DRINK_PORTION_CHIPS,
  READY_MEAL_PORTION_CHIPS,
  readyMealPortionChipGrams,
} from "./confirm-portion-chips.ts";

test("drink chips include 150ml and can sizes 330/350", () => {
  assert.ok(DRINK_PORTION_CHIPS.includes(150));
  assert.ok(DRINK_PORTION_CHIPS.includes(330));
  assert.ok(DRINK_PORTION_CHIPS.includes(350));
});

test("ready-meal chips include 300/350/400 for cafe salad label", () => {
  const chips = readyMealPortionChipGrams({
    dishName: "Салат Цезарь",
    photoKind: "label",
    portionGrams: 0,
  });
  assert.deepEqual(chips, [...READY_MEAL_PORTION_CHIPS]);
});

test("ready-meal chips prepend sticker portion grams when present", () => {
  const chips = readyMealPortionChipGrams({
    dishName: "Рис с курицей",
    photoKind: "package",
    portionGrams: 280,
  });
  assert.equal(chips[0], 280);
  assert.ok(chips.includes(300));
  assert.ok(chips.includes(350));
  assert.ok(chips.includes(400));
});

test("factory snack bar without prepared-food cue gets no ready-meal chips", () => {
  const chips = readyMealPortionChipGrams({
    dishName: "Батончик",
    brand: "Bombbar",
    photoKind: "package",
    portionGrams: 60,
  });
  assert.deepEqual(chips, []);
});
