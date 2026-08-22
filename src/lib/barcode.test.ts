import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeEanCheckDigit,
  hasValidEanChecksum,
  normalizeBarcode,
  pickDecodedBarcode,
  repairBarcodeCandidates,
} from "./barcode.ts";

test("normalizes spaced EAN-13 barcodes", () => {
  assert.equal(normalizeBarcode("460 0605 023124"), "4600605023124");
});

test("rejects too-short codes", () => {
  assert.equal(normalizeBarcode("12345"), null);
});

test("accepts a known EAN-13 checksum", () => {
  assert.equal(hasValidEanChecksum("4006381333931"), true);
});

test("computeEanCheckDigit matches known EAN-13", () => {
  assert.equal(computeEanCheckDigit("400638133393"), 1);
});

test("repairBarcodeCandidates fixes checksum digit", () => {
  const repaired = repairBarcodeCandidates("4006381333939");
  assert.ok(repaired.includes("4006381333931"));
});

test("repairBarcodeCandidates fixes single OCR digit", () => {
  const corrupted = "4006387333931";
  assert.equal(hasValidEanChecksum(corrupted), false);
  const repaired = repairBarcodeCandidates(corrupted);
  assert.ok(repaired.includes("4006381333931"));
});

test("picks the first valid decoded barcode", () => {
  assert.equal(pickDecodedBarcode(["abc", "460 0605 023124", "4006381333931"]), "4600605023124");
  assert.equal(pickDecodedBarcode(["nope", "12"]), null);
});
