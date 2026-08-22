import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeVisionBarcode, shouldRunBarcodePass } from "./ai/barcode-vision.ts";

test("strips barcodes invented on plated meals", () => {
  const cleaned = sanitizeVisionBarcode({
    dishName: "Борщ",
    calories: 200,
    confidence: 0.8,
    photoKind: "meal",
    barcode: "4601234567890",
  });
  assert.equal(cleaned.barcode, undefined);
});

test("normalizes package barcodes", () => {
  const cleaned = sanitizeVisionBarcode({
    dishName: "Молоко",
    calories: 0,
    confidence: 0.7,
    photoKind: "package",
    barcode: "460 0605 023124",
  });
  assert.equal(cleaned.barcode, "4600605023124");
});

test("barcode pass skips drink bottles on package front", () => {
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Coca-Cola Zero",
      brand: "Coca-Cola",
      calories: 1,
      confidence: 0.7,
      photoKind: "package",
      portionGrams: 100,
    }),
    false,
  );
});

test("barcode pass also runs for package without digits", () => {
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Батончик",
      calories: 0,
      confidence: 0.6,
      photoKind: "package",
      barcode: "",
    }),
    true,
  );
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Батончик",
      calories: 0,
      confidence: 0.6,
      photoKind: "package",
      barcode: "4600605023124",
    }),
    false,
  );
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Стейк, картофель",
      calories: 500,
      confidence: 0.7,
      photoKind: "package",
    }),
    false,
  );
});
