import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatBarcodeWebContext,
  hasTrustedBarcodeWebName,
  isJunkBarcodeWebTitle,
  normalizeBarcodeWebProductName,
  pickBarcodeWebProductName,
  type BarcodeWebEvidence,
} from "./barcode-web-lookup.ts";

test("isJunkBarcodeWebTitle rejects generic barcode tools and calorie sites", () => {
  assert.equal(isJunkBarcodeWebTitle("Barcode Lookup | UPC, EAN & ISBN Search"), true);
  assert.equal(isJunkBarcodeWebTitle("Калькулятор КБЖУ — калорийность продуктов"), true);
  assert.equal(isJunkBarcodeWebTitle("Проверка штрих-кода онлайн"), true);
  assert.equal(isJunkBarcodeWebTitle("Invalid Value — Go-UPC"), true);
});

test("isJunkBarcodeWebTitle accepts concrete product titles", () => {
  assert.equal(isJunkBarcodeWebTitle("Харбин 0,61л. 3,6% 1/12"), false);
  assert.equal(isJunkBarcodeWebTitle("Молоко Простоквашино 3.2% 930 мл"), false);
});

test("normalizeBarcodeWebProductName strips case-pack suffix", () => {
  assert.equal(
    normalizeBarcodeWebProductName("Харбин 0,61л. 3,6% 1/12"),
    "Харбин 0,61л. 3,6%",
  );
});

test("pickBarcodeWebProductName prefers product-like titles over English noise", () => {
  const evidence: BarcodeWebEvidence = {
    titles: [
      "Barcode Lookup | UPC Search",
      "Culturelle Digestive Health Probiotic",
      "Харбин 0,61л. 3,6% 1/12",
    ],
    snippets: [],
    sources: ["duckduckgo", "go-upc"],
  };
  assert.equal(pickBarcodeWebProductName(evidence), "Харбин 0,61л. 3,6%");
});

test("hasTrustedBarcodeWebName is true for go-upc and upcitemdb", () => {
  assert.equal(hasTrustedBarcodeWebName({ titles: [], snippets: [], sources: ["go-upc"] }), true);
  assert.equal(
    hasTrustedBarcodeWebName({ titles: [], snippets: [], sources: ["upcitemdb"] }),
    true,
  );
  assert.equal(
    hasTrustedBarcodeWebName({ titles: [], snippets: [], sources: ["duckduckgo"] }),
    false,
  );
});

test("formatBarcodeWebContext includes go-upc product title", () => {
  const evidence: BarcodeWebEvidence = {
    titles: ["Харбин 0,61л. 3,6% 1/12"],
    brand: "Harbin",
    snippets: ["Купить Харбин Светлое/Harbin 0,61л.*12"],
    sources: ["go-upc"],
  };
  const block = formatBarcodeWebContext(evidence);
  assert.match(block, /Харбин 0,61л/);
  assert.match(block, /Harbin/);
  assert.match(block, /go-upc/);
});
