import assert from "node:assert/strict";
import { test } from "node:test";
import { atwaterKcal } from "./nutrition-consistency.ts";
import {
  estimateOfflineFoodPhrase,
  heuristicRepairWriteActions,
} from "./assistant-repair.ts";

function assertAtwater(kcal: number, protein = 0, fat = 0, carbs = 0) {
  const expected = atwaterKcal(protein, fat, carbs);
  assert.ok(
    Math.abs(kcal - expected) <= 1,
    `${kcal} ккал vs Атуотер ${expected.toFixed(1)}`,
  );
}

test("офлайн: борщ тарелка ~57 ккал/100 г", () => {
  const hit = estimateOfflineFoodPhrase("борщ тарелка");
  assert.ok(hit);
  assert.match(hit.dishName, /Борщ/);
  assert.equal(hit.grams, 300);
  const per100 = hit.kcal / 3;
  assert.ok(per100 >= 55 && per100 <= 60, String(per100));
  assert.ok(hit.kcal >= 165 && hit.kcal <= 180);
  assertAtwater(hit.kcal, hit.protein, hit.fat, hit.carbs);
});

test("офлайн: сырники 3 шт — 210 г и ккал сходятся с БЖУ", () => {
  const hit = estimateOfflineFoodPhrase("сырники 3 шт");
  assert.ok(hit);
  assert.match(hit.dishName, /Сырники/);
  assert.equal(hit.pieces, 3);
  assert.equal(hit.grams, 210);
  assertAtwater(hit.kcal, hit.protein, hit.fat, hit.carbs);
  const viaVerb = heuristicRepairWriteActions("съел сырники 3 шт");
  assert.equal(viaVerb?.meals?.[0]?.grams, 210);
  assert.equal(viaVerb?.meals?.[0]?.kcal, hit.kcal);
});

test("офлайн: куриная грудка без жарки ~112 ккал/100 г", () => {
  const hit = estimateOfflineFoodPhrase("куриная грудка 150 г");
  assert.ok(hit);
  assert.equal(hit.dishName, "Куриная грудка");
  assert.equal(hit.grams, 150);
  assert.ok(hit.kcal >= 165 && hit.kcal <= 175, String(hit.kcal));
  const per100 = (hit.kcal / 150) * 100;
  assert.ok(per100 >= 110 && per100 <= 115, String(per100));
  assertAtwater(hit.kcal, hit.protein, hit.fat, hit.carbs);

  const fried = estimateOfflineFoodPhrase("куриная грудка жареная 150 г");
  assert.ok(fried);
  assert.match(fried.dishName, /жарен/i);
  assert.ok(fried.kcal > hit.kcal);
});

test("офлайн: пиво, изолят, пельмени, яйца и пицца не разъехались", () => {
  const beer = heuristicRepairWriteActions("выпил пиво 0,5");
  assert.equal(beer?.meals?.[0]?.grams, 500);
  assert.equal(beer?.meals?.[0]?.unit, "мл");
  assert.ok((beer?.meals?.[0]?.kcal ?? 0) > 150);

  const isolate = heuristicRepairWriteActions("съел протеин изолят 30 г");
  assert.equal(isolate?.meals?.[0]?.grams, 30);
  assert.ok((isolate?.meals?.[0]?.protein ?? 0) < 30);
  assert.ok((isolate?.meals?.[0]?.kcal ?? 0) > 80);

  const dumplings = heuristicRepairWriteActions("съел пельмени 15 шт");
  assert.equal(dumplings?.meals?.[0]?.grams, 225);

  const eggs = heuristicRepairWriteActions("съел 2 яйца");
  assert.equal(eggs?.meals?.[0]?.grams, 110);

  const pizza = heuristicRepairWriteActions("съел 2 куска пиццы");
  assert.equal(pizza?.meals?.[0]?.grams, 200);
});
