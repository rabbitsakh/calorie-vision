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
    assert.match(copy.headline, /приём|начнётся/i);
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

  test("near goal leads with percent", () => {
    const copy = buildDayHeroCopy({
      calories: 2000,
      calorieTarget: 2000,
      caloriePct: 100,
      streak: 1,
      loggedToday: true,
      isToday: true,
    });
    assert.equal(copy.pose, "goal");
    assert.match(copy.headline, /^100%/);
    assert.match(copy.headline, /цель|закрыт/i);
  });

  test("mid progress with streak uses streak pose and leads with %", () => {
    const copy = buildDayHeroCopy({
      calories: 1000,
      calorieTarget: 2000,
      caloriePct: 50,
      streak: 7,
      loggedToday: true,
      isToday: true,
    });
    assert.equal(copy.pose, "streak");
    assert.match(copy.headline, /^50%/);
    assert.match(copy.headline, /7 серии/i);
  });

  test("early progress still leads with percent", () => {
    const copy = buildDayHeroCopy({
      calories: 200,
      calorieTarget: 2000,
      caloriePct: 10,
      streak: 0,
      loggedToday: true,
      isToday: true,
    });
    assert.equal(copy.pose, "cheer");
    assert.match(copy.headline, /^10%/);
  });
});
