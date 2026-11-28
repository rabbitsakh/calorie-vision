import assert from "node:assert/strict";
import { test } from "node:test";
import { leavesCount, pluralLeaves } from "./russian-text.ts";

test("листики склоняются", () => {
  assert.equal(pluralLeaves(1), "листик");
  assert.equal(pluralLeaves(2), "листика");
  assert.equal(pluralLeaves(4), "листика");
  assert.equal(pluralLeaves(5), "листиков");
  assert.equal(pluralLeaves(11), "листиков");
  assert.equal(pluralLeaves(21), "листик");
  assert.equal(pluralLeaves(22), "листика");
  assert.equal(leavesCount(10), "10 листиков");
});
