import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupRuSkuCache } from "./barcode-ru-sku-cache.ts";

test("finds curated RU SKU by barcode", () => {
  const hit = lookupRuSkuCache("4607025390055");
  assert.ok(hit);
  assert.match(hit!.name, /Творог/i);
});

test("returns null for unknown barcode", () => {
  assert.equal(lookupRuSkuCache("0000000000000"), null);
});
