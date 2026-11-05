import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  exerciseNamesMatch,
  exerciseNameSimilarity,
  exercisePhraseCovers,
  normalizeExerciseName,
  pickBestNameMatch,
  scoreExercisePhrase,
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

  it("сводит опечатки бицепса и сквота", () => {
    assert.equal(
      normalizeExerciseName("Молотки на бийепс"),
      normalizeExerciseName("Молотки на бицепс"),
    );
    assert.equal(normalizeExerciseName("Скват"), "присед");
    assert.equal(normalizeExerciseName("сквот"), "присед");
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

describe("scoreExercisePhrase", () => {
  it("считает шолдер пресс и shoulder press одним названием", () => {
    assert.equal(scoreExercisePhrase("шолдер пресс", "shoulder press"), 1);
  });

  it("пропускает стоя и в тренажере, но не другое движение", () => {
    assert.equal(exercisePhraseCovers("подъем штанги на бицепс стоя", "подъем штанги на бицепс"), true);
    assert.equal(
      exercisePhraseCovers("разгибание ног в тренажере", "разгибание ног"),
      true,
    );
    assert.equal(
      exercisePhraseCovers("подъем штанги на бицепс стоя обратным хватом узко", "подъем штанги на бицепс"),
      false,
    );
    assert.equal(
      exercisePhraseCovers("тяга в блоке на трицепс из за спины", "тяга в блоке на трицепс"),
      false,
    );
    assert.equal(exercisePhraseCovers("бабочка на заднюю дельту", "бабочка"), false);
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
