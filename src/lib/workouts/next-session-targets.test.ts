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
        points: [
          { date: "a", topWeightKg: 77.5, topReps: 5, totalLoad: 400 },
          { date: "b", topWeightKg: 80, topReps: 5, totalLoad: 400 },
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
  assert.match(card.targets[0]!.line, /Жим → 84 кг/);
  assert.equal(card.targets[0]!.suggestedKg, 84);
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
  assert.match(card.targets[0]!.line, /deload 90 кг/);
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

test("ruleNextSessionTip highlights stall", () => {
  const tip = ruleNextSessionTip([
    {
      name: "Присед",
      adviceKind: "stall",
      title: "Плато",
      line: "Присед → deload 90 кг",
      suggestedKg: 90,
    },
  ]);
  assert.match(tip, /плато/i);
  assert.match(tip, /Присед/);
});
