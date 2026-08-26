import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDayMealsPayload } from "./day-meals.ts";

test("buildDayMealsPayload is exported as a function", () => {
  assert.equal(typeof buildDayMealsPayload, "function");
});
