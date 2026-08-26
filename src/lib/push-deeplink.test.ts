import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mealTypeForReminder,
  parseMealQueryParam,
  rationMealLink,
  reminderDeepLink,
} from "./push-deeplink.ts";

test("mealTypeForReminder maps meal slots", () => {
  assert.equal(mealTypeForReminder("breakfast"), "BREAKFAST");
  assert.equal(mealTypeForReminder("lunch"), "LUNCH");
  assert.equal(mealTypeForReminder("dinner"), "DINNER");
  assert.equal(mealTypeForReminder("streak"), null);
});

test("reminderDeepLink includes meal query for breakfast", () => {
  assert.equal(reminderDeepLink("breakfast"), "/ration?meal=BREAKFAST");
  assert.equal(reminderDeepLink("lunch"), "/ration?meal=LUNCH");
  assert.equal(reminderDeepLink("dinner"), "/ration?meal=DINNER");
  assert.equal(reminderDeepLink("checkin"), "/ration");
  assert.equal(reminderDeepLink("weekly"), "/stats");
  assert.equal(reminderDeepLink("calories"), "/stats");
});

test("rationMealLink", () => {
  assert.equal(rationMealLink("DINNER"), "/ration?meal=DINNER");
  assert.equal(rationMealLink(null), "/ration");
});

test("parseMealQueryParam", () => {
  assert.equal(parseMealQueryParam("BREAKFAST"), "BREAKFAST");
  assert.equal(parseMealQueryParam("lunch"), "LUNCH");
  assert.equal(parseMealQueryParam("nope"), null);
});
