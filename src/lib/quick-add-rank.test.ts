import assert from "node:assert/strict";
import { test } from "node:test";
import { inferMealTypeFromHour } from "./meal-type.ts";
import { compareQuickAddRecency, quickAddHour } from "./quick-add-rank.ts";

test("повтор берёт более поздний приём, даже если его создали раньше", () => {
  const olderEaten = {
    createdAt: "2026-11-04T02:00:00.000Z",
    eatenAt: "2026-11-03T01:00:00.000Z",
  };
  const laterEaten = {
    createdAt: "2026-11-01T02:00:00.000Z",
    eatenAt: "2026-11-03T23:28:00.000Z",
  };
  const ranked = [olderEaten, laterEaten].sort(compareQuickAddRecency);
  assert.equal(ranked[0], laterEaten);
});

test("завтрак на Сахалине не превращается в поздний перекус UTC", () => {
  const eaten = { createdAt: "2026-11-03T23:28:00.000Z", eatenAt: "2026-11-03T23:28:00.000Z" };
  const hour = quickAddHour(eaten, "Asia/Sakhalin");
  assert.equal(hour, 10);
  assert.equal(inferMealTypeFromHour(hour), "BREAKFAST");
  assert.equal(inferMealTypeFromHour(new Date(eaten.eatenAt).getUTCHours()), "SNACK");
});
