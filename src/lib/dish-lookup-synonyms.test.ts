import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupQueriesForName } from "./dish-lookup-synonyms.ts";

test("lookupQueriesForName returns original and synonym", () => {
  const queries = lookupQueriesForName("гречка", null, 2);
  assert.equal(queries[0], "гречка");
  assert.ok(queries.some((q) => q.includes("гречневая")));
});

test("lookupQueriesForName respects limit", () => {
  assert.equal(lookupQueriesForName("борщ домашний", "борщ", 2).length, 2);
});

test("lookupQueriesForName adds milk synonym", () => {
  const queries = lookupQueriesForName("молоко", null, 2);
  assert.ok(queries.some((q) => q.includes("2.5") || q.includes("2,5")));
});

test("lookupQueriesForName expands typos and brands", () => {
  const typo = lookupQueriesForName("боршь", null, 2);
  assert.ok(typo.some((q) => q.includes("борщ")));

  const brand = lookupQueriesForName("дошик", null, 2);
  assert.ok(brand.some((q) => q.toLowerCase().includes("доширак")));

  const alcohol = lookupQueriesForName("пиво", null, 2);
  assert.ok(alcohol.some((q) => q.includes("светлое")));
});
