import assert from "node:assert/strict";
import test from "node:test";
import { EXERCISE_CATALOG } from "./exercise-catalog.ts";
import { searchExerciseCatalog, scoreCatalogExercise } from "./catalog-search.ts";
import { matchExerciseName, resolveLoggedExercise } from "./catalog-link.ts";

test("справочник содержит 150–200 уникальных упражнений", () => {
  assert.ok(EXERCISE_CATALOG.length >= 150 && EXERCISE_CATALOG.length <= 200);
  const ids = new Set(EXERCISE_CATALOG.map((row) => row.id));
  assert.equal(ids.size, EXERCISE_CATALOG.length);
  for (const row of EXERCISE_CATALOG) {
    assert.ok(row.primary.length > 0, row.id);
    assert.ok(row.nameNorm.length > 0, row.id);
  }
});

test("пулдаун и шолдер пресс находятся по синонимам", () => {
  const pull = searchExerciseCatalog({ query: "пулдаун", catalog: EXERCISE_CATALOG, limit: 3 });
  assert.equal(pull[0]?.id, "lat-pulldown");
  const shoulder = searchExerciseCatalog({
    query: "шолдер пресс",
    catalog: EXERCISE_CATALOG,
    limit: 3,
  });
  assert.equal(shoulder[0]?.id, "ohp");
});

test("опечатка тренажёра не роняет точный синоним", () => {
  const row = EXERCISE_CATALOG.find((item) => item.id === "machine-curl");
  assert.ok(row);
  assert.equal(scoreCatalogExercise("сгибание в тиенажере на бицепс", row), 1);
});

test("пустой запрос поднимает недавние", () => {
  const hits = searchExerciseCatalog({
    catalog: EXERCISE_CATALOG,
    recent: [{ name: "Жим штанги лёжа", catalogId: "bench-press", useCount: 12 }],
    limit: 5,
  });
  assert.equal(hits[0]?.id, "bench-press");
  assert.equal(hits[0]?.source, "recent");
});

test("фильтр по группе мышц", () => {
  const hits = searchExerciseCatalog({
    query: "жим",
    muscle: "shoulders",
    catalog: EXERCISE_CATALOG,
    limit: 10,
  });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((hit) => hit.primary.includes("shoulders") || hit.secondary.includes("shoulders")));
});

test("уверенные совпадения владельца склеиваются, короткое «жим» — нет", () => {
  const pullA = matchExerciseName("Тяга блока на спину");
  const pullB = matchExerciseName("Пулдаун в тренажере");
  assert.equal(pullA.status, "confident");
  assert.equal(pullB.status, "confident");
  if (pullA.status === "confident" && pullB.status === "confident") {
    assert.equal(pullA.catalogId, pullB.catalogId);
    assert.equal(pullA.catalogId, "lat-pulldown");
  }
  const shoulder = matchExerciseName("шолдер пресс");
  assert.equal(shoulder.status, "confident");
  const vague = matchExerciseName("жим");
  assert.notEqual(vague.status, "confident");
});

test("своё название без совпадения остаётся своим", () => {
  const custom = resolveLoggedExercise({
    name: "Мой странный жим на коленях",
    kind: "strength",
    muscleGroup: "chest",
  });
  assert.equal(custom.catalogId, null);
  assert.equal(custom.name, "Мой странный жим на коленях");
});

test("уверенный ввод получает каноническое имя и отдых", () => {
  const resolved = resolveLoggedExercise({
    name: "shoulder press",
    kind: "strength",
    muscleGroup: null,
  });
  assert.equal(resolved.catalogId, "ohp");
  assert.equal(resolved.name, "Жим штанги стоя");
  assert.equal(resolved.muscleGroup, "shoulders");
  assert.ok((resolved.defaultRestSec ?? 0) > 0);
});
