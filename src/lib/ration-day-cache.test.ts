import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RATION_DAY_CACHE_KEY,
  readRationDayCache,
  writeRationDayCache,
} from "./ration-day-cache.ts";
import type { RationDayPayload } from "../components/RationDayProvider.tsx";

function mockStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

function stubPayload(date: string): RationDayPayload {
  return { date, today: date } as RationDayPayload;
}

test("writeRationDayCache and readRationDayCache round-trip", () => {
  mockStorage();
  writeRationDayCache(stubPayload("2026-09-06"));
  const hit = readRationDayCache("2026-09-06");
  assert.ok(hit);
  assert.equal(hit!.date, "2026-09-06");
  assert.ok(localStorage.getItem(RATION_DAY_CACHE_KEY));
});

test("readRationDayCache returns null for unknown date", () => {
  mockStorage();
  assert.equal(readRationDayCache("2026-01-01"), null);
});
