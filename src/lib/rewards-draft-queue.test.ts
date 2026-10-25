import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  countRewardsDrafts,
  enqueueRewardsDraft,
  listRewardsDrafts,
  removeRewardsDraft,
  resetRewardsDraftQueueForTests,
  REWARDS_DRAFT_QUEUE_KEY,
} from "./rewards-draft-queue.ts";

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
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  map.clear();
  return map;
}

describe("rewards-draft-queue", () => {
  test("enqueue mark + open, dedupe mark by date", () => {
    mockStorage();
    resetRewardsDraftQueueForTests();
    enqueueRewardsDraft({ source: "quest", action: "mark", date: "2026-10-26" });
    enqueueRewardsDraft({ source: "quest", action: "mark", date: "2026-10-26" });
    assert.equal(countRewardsDrafts(), 1);
    enqueueRewardsDraft({ source: "next", action: "open", date: "2026-10-26" });
    enqueueRewardsDraft({ source: "next", action: "open", date: "2026-10-26" });
    assert.equal(countRewardsDrafts(), 2);
    assert.equal(listRewardsDrafts().filter((i) => i.kind === "open").length, 1);
    assert.ok(localStorage.getItem(REWARDS_DRAFT_QUEUE_KEY));
    const id = listRewardsDrafts()[0]!.id;
    removeRewardsDraft(id);
    assert.equal(countRewardsDrafts(), 1);
  });
});
