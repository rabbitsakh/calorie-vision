import assert from "node:assert/strict";
import test from "node:test";
import {
  GYM_TOUR_STEPS,
  GYM_TOUR_STORAGE_KEY,
  advanceGymTour,
  gymTourStepIndex,
  markGymTourSeen,
  readGymTourSeen,
  shouldShowGymTour,
} from "./gym-onboarding.ts";

test("тур короткий и покрывает зал и ассистента", () => {
  assert.equal(GYM_TOUR_STEPS.length, 4);
  assert.deepEqual(
    GYM_TOUR_STEPS.map((step) => step.id),
    ["muscles", "programs", "coach", "assistant"],
  );
  assert.match(GYM_TOUR_STEPS[0].body, /Мышцы/);
  assert.match(GYM_TOUR_STEPS[1].body, /Готовые программы/);
  assert.match(GYM_TOUR_STEPS[2].body, /Предложить тренировку/);
  assert.match(GYM_TOUR_STEPS[3].body, /искра/);
});

test("показ один раз и только после входа", () => {
  assert.equal(shouldShowGymTour(false, true), true);
  assert.equal(shouldShowGymTour(true, true), false);
  assert.equal(shouldShowGymTour(false, false), false);

  const bag = new Map<string, string>();
  const storage = {
    getItem: (key: string) => bag.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
  };
  assert.equal(readGymTourSeen(storage), false);
  markGymTourSeen(storage);
  assert.equal(bag.get(GYM_TOUR_STORAGE_KEY), "done");
  assert.equal(readGymTourSeen(storage), true);
  assert.equal(readGymTourSeen(null), true);
});

test("последний шаг закрывает тур и не возвращает на первый", () => {
  assert.deepEqual(advanceGymTour(0), { done: false, index: 1 });
  assert.deepEqual(advanceGymTour(GYM_TOUR_STEPS.length - 2), {
    done: false,
    index: GYM_TOUR_STEPS.length - 1,
  });
  assert.deepEqual(advanceGymTour(GYM_TOUR_STEPS.length - 1), { done: true });
  assert.deepEqual(advanceGymTour(GYM_TOUR_STEPS.length), { done: true });
  assert.equal(gymTourStepIndex("assistant"), GYM_TOUR_STEPS.length - 1);
  assert.equal(gymTourStepIndex("muscles"), 0);
  assert.equal(gymTourStepIndex("нет-такого"), 0);
  assert.equal(gymTourStepIndex(null), 0);
});
