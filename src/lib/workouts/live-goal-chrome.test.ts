import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLiveGoalChrome } from "./live-goal-chrome.ts";
import {
  PROGRESSION_LEVER_MEMORY_KEY,
  setLeverMemory,
} from "./progression-lever-memory.ts";
import type { ProgressionAdvice } from "./progression.ts";

function installStorage() {
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
  map.delete(PROGRESSION_LEVER_MEMORY_KEY);
}

const advice: ProgressionAdvice = {
  kind: "progress",
  title: "Прогрессия",
  detail: "можно вес",
  suggestedKg: 84,
  basisKg: 80,
  basisReps: 5,
  primaryLever: "weight",
  options: [
    { lever: "weight", label: "Вес", line: "84 кг", suggestedKg: 84, suggestedReps: 5 },
    { lever: "volume", label: "Тоннаж", line: "те же 80 кг · +1 подход", suggestedKg: 80, suggestedReps: 5 },
    { lever: "reps", label: "Повторы", line: "80 кг × 6", suggestedKg: 80, suggestedReps: 6 },
  ],
};

test("buildLiveGoalChrome uses rule primary by default", () => {
  installStorage();
  const g = buildLiveGoalChrome(advice, "Жим");
  assert.equal(g?.lever, "weight");
  assert.equal(g?.basisKg, 80);
  assert.equal(g?.targetLine, "84 кг");
  assert.equal(g?.leverRemembered, false);
});

test("buildLiveGoalChrome prefers remembered lever", () => {
  installStorage();
  setLeverMemory({ name: "Жим", lever: "reps", at: "2026-10-14" });
  const g = buildLiveGoalChrome(advice, "Жим");
  assert.equal(g?.lever, "reps");
  assert.equal(g?.leverLabel, "Повторы");
  assert.equal(g?.suggestedReps, 6);
  assert.equal(g?.targetLine, "80 кг × 6");
  assert.equal(g?.leverRemembered, true);
});

test("buildLiveGoalChrome fallback suggested kg only", () => {
  installStorage();
  const g = buildLiveGoalChrome(null, "Жим", 70);
  assert.equal(g?.suggestedKg, 70);
  assert.match(g!.targetLine!, /70/);
});
