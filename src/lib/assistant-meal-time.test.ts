import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichAssistantActionsMealMeta,
  enrichAssistantActionsMealNotes,
  enrichAssistantActionsMealTimes,
  enrichAssistantActionsTargetDate,
  extractMealTimeFromMessage,
  extractMealTypeFromMessage,
  extractTargetDateFromMessage,
  parseMealTimeHHMM,
} from "./assistant-meal-time.ts";

test("parseMealTimeHHMM normalizes HH:MM", () => {
  assert.equal(parseMealTimeHHMM("10:30"), "10:30");
  assert.equal(parseMealTimeHHMM("9.05"), "09:05");
  assert.equal(parseMealTimeHHMM("25:00"), null);
  assert.equal(parseMealTimeHHMM(""), null);
});

test("extractMealTimeFromMessage finds в 10:30", () => {
  assert.equal(
    extractMealTimeFromMessage("Я съел на перекус в 10:30 паротеин изолят 70г"),
    "10:30",
  );
  assert.equal(extractMealTimeFromMessage("около 9.15 протеин"), "09:15");
  assert.equal(extractMealTimeFromMessage("съел банан в 10"), null);
});

test("enrichAssistantActionsMealTimes fills missing meals.time", () => {
  const enriched = enrichAssistantActionsMealTimes(
    {
      meals: [
        { name: "Протеин изолят", kcal: 260, protein: 60, note: "перекус" },
      ],
    },
    "Я съел на перекус в 10:30 паротеин изолят 70г",
  );
  assert.equal(enriched?.meals?.[0]?.time, "10:30");
});

test("enrichAssistantActionsMealTimes keeps existing time", () => {
  const enriched = enrichAssistantActionsMealTimes(
    {
      meals: [{ name: "Протеин", kcal: 200, time: "11:00", note: "перекус" }],
    },
    "Я съел в 10:30 протеин",
  );
  assert.equal(enriched?.meals?.[0]?.time, "11:00");
});

test("extractMealTypeFromMessage finds перекус / завтрак", () => {
  assert.equal(
    extractMealTypeFromMessage("Я съел на перекус в 10:30 паротеин изолят 70г"),
    "перекус",
  );
  assert.equal(extractMealTypeFromMessage("на завтрак омлет"), "завтрак");
  assert.equal(extractMealTypeFromMessage("Вчерашний ужин:"), "ужин");
  assert.equal(extractMealTypeFromMessage("просто банан"), null);
});

test("enrichAssistantActionsMealNotes fills missing note", () => {
  const enriched = enrichAssistantActionsMealNotes(
    { meals: [{ name: "Протеин изолят", kcal: 260 }] },
    "Я съел на перекус протеин изолят 70г",
  );
  assert.equal(enriched?.meals?.[0]?.note, "перекус");
});

test("enrichAssistantActionsMealNotes overrides heuristic перекус with ужин", () => {
  const enriched = enrichAssistantActionsMealNotes(
    { meals: [{ name: "Пиво светлое", kcal: 900, note: "перекус" }] },
    "Вчерашний ужин:\n- Пиво светлое 3 л",
  );
  assert.equal(enriched?.meals?.[0]?.note, "ужин");
});

test("extractTargetDateFromMessage finds вчерашний", () => {
  assert.equal(extractTargetDateFromMessage("Вчерашний ужин: пюре"), "вчера");
  assert.equal(extractTargetDateFromMessage("добавь на сегодня"), "сегодня");
  assert.equal(extractTargetDateFromMessage("просто банан"), null);
});

test("enrichAssistantActionsTargetDate overrides сегодня with вчера", () => {
  const enriched = enrichAssistantActionsTargetDate(
    { targetDate: "сегодня", meals: [{ name: "Пиво", kcal: 900 }] },
    "Вчерашний ужин: пиво",
  );
  assert.equal(enriched?.targetDate, "вчера");
});

test("enrichAssistantActionsMealMeta fills time and note together", () => {
  const enriched = enrichAssistantActionsMealMeta(
    { meals: [{ name: "Протеин изолят", kcal: 260 }] },
    "Я съел на перекус в 10:30 паротеин изолят 70г",
  );
  assert.equal(enriched?.meals?.[0]?.time, "10:30");
  assert.equal(enriched?.meals?.[0]?.note, "перекус");
});
