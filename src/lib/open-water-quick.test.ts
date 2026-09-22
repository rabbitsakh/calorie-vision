import assert from "node:assert/strict";
import { test } from "node:test";
import {
  notifyWaterLogged,
  OPEN_WATER_QUICK_EVENT,
  requestOpenWaterQuick,
  WATER_LOGGED_EVENT,
} from "./open-water-quick.ts";

test("water quick event constants are stable", () => {
  assert.equal(OPEN_WATER_QUICK_EVENT, "cv-open-water-quick");
  assert.equal(WATER_LOGGED_EVENT, "cv-water-logged");
});

test("requestOpenWaterQuick and notifyWaterLogged are no-ops without window", () => {
  // Node test env: functions guard on window and must not throw.
  assert.doesNotThrow(() => requestOpenWaterQuick());
  assert.doesNotThrow(() => notifyWaterLogged());
});
