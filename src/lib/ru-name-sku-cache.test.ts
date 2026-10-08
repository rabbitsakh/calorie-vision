import assert from "node:assert/strict";
import { test } from "node:test";
import { listRuNameSkuByBrand, lookupRuNameSkuCache } from "./ru-name-sku-cache.ts";

test("lookupRuNameSkuCache finds Prostokvashino cottage cheese", () => {
  const hit = lookupRuNameSkuCache("Простоквашино", "творог 5%");
  assert.ok(hit);
  assert.match(hit!.dishName, /творог/i);
  assert.equal(hit!.brand, "Простоквашино");
});

test("listRuNameSkuByBrand returns several SKUs", () => {
  const list = listRuNameSkuByBrand("Простоквашино", 5);
  assert.ok(list.length >= 2);
});
