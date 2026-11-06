import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogById } from "./exercise-catalog.ts";
import { GYM_PROGRAMS, planProgramSave, programPreviewLines, routineDraftFromDay } from "./programs.ts";

test("готовые программы ссылаются на реальные упражнения справочника", () => {
  assert.equal(GYM_PROGRAMS.length, 3);
  const ids = GYM_PROGRAMS.map((program) => program.id);
  assert.deepEqual(ids, ["fullbody", "split", "five"]);
  for (const program of GYM_PROGRAMS) {
    assert.ok(program.days.length >= 2);
    for (const day of program.days) {
      const draft = routineDraftFromDay(day);
      assert.ok(draft, day.name);
      assert.equal(draft?.name, day.name);
      for (const exercise of draft!.exercises) {
        assert.equal(catalogById(exercise.catalogId)?.name, exercise.name);
        assert.ok(exercise.plannedSets.length >= 1);
        assert.equal(exercise.plannedSets[0]?.weightKg, null);
      }
      const lines = programPreviewLines(day);
      assert.equal(lines.length, day.slots.length);
      assert.match(lines[0] ?? "", /×/);
    }
  }
});

test("повторное сохранение программы не создаёт второй шаблон с тем же именем", () => {
  const first = planProgramSave([], "five");
  assert.ok(first);
  assert.equal(first!.every((step) => !step.skip), true);
  const names = first!.map((step) => step.name);
  const second = planProgramSave(names, "five");
  assert.ok(second);
  assert.equal(second!.every((step) => step.skip), true);
  const partial = planProgramSave([names[0]!], "five");
  assert.equal(partial!.filter((step) => step.skip).length, 1);
  assert.equal(planProgramSave([], "нет"), null);
});
