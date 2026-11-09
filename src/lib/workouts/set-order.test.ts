import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignSortOrders,
  moveSetWithinExercise,
  removeSetById,
  restoreDeletedSet,
} from "./set-order.ts";

type Row = {
  id: string;
  weightKg: number;
  reps: number;
  completed: boolean;
  setType: string;
};

const rows: Row[] = [
  { id: "a", weightKg: 60, reps: 8, completed: true, setType: "working" },
  { id: "b", weightKg: 80, reps: 5, completed: true, setType: "working" },
  { id: "c", weightKg: 40, reps: 12, completed: false, setType: "warmup" },
];

test("первый подход нельзя поднять, последний нельзя опустить", () => {
  const up = moveSetWithinExercise(rows, "a", "up");
  assert.equal(up.moved, false);
  assert.deepEqual(up.sets.map((s) => s.id), ["a", "b", "c"]);
  assert.equal(up.restRestarted, false);

  const down = moveSetWithinExercise(rows, "c", "down");
  assert.equal(down.moved, false);
  assert.deepEqual(down.sets.map((s) => s.id), ["a", "b", "c"]);
});

test("перемещение выполненного подхода сохраняет его данные и не трогает остальные", () => {
  const moved = moveSetWithinExercise(rows, "b", "down");
  assert.equal(moved.moved, true);
  assert.equal(moved.restRestarted, false);
  assert.deepEqual(
    moved.sets.map((s) => [s.id, s.weightKg, s.reps, s.completed]),
    [
      ["a", 60, 8, true],
      ["c", 40, 12, false],
      ["b", 80, 5, true],
    ],
  );
  const saved = assignSortOrders(moved.sets);
  const reopened = [...saved].sort((x, y) => x.sortOrder - y.sortOrder);
  assert.deepEqual(reopened.map((s) => s.id), ["a", "c", "b"]);
});

test("удаление выполненного и последнего, отмена возвращает данные на место", () => {
  const dropB = removeSetById(rows, "b");
  assert.ok(dropB);
  assert.equal(dropB.set.completed, true);
  assert.equal(dropB.index, 1);
  assert.deepEqual(dropB.sets.map((s) => s.id), ["a", "c"]);

  const afterMove = moveSetWithinExercise(dropB.sets, "c", "up").sets;
  const restored = restoreDeletedSet(afterMove, { index: dropB.index, set: dropB.set });
  assert.deepEqual(
    restored.map((s) => [s.id, s.weightKg, s.reps, s.completed]),
    [
      ["c", 40, 12, false],
      ["b", 80, 5, true],
      ["a", 60, 8, true],
    ],
  );

  const only = [rows[2]!];
  const dropLast = removeSetById(only, "c");
  assert.ok(dropLast);
  assert.deepEqual(dropLast.sets, []);
  const back = restoreDeletedSet(dropLast.sets, { index: dropLast.index, set: dropLast.set });
  assert.deepEqual(back, [rows[2]]);
});

test("удаление всех подходов не воссоздаёт их само", () => {
  const first = removeSetById(rows, "a");
  const second = removeSetById(first!.sets, "b");
  const third = removeSetById(second!.sets, "c");
  assert.deepEqual(third!.sets, []);
  const reopened = assignSortOrders(third!.sets);
  assert.deepEqual(reopened, []);
});

test("отмена после нового подхода вставляет удалённый на прежний индекс", () => {
  const dropped = removeSetById(rows, "a");
  assert.ok(dropped);
  const withNew = [
    ...dropped.sets,
    { id: "d", weightKg: 70, reps: 6, completed: false, setType: "working" },
  ];
  const restored = restoreDeletedSet(withNew, { index: dropped.index, set: dropped.set });
  assert.deepEqual(restored.map((s) => s.id), ["a", "b", "c", "d"]);
  assert.equal(restored[0]?.completed, true);
  assert.equal(restored[1]?.completed, true);
});
