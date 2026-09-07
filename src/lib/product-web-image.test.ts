import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProductWebImageQueries,
  isDownloadableProductImageUrl,
  isRejectedWebImageHit,
} from "./product-web-image.ts";

test("buildProductWebImageQueries always adds packaging/product context", () => {
  const qs = buildProductWebImageQueries("конфеты Маска");
  assert.ok(qs.some((q) => /упаковка/i.test(q)));
  assert.ok(qs.some((q) => /конфеты/i.test(q)));
  assert.ok(!qs.some((q) => /^маска$/i.test(q.trim())));
});

test("buildProductWebImageQueries includes Bombbar packaging forms", () => {
  const qs = buildProductWebImageQueries("Bombbar Батончик глазированный", "Bombbar");
  assert.ok(qs.length >= 2);
  assert.ok(qs.every((q) => /bombbar|батончик|упаковка|продукт|купить|packaging/i.test(q)));
});

test("rejects portrait/costume web hits", () => {
  assert.equal(isRejectedWebImageHit("Portrait of a man", "https://cdn.example/a.jpg"), true);
  assert.equal(isRejectedWebImageHit("Carnival costume mask", "https://cdn.example/b.jpg"), true);
  assert.equal(
    isRejectedWebImageHit("Bombbar protein bar packaging", "https://cdn.shop/bombbar.jpg"),
    false,
  );
});

test("isDownloadableProductImageUrl blocks private hosts and http", () => {
  assert.equal(isDownloadableProductImageUrl("https://cdn.example.com/a.jpg"), true);
  assert.equal(isDownloadableProductImageUrl("http://cdn.example.com/a.jpg"), false);
  assert.equal(isDownloadableProductImageUrl("https://127.0.0.1/a.jpg"), false);
  assert.equal(isDownloadableProductImageUrl("https://192.168.1.1/a.jpg"), false);
  assert.equal(isDownloadableProductImageUrl("https://cdn.example.com/a.svg"), false);
});
