import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dishImageLookupQueries,
  mealNeedsImage,
  normalizeDishName,
  shouldSkipDishName,
} from "./meal-image.ts";

test("normalizes dish names so the same meal reuses one photo", () => {
  assert.equal(normalizeDishName("Борщ  с мясом"), normalizeDishName("борщ с мясом"));
  assert.equal(normalizeDishName("Ёжик"), "ежик");
});

test("treats missing and remote hotlinked photos as needing a cached image", () => {
  assert.equal(mealNeedsImage(null), true);
  assert.equal(mealNeedsImage(""), true);
  assert.equal(mealNeedsImage("https://upload.wikimedia.org/wikipedia/commons/a.jpg"), true);
  assert.equal(mealNeedsImage("/api/uploads/abc"), false);
});

test("shouldSkipDishName ignores failed recognition labels", () => {
  assert.equal(shouldSkipDishName("Не удалось распознать"), true);
  assert.equal(shouldSkipDishName("Борщ"), false);
});

test("dishImageLookupQueries shortens long product names", () => {
  const queries = dishImageLookupQueries("Хрустящие банановые подушечки");
  assert.ok(queries.includes("Хрустящие банановые подушечки"));
  assert.ok(queries.some((q) => /банановые подушечки/i.test(q)));
  assert.ok(queries.some((q) => normalizeDishName(q) === "подушечки" || /подушечк/i.test(q)));
  assert.ok(queries.length >= 2);
  assert.ok(queries.length <= 5);
});
