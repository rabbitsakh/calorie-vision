import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildDayHeroCopy } from "./day-hero-copy.ts";

describe("day-hero-copy", () => {
  test("empty today encourages first meal", () => {
    const copy = buildDayHeroCopy({
      calories: 0,
      calorieTarget: 2000,
      caloriePct: 0,
      streak: 0,
      loggedToday: false,
      isToday: true,
    });
    assert.equal(copy.pose, "empty");
    assert.match(copy.headline, /приём|движении/i);
  });

  test("streak empty day mentions series", () => {
    const copy = buildDayHeroCopy({
      calories: 0,
      calorieTarget: 2000,
      caloriePct: 0,
      streak: 4,
      loggedToday: false,
      isToday: true,
    });
    assert.equal(copy.pose, "streak");
    assert.match(copy.headline, /Серия 4/);
  });

  test("near goal uses goal pose", () => {
    const copy = buildDayHeroCopy({
      calories: 2000,
      calorieTarget: 2000,
      caloriePct: 100,
      streak: 1,
      loggedToday: true,
      isToday: true,
    });
    assert.equal(copy.pose, "goal");
    assert.match(copy.headline, /Цель|закрыт/i);
  });

  test("mid progress with streak uses streak pose", () => {
    const copy = buildDayHeroCopy({
      calories: 1000,
      calorieTarget: 2000,
      caloriePct: 50,
      streak: 7,
      loggedToday: true,
      isToday: true,
    });
    assert.equal(copy.pose, "streak");
    assert.match(copy.headline, /7 серии|50%/);
  });
});
