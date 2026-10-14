import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNextSessionTargets,
  ruleNextSessionTip,
} from "./next-session-targets.ts";

test("buildNextSessionTargets suggests kg bump for top load exercise", () => {
  const card = buildNextSessionTargets(
    [
      {
        name: "Жим",
        kind: "barbell",
        lastWorkingKg: 80,
        lastWorkingReps: 8,
        points: [
          { date: "a", topWeightKg: 77.5, topReps: 5, totalLoad: 400 },
          { date: "b", topWeightKg: 80, topReps: 8, totalLoad: 400 },
        ],
        load: 2000,
        completedCount: 3,
      },
      {
        name: "Разведения",
        kind: "dumbbell",
        lastWorkingKg: 12,
        points: [],
        load: 200,
        completedCount: 2,
      },
    ],
    0.05,
    3,
  );
  assert.equal(card.title, "Следующий раз");
  assert.equal(card.targets.length, 2);
  assert.equal(card.targets[0]!.name, "Жим");
  assert.equal(card.targets[0]!.basisKg, 80);
  assert.equal(card.targets[0]!.suggestedKg, 84);
  assert.equal(card.targets[0]!.options.length, 3);
  assert.ok(card.targets[0]!.options.some((o) => o.lever === "weight" && o.suggestedKg === 84));
  assert.ok(card.targets[0]!.options.some((o) => o.lever === "volume"));
  assert.ok(card.targets[0]!.options.some((o) => o.lever === "reps"));
  assert.match(card.targets[0]!.line, /Жим/);
});

test("buildNextSessionTargets stall → deload line", () => {
  const flat = [
    { date: "a", topWeightKg: 100, topReps: 5, totalLoad: 500 },
    { date: "b", topWeightKg: 100, topReps: 5, totalLoad: 500 },
    { date: "c", topWeightKg: 100, topReps: 5, totalLoad: 500 },
  ];
  const card = buildNextSessionTargets(
    [
      {
        name: "Присед",
        kind: "barbell",
        lastWorkingKg: 100,
        points: flat,
        load: 3000,
        completedCount: 3,
      },
    ],
    0.05,
  );
  assert.equal(card.targets[0]!.adviceKind, "stall");
  assert.equal(card.targets[0]!.suggestedKg, 90);
  assert.ok(card.targets[0]!.options.some((o) => /deload 90/.test(o.line)));
});

test("buildNextSessionTargets cardio distance bump", () => {
  const card = buildNextSessionTargets(
    [
      {
        name: "Бег",
        kind: "cardio",
        lastWorkingKg: null,
        points: [],
        load: 0,
        completedCount: 1,
        cardioDistanceKm: 5,
        cardioDurationSec: 1800,
        previousBestPaceSecPerKm: 360,
      },
    ],
    0.05,
  );
  assert.equal(card.targets.length, 1);
  assert.match(card.targets[0]!.line, /Бег →/);
  assert.match(card.targets[0]!.line, /5\.5 км/);
});

test("buildNextSessionTargets skips empty unfinished exercises", () => {
  const card = buildNextSessionTargets(
    [
      {
        name: "Пусто",
        kind: "barbell",
        lastWorkingKg: null,
        points: [],
        load: 0,
        completedCount: 0,
      },
    ],
    0.05,
  );
  assert.equal(card.targets.length, 0);
});

test("buildNextSessionTargets preferredLevers overrides primary", () => {
  const card = buildNextSessionTargets(
    [
      {
        name: "Жим",
        kind: "barbell",
        lastWorkingKg: 80,
        lastWorkingReps: 5,
        points: [
          { date: "a", topWeightKg: 77.5, topReps: 5, totalLoad: 400 },
          { date: "b", topWeightKg: 80, topReps: 5, totalLoad: 400 },
        ],
        load: 2000,
        completedCount: 3,
      },
    ],
    0.05,
    3,
    { "жим": "volume" },
  );
  assert.equal(card.targets[0]!.primaryLever, "volume");
  assert.equal(card.targets[0]!.leverRemembered, true);
  assert.equal(card.targets[0]!.suggestedKg, 80);
  assert.match(card.targets[0]!.line, /Тоннаж|подход/i);
});

test("ruleNextSessionTip highlights stall", () => {
  const tip = ruleNextSessionTip([
    {
      name: "Присед",
      adviceKind: "stall",
      title: "Плато",
      line: "Присед → deload 90 кг",
      suggestedKg: 90,
      basisKg: 100,
      primaryLever: "weight",
      options: [],
    },
  ]);
  assert.match(tip, /плато/i);
  assert.match(tip, /Присед/);
});
