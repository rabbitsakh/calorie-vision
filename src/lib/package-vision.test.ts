import assert from "node:assert/strict";
import { test } from "node:test";
import { isBetterPackageResult, shouldRunPackagePass } from "./ai/package-vision.ts";

test("package pass runs when name is generic", () => {
  assert.equal(
    shouldRunPackagePass({
      dishName: "Упаковка",
      calories: 0,
      confidence: 0.5,
      photoKind: "package",
    }),
    true,
  );
});

test("package pass runs when brand and net weight missing", () => {
  assert.equal(
    shouldRunPackagePass({
      dishName: "Печенье",
      calories: 0,
      confidence: 0.6,
      photoKind: "package",
      portionGrams: 100,
    }),
    true,
  );
});

test("package pass skips when name brand and net look solid", () => {
  assert.equal(
    shouldRunPackagePass({
      dishName: "Юбилейное традиционное",
      brand: "Юбилейное",
      calories: 0,
      confidence: 0.8,
      photoKind: "package",
      portionGrams: 112,
    }),
    false,
  );
});

test("prefers candidate with brand and net weight", () => {
  assert.equal(
    isBetterPackageResult(
      { dishName: "Печенье", calories: 0, confidence: 0.5, photoKind: "package" },
      {
        dishName: "Юбилейное традиционное",
        brand: "Юбилейное",
        calories: 0,
        confidence: 0.85,
        photoKind: "package",
        portionGrams: 112,
      },
    ),
    true,
  );
});
