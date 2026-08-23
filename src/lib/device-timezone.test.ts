import assert from "node:assert/strict";
import { test } from "node:test";
import { detectDeviceTimezone, isValidIanaTimezone } from "./device-timezone.ts";

test("isValidIanaTimezone accepts known zones", () => {
  assert.equal(isValidIanaTimezone("Asia/Sakhalin"), true);
  assert.equal(isValidIanaTimezone("Europe/Moscow"), true);
  assert.equal(isValidIanaTimezone("Not/ARealZone"), false);
});

test("detectDeviceTimezone returns a string or null in Node", () => {
  const tz = detectDeviceTimezone();
  assert.ok(tz === null || typeof tz === "string");
  if (tz) assert.equal(isValidIanaTimezone(tz), true);
});
