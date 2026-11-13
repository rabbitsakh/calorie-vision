import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFiberSugarOverrides, recommendDiet } from "./diet.ts";
import { FALLBACK_BODY_WEIGHT_KG, estimateSessionEnergy, type SessionEnergy } from "./workouts/energy.ts";
import {
  TRAINING_PROTEIN_G_PER_KG,
  dayTrainingFromSessions,
  isNotableTrainingSession,
} from "./training-day.ts";

function energy(partial: Partial<SessionEnergy> & { kcal: number }): SessionEnergy {
  return {
    met: 5,
    durationSec: 2400,
    weightKg: 80,
    weightSource: "measured",
    durationSource: "clock",
    approximate: false,
    approximateReasons: [],
    cardioKcal: 0,
    strengthKcal: partial.kcal,
    grossKcal: partial.kcal,
    paceKmh: null,
    movement: null,
    ...partial,
  };
}

test("день тренировки поднимает калории на расход и белок на 0,2 г/кг", () => {
  const base = recommendDiet(80, "LOSE", "HEALTHY", "FEMALE");
  const burn = 280;
  const { target, training } = dayTrainingFromSessions(
    base,
    [{ notable: true, energy: energy({ kcal: burn, strengthKcal: burn }) }],
    { weightKg: 80, sex: "FEMALE" },
  );
  assert.ok(training);
  assert.equal(training.trainingDay, true);
  assert.equal(target.calories, base.calories + burn);
  assert.equal(training.proteinBonusG, 80 * TRAINING_PROTEIN_G_PER_KG);
  assert.equal(target.protein, base.protein + 16);
  assert.ok(Math.abs(target.protein * 4 + target.fat * 9 + target.carbs * 4 - target.calories) <= target.calories * 0.02);
  assert.equal(target.fiber, base.fiber);
  assert.equal(base.calories !== target.calories, true);
  assert.match(training.label ?? "", /День тренировки/);
  assert.match(training.label ?? "", /280 ккал сверх покоя/);
  assert.match(training.label ?? "", /белок \+16 г/);
  assert.match(training.detail ?? "", /Обычная цель/);
  assert.ok((training.detail ?? "").includes(String(base.calories)));
});

test("ручные клетчатка и сахар остаются, база не мутирует", () => {
  const raw = recommendDiet(80, "MAINTAIN", null, "FEMALE");
  const base = applyFiberSugarOverrides(raw, { fiberTargetG: 35, sugarTargetG: 40 });
  const snapshot = { ...base };
  const { target } = dayTrainingFromSessions(
    base,
    [{ notable: true, energy: energy({ kcal: 200 }) }],
    { weightKg: 80, sex: "FEMALE" },
  );
  assert.equal(base.fiber, 35);
  assert.equal(base.sugar, 40);
  assert.equal(base.calories, snapshot.calories);
  assert.equal(base.protein, snapshot.protein);
  assert.equal(target.fiber, 35);
  assert.equal(target.sugar, 40);
  assert.equal(target.calories, snapshot.calories + 200);
});

test("без тренировки и после удаления цели возвращаются к обычным", () => {
  const base = recommendDiet(70, "MAINTAIN", null, "MALE");
  const withGym = dayTrainingFromSessions(
    base,
    [{ notable: true, energy: energy({ kcal: 150 }) }],
    { weightKg: 70, sex: "MALE" },
  );
  assert.equal(withGym.target.calories, base.calories + 150);
  const rest = dayTrainingFromSessions(base, [], { weightKg: 70, sex: "MALE" });
  assert.equal(rest.target, base);
  assert.equal(rest.training, null);
  assert.equal(rest.target.calories, base.calories);
  assert.equal(rest.target.protein, base.protein);
});

test("короткое кардио добавляет калории, но не белок и не называется днём тренировки", () => {
  const base = recommendDiet(70, "MAINTAIN", null, "FEMALE");
  const burn = estimateSessionEnergy({
    weightKg: 70,
    elapsedSec: 5 * 60,
    exercises: [{ name: "Эллипс", kind: "cardio", catalogId: "ellipse", sets: [{ completed: true, durationSec: 5 * 60 }] }],
  });
  assert.equal(
    isNotableTrainingSession({
      cardioOnly: true,
      cardioDurationSec: 5 * 60,
      elapsedSec: 5 * 60,
    }),
    false,
  );
  assert.equal(
    isNotableTrainingSession({
      cardioOnly: true,
      cardioDurationSec: 20 * 60,
      elapsedSec: 20 * 60,
    }),
    true,
  );
  const { target, training } = dayTrainingFromSessions(
    base,
    [{ notable: false, energy: burn }],
    { weightKg: 70, sex: "FEMALE" },
  );
  assert.ok(training);
  assert.equal(training.trainingDay, false);
  assert.equal(training.proteinBonusG, 0);
  assert.equal(target.protein, base.protein);
  assert.equal(target.calories, base.calories + burn.kcal);
  assert.doesNotMatch(training.label ?? "", /День тренировки/);
  assert.match(training.label ?? "", /ккал/);
});

test("силовая с рабочими подходами — день тренировки даже без длинного кардио", () => {
  assert.equal(
    isNotableTrainingSession({
      cardioOnly: false,
      totalLoad: 0,
      exercises: [{ kind: "strength", sets: [{ completed: true, setType: "working" }] }],
    }),
    true,
  );
  assert.equal(
    isNotableTrainingSession({
      cardioOnly: false,
      exercises: [{ kind: "strength", sets: [{ completed: true, setType: "warmup" }] }],
    }),
    false,
  );
});

test("расход тренировки прибавляется и при умеренной активности", () => {
  const base = recommendDiet(80, "MAINTAIN", null, "MALE");
  const added = dayTrainingFromSessions(
    base,
    [{ notable: true, energy: energy({ kcal: 317, grossKcal: 443 }) }],
    { weightKg: 80, sex: "MALE", activityLevel: "LIGHT" },
  );
  assert.equal(added.target.calories, base.calories + 317);
  const also = dayTrainingFromSessions(
    base,
    [{ notable: true, energy: energy({ kcal: 317, grossKcal: 443 }) }],
    { weightKg: 80, sex: "MALE", activityLevel: "MODERATE" },
  );
  assert.equal(also.target.calories, base.calories + 317);
  assert.equal(also.target.protein, added.target.protein);
  assert.equal(also.training?.calorieBonusKcal, 317);
  assert.equal(also.training?.activityAlreadyCountsTraining, false);
  assert.match(also.training?.label ?? "", /317 ккал/);
  assert.doesNotMatch(also.training?.label ?? "", /не добавляем второй раз/);
});

test("без нормы дня надбавка не придумывается, запасной вес остаётся только в расходе", () => {
  const { target, training } = dayTrainingFromSessions(
    null,
    [{ notable: true, energy: energy({ kcal: 100, weightSource: "fallback", weightKg: FALLBACK_BODY_WEIGHT_KG, approximate: true, approximateReasons: ["weight"] }) }],
    { weightKg: 0 },
  );
  assert.equal(target, null);
  assert.equal(training, null);
});
