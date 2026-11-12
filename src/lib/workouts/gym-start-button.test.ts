import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

test("повтор прошлой — первая кнопка, пустая тренировка остаётся отдельной", () => {
  const src = source("components/workouts/WorkoutWeekPlan.tsx");
  assert.match(src, /GYM_START_LABELS\.repeat/);
  assert.match(src, /onRepeatLast\(lastRepeat\.id\)/);
  assert.match(src, /onClick=\{onStartBlank\}/);
  assert.match(src, /Пустая тренировка/);
  assert.match(src, /По шаблону/);
  assert.match(src, /const showBigStart = startChrome\.showBigStart/);
  const repeatAt = src.indexOf("onRepeatLast(lastRepeat.id)");
  const blankAt = src.indexOf("onClick={onStartBlank}");
  assert.ok(repeatAt > 0 && blankAt > repeatAt);
});

test("create session defaults copy off and empty sessions skip repeat", () => {
  const src = source("components/WorkoutsView.tsx");
  assert.match(src, /useState\(COPY_PREVIOUS_SESSION_DEFAULT\)/);
  assert.match(src, /shouldRepeatPreviousSession\(copyExercises, previousSessionId\)/);
  assert.doesNotMatch(src, /setCopyExercises\] = useState\(true\)/);
});
