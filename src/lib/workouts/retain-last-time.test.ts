import assert from "node:assert/strict";
import test from "node:test";
import { retainMissingLastTime } from "./retain-last-time.ts";

const history = {
  date: "2026-11-10",
  sets: [{ weightKg: 72, reps: 16 }],
};

test("сохранение подхода не стирает прошлый раз, пока нет полного ответа", () => {
  const previous = {
    id: "s1",
    exercises: [{ id: "e1", name: "Жим", lastTime: history }],
  };
  const incoming = {
    id: "s1",
    exercises: [{ id: "e1", name: "Жим", sets: [{ weightKg: 70, reps: 16 }] }],
  };
  const kept = retainMissingLastTime(previous, incoming);
  assert.equal(kept.exercises[0]?.lastTime, history);
  assert.equal(incoming.exercises[0] && "lastTime" in incoming.exercises[0], false);
});

test("явный lastTime из полной загрузки не подменяется старым", () => {
  const previous = {
    id: "s1",
    exercises: [{ id: "e1", lastTime: history }],
  };
  const incoming = {
    id: "s1",
    exercises: [{ id: "e1", lastTime: null }],
  };
  assert.equal(retainMissingLastTime(previous, incoming).exercises[0]?.lastTime, null);

  const fresh = {
    id: "s1",
    exercises: [{ id: "e1", lastTime: { date: "2026-11-16", sets: [] } }],
  };
  assert.notEqual(retainMissingLastTime(previous, fresh).exercises[0]?.lastTime, history);
});

test("чужая тренировка и новое упражнение не получают чужой прошлый раз", () => {
  const previous = {
    id: "s1",
    exercises: [{ id: "e1", lastTime: history }],
  };
  const other = { id: "s2", exercises: [{ id: "e1" }] };
  assert.equal(retainMissingLastTime(previous, other), other);
  assert.equal(retainMissingLastTime(null, other), other);

  const added = { id: "s1", exercises: [{ id: "e2" }] };
  assert.equal("lastTime" in (retainMissingLastTime(previous, added).exercises[0] ?? {}), false);
});
