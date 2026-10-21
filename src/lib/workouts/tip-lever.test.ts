import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  buildTipPrompt,
  detectLeverInTip,
  pickTipFocus,
  ruleTipForFocus,
  stripLeverAnnotation,
  type TipTarget,
} from "./tip-lever.ts";
import {
  recordLeverOutcome,
  resetLeverOutcomeHistoryForTests,
} from "./lever-outcome-history.ts";
import { setLeverMemory } from "./progression-lever-memory.ts";

function installLocalStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: () => null,
      get length() {
        return map.size;
      },
    },
    configurable: true,
  });
}

afterEach(() => {
  resetLeverOutcomeHistoryForTests();
});

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
  installLocalStorage();
  const pick = pickTipFocus([
    target({ primaryLever: "volume", leverRemembered: true }),
  ])!;
  const prompt = buildTipPrompt(pick);
  assert.match(prompt, /уже выбрал/);
  assert.match(prompt, /Тоннаж/);
  assert.doesNotMatch(prompt, /укажи код рычага/);
});

test("K1: 2× miss prefers struggling exercise and deload tip", () => {
  installLocalStorage();
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-03-01" });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-03-03" });
  const pick = pickTipFocus([
    target({ name: "Жим", primaryLever: "reps", leverRemembered: true }),
    target({ name: "Присед", primaryLever: "weight", leverRemembered: true }),
  ])!;
  assert.equal(pick.exerciseName, "Присед");
  assert.ok(pick.missStreak >= 2);
  assert.match(ruleTipForFocus(pick), /Два раза не добрали/);
});

test("earlyUser tip avoids рычаг / soft deload jargon", () => {
  const pick = pickTipFocus([target({ primaryLever: "weight" })])!;
  const tip = ruleTipForFocus(pick, { earlyUser: true });
  assert.match(tip, /следующий раз|чуть/i);
  assert.doesNotMatch(tip, /рычаг|soft deload/i);
});

test("N: recovery-armed tip prefers switch wording over soft deload", () => {
  installLocalStorage();
  setLeverMemory({
    name: "Присед",
    lever: "weight",
    basisKg: 100,
    targetKg: 90,
    targetReps: 5,
    at: "2026-03-04",
    recovery: "deload",
  });
  recordLeverOutcome({ name: "Присед", lever: "weight", outcome: "miss", at: "2026-03-05" });
  const pick = pickTipFocus([
    target({ name: "Присед", primaryLever: "weight", leverRemembered: true }),
  ])!;
  assert.ok(pick.missStreak >= 1);
  assert.match(ruleTipForFocus(pick), /после восстановления мимо/);
});

test("O: recovery hit tip celebrates and keeps lever", () => {
  installLocalStorage();
  const pick = pickTipFocus([
    target({ name: "Присед", primaryLever: "weight", leverRemembered: true }),
  ])!;
  assert.match(ruleTipForFocus(pick, { recoveryHit: true }), /Восстановление сработало/);
});
