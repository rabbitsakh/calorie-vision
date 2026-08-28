import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBarcodeLookupFailure,
  classifyBarcodeLookupFailure,
  validateBarcodeClient,
} from "./barcode-lookup-client.ts";

test("validateBarcodeClient rejects short codes", () => {
  const result = validateBarcodeClient("12345");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /короткий|корректный/i);
  }
});

test("validateBarcodeClient accepts EAN-13", () => {
  const result = validateBarcodeClient("4601234567890");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.barcode, "4601234567890");
  }
});

test("classifyBarcodeLookupFailure", () => {
  assert.equal(classifyBarcodeLookupFailure(400, "Укажите корректный штрихкод"), "invalid_format");
  assert.equal(
    classifyBarcodeLookupFailure(500, "Продукт не найден по штрихкоду: нет в Open Food Facts"),
    "not_found",
  );
  assert.equal(classifyBarcodeLookupFailure(429, "Слишком много"), "rate_limit");
  assert.equal(classifyBarcodeLookupFailure(0, undefined, new TypeError("Failed to fetch")), "network");
});

test("buildBarcodeLookupFailure includes hint for not_found", () => {
  const failure = buildBarcodeLookupFailure("not_found", "4601234567890");
  assert.match(failure.message, /4601234567890/);
  assert.match(failure.hint ?? "", /этикетку/i);
});
