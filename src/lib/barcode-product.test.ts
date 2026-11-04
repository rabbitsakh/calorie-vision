import assert from "node:assert/strict";
import { test } from "node:test";
import { computeEanCheckDigit } from "./barcode.ts";
import {
  defaultPortionFromPack,
  parseUserBarcodeProduct,
  per100DraftFromRecognition,
} from "./barcode-product.ts";
import type { FoodRecognitionResult } from "./food-types.ts";

const EAN13 = "4006381333931";

test("default portion is the net weight, and unknown weight stays empty", () => {
  assert.equal(defaultPortionFromPack(undefined), undefined);
  assert.equal(defaultPortionFromPack(180), 180);
  assert.equal(defaultPortionFromPack(500), 500);
  assert.equal(defaultPortionFromPack(1000), 1000);
});

test("parseUserBarcodeProduct normalizes spacing and keeps per-100 g macros", () => {
  const parsed = parseUserBarcodeProduct({
    barcode: "4006 3813 33931",
    name: "  Творог 5% ",
    brand: "Простоквашино",
    kcalPer100: "121",
    proteinPer100: "16,3",
    fatPer100: 5,
    carbsPer100: 3,
    packGrams: "180",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.product.barcode, EAN13);
  assert.equal(parsed.product.name, "Творог 5%");
  assert.equal(parsed.product.brand, "Простоквашино");
  assert.equal(parsed.product.kcalPer100, 121);
  assert.equal(parsed.product.proteinPer100, 16.3);
  assert.equal(parsed.product.packGrams, 180);
  assert.equal(parsed.product.userContributed, true);
  assert.equal(parsed.product.source, "user");
});

test("parseUserBarcodeProduct accepts EAN-8 and UPC-A checksums", () => {
  const ean8 = `9638507${computeEanCheckDigit("9638507")}`;
  const upcBody = "03600029145";
  const upc = `${upcBody}${computeEanCheckDigit(upcBody)}`;
  assert.equal(ean8.length, 8);
  assert.equal(upc.length, 12);

  const fromEan8 = parseUserBarcodeProduct({
    barcode: ean8,
    name: "Батончик",
    kcalPer100: 400,
    proteinPer100: 6,
    fatPer100: 20,
    carbsPer100: 50,
  });
  const fromUpc = parseUserBarcodeProduct({
    barcode: upc,
    name: "Соус",
    kcalPer100: 90,
    proteinPer100: 1,
    fatPer100: 0,
    carbsPer100: 20,
  });
  assert.equal(fromEan8.ok, true);
  assert.equal(fromUpc.ok, true);
});

test("parseUserBarcodeProduct rejects a bad checksum, empty name, and wild macros", () => {
  assert.equal(
    parseUserBarcodeProduct({
      barcode: "4006381333939",
      name: "Творог",
      kcalPer100: 100,
      proteinPer100: 1,
      fatPer100: 1,
      carbsPer100: 1,
    }).ok,
    false,
  );
  const noName = parseUserBarcodeProduct({
    barcode: EAN13,
    name: " ",
    kcalPer100: 100,
    proteinPer100: 1,
    fatPer100: 1,
    carbsPer100: 1,
  });
  assert.equal(noName.ok, false);
  const hot = parseUserBarcodeProduct({
    barcode: EAN13,
    name: "Сахар",
    kcalPer100: 5000,
    proteinPer100: 0,
    fatPer100: 0,
    carbsPer100: 100,
  });
  assert.equal(hot.ok, false);
  if (!hot.ok) assert.match(hot.error, /калори/i);
});

test("per100DraftFromRecognition scales a portion total back to 100 g", () => {
  const result: FoodRecognitionResult = {
    dishName: "Простоквашино Творог 5%",
    brand: "Простоквашино",
    calories: 242,
    protein: 32,
    fat: 10,
    carbs: 6,
    portionGrams: 200,
    confidence: 0.8,
    photoKind: "label",
  };
  const draft = per100DraftFromRecognition(result);
  assert.ok(draft);
  assert.equal(draft?.name, "Творог 5%");
  assert.equal(draft?.brand, "Простоквашино");
  assert.equal(draft?.kcalPer100, 121);
  assert.equal(draft?.proteinPer100, 16);
  assert.equal(draft?.packGrams, "200");
});

test("per100DraftFromRecognition prefers an explicit per-100 g block", () => {
  const draft = per100DraftFromRecognition({
    dishName: "Кефир",
    calories: 112,
    portionGrams: 200,
    per100g: { calories: 56, protein: 2.9, fat: 3.2, carbs: 4 },
    confidence: 0.9,
  });
  assert.equal(draft?.kcalPer100, 56);
  assert.equal(draft?.proteinPer100, 2.9);
  assert.equal(draft?.packGrams, "200");
});
