import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSetsOnly, parseWorkoutText } from "./parse-text.ts";

test("parses named exercise with multiple sets", () => {
  const blocks = parseWorkoutText("Жим лёжа 80x8, 80x8, 82.5×6");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.name, "Жим лёжа");
  assert.deepEqual(blocks[0]?.sets, [
    { weightKg: 80, reps: 8 },
    { weightKg: 80, reps: 8 },
    { weightKg: 82.5, reps: 6 },
  ]);
});

test("parses multiple lines", () => {
  const blocks = parseWorkoutText("Присед 100/5 100/5\nТяга 120x5");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.name, "Присед");
  assert.equal(blocks[1]?.name, "Тяга");
  assert.equal(blocks[1]?.sets[0]?.weightKg, 120);
});

test("parseSetsOnly ignores names", () => {
  assert.deepEqual(parseSetsOnly("80x8 82,5×6"), [
    { weightKg: 80, reps: 8 },
    { weightKg: 82.5, reps: 6 },
  ]);
});
