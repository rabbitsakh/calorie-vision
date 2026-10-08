import assert from "node:assert/strict";
import { test } from "node:test";
import {
  brandedLookupQueries,
  parseFoodQuery,
  productLookupPhrase,
} from "./food-query-parse.ts";

test("parseFoodQuery: generic cottage cheese", () => {
  const q = parseFoodQuery("творог обезжиренный");
  assert.equal(q.mode, "generic");
  assert.equal(q.brand, null);
  assert.equal(q.brandOnly, false);
  assert.ok(q.flags.fatFree);
  assert.match(q.product, /творог/);
});

test("parseFoodQuery: branded cottage cheese", () => {
  const q = parseFoodQuery("творог Простоквашино");
  assert.equal(q.mode, "branded");
  assert.equal(q.brand, "Простоквашино");
  assert.equal(q.brandOnly, false);
  assert.match(q.product, /творог/);
});

test("parseFoodQuery: brand only", () => {
  const q = parseFoodQuery("простоквашино");
  assert.equal(q.mode, "branded");
  assert.equal(q.brand, "Простоквашино");
  assert.equal(q.brandOnly, true);
});

test("parseFoodQuery: Latin brand milk", () => {
  const q = parseFoodQuery("молоко Bobbbar");
  assert.equal(q.mode, "branded");
  assert.equal(q.brand, "Bombbar");
  assert.match(q.product, /молоко/);
});

test("parseFoodQuery: fat percent stays generic without brand", () => {
  const q = parseFoodQuery("молоко 2,5%");
  assert.equal(q.mode, "generic");
  assert.deepEqual(q.fatPercents, [2.5]);
});

test("productLookupPhrase and brandedLookupQueries", () => {
  const generic = parseFoodQuery("творог обезжиренный");
  assert.match(productLookupPhrase(generic), /творог/);

  const branded = parseFoodQuery("творог простоквашино 5%");
  const queries = brandedLookupQueries(branded);
  assert.ok(queries.some((q) => /простоквашино/i.test(q)));
  assert.ok(queries.some((q) => /творог/i.test(q)));
});
