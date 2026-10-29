import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_NAV,
  isAppNavPath,
  isFoodAddPath,
  NAV_ALIASES,
  navKeepsDate,
  showsComposer,
} from "./navigation.ts";

test("APP_NAV is the hybrid 4-tab order without plan or weight", () => {
  assert.deepEqual(
    APP_NAV.map((i) => i.href),
    ["/ration", "/workouts", "/stats", "/profile"],
  );
  assert.deepEqual(
    APP_NAV.map((i) => i.shortLabel),
    ["Сегодня", "Зал", "Прогресс", "Я"],
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
  assert.equal(isFoodAddPath("/assistant"), true);
  assert.equal(isFoodAddPath("/weight"), false);
});

test("navKeepsDate includes plan and workouts for date continuity", () => {
  assert.equal(navKeepsDate("/plan"), true);
  assert.equal(navKeepsDate("/workouts"), true);
  assert.equal(navKeepsDate("/profile"), false);
});

test("hybrid aliases point at existing tab routes", () => {
  const hrefs = new Set(APP_NAV.map((i) => i.href));
  for (const target of Object.values(NAV_ALIASES)) assert.equal(hrefs.has(target), true);
});

test("composer only on the day screen", () => {
  assert.equal(showsComposer("/ration"), true);
  assert.equal(showsComposer("/workouts"), false);
  assert.equal(showsComposer("/assistant"), false);
});
