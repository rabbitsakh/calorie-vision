import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_NAV, isAppNavPath, isFoodAddPath, navKeepsDate } from "./navigation.ts";

test("APP_NAV is gym tab order without plan or weight", () => {
  assert.deepEqual(
    APP_NAV.map((i) => i.href),
    ["/stats", "/ration", "/workouts", "/profile"],
  );
  assert.deepEqual(
    APP_NAV.map((i) => i.shortLabel),
    ["Стат.", "Рацион", "Зал", "Профиль"],
  );
  assert.equal(APP_NAV.find((i) => i.href === "/workouts")?.label, "Зал");
  assert.equal(APP_NAV.find((i) => i.href === "/workouts")?.shortLabel, "Зал");
});

test("isAppNavPath covers workouts and not plan/weight", () => {
  assert.equal(isAppNavPath("/workouts"), true);
  assert.equal(isAppNavPath("/workouts/live"), true);
  assert.equal(isAppNavPath("/plan"), false);
  assert.equal(isAppNavPath("/weight"), false);
  assert.equal(isAppNavPath("/ration"), true);
});

test("isFoodAddPath keeps plan shell with +", () => {
  assert.equal(isFoodAddPath("/workouts"), true);
  assert.equal(isFoodAddPath("/plan"), true);
  assert.equal(isFoodAddPath("/weight"), false);
});

test("navKeepsDate includes plan route for deep links", () => {
  assert.equal(navKeepsDate("/plan"), true);
  assert.equal(navKeepsDate("/workouts"), false);
  assert.equal(navKeepsDate("/profile"), false);
});
