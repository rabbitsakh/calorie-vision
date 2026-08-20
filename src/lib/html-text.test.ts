import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeHtmlEntities, mergeDecodedFoodStats } from "./html-text.ts";

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

test("merges stats rows that differ only by HTML entities", () => {
  const merged = mergeDecodedFoodStats(
    [
      { dishName: 'ООО &quot;КДВ Воронеж&quot; Zebra', count: 2, avgCalories: 200 },
      { dishName: 'ООО "КДВ Воронеж" Zebra', count: 1, avgCalories: 230 },
      { dishName: "Борщ", count: 3, avgCalories: 150 },
    ],
    8,
  );

  assert.equal(merged[0]?.dishName, "Борщ");
  assert.equal(merged[1]?.dishName, 'ООО "КДВ Воронеж" Zebra');
  assert.equal(merged[1]?.count, 3);
  assert.equal(merged[1]?.avgCalories, 210);
});
