import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupRuNutritionTable } from "./ru-nutrition-lookup.ts";

test("lookupRuNutritionTable matches borscht", () => {
  const hit = lookupRuNutritionTable("Домашний борщ");
  assert.ok(hit);
  assert.match(hit!.dishName, /Борщ/i);
  assert.ok(hit!.calories >= 200);
});

test("lookupRuNutritionTable matches buckwheat synonym", () => {
  const hit = lookupRuNutritionTable("Гречка с маслом");
  assert.ok(hit);
  assert.match(hit!.dishName, /Греч/i);
});

test("lookupRuNutritionTable returns null for unknown dish", () => {
  assert.equal(lookupRuNutritionTable("xyz"), null);
});
