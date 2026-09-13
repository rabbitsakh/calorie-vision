import assert from "node:assert/strict";
import { test } from "node:test";
import { pickSpecialistPass } from "./ai/specialist-pass.ts";

test("misclassified mixed plate as package still picks plate specialist", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Стейк, картофель",
      calories: 500,
      confidence: 0.7,
      photoKind: "package",
    }),
    "plate",
  );
});

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

test("ready-meal package without barcode prefers sticker over barcode", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Рис с курицей",
      calories: 0,
      confidence: 0.55,
      photoKind: "package",
      barcode: "",
    }),
    "sticker",
  );
});

test("drink stuck at 100ml prefers drink over label", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Пиво светлое",
      calories: 42,
      carbs: 4,
      confidence: 0.8,
      photoKind: "label",
      portionGrams: 100,
      per100g: { calories: 42, protein: 0.4, fat: 0, carbs: 4 },
    }),
    "drink",
  );
});

test("empty ready-meal label prefers sticker over label table", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Салат цезарь",
      calories: 0,
      confidence: 0.5,
      photoKind: "label",
    }),
    "sticker",
  );
});

test("factory package without barcode still prefers barcode", () => {
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

test("restaurant context prefers plate before label on meal photos", () => {
  assert.equal(
    pickSpecialistPass(
      {
        dishName: "Котлета",
        calories: 320,
        confidence: 0.7,
        photoKind: "meal",
      },
      { context: "restaurant" },
    ),
    "plate",
  );
});

test("canteen tray name prefers plate before label", () => {
  assert.equal(
    pickSpecialistPass({
      dishName: "Борщ, котлета, пюре",
      calories: 600,
      confidence: 0.65,
      photoKind: "meal",
    }),
    "plate",
  );
});
