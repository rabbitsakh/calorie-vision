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

test("barcode pass runs when kind is barcode but digits missing", () => {
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Продукт",
      calories: 0,
      confidence: 0.5,
      photoKind: "barcode",
      barcode: "",
    }),
    true,
  );
  assert.equal(
    shouldRunBarcodePass({
      dishName: "Продукт",
      calories: 0,
      confidence: 0.5,
      photoKind: "barcode",
      barcode: "4600605023124",
    }),
    false,
  );
});
