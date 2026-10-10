import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countDiaryNoteDrafts,
  DIARY_NOTE_DRAFT_QUEUE_KEY,
  enqueueDiaryNoteDraft,
  listDiaryNoteDrafts,
  removeDiaryNoteDraft,
} from "./diary-note-draft-queue.ts";
import { readRationDayCache } from "./ration-day-cache.ts";

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
    value: {
      localStorage: storage,
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

test("enqueueDiaryNoteDraft keeps one draft per day and patches mood cache", () => {
  mockStorage();
  enqueueDiaryNoteDraft({ date: "2026-08-24", note: "a", mood: 3 });
  enqueueDiaryNoteDraft({ date: "2026-08-24", note: "b", mood: 5 });
  assert.equal(countDiaryNoteDrafts(), 1);
  assert.equal(listDiaryNoteDrafts()[0]?.mood, 5);
  assert.equal(listDiaryNoteDrafts()[0]?.note, "b");
  assert.equal(readRationDayCache("2026-08-24")?.diaryMood, "5");
  assert.ok(localStorage.getItem(DIARY_NOTE_DRAFT_QUEUE_KEY));
});

test("removeDiaryNoteDraft clears queue", () => {
  mockStorage();
  const id = enqueueDiaryNoteDraft({ date: "2026-08-24", note: "x", mood: 4 });
  removeDiaryNoteDraft(id);
  assert.equal(countDiaryNoteDrafts(), 0);
});
