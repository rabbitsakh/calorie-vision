import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dishImageLookupQueries,
  looksLikeEggDishName,
  looksLikeProduceName,
  looksLikeWikiFoodFallbackName,
  mealNeedsImage,
  normalizeDishName,
  shouldSkipDishName,
  stripFreshnessAdjectives,
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
  assert.ok(queries.some((q) => /подушечк/i.test(q)));
  assert.ok(queries.length >= 2);
  assert.ok(queries.length <= 5);
});

test("dishImageLookupQueries does not use bare brand tokens like Маска", () => {
  const queries = dishImageLookupQueries("конфеты Маска");
  assert.ok(queries.some((q) => /конфеты/i.test(q)));
  assert.ok(!queries.some((q) => normalizeDishName(q) === "маска"));
});

test("stripFreshnessAdjectives drops свежий", () => {
  assert.equal(stripFreshnessAdjectives("Сельдерей свежий"), "Сельдерей");
  assert.equal(stripFreshnessAdjectives("свежие огурцы"), "огурцы");
});

test("looksLikeProduceName detects celery and vegetables", () => {
  assert.equal(looksLikeProduceName("Сельдерей свежий"), true);
  assert.equal(looksLikeProduceName("борщ с мясом"), false);
});

test("looksLikeEggDishName and wiki fallback for boiled egg", () => {
  assert.equal(looksLikeEggDishName("Вареное яйцо"), true);
  assert.equal(looksLikeEggDishName("яйцо в мешочек"), false);
  assert.equal(looksLikeWikiFoodFallbackName("Вареное яйцо"), true);
  const queries = dishImageLookupQueries("Вареное яйцо");
  assert.ok(queries.some((q) => /hard-boiled egg/i.test(q)));
  assert.ok(queries.some((q) => /вареное яйцо/i.test(q)));
});

test("dishImageLookupQueries prefers bare сельдерей and celery synonym", () => {
  const queries = dishImageLookupQueries("Сельдерей свежий");
  assert.ok(queries.some((q) => normalizeDishName(q) === "сельдерей"));
  assert.ok(queries.some((q) => /celery/i.test(q)));
  assert.ok(!queries.every((q) => /свежий/i.test(q)));
});
