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
