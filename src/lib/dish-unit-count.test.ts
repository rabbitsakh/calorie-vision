import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeCountedDishName, parseDishUnitCount } from "./dish-unit-count.ts";

test("parseDishUnitCount handles 2× and word forms", () => {
  assert.deepEqual(parseDishUnitCount("2× батончик протеиновый"), {
    count: 2,
    unitName: "батончик протеиновый",
  });
  assert.deepEqual(parseDishUnitCount("два протеиновых батончика"), {
    count: 2,
    unitName: "протеиновых батончика",
  });
  assert.deepEqual(parseDishUnitCount("батончик (2 шт)"), {
    count: 2,
    unitName: "батончик",
  });
  assert.deepEqual(parseDishUnitCount("3 йогурта"), {
    count: 3,
    unitName: "йогурта",
  });
  assert.equal(parseDishUnitCount("батончик протеиновый"), null);
  assert.equal(looksLikeCountedDishName("2 батончика"), true);
});
