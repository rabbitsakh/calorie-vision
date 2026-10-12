import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exerciseNamesMatch,
  exerciseNameSimilarity,
  normalizeExerciseName,
  pickBestNameMatch,
} from "./exercise-name.ts";

describe("normalizeExerciseName", () => {
  it("collapses spaces, lowercases, maps ё→е", () => {
    assert.equal(normalizeExerciseName("  Жим  лёжа "), "жим лежа");
  });

  it("fixes common тренажёр typos", () => {
    assert.equal(
      normalizeExerciseName("Сгибание в тиенажере"),
      normalizeExerciseName("Сгибание в тренажёре"),
    );
    assert.equal(normalizeExerciseName("Разгибание в тренажере"), "разгибание в тренажере");
  });

  it("strips punctuation noise", () => {
    assert.equal(normalizeExerciseName("Жим лёжа!!!"), "жим лежа");
    assert.equal(normalizeExerciseName("Тяга (верхнего блока)"), "тяга верхнего блока");
  });
});

describe("exerciseNamesMatch", () => {
  it("matches ё/е variants", () => {
    assert.equal(exerciseNamesMatch("Жим лёжа", "жим лежа"), true);
  });

  it("matches typo vs correct machine name", () => {
    assert.equal(
      exerciseNamesMatch("Сгибание в тиенажере", "Сгибание в тренажере"),
      true,
    );
  });

  it("does not match short unrelated names", () => {
    assert.equal(exerciseNamesMatch("Жим", "Жимка"), false);
  });
});

describe("pickBestNameMatch", () => {
  it("prefers exact normalize then soft", () => {
    const rows = [
      { id: "1", nameNorm: "жим лежа" },
      { id: "2", nameNorm: "тяга верхнего блока" },
    ];
    assert.equal(pickBestNameMatch(rows, "Жим лёжа")?.id, "1");
    assert.equal(pickBestNameMatch(rows, "сгибание ног") , null);
  });

  it("soft-matches near typo on longer names", () => {
    const rows = [{ id: "1", nameNorm: normalizeExerciseName("Сгибание в тренажере") }];
    const hit = pickBestNameMatch(rows, "Сгибание в тиенажере");
    assert.ok(hit);
    assert.equal(hit.id, "1");
    assert.ok(exerciseNameSimilarity("Сгибание в тиенажере", "Сгибание в тренажере") >= 0.9);
  });
});
