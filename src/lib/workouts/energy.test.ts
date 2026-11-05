import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ESTIMATED_SET_SEC,
  FALLBACK_BODY_WEIGHT_KG,
  FREE_WEIGHT_MET,
  FREE_WEIGHT_VIGOROUS_MET,
  MACHINE_MET,
  estimateSessionEnergy,
  formatSessionEnergyCaption,
  kcalFromMet,
  metForExercise,
} from "./energy.ts";

const set = (partial: { durationSec?: number; completed?: boolean } = {}) => ({
  completed: partial.completed ?? true,
  durationSec: partial.durationSec ?? null,
  setType: "working" as const,
});

test("kcalFromMet: MET × вес × часы", () => {
  assert.equal(kcalFromMet(6, 80, 3600), 480);
  assert.equal(kcalFromMet(8, 75, 1800), 300);
  assert.equal(kcalFromMet(5, 70, 0), 0);
  assert.equal(kcalFromMet(0, 70, 3600), 0);
});

test("без веса — запасные 70 кг и честная пометка", () => {
  const energy = estimateSessionEnergy({
    weightKg: null,
    elapsedSec: 3600,
    exercises: [{ name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] }],
  });
  assert.equal(energy.weightSource, "fallback");
  assert.equal(energy.weightKg, FALLBACK_BODY_WEIGHT_KG);
  assert.equal(energy.approximate, true);
  assert.ok(energy.approximateReasons.includes("weight"));
  assert.equal(energy.kcal, Math.round(FREE_WEIGHT_VIGOROUS_MET * FALLBACK_BODY_WEIGHT_KG));
  assert.match(formatSessionEnergyCaption(energy), /нет веса/);
  assert.match(formatSessionEnergyCaption(energy), /70 кг/);
});

test("бег, эллипс и вело используют разные MET, не одну константу", () => {
  const hour = (name: string, id: string) =>
    estimateSessionEnergy({
      weightKg: 75,
      elapsedSec: 1800,
      exercises: [{ name, kind: "cardio", catalogId: id, sets: [set({ durationSec: 1800 })] }],
    });
  const run = hour("Бег", "run");
  const bike = hour("Велотренажёр", "bike");
  const ellipse = hour("Эллипс", "ellipse");
  assert.equal(run.kcal, Math.round(8.3 * 75 * 0.5));
  assert.equal(bike.kcal, Math.round(6.8 * 75 * 0.5));
  assert.equal(ellipse.kcal, Math.round(5 * 75 * 0.5));
  assert.ok(run.kcal > bike.kcal);
  assert.ok(bike.kcal > ellipse.kcal);
  assert.equal(run.approximate, false);
  assert.equal(run.cardioKcal, run.kcal);
  assert.equal(run.strengthKcal, 0);
});

test("тренажёр ниже свободного веса при том же времени и весе", () => {
  const minutes = 40 * 60;
  const free = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: minutes,
    exercises: [{ name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] }],
  });
  const machine = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: minutes,
    exercises: [
      { name: "Жим в тренажёре лёжа", kind: "strength", catalogId: "machine-press", sets: [set()] },
    ],
  });
  assert.equal(metForExercise({ name: "Жим штанги лёжа", catalogId: "bench-press", kind: "strength" }), FREE_WEIGHT_VIGOROUS_MET);
  assert.equal(metForExercise({ name: "Сгибание ног", catalogId: "leg-curl", kind: "strength" }), MACHINE_MET);
  assert.equal(free.kcal, Math.round(FREE_WEIGHT_VIGOROUS_MET * 80 * (40 / 60)));
  assert.equal(machine.kcal, Math.round(MACHINE_MET * 80 * (40 / 60)));
  assert.ok(machine.kcal < free.kcal);
});

test("длительность и состав пересчитывают калории, пустая сессия не равна константе", () => {
  const bench = (elapsedSec: number) =>
    estimateSessionEnergy({
      weightKg: 80,
      elapsedSec,
      exercises: [{ name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] }],
    });
  const short = bench(20 * 60);
  const long = bench(40 * 60);
  assert.equal(long.kcal, short.kcal * 2);
  assert.ok(long.kcal > 0);

  const isolation = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 40 * 60,
    exercises: [{ name: "Подъём штанги на бицепс", kind: "strength", catalogId: "bb-curl", sets: [set()] }],
  });
  assert.equal(metForExercise({ name: "Подъём штанги на бицепс", catalogId: "bb-curl" }), FREE_WEIGHT_MET);
  assert.ok(isolation.kcal < long.kcal);

  const empty = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 0,
    exercises: [],
  });
  assert.equal(empty.kcal, 0);

  const twoMinutes = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 120,
    exercises: [{ name: "Сгибание ног", catalogId: "leg-curl", kind: "strength", sets: [set()] }],
  });
  assert.ok(twoMinutes.kcal > 0);
  assert.ok(twoMinutes.kcal < 40);
});

test("смешанная сессия: кардио по своей длительности, силовая — на остаток таймера", () => {
  const energy = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 60 * 60,
    exercises: [
      { name: "Бег", kind: "cardio", catalogId: "run", sets: [set({ durationSec: 30 * 60 })] },
      { name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] },
    ],
  });
  assert.equal(energy.cardioKcal, Math.round(8.3 * 80 * 0.5));
  assert.equal(energy.strengthKcal, Math.round(FREE_WEIGHT_VIGOROUS_MET * 80 * 0.5));
  assert.equal(energy.kcal, energy.cardioKcal + energy.strengthKcal);
});

test("без таймера время силовых оценивается по подходам и помечается", () => {
  const sets = Array.from({ length: 10 }, () => set());
  const energy = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 0,
    exercises: [{ name: "Жим штанги лёжа", catalogId: "bench-press", kind: "strength", sets }],
  });
  const hours = (10 * ESTIMATED_SET_SEC) / 3600;
  assert.equal(energy.durationSource, "estimated");
  assert.equal(energy.kcal, Math.round(FREE_WEIGHT_VIGOROUS_MET * 80 * hours));
  assert.ok(energy.approximateReasons.includes("duration"));
  assert.match(formatSessionEnergyCaption(energy), /подходам/);
});
