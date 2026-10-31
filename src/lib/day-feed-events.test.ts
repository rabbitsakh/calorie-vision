import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gymSessionEvent,
  placeDayEvents,
  plannedDaySlots,
  waterFeedEvent,
  weightEvent,
  type DayFeedEvent,
} from "./day-feed-events.ts";

const ev = (key: string, atMs: number | null): DayFeedEvent => ({
  key,
  kind: "gym",
  atMs,
  title: key,
  detail: null,
  href: "/workouts",
});

test("placeDayEvents: event slots before the first later meal", () => {
  const placed = placeDayEvents([100, 300, 500], [ev("gym", 200)]);
  assert.deepEqual([...placed.keys()], [1]);
});

test("placeDayEvents: no time → top; after every meal → end", () => {
  const placed = placeDayEvents([100, 300], [ev("w", null), ev("late", 900)]);
  assert.equal(placed.get(0)?.[0]?.key, "w");
  assert.equal(placed.get(2)?.[0]?.key, "late");
});

test("placeDayEvents: undo rows (null time) are not boundaries", () => {
  const placed = placeDayEvents([100, null, 300], [ev("gym", 150)]);
  assert.deepEqual([...placed.keys()], [2]);
});

test("gymSessionEvent: finished and live sessions", () => {
  const done = gymSessionEvent({
    id: "s1",
    startedAt: "2026-10-29T07:00:00Z",
    endedAt: "2026-10-29T07:52:00Z",
    elapsedSec: 3120,
    muscleLabels: ["Грудь", "Трицепс"],
    setCount: 14,
    clockStatus: "finished",
    prCount: 2,
  });
  assert.equal(done?.title, "Зал");
  assert.equal(done?.detail, "Грудь · Трицепс · 52 мин · 14 подх.");
  assert.equal(done?.record, true);
  const live = gymSessionEvent({ id: "s2", startedAt: "2026-10-29T07:00:00Z", endedAt: null, clockStatus: "running", setCount: 3, prCount: 1 });
  assert.equal(live?.live, true);
  assert.equal(live?.record, false);
  assert.equal(live?.detail, "идёт · 3 подх.");
  assert.equal(gymSessionEvent({ id: "s3", startedAt: null, endedAt: null, setCount: 0 }), null);
});

test("weightEvent", () => {
  assert.equal(weightEvent(82.4)?.detail, "82,4 кг");
  assert.equal(weightEvent(null), null);
});

test("waterFeedEvent: shows after first sip", () => {
  assert.equal(waterFeedEvent({ totalMl: 0, target: 2000 }), null);
  const w = waterFeedEvent({ totalMl: 500, target: 2000 });
  assert.equal(w?.kind, "water");
  assert.equal(w?.waterAddMl, 250);
  assert.match(w?.title ?? "", /500 мл/);
  assert.match(w?.detail ?? "", /2[\s\u00a0]?000 мл/);
  const full = waterFeedEvent({ totalMl: 2000, target: 2000 });
  assert.match(full?.title ?? "", /2[\s\u00a0]?000 мл/);
});

test("plannedDaySlots: morning → weigh-in + breakfast; filled slots and other days → none", () => {
  const none = new Set<string>();
  assert.deepEqual(
    plannedDaySlots({ isToday: true, hour: 7, hasWeight: false, loggedMealTypes: none }).map((s) => s.title),
    ["Вес до завтрака", "Завтрак"],
  );
  assert.deepEqual(
    plannedDaySlots({ isToday: true, hour: 13, hasWeight: false, loggedMealTypes: new Set(["BREAKFAST"]) }).map(
      (s) => s.title,
    ),
    ["Обед"],
  );
  assert.equal(plannedDaySlots({ isToday: true, hour: 13, hasWeight: true, loggedMealTypes: new Set(["LUNCH"]) }).length, 0);
  assert.equal(plannedDaySlots({ isToday: false, hour: 7, hasWeight: false, loggedMealTypes: none }).length, 0);
  assert.equal(plannedDaySlots({ isToday: true, hour: 23, hasWeight: true, loggedMealTypes: none }).length, 0);
});
