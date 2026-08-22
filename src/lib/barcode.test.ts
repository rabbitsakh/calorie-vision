import assert from "node:assert/strict";
import { test } from "node:test";
import { hasValidEanChecksum, normalizeBarcode, pickDecodedBarcode } from "./barcode.ts";

test("normalizes spaced EAN-13 barcodes", () => {
  assert.equal(normalizeBarcode("460 0605 023124"), "4600605023124");
});

test("rejects too-short codes", () => {
  assert.equal(normalizeBarcode("12345"), null);
});

test("accepts a known EAN-13 checksum", () => {
  assert.equal(hasValidEanChecksum("4006381333931"), true);
});

test("picks the first valid decoded barcode", () => {
  assert.equal(pickDecodedBarcode(["abc", "460 0605 023124", "4006381333931"]), "4600605023124");
  assert.equal(pickDecodedBarcode(["nope", "12"]), null);
});
