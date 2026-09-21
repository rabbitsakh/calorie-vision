import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectDeviceTimezone,
  isValidIanaTimezone,
  timezoneOffsetMinutes,
  timezonesCurrentlyEquivalent,
} from "./device-timezone.ts";

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

test("timezoneOffsetMinutes for Sakhalin / Magadan is UTC+11", () => {
  // Fixed instant mid-year — Russian Far East has no DST.
  const mid = new Date("2026-06-15T12:00:00Z");
  assert.equal(timezoneOffsetMinutes("Asia/Sakhalin", mid), 11 * 60);
  assert.equal(timezoneOffsetMinutes("Asia/Magadan", mid), 11 * 60);
  assert.equal(timezoneOffsetMinutes("Asia/Srednekolymsk", mid), 11 * 60);
  assert.equal(timezoneOffsetMinutes("Etc/GMT-11", mid), 11 * 60);
  assert.equal(timezoneOffsetMinutes("Europe/Moscow", mid), 3 * 60);
});

test("timezonesCurrentlyEquivalent treats same-offset Far East zones as equal", () => {
  const mid = new Date("2026-06-15T12:00:00Z");
  assert.equal(timezonesCurrentlyEquivalent("Asia/Sakhalin", "Asia/Magadan", mid), true);
  assert.equal(timezonesCurrentlyEquivalent("Asia/Sakhalin", "Etc/GMT-11", mid), true);
  assert.equal(timezonesCurrentlyEquivalent("Asia/Sakhalin", "Asia/Sakhalin", mid), true);
  assert.equal(timezonesCurrentlyEquivalent("Asia/Sakhalin", "Europe/Moscow", mid), false);
  assert.equal(timezonesCurrentlyEquivalent(null, "Asia/Sakhalin", mid), false);
});
