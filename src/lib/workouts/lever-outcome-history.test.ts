import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  formatLeverStreakHint,
  getLeverHitStreak,
  recordLeverOutcome,
  resetLeverOutcomeHistoryForTests,
} from "./lever-outcome-history.ts";

function installLocalStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
  (globalThis as { localStorage?: Storage }).localStorage = storage;
}

afterEach(() => {
  resetLeverOutcomeHistoryForTests();
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("lever-outcome-history", () => {
  test("hit streak accumulates on same lever", () => {
    installLocalStorage();
    recordLeverOutcome({ name: "Жим", lever: "weight", outcome: "hit", at: "2026-03-01" });
    recordLeverOutcome({ name: "Жим", lever: "weight", outcome: "hit", at: "2026-03-03" });
    recordLeverOutcome({ name: "Жим", lever: "weight", outcome: "hit", at: "2026-03-05" });
    const streak = getLeverHitStreak("жим");
    assert.equal(streak?.hitStreak, 3);
    assert.equal(formatLeverStreakHint(streak), "3× подряд");
  });

  test("miss breaks streak", () => {
    installLocalStorage();
    recordLeverOutcome({ name: "Присед", lever: "reps", outcome: "hit", at: "2026-03-01" });
    recordLeverOutcome({ name: "Присед", lever: "reps", outcome: "miss", at: "2026-03-02" });
    const streak = getLeverHitStreak("Присед");
    assert.equal(streak?.hitStreak, 0);
    assert.equal(formatLeverStreakHint(streak), "в прошлый раз мимо");
  });

  test("same day overwrites", () => {
    installLocalStorage();
    recordLeverOutcome({ name: "Тяга", lever: "volume", outcome: "miss", at: "2026-03-01" });
    recordLeverOutcome({ name: "Тяга", lever: "volume", outcome: "hit", at: "2026-03-01" });
    assert.equal(getLeverHitStreak("Тяга")?.hitStreak, 1);
  });
});
