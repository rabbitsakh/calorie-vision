import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barcodeProductToRecognition,
  lookupBarcodeCatalog,
  type BarcodeCatalogDeps,
  type BarcodeCatalogProduct,
} from "./barcode-catalog.ts";
import { packToCatalogProduct } from "./barcode-off.ts";

const GOOD = "4006381333931";
const MISREAD = "4006387333931";

function product(overrides: Partial<BarcodeCatalogProduct> = {}): BarcodeCatalogProduct {
  return {
    barcode: GOOD,
    name: "Творог 5%",
    brand: "Простоквашино",
    kcalPer100: 121,
    proteinPer100: 16,
    fatPer100: 5,
    carbsPer100: 3,
    packGrams: 180,
    source: "openfoodfacts",
    userContributed: false,
    ...overrides,
  };
}

function deps(partial: Partial<BarcodeCatalogDeps> = {}): BarcodeCatalogDeps & {
  writes: string[];
  offCalls: string[];
} {
  const writes: string[] = [];
  const offCalls: string[] = [];
  return {
    writes,
    offCalls,
    readCache: async () => null,
    writeCache: async (row) => {
      writes.push(row.barcode);
    },
    lookupOff: async (barcode) => {
      offCalls.push(barcode);
      return { status: "miss" };
    },
    lookupRuSku: () => null,
    ...partial,
  };
}

test("cache hit skips Open Food Facts", async () => {
  const harness = deps({
    readCache: async (barcode) => (barcode === GOOD ? product() : null),
  });
  const result = await lookupBarcodeCatalog(GOOD, harness);
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.origin, "cache");
    assert.equal(result.product.name, "Творог 5%");
  }
  assert.deepEqual(harness.offCalls, []);
  assert.deepEqual(harness.writes, []);
});

test("Open Food Facts hit is stored under the scanned code", async () => {
  const harness = deps({
    lookupOff: async (barcode) => {
      harness.offCalls.push(barcode);
      if (barcode !== GOOD) return { status: "miss" };
      return { status: "hit", product: product() };
    },
  });
  const result = await lookupBarcodeCatalog(` ${GOOD} `, harness);
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.origin, "openfoodfacts");
  assert.deepEqual(harness.writes, [GOOD]);
});

test("a repaired code found in the cache is not sent to the network", async () => {
  const harness = deps({
    readCache: async (barcode) => (barcode === GOOD ? product() : null),
  });
  const result = await lookupBarcodeCatalog(MISREAD, harness);
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.origin, "cache");
  assert.deepEqual(harness.offCalls, []);
});

test("an Open Food Facts repair is cached for both codes", async () => {
  const scanned = "4006381333939";
  const harness = deps({
    lookupOff: async (barcode) => {
      harness.offCalls.push(barcode);
      if (barcode === GOOD) return { status: "hit", product: product() };
      return { status: "miss" };
    },
  });
  const result = await lookupBarcodeCatalog(scanned, harness);
  assert.equal(result.status, "found");
  assert.deepEqual(harness.writes, [GOOD, scanned]);
  assert.ok(harness.offCalls.includes(GOOD));
});

test("offline Open Food Facts falls back to the local RU list", async () => {
  const local = product({ source: "ru-sku", barcode: GOOD, packGrams: 180 });
  const harness = deps({
    lookupOff: async (barcode) => {
      harness.offCalls.push(barcode);
      return { status: "unavailable" };
    },
    lookupRuSku: (barcode) => (barcode === GOOD ? local : null),
  });
  const result = await lookupBarcodeCatalog(GOOD, harness);
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.origin, "ru-sku");
  assert.deepEqual(harness.writes, [GOOD]);
  assert.equal(harness.offCalls.length, 1);
});

test("offline with no local hint stays offline", async () => {
  const harness = deps({
    lookupOff: async () => ({ status: "unavailable" }),
  });
  const result = await lookupBarcodeCatalog(GOOD, harness);
  assert.equal(result.status, "offline");
  assert.deepEqual(harness.writes, []);
});

test("a confirmed miss is not_found", async () => {
  const result = await lookupBarcodeCatalog(GOOD, deps());
  assert.equal(result.status, "not_found");
});

test("short codes are invalid", async () => {
  const harness = deps();
  const result = await lookupBarcodeCatalog("12345", harness);
  assert.equal(result.status, "invalid");
  assert.deepEqual(harness.offCalls, []);
});

test("recognition uses the pack as the default portion and keeps per 100 g", () => {
  const recognition = barcodeProductToRecognition(product());
  assert.equal(recognition.portionGrams, 180);
  assert.equal(recognition.per100g?.calories, 121);
  assert.equal(recognition.calories, Math.round(121 * 1.8));
  assert.equal(recognition.dishName, "Простоквашино Творог 5%");
  assert.equal(recognition.source, "openfoodfacts-barcode");
  assert.equal(recognition.photoKind, "barcode");

  const large = barcodeProductToRecognition(product({ packGrams: 1000, userContributed: true, source: "user" }));
  assert.equal(large.portionGrams, 100);
  assert.equal(large.calories, 121);
  assert.equal(large.source, "barcode-user");
});

test("packToCatalogProduct keeps the net weight and drops the brand prefix", () => {
  const mapped = packToCatalogProduct(
    {
      dishName: "Простоквашино Творог 5%",
      brand: "Простоквашино",
      calories: 218,
      portionGrams: 180,
      per100g: { calories: 121, protein: 16, fat: 5, carbs: 3 },
      packGrams: 180,
      explicitPackGrams: true,
      barcode: GOOD,
      imageUrl: "https://images.openfoodfacts.org/images/products/460/kefir.jpg",
    },
    GOOD,
  );
  assert.equal(mapped?.name, "Творог 5%");
  assert.equal(mapped?.brand, "Простоквашино");
  assert.equal(mapped?.kcalPer100, 121);
  assert.equal(mapped?.packGrams, 180);
  assert.equal(mapped?.userContributed, false);
  assert.equal(mapped?.source, "openfoodfacts");
});
