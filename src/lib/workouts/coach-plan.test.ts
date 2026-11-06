import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogById } from "./exercise-catalog.ts";
import {
  buildCoachPreview,
  COACH_POOL,
  draftFromPreview,
  fallbackCoachPlan,
  foodCaution,
  parseCoachInput,
  validateCoachJson,
  type CoachInput,
} from "./coach-plan.ts";

const base: CoachInput = {
  goal: "general",
  minutes: 45,
  equipment: ["barbell", "dumbbell", "machine", "cable"],
  experience: "some",
  limitations: "",
};

test("мусорное оборудование не попадает в запрос", () => {
  const parsed = parseCoachInput({
    goal: "general",
    minutes: 40,
    experience: "some",
    equipment: ["barbell", "spaceship"],
    limitations: "",
  });
  assert.deepEqual(parsed?.equipment, ["barbell"]);
});

test("пул тренера существует в справочнике", () => {
  for (const item of COACH_POOL) {
    assert.ok(catalogById(item.catalogId), item.catalogId);
  }
});

test("валидный JSON ИИ остаётся черновиком с реальными id", () => {
  const preview = validateCoachJson(
    '{"title":"Сегодня","note":"Спокойный объём.","exercises":[{"catalogId":"lat-pulldown","sets":3,"reps":8},{"catalogId":"db-row","sets":3,"reps":10},{"catalogId":"face-pull","sets":2,"reps":12}]}',
    base,
    null,
  );
  assert.equal(preview?.source, "ai");
  assert.equal(preview?.exercises[0]?.name, catalogById("lat-pulldown")?.name);
  assert.equal(preview?.exercises.length, 3);
  const draft = draftFromPreview(preview!);
  assert.equal(draft?.exercises[0]?.plannedSets[0]?.weightKg, null);
});

test("медицинский текст и чужие id не проходят, слишком короткий ответ уходит в запасной", async () => {
  const rejected = validateCoachJson(
    '{"title":"Курс","note":"Это вылечит спину и гарантирует результат.","exercises":[{"catalogId":"nope","sets":3,"reps":8},{"catalogId":"squat","sets":30,"reps":8}]}',
    base,
    { mealCount: 1, calories: 200 },
  );
  assert.equal(rejected, null);
  const preview = await buildCoachPreview({
    request: { ...base, limitations: "болит колено" },
    freshness: [{ key: "legs", status: "loaded" }, { key: "back", status: "fresh" }],
    food: { mealCount: 1, calories: 200 },
    complete: async () => "не json",
  });
  assert.equal(preview.source, "fallback");
  assert.equal(preview.exercises.some((exercise) => exercise.catalogId === "squat"), false);
  assert.match(preview.caution ?? "", /не причина|не повод/);
  assert.equal(preview.note, "Черновик под ваши вводные. Веса не подставляем — оставьте как в прошлый раз или пустыми. Это не медицинский совет.");
  assert.doesNotMatch(preview.note, /вылечит|гарантир/);
  assert.ok(preview.exercises.length >= 3);
});

test("сбой ИИ даёт запасной шаблон и помечает источник", async () => {
  const preview = await buildCoachPreview({
    request: base,
    freshness: [],
    food: null,
    complete: async () => {
      throw new Error("gigachat down");
    },
  });
  assert.equal(preview.source, "fallback");
  assert.equal(foodCaution(null)?.includes("не повод"), true);
  const dumbbells = fallbackCoachPlan(
    { ...base, equipment: ["dumbbell"], minutes: 30 },
    [],
    null,
  );
  assert.ok(dumbbells.exercises.every((exercise) => {
    const equipment = catalogById(exercise.catalogId)?.equipment;
    return equipment === "dumbbell" || equipment === "bodyweight";
  }));
  assert.equal(dumbbells.exercises.some((exercise) => exercise.catalogId === "squat"), false);
});

test("свежая группа предпочтительнее уже нагруженной", () => {
  const preview = fallbackCoachPlan(
    base,
    [
      { key: "chest", status: "loaded" },
      { key: "shoulders", status: "loaded" },
      { key: "back", status: "fresh" },
      { key: "legs", status: "loaded" },
    ],
    null,
  );
  const first = preview.exercises[0]?.catalogId;
  const primary = first ? catalogById(first)?.primary[0] : null;
  assert.equal(primary, "back");
});
