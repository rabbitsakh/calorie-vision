import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSpecialistPass } from "./ai/specialist-pass.ts";

test("package without barcode digits prefers barcode specialist only", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Батончик",
      calories: 0,
      confidence: 0.6,
      photoKind: "package",
    }),
    "barcode",
  );
});

test("package with barcode and weak name uses package specialist", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Упаковка",
      calories: 0,
      confidence: 0.5,
      photoKind: "package",
      barcode: "4600605023124",
    }),
    "package",
  );
});

test("does not cascade sticker on factory package", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Протеин бар",
      brand: "Bombbar",
      calories: 180,
      protein: 20,
      fat: 8,
      carbs: 10,
      confidence: 0.8,
      photoKind: "package",
      portionGrams: 60,
      barcode: "4600605023124",
    }),
    null,
  );
});

test("plate list without items picks plate", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Стейк, картофель",
      calories: 500,
      confidence: 0.7,
      photoKind: "meal",
    }),
    "plate",
  );
});
