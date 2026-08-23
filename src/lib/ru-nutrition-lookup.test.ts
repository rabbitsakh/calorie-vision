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

test("lookupRuNutritionTable matches milk not coffee latte", () => {
  const hit = lookupRuNutritionTable("молоко");
  assert.ok(hit);
  assert.match(hit!.dishName, /Молоко/i);
  assert.doesNotMatch(hit!.dishName, /Кофе|латте/i);
});

test("lookupRuNutritionTable matches milk with fat percent", () => {
  const hit = lookupRuNutritionTable("Молоко 3.2%");
  assert.ok(hit);
  assert.match(hit!.dishName, /Молоко/i);
});

test("lookupRuNutritionTable still matches coffee queries", () => {
  const hit = lookupRuNutritionTable("кофе");
  assert.ok(hit);
  assert.match(hit!.dishName, /Кофе/i);
});

test("lookupRuNutritionTable does not match cheese to syrniki", () => {
  const hit = lookupRuNutritionTable("сыр");
  assert.ok(hit);
  assert.match(hit!.dishName, /Сыр/i);
  assert.doesNotMatch(hit!.dishName, /Сырник/i);
});
