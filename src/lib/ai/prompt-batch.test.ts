import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFiberSugarBatchLookupPrompt } from "./prompt.ts";

test("batch fiber/sugar prompt lists all dishes", () => {
  const prompt = buildFiberSugarBatchLookupPrompt([
    { dishName: "Борщ", portionGrams: 300 },
    { dishName: "Хлеб белый", portionGrams: 50 },
  ]);
  assert.match(prompt, /Борщ/);
  assert.match(prompt, /Хлеб белый/);
  assert.match(prompt, /JSON-массив/i);
});
