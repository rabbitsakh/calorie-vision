import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adviceWithPreferredLever,
  clearLeverMemory,
  collectPreferredLevers,
  getLeverMemory,
  goalFromLeverOption,
  normalizeExerciseKey,
  PROGRESSION_LEVER_MEMORY_KEY,
  resolvePreferredLever,
  setLeverMemory,
} from "./progression-lever-memory.ts";
import type { ProgressionOption } from "./progression.ts";

function installStorage() {
  const map = new Map<string, string>();
  const storage = {
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
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

test("normalizeExerciseKey collapses case and spaces", () => {
  assert.equal(normalizeExerciseKey("  Жим  лежа "), "жим лежа");
});

test("set/get lever memory round-trips", () => {
  installStorage();
  const saved = setLeverMemory({
    name: "Жим лежа",
    lever: "reps",
    basisKg: 70,
    targetKg: 70,
    targetReps: 9,
    at: "2026-10-14",
  });
  assert.equal(saved?.lever, "reps");
  const got = getLeverMemory("жим  лежа");
  assert.equal(got?.lever, "reps");
  assert.equal(got?.targetReps, 9);
  assert.ok(localStorage.getItem(PROGRESSION_LEVER_MEMORY_KEY));
  clearLeverMemory("Жим лежа");
  assert.equal(getLeverMemory("Жим лежа"), null);
});

test("resolvePreferredLever prefers memory when option exists", () => {
  const options: ProgressionOption[] = [
    { lever: "weight", label: "Вес", line: "84 кг", suggestedKg: 84, suggestedReps: 5 },
    { lever: "volume", label: "Тоннаж", line: "+1", suggestedKg: 80, suggestedReps: 5 },
    { lever: "reps", label: "Повторы", line: "×6", suggestedKg: 80, suggestedReps: 6 },
  ];
  assert.equal(resolvePreferredLever(options, "weight", "reps"), "reps");
  assert.equal(resolvePreferredLever(options, "weight", "volume"), "volume");
  assert.equal(resolvePreferredLever(options, "weight", null), "weight");
});

test("goalFromLeverOption marks extra set for volume", () => {
  const g = goalFromLeverOption({
    lever: "volume",
    label: "Тоннаж",
    line: "+1",
    suggestedKg: 80,
    suggestedReps: 8,
  });
  assert.equal(g.extraSet, true);
  assert.equal(g.kg, 80);
});

test("collectPreferredLevers maps normalized keys", () => {
  installStorage();
  setLeverMemory({ name: "Жим лежа", lever: "reps", at: "2026-10-14" });
  const map = collectPreferredLevers(["Жим лежа", "Присед"]);
  assert.equal(map["жим лежа"], "reps");
  assert.equal(map["присед"], undefined);
});

test("adviceWithPreferredLever uses memory when present", () => {
  installStorage();
  setLeverMemory({ name: "Жим", lever: "reps", at: "2026-10-14" });
  const options: ProgressionOption[] = [
    { lever: "weight", label: "Вес", line: "84 кг", suggestedKg: 84, suggestedReps: 5 },
    { lever: "volume", label: "Тоннаж", line: "+1", suggestedKg: 80, suggestedReps: 5 },
    { lever: "reps", label: "Повторы", line: "×6", suggestedKg: 80, suggestedReps: 6 },
  ];
  const got = adviceWithPreferredLever(
    { primaryLever: "weight", suggestedKg: 84, options },
    "Жим",
  );
  assert.equal(got.primaryLever, "reps");
  assert.equal(got.suggestedKg, 80);
  assert.equal(got.suggestedReps, 6);
  assert.equal(got.leverRemembered, true);
});
