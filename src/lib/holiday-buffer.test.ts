import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOLIDAY_BUFFER_FACTOR,
  applyHolidayBuffer,
  holidayBufferKey,
  isHolidayBufferOn,
  setHolidayBuffer,
} from "./holiday-buffer.ts";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("holiday buffer key and toggle", () => {
  const storage = memoryStorage();
  assert.equal(holidayBufferKey("2026-08-26"), "cv-holiday-buffer:2026-08-26");
  assert.equal(isHolidayBufferOn("2026-08-26", storage), false);
  setHolidayBuffer("2026-08-26", true, storage);
  assert.equal(isHolidayBufferOn("2026-08-26", storage), true);
  setHolidayBuffer("2026-08-26", false, storage);
  assert.equal(isHolidayBufferOn("2026-08-26", storage), false);
});

test("applyHolidayBuffer adds ~12%", () => {
  assert.equal(applyHolidayBuffer(2000, false), 2000);
  assert.equal(applyHolidayBuffer(2000, true), Math.round(2000 * HOLIDAY_BUFFER_FACTOR));
  assert.equal(applyHolidayBuffer(0, true), 0);
});
