import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_LOGGED_IN_KEY,
  clearCapacitorLoggedIn,
  hasCapacitorLoggedIn,
  markCapacitorLoggedIn,
} from "./capacitor-login-flag.ts";

test("login flag key is stable", () => {
  assert.equal(CAP_LOGGED_IN_KEY, "cv_cap_logged_in_v1");
});

test("hasCapacitorLoggedIn is false on web", async () => {
  assert.equal(await hasCapacitorLoggedIn(), false);
});

test("mark/clear are no-ops on web", async () => {
  await markCapacitorLoggedIn();
  await clearCapacitorLoggedIn();
  assert.equal(await hasCapacitorLoggedIn(), false);
});
