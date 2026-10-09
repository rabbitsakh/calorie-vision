import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildProductWebImageQueries,
  isDownloadableProductImageUrl,
  isRejectedWebImageHit,
  isUnexpectedBrandPackHit,
} from "./product-web-image.ts";

test("buildProductWebImageQueries: generic staple avoids packaging bias", () => {
  const qs = buildProductWebImageQueries("творог обезжиренный 0%");
  assert.ok(qs.some((q) => /миске|порция|еда|food/i.test(q)));
  assert.ok(!qs.some((q) => /упаковка/i.test(q)));
});

test("buildProductWebImageQueries includes Bombbar packaging forms", () => {
  const qs = buildProductWebImageQueries("Bombbar Батончик глазированный", "Bombbar");
  assert.ok(qs.length >= 2);
  assert.ok(qs.every((q) => /bombbar|батончик|упаковка|продукт|купить|packaging/i.test(q)));
});

test("isUnexpectedBrandPackHit drops pack brands on generic queries", () => {
  assert.equal(isUnexpectedBrandPackHit("Творог Серышевский 0%", undefined), true);
  assert.equal(isUnexpectedBrandPackHit("Творог Чернышевский обезжиренный", undefined), true);
  assert.equal(isUnexpectedBrandPackHit("Творог в миске", undefined), false);
  assert.equal(isUnexpectedBrandPackHit("Творог Серышевский", "Серышевский"), false);
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
