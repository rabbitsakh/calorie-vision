import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMetrikaId, shouldTrackMetrikaPath } from "./yandex-metrika.ts";

test("accepts numeric Metrika counter ids", () => {
  assert.equal(parseMetrikaId("12345678"), "12345678");
  assert.equal(parseMetrikaId(" 98765432 "), "98765432");
});

test("rejects empty and non-numeric ids", () => {
  assert.equal(parseMetrikaId(""), null);
  assert.equal(parseMetrikaId(undefined), null);
  assert.equal(parseMetrikaId("ym_123"), null);
  assert.equal(parseMetrikaId("<script>"), null);
});

test("skips admin paths for Metrika hits", () => {
  assert.equal(shouldTrackMetrikaPath("/"), true);
  assert.equal(shouldTrackMetrikaPath("/ration"), true);
  assert.equal(shouldTrackMetrikaPath("/login"), true);
  assert.equal(shouldTrackMetrikaPath("/admin"), false);
  assert.equal(shouldTrackMetrikaPath("/admin/users"), false);
});
