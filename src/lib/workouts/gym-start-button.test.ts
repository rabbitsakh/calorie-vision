import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

test("big Начать тренировку button always starts a free workout", () => {
  const src = source("components/workouts/WorkoutWeekPlan.tsx");
  const marker = 'gymBigStartLabel(primary === "finished")';
  const at = src.indexOf(marker);
  assert.ok(at > 0, "big start label missing");
  const button = src.slice(at - 500, at);
  assert.match(button, /onClick=\{onStartBlank\}/);
  assert.doesNotMatch(button, /onRepeatLast/);
  assert.match(src, /const showBigStart = startChrome\.showBigStart/);
  assert.match(src, /GYM_START_LABELS\.plan/);
  assert.match(src, /GYM_START_LABELS\.repeat/);
  assert.doesNotMatch(src, /primary === "repeat" && lastRepeat && onRepeatLast/);
});

test("create session defaults copy off and empty sessions skip repeat", () => {
  const src = source("components/WorkoutsView.tsx");
  assert.match(src, /useState\(COPY_PREVIOUS_SESSION_DEFAULT\)/);
  assert.match(src, /shouldRepeatPreviousSession\(copyExercises, previousSessionId\)/);
  assert.doesNotMatch(src, /setCopyExercises\] = useState\(true\)/);
});
