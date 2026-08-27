import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  aggressiveDeficitTip,
  breakfastStreakBody,
  emptyMealSlotTitle,
  freezeBannerCopy,
  mondayWeekWrapTip,
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
  });
});
