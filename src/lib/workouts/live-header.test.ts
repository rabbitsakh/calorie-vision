import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLiveHeaderView,
  exerciseNameSignature,
  formatDurationDelta,
  formatTonnageKg,
  pickPreviousWorkout,
  type LiveHeaderExercise,
  type PreviousWorkoutCandidate,
} from "./live-header.ts";

const working = (weightKg: number, reps: number, setType = "working") => ({
  weightKg,
  reps,
  setType,
  completed: true,
});

function exercise(
  partial: Partial<LiveHeaderExercise> & Pick<LiveHeaderExercise, "sets">,
): LiveHeaderExercise {
  return {
    kind: "strength",
    lastSetCount: partial.sets.length,
    bestKg: null,
    targetKg: null,
    ...partial,
  };
}

describe("formatTonnageKg", () => {
  it("пишет тонны от 1000 кг и килограммы ниже", () => {
    assert.equal(formatTonnageKg(8400), "8,4 т");
    assert.equal(formatTonnageKg(1000), "1,0 т");
    assert.equal(formatTonnageKg(840), "840 кг");
    assert.equal(formatTonnageKg(999.4), "999 кг");
    assert.equal(formatTonnageKg(999.6), "1,0 т");
    assert.equal(formatTonnageKg(0), "0 кг");
  });
});

describe("тоннаж и сравнение", () => {
  it("не считает разминку и незавершённый подход", () => {
    const view = buildLiveHeaderView({
      elapsedSec: 34 * 60 + 15,
      prCount: 0,
      previous: { tonnage: 7900, elapsedSec: 40 * 60 },
      exercises: [
        exercise({
          lastSetCount: 3,
          sets: [
            working(60, 10, "warmup"),
            working(100, 8),
            { weightKg: 200, reps: 5, setType: "working", completed: false },
          ],
        }),
      ],
    });
    assert.equal(view.tonnageLabel, "800 кг");
    assert.equal(view.previousTonnageLabel, "было 7,9 т");
    assert.equal(view.deltaLabel, "−89,9%");
    assert.equal(view.deltaTone, "down");
    assert.equal(view.durationLabel, "−6 мин");
  });

  it("зелёный процент, когда текущий тоннаж больше", () => {
    const view = buildLiveHeaderView({
      elapsedSec: 50 * 60,
      prCount: 0,
      previous: { tonnage: 8000, elapsedSec: 40 * 60 },
      exercises: [exercise({ sets: [working(820, 10)] })],
    });
    assert.equal(view.tonnageLabel, "8,2 т");
    assert.equal(view.deltaLabel, "+2,5%");
    assert.equal(view.deltaTone, "up");
    assert.equal(view.durationLabel, "+10 мин");
  });

  it("без прошлой тренировки оставляет только тоннаж и подходы", () => {
    const view = buildLiveHeaderView({
      elapsedSec: 600,
      prCount: 0,
      previous: null,
      exercises: [exercise({ sets: [working(40, 10), working(40, 10)] })],
    });
    assert.equal(view.tonnageLabel, "800 кг");
    assert.equal(view.previousTonnageLabel, null);
    assert.equal(view.deltaLabel, null);
    assert.equal(view.durationLabel, null);
    assert.equal(view.setsLabel, "2 из 2");
  });

  it("ровно 8400 кг — 8,4 т и плюс 6,3% к 7,9 т", () => {
    const sets = Array.from({ length: 12 }, () => working(100, 7));
    const view = buildLiveHeaderView({
      elapsedSec: 0,
      prCount: 0,
      previous: { tonnage: 7900, elapsedSec: 0 },
      exercises: [exercise({ sets, lastSetCount: 12 })],
    });
    assert.equal(view.tonnageLabel, "8,4 т");
    assert.equal(view.deltaLabel, "+6,3%");
    assert.equal(view.durationLabel, null);
    assert.equal(formatDurationDelta(90, 60), "+1 мин");
  });
});

describe("Прогрессия N из M", () => {
  it("считает только стрелку «100 → 105» и рабочий подход на цели", () => {
    const view = buildLiveHeaderView({
      elapsedSec: 0,
      prCount: 2,
      previous: null,
      exercises: [
        exercise({
          bestKg: 100,
          targetKg: 105,
          sets: [working(60, 10, "warmup"), working(105, 5)],
        }),
        exercise({
          bestKg: 80,
          targetKg: 84,
          sets: [working(80, 8), working(70, 8, "drop")],
        }),
        exercise({
          bestKg: 60,
          targetKg: 60,
          sets: [working(60, 8)],
        }),
        exercise({
          kind: "cardio",
          bestKg: null,
          targetKg: null,
          sets: [],
          lastSetCount: 1,
        }),
        exercise({
          kind: "assisted",
          bestKg: 20,
          targetKg: 15,
          sets: [working(15, 6)],
        }),
      ],
    });
    assert.equal(view.progressionLabel, "Прогрессия 2 из 3");
    assert.equal(view.progressionDone, 2);
    assert.equal(view.progressionTotal, 3);
    assert.equal(view.prCount, 2);
    assert.equal(view.setsLabel, "6 из 7");
  });

  it("разминка на целевом весе не закрывает прогрессию", () => {
    const view = buildLiveHeaderView({
      elapsedSec: 0,
      prCount: 0,
      previous: null,
      exercises: [
        exercise({
          bestKg: 100,
          targetKg: 105,
          sets: [working(105, 5, "warmup")],
        }),
      ],
    });
    assert.equal(view.progressionLabel, "Прогрессия 0 из 1");
    assert.equal(view.tonnageLabel, "0 кг");
  });
});

describe("прошлая тренировка", () => {
  const legs = (id: string, names: string[], extra: Partial<PreviousWorkoutCandidate> = {}): PreviousWorkoutCandidate => ({
    id,
    date: "2026-11-01",
    createdAt: "2026-11-01T10:00:00.000Z",
    muscleKeys: ["legs"],
    totalLoad: 5000,
    elapsedSec: 2400,
    finished: true,
    exerciseNames: names,
    ...extra,
  });

  it("шаблон важнее более свежей тренировки того же типа", () => {
    const picked = pickPreviousWorkout({
      currentId: "now",
      muscleKeys: ["legs"],
      exerciseNames: ["Присед", "Румынская тяга"],
      templateExerciseNames: [["Присед", "Румынская тяга"], ["Жим лёжа"]],
      history: [
        legs("fresh-other", ["Выпады"], {
          date: "2026-11-10",
          totalLoad: 9000,
        }),
        legs("template-prev", ["румынская тяга", "Присед"], {
          date: "2026-11-03",
          totalLoad: 7900,
          elapsedSec: 3000,
        }),
      ],
    });
    assert.equal(picked?.matchedBy, "template");
    assert.equal(picked?.previousId, "template-prev");
    assert.equal(picked?.previousTonnage, 7900);
    assert.equal(
      exerciseNameSignature(["Присед", "Румынская тяга"]),
      exerciseNameSignature(["румынская тяга", "Присед"]),
    );
  });

  it("без шаблона берёт последнюю завершённую того же типа", () => {
    const picked = pickPreviousWorkout({
      currentId: "now",
      muscleKeys: ["legs"],
      exerciseNames: ["Выпады"],
      templateExerciseNames: [["Присед"]],
      history: [
        legs("open", ["Жим ногами"], { finished: false, date: "2026-11-12", totalLoad: 1000 }),
        legs("chest", ["Жим"], {
          date: "2026-11-11",
          muscleKeys: ["chest"],
          totalLoad: 4000,
        }),
        legs("older", ["Присед"], { date: "2026-11-01", totalLoad: 6000 }),
        legs("newer", ["Жим ногами"], { date: "2026-11-08", totalLoad: 7000, elapsedSec: 1800 }),
      ],
    });
    assert.equal(picked?.matchedBy, "type");
    assert.equal(picked?.previousId, "newer");
    assert.equal(picked?.previousTonnage, 7000);
  });

  it("если шаблон есть, но такой тренировки ещё не было — сравнения нет", () => {
    const picked = pickPreviousWorkout({
      currentId: "now",
      muscleKeys: ["legs"],
      exerciseNames: ["Присед", "Тяга"],
      templateExerciseNames: [["Присед", "Тяга"]],
      history: [legs("other-legs", ["Выпады"], { totalLoad: 8000 })],
    });
    assert.equal(picked, null);
  });
});
