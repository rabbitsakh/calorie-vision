import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeHtmlEntities } from "./html-text.ts";

test("decodes HTML entities in food names", () => {
  assert.equal(
    decodeHtmlEntities('ООО &quot;КДВ Воронеж&quot; Zebra'),
    'ООО "КДВ Воронеж" Zebra',
  );
  assert.equal(decodeHtmlEntities("Pistachios &amp; Caramel"), "Pistachios & Caramel");
  assert.equal(decodeHtmlEntities("O&#39;Henry"), "O'Henry");
  assert.equal(decodeHtmlEntities("A &amp;quot;B&amp;quot;"), 'A "B"');
  assert.equal(decodeHtmlEntities("борщ"), "борщ");
});
