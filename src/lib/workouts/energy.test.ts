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
  formatSessionEnergyLine,
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

function activeKcal(met: number, kg: number, hours: number): number {
  return Math.round(Math.max(0, met - 1) * kg * hours);
}

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
  assert.equal(energy.kcal, activeKcal(FREE_WEIGHT_VIGOROUS_MET, FALLBACK_BODY_WEIGHT_KG, 1));
  assert.match(formatSessionEnergyCaption(energy), /оценка/);
  assert.match(formatSessionEnergyCaption(energy), /нет веса/);
  assert.match(formatSessionEnergyCaption(energy), /70 кг/);
});

test("ходьба 5 км за 60 мин при 126.6 кг не получает MET бега", () => {
  const names = [
    { name: "Беговая дорожка", catalogId: "treadmill" },
    { name: "Ходьба на дорожке", catalogId: "walk-tread" },
    { name: "Бег на дорожке", catalogId: "treadmill" },
    { name: "дорожка", catalogId: null },
  ];
  for (const row of names) {
    const energy = estimateSessionEnergy({
      weightKg: 126.6,
      elapsedSec: 60 * 60,
      exercises: [
        {
          name: row.name,
          kind: "cardio",
          catalogId: row.catalogId,
          sets: [{ completed: true, durationSec: 60 * 60, distanceKm: 5 }],
        },
      ],
    });
    assert.equal(energy.met, 3.5, row.name);
    assert.equal(energy.movement, "ходьба", row.name);
    assert.equal(energy.kcal, 317, row.name);
    assert.equal(energy.grossKcal, 443, row.name);
    assert.ok(energy.kcal < energy.grossKcal);
    const line = formatSessionEnergyLine(energy) ?? "";
    assert.match(line, /оценка/);
    assert.match(line, /ходьба/);
    assert.match(line, /сверх покоя/);
    assert.doesNotMatch(line, /8,3/);
    assert.ok(!line.startsWith("1051"));
  }
});

test("бег с темпом около 8 км/ч берёт MET 8.3, без дистанции — не высокую скорость", () => {
  const paced = estimateSessionEnergy({
    weightKg: 75,
    elapsedSec: 60 * 60,
    exercises: [
      {
        name: "Бег",
        kind: "cardio",
        catalogId: "run",
        sets: [{ completed: true, durationSec: 60 * 60, distanceKm: 8 }],
      },
    ],
  });
  assert.equal(paced.met, 8.3);
  assert.equal(paced.movement, "бег");
  assert.equal(paced.kcal, activeKcal(8.3, 75, 1));
  assert.equal(paced.approximate, false);

  const unknown = estimateSessionEnergy({
    weightKg: 75,
    elapsedSec: 60 * 60,
    exercises: [{ name: "Бег", kind: "cardio", catalogId: "run", sets: [set({ durationSec: 60 * 60 })] }],
  });
  assert.equal(unknown.met, 7);
  assert.ok(unknown.met < 8.3);
  assert.ok(unknown.approximateReasons.includes("intensity"));
  assert.match(formatSessionEnergyCaption(unknown), /скорость неизвестна/);

  const unnamed = estimateSessionEnergy({
    weightKg: 75,
    elapsedSec: 60 * 60,
    exercises: [{ name: "Кардио", kind: "cardio", sets: [set({ durationSec: 60 * 60 })] }],
  });
  assert.equal(unnamed.met, 3.8);
  assert.ok(unnamed.met < 6);
  assert.ok(unnamed.approximateReasons.includes("intensity"));
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
  assert.equal(free.kcal, activeKcal(FREE_WEIGHT_VIGOROUS_MET, 80, 40 / 60));
  assert.equal(machine.kcal, activeKcal(MACHINE_MET, 80, 40 / 60));
  assert.ok(machine.kcal < free.kcal);
});

test("длительность и состав пересчитывают калории, пустая сессия не равна константе", () => {
  const bench = (elapsedSec: number) =>
    estimateSessionEnergy({
      weightKg: 80,
      elapsedSec,
      exercises: [{ name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] }],
    });
  const short = bench(30 * 60);
  const long = bench(60 * 60);
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

test("смешанная сессия: бег по своему темпу, силовая — на остаток таймера, сверх покоя", () => {
  const energy = estimateSessionEnergy({
    weightKg: 80,
    elapsedSec: 60 * 60,
    exercises: [
      {
        name: "Бег",
        kind: "cardio",
        catalogId: "run",
        sets: [{ completed: true, durationSec: 30 * 60, distanceKm: 4 }],
      },
      { name: "Жим штанги лёжа", kind: "strength", catalogId: "bench-press", sets: [set()] },
    ],
  });
  assert.equal(energy.cardioKcal, activeKcal(8.3, 80, 0.5));
  assert.equal(energy.strengthKcal, activeKcal(FREE_WEIGHT_VIGOROUS_MET, 80, 0.5));
  assert.equal(energy.kcal, energy.cardioKcal + energy.strengthKcal);
  assert.ok(energy.grossKcal > energy.kcal);
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
  assert.equal(energy.kcal, activeKcal(FREE_WEIGHT_VIGOROUS_MET, 80, hours));
  assert.ok(energy.approximateReasons.includes("duration"));
  assert.match(formatSessionEnergyCaption(energy), /подходам/);
});
