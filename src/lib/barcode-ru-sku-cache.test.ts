import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupRuSkuCache, RU_SKU_CACHE } from "./barcode-ru-sku-cache.ts";

test("finds curated RU SKU by barcode", () => {
  const hit = lookupRuSkuCache("4607025390055");
  assert.ok(hit);
  assert.match(hit!.name, /Творог/i);
});

test("returns null for unknown barcode", () => {
  assert.equal(lookupRuSkuCache("0000000000000"), null);
});

test("SKU cache has unique barcodes and enough entries", () => {
  assert.ok(RU_SKU_CACHE.length >= 20, `expected >=20 SKUs, got ${RU_SKU_CACHE.length}`);
  const codes = RU_SKU_CACHE.map((row) => row.barcode);
  assert.equal(new Set(codes).size, codes.length, "barcode codes must be unique");
  for (const row of RU_SKU_CACHE) {
    assert.match(row.barcode, /^\d{8,14}$/);
    assert.ok(row.name.trim().length > 0);
    if (row.kcalPer100 !== undefined) {
      assert.ok(Number.isFinite(row.kcalPer100));
      assert.ok(row.kcalPer100 >= 0);
      assert.ok(row.kcalPer100 < 900);
    }
  }
});

test("normalizes non-digit characters in barcode lookup", () => {
  const hit = lookupRuSkuCache("460-7025-390055");
  assert.ok(hit);
  assert.equal(hit!.barcode, "4607025390055");
});
