import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTipPrompt,
  detectLeverInTip,
  pickTipFocus,
  ruleTipForFocus,
  stripLeverAnnotation,
  type TipTarget,
} from "./tip-lever.ts";

const options = [
  { lever: "weight" as const, label: "Вес", line: "84 кг", suggestedKg: 84, suggestedReps: 5 },
  { lever: "volume" as const, label: "Тоннаж", line: "+1 подход", suggestedKg: 80, suggestedReps: 5 },
  { lever: "reps" as const, label: "Повторы", line: "80 кг × 6", suggestedKg: 80, suggestedReps: 6 },
];

function target(partial: Partial<TipTarget>): TipTarget {
  return {
    name: "Жим",
    adviceKind: "progress",
    line: "Жим → 84 кг",
    primaryLever: "weight",
    options,
    ...partial,
  };
}

test("pickTipFocus prefers remembered lever", () => {
  const pick = pickTipFocus([
    target({ primaryLever: "weight" }),
    target({
      name: "Присед",
      primaryLever: "reps",
      leverRemembered: true,
      line: "Присед → ×6",
      suggestedKg: 100,
    }),
  ]);
  assert.equal(pick?.exerciseName, "Присед");
  assert.equal(pick?.lever, "reps");
  assert.equal(pick?.fromPreference, true);
});

test("pickTipFocus falls back to first primary", () => {
  const pick = pickTipFocus([target({ primaryLever: "volume" })]);
  assert.equal(pick?.lever, "volume");
  assert.equal(pick?.fromPreference, false);
});

test("ruleTipForFocus is single-lever", () => {
  const pick = pickTipFocus([target({ primaryLever: "reps" })])!;
  const tip = ruleTipForFocus(pick);
  assert.match(tip, /повтор/i);
  assert.match(tip, /Жим/);
  assert.doesNotMatch(tip, /тоннаж.*вес|вес.*тоннаж/i);
});

test("stripLeverAnnotation extracts code", () => {
  const { tip, lever } = stripLeverAnnotation("Добавьте подход на жиме. (volume)");
  assert.equal(lever, "volume");
  assert.match(tip, /подход/);
  assert.doesNotMatch(tip, /volume/);
});

test("detectLeverInTip constrained", () => {
  assert.equal(detectLeverInTip("Возьмите 84 кг на жиме", ["weight", "volume", "reps"]), "weight");
  assert.equal(detectLeverInTip("вес и повторы сразу", ["weight", "reps"]), null);
});

test("buildTipPrompt locks preference", () => {
  const pick = pickTipFocus([
    target({ primaryLever: "volume", leverRemembered: true }),
  ])!;
  const prompt = buildTipPrompt(pick);
  assert.match(prompt, /уже выбрал/);
  assert.match(prompt, /Тоннаж/);
  assert.doesNotMatch(prompt, /укажи код рычага/);
});
