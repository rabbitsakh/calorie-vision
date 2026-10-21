import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichAssistantActionsMealTimes,
  extractMealTimeFromMessage,
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
