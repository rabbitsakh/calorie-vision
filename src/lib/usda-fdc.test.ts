import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resetUsdaSearchCacheForTests,
  searchUsdaFoodDataCentral,
} from "./usda-fdc.ts";

const originalFetch = globalThis.fetch;

test("USDA search returns null without API key", async () => {
  resetUsdaSearchCacheForTests();
  const prev = process.env.USDA_FDC_API_KEY;
  delete process.env.USDA_FDC_API_KEY;
  delete process.env.FDC_API_KEY;
  assert.equal(await searchUsdaFoodDataCentral("apple"), null);
  if (prev) process.env.USDA_FDC_API_KEY = prev;
});

test("USDA search parses FDC response", async () => {
  resetUsdaSearchCacheForTests();
  process.env.USDA_FDC_API_KEY = "test-key";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            description: "Apple, raw",
            foodNutrients: [
              { nutrientId: 1008, value: 52 },
              { nutrientId: 1003, value: 0.3 },
              { nutrientId: 1005, value: 14 },
              { nutrientId: 1079, value: 2.4 },
              { nutrientId: 2000, value: 10 },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await searchUsdaFoodDataCentral("apple", 150);
    assert.ok(result);
    assert.equal(result?.source, "usda-fdc");
    assert.equal(result?.calories, 78);
    assert.equal(result?.fiber, 3.6);
    assert.equal(result?.sugar, 15);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.USDA_FDC_API_KEY;
  }
});
