import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mealEntryCloneData } from "./meal-entry-clone.ts";

describe("mealEntryCloneData", () => {
  it("copies brand and lookupMode", () => {
    const cloned = mealEntryCloneData({
      id: "src",
      userId: "u1",
      date: "2026-10-08",
      dishName: "Творог",
      calories: 120,
      protein: 16,
      fat: 5,
      carbs: 3,
      fiber: null,
      sugar: null,
      portionGrams: 100,
      confidence: 0.9,
      imagePath: null,
      mealType: "BREAKFAST",
      wasCorrected: false,
      originalDish: null,
      originalCalories: null,
      recognitionSource: "openfoodfacts-search",
      photoKind: null,
      barcode: null,
      brand: "Простоквашино",
      lookupMode: "branded",
      eatenAt: null,
      mealGroupId: "g1",
      createdAt: new Date("2026-10-08T10:00:00Z"),
      updatedAt: new Date("2026-10-08T10:00:00Z"),
    } as never);

    assert.equal(cloned.brand, "Простоквашино");
    assert.equal(cloned.lookupMode, "branded");
    assert.equal(cloned.mealGroupId, null);
  });
});
