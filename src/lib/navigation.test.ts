import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_NAV, isAppNavPath, navKeepsDate } from "./navigation.ts";

test("APP_NAV is Weekly OS order without weight tab", () => {
  assert.deepEqual(
    APP_NAV.map((i) => i.href),
    ["/stats", "/ration", "/plan", "/profile"],
  );
});

test("isAppNavPath covers plan and not weight", () => {
  assert.equal(isAppNavPath("/plan"), true);
  assert.equal(isAppNavPath("/weight"), false);
  assert.equal(isAppNavPath("/ration"), true);
});

test("navKeepsDate includes plan", () => {
  assert.equal(navKeepsDate("/plan"), true);
  assert.equal(navKeepsDate("/profile"), false);
});
