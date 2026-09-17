import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  aggressiveDeficitTip,
  breakfastStreakBody,
  emptyMealSlotTitle,
  freezeBannerCopy,
  softRecoveryBody,
  softRecoveryTitle,
  mondayWeekWrapTip,
  resolveWeekRitualWindow,
  weekRitualCopy,
  streakAtRiskBody,
  streakAtRiskPushTitle,
  streakAtRiskTitle,
  undereatSuggestionTip,
} from "./motivation-voice.ts";

describe("motivation-voice", () => {
  test("streak copy avoids threat framing", () => {
    assert.match(streakAtRiskTitle(5), /ждёт/);
    assert.doesNotMatch(streakAtRiskTitle(5), /угроз|оборв/i);
    assert.match(streakAtRiskBody(), /без давления/i);
    assert.doesNotMatch(streakAtRiskPushTitle(4, false), /угроз|оборв/i);
  });

  test("breakfast and meal slot titles stay soft", () => {
    assert.match(breakfastStreakBody(3, true), /Серия 3/);
    assert.equal(emptyMealSlotTitle("lunch", false), "Обед ещё впереди");
    assert.equal(emptyMealSlotTitle("dinner", true), "Ужин ещё впереди");
  });

  test("undereat and deficit tips avoid shame words", () => {
    assert.doesNotMatch(undereatSuggestionTip(20), /очень мало/i);
    assert.doesNotMatch(aggressiveDeficitTip("Сегодня", 800), /жёстко/i);
    assert.match(aggressiveDeficitTip("Сегодня", 800), /мягкий дефицит/i);
  });

  test("monday wrap and freeze copy", () => {
    assert.match(mondayWeekWrapTip(6), /6 из 7/);
    assert.match(mondayWeekWrapTip(0), /Новая неделя/);
    assert.match(freezeBannerCopy(), /заморозк/i);
    assert.match(softRecoveryTitle(), /Спокойный/);
    assert.match(softRecoveryBody(), /без давления/i);
  });

  test("week ritual windows and soft copy", () => {
    assert.equal(resolveWeekRitualWindow(0, 18), "sunday-evening");
    assert.equal(resolveWeekRitualWindow(0, 12), null);
    assert.equal(resolveWeekRitualWindow(1, 9), "monday-morning");
    assert.equal(resolveWeekRitualWindow(1, 14), null);
    assert.equal(resolveWeekRitualWindow(3, 20), null);
    const sun = weekRitualCopy("sunday-evening", 6);
    assert.match(sun.title, /почти дома/);
    assert.doesNotMatch(sun.body, /стыд|провал|опять/i);
    const mon = weekRitualCopy("monday-morning", 3);
    assert.match(mon.title, /Мягкий старт/);
    assert.match(mon.body, /3 из 7/);
  });
});
