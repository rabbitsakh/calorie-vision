import assert from "node:assert/strict";
import { test } from "node:test";
import {
  looksLikeCanteenTrayName,
  shouldForcePlateBeforeRetry,
  shouldRunPlatePass,
} from "./plate-vision.ts";

test("looksLikeCanteenTrayName detects tray wording and dense lists", () => {
  assert.equal(looksLikeCanteenTrayName("Комплексный обед"), true);
  assert.equal(looksLikeCanteenTrayName("Борщ, котлета, пюре"), true);
  assert.equal(looksLikeCanteenTrayName("Борщ"), false);
});

test("canteen tray name triggers plate pass", () => {
  assert.equal(
    shouldRunPlatePass({
      dishName: "Поднос: суп, салат, гарнир",
      calories: 500,
      confidence: 0.6,
      photoKind: "meal",
    }),
    true,
  );
  assert.equal(
    shouldForcePlateBeforeRetry({
      dishName: "Поднос комплексный",
      calories: 400,
      confidence: 0.6,
      photoKind: "meal",
    }),
    true,
  );
});
