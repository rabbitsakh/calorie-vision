import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DRINK_PORTION_CHIPS,
  MEAL_PORTION_CHIPS,
  READY_MEAL_PORTION_CHIPS,
  isCrediblePhotoPortionGrams,
  portionChipOptions,
  readyMealPortionChipGrams,
} from "./confirm-portion-chips.ts";

test("drink chips include 150ml and can sizes 330/350", () => {
  assert.ok(DRINK_PORTION_CHIPS.includes(150));
  assert.ok(DRINK_PORTION_CHIPS.includes(330));
  assert.ok(DRINK_PORTION_CHIPS.includes(350));
});

test("meal chips are 100/150/200/250", () => {
  assert.deepEqual([...MEAL_PORTION_CHIPS], [100, 150, 200, 250]);
});

test("portionChipOptions for solid food includes meal defaults and history", () => {
  const chips = portionChipOptions(
    {
      dishName: "Каша",
      original: {
        dishName: "Каша",
        calories: 200,
        confidence: 0.9,
        portionGrams: 200,
      },
    },
    [180],
  );
  assert.ok(chips.some((c) => c.grams === 200 && c.label.includes("фото")));
  assert.ok(chips.some((c) => c.grams === 180));
  assert.ok(chips.length <= 8);
});

test("portionChipOptions for drinks uses ml labels", () => {
  const chips = portionChipOptions({
    dishName: "Кола",
    original: {
      dishName: "Кола",
      calories: 42,
      confidence: 0.9,
      photoKind: "label",
      portionGrams: 500,
      brand: "Coca-Cola",
    },
  });
  assert.ok(chips.some((c) => c.label.includes("мл")));
  assert.ok(!chips.some((c) => / г$/.test(c.label) || c.label.endsWith(" г)")));
});

test("rejects absurd photo portion chips (1g / drink <50)", () => {
  assert.equal(isCrediblePhotoPortionGrams(1, false), false);
  assert.equal(isCrediblePhotoPortionGrams(1, true), false);
  assert.equal(isCrediblePhotoPortionGrams(9, false), false);
  assert.equal(isCrediblePhotoPortionGrams(40, true), false);
  assert.equal(isCrediblePhotoPortionGrams(10, false), true);
  assert.equal(isCrediblePhotoPortionGrams(50, true), true);
  assert.equal(isCrediblePhotoPortionGrams(330, true), true);
});

test("portionChipOptions skips 1g photo chip for drinks", () => {
  const chips = portionChipOptions({
    dishName: "Тоник",
    original: {
      dishName: "Тоник",
      calories: 0,
      confidence: 0.9,
      photoKind: "barcode",
      portionGrams: 1,
      brand: "Schweppes",
    },
  });
  assert.ok(!chips.some((c) => c.label.includes("Как на фото") && c.grams === 1));
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
