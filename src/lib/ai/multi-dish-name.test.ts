import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeMultiDishName } from "./multi-dish-name.ts";

test("looksLikeMultiDishName detects set/combo titles", () => {
  assert.equal(looksLikeMultiDishName("Суши сет"), true);
  assert.equal(looksLikeMultiDishName("Сет роллов"), true);
  assert.equal(looksLikeMultiDishName("Комбо обед"), true);
  assert.equal(looksLikeMultiDishName("Бизнес-ланч"), true);
  assert.equal(looksLikeMultiDishName("Стейк"), false);
});
