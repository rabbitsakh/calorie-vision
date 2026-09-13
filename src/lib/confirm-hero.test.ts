import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveConfirmHeroSrc } from "./confirm-hero.ts";

test("resolveConfirmHeroSrc prefers upload path over blob preview", () => {
  const src = resolveConfirmHeroSrc("/api/uploads/abc123", "blob:http://localhost/x");
  assert.match(src, /\/api\/uploads\/abc123/);
  assert.doesNotMatch(src, /^blob:/);
});

test("resolveConfirmHeroSrc falls back to preview when path empty", () => {
  assert.equal(resolveConfirmHeroSrc("", "blob:http://localhost/preview"), "blob:http://localhost/preview");
  assert.equal(resolveConfirmHeroSrc("   ", "https://cdn.example/meal.jpg"), "https://cdn.example/meal.jpg");
});

test("resolveConfirmHeroSrc returns empty when both missing", () => {
  assert.equal(resolveConfirmHeroSrc(""), "");
  assert.equal(resolveConfirmHeroSrc("  ", "  "), "");
});
