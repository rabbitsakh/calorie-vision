import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearAllOfflineQueueFlushErrors,
  clearOfflineQueueFlushError,
  hasOfflineQueueFlushError,
  listOfflineQueueFlushErrors,
  markOfflineQueueFlushError,
  OFFLINE_QUEUE_FLUSH_ERRORS_KEY,
} from "./offline-queue-flush-errors.ts";

const store = new Map<string, string>();
(globalThis as { sessionStorage?: Storage }).sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

test("T8: mark / has / clear flush errors", () => {
  store.clear();
  clearAllOfflineQueueFlushErrors();
  markOfflineQueueFlushError("a1");
  markOfflineQueueFlushError("gym-2");
  assert.equal(hasOfflineQueueFlushError("a1"), true);
  assert.deepEqual(listOfflineQueueFlushErrors().sort(), ["a1", "gym-2"]);
  clearOfflineQueueFlushError("a1");
  assert.equal(hasOfflineQueueFlushError("a1"), false);
  assert.deepEqual(listOfflineQueueFlushErrors(), ["gym-2"]);
  clearAllOfflineQueueFlushErrors();
  assert.equal(listOfflineQueueFlushErrors().length, 0);
  assert.ok(OFFLINE_QUEUE_FLUSH_ERRORS_KEY.length > 0);
});
