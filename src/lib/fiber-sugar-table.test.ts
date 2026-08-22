import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupFiberSugarTable } from "./fiber-sugar-table.ts";

test("lookupFiberSugarTable scales apple per 100g to portion", () => {
  const hit = lookupFiberSugarTable("Яблоко", 180);
  assert.ok(hit);
  assert.equal(hit?.fiber, 4.3);
  assert.equal(hit?.sugar, 18);
});

test("lookupFiberSugarTable finds yogurt sugar without fiber call", () => {
  const hit = lookupFiberSugarTable("Греческий йогурт", 150);
  assert.equal(hit?.fiber, 0);
  assert.equal(hit?.sugar, 6);
});

test("lookupFiberSugarTable returns null for unknown dish", () => {
  assert.equal(lookupFiberSugarTable("Неизвестное блюдо XYZ"), null);
});
