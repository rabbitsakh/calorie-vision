import assert from "node:assert/strict";
import { test } from "node:test";
import { pluralDays } from "./russian-text.ts";

test("pluralDays handles Russian day forms", () => {
  assert.equal(pluralDays(1), "день");
  assert.equal(pluralDays(2), "дня");
  assert.equal(pluralDays(4), "дня");
  assert.equal(pluralDays(5), "дней");
  assert.equal(pluralDays(11), "дней");
  assert.equal(pluralDays(21), "день");
  assert.equal(pluralDays(22), "дня");
  assert.equal(pluralDays(25), "дней");
});
