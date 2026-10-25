import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  challengeReadyItem,
  mergeReadyQueue,
  questReadyItem,
  readyQueueDockCopy,
  streakReadyItem,
  weekReadyItem,
} from "./chest-ready-queue.ts";

describe("chest-ready-queue", () => {
  test("quest head first, then milestones FIFO", () => {
    const queue = mergeReadyQueue({
      questReadyCount: 1,
      streak: [streakReadyItem(7)],
      week: weekReadyItem("2026-10-20"),
      challenge: [challengeReadyItem("2026-10-20", "water_5", "Вода")],
    });
    assert.equal(queue[0]?.source, "quest");
    assert.equal(queue[1]?.source, "streak");
    assert.equal(queue[2]?.source, "week");
    assert.equal(queue[3]?.source, "challenge");
    assert.equal(queue.length, 4);
  });

  test("dock copy shows queue remainder", () => {
    const queue = mergeReadyQueue({
      questReadyCount: 2,
      streak: [streakReadyItem(14)],
    });
    const copy = readyQueueDockCopy(queue);
    assert.equal(copy.readyCount, 2);
    assert.match(copy.label, /ещё 1/);
    assert.match(copy.label, /Сундук готов/);
  });

  test("empty queue", () => {
    assert.equal(questReadyItem(0), null);
    const copy = readyQueueDockCopy([]);
    assert.equal(copy.readyCount, 0);
  });
});
