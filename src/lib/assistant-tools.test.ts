import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectUndoFromTools,
  decodeImageBase64,
  executeAssistantWriteTools,
  formatToolResultsForReply,
  resolveAssistantDate,
  shouldAutoApply,
  undoPayloadHasItems,
  userWantsStartWorkout,
  userWantsWrite,
  weekdayIndexFromLabel,
} from "./assistant-tools.ts";

test("userWantsWrite detects Russian write intents", () => {
  assert.equal(userWantsWrite("Составь план тренировки на завтра"), true);
  assert.equal(userWantsWrite("Добавь омлет в рацион"), true);
  assert.equal(userWantsWrite("Выпил 250 мл воды"), true);
  assert.equal(userWantsWrite("Что ещё съесть сегодня?"), false);
});

test("userWantsStartWorkout", () => {
  assert.equal(userWantsStartWorkout("Начни сегодняшнюю тренировку"), true);
  assert.equal(userWantsStartWorkout("Что поесть?"), false);
});

test("resolveAssistantDate handles relative and weekday labels", () => {
  assert.equal(resolveAssistantDate("сегодня", "2026-10-10"), "2026-10-10");
  assert.equal(resolveAssistantDate("завтра", "2026-10-10"), "2026-10-11");
  assert.equal(resolveAssistantDate("2026-10-12", "2026-10-10"), "2026-10-12");
  // 2026-10-10 is Saturday (5) → next Monday is +2
  assert.equal(resolveAssistantDate("Пн", "2026-10-10"), "2026-10-12");
});

test("weekdayIndexFromLabel maps Russian short labels", () => {
  assert.equal(weekdayIndexFromLabel("Пн"), 0);
  assert.equal(weekdayIndexFromLabel("среда"), 2);
  assert.equal(weekdayIndexFromLabel("Вс"), 6);
  assert.equal(weekdayIndexFromLabel("xyz"), null);
});

test("shouldAutoApply when apply flag or write intent + content", () => {
  assert.equal(
    shouldAutoApply({ apply: true, meals: [{ name: "Суп", kcal: 200 }] }, "идеи?"),
    true,
  );
  assert.equal(
    shouldAutoApply(
      { meals: [{ name: "Суп", kcal: 200 }] },
      "Добавь суп в дневник",
    ),
    true,
  );
  assert.equal(
    shouldAutoApply({ meals: [{ name: "Суп", kcal: 200 }] }, "Что поесть?"),
    false,
  );
  assert.equal(shouldAutoApply(null, "Добавь"), false);
});

test("decodeImageBase64 accepts data URL and raw", () => {
  const raw = Buffer.from("fake-image-bytes-xxxxxxxxYYYYYYYY").toString("base64");
  const a = decodeImageBase64(raw, "image/jpeg");
  assert.ok(a);
  assert.equal(a!.mimeType, "image/jpeg");
  assert.ok(a!.buffer.length >= 32);

  const b = decodeImageBase64(`data:image/png;base64,${raw}`, null);
  assert.ok(b);
  assert.equal(b!.mimeType, "image/png");

  assert.equal(decodeImageBase64("nope", "image/jpeg"), null);
  assert.equal(decodeImageBase64(raw, "text/plain"), null);
});

test("formatToolResultsForReply", () => {
  const text = formatToolResultsForReply([
    { ok: true, tool: "save_meals", message: "ок" },
    { ok: false, tool: "x", message: "fail" },
  ]);
  assert.match(text, /✓ ок/);
  assert.match(text, /✗ fail/);
});

test("collectUndoFromTools gathers meal and routine ids", () => {
  const undo = collectUndoFromTools([
    {
      ok: true,
      tool: "save_meals",
      message: "ok",
      data: { meals: [{ id: "m1" }, { id: "m2" }] },
    },
    {
      ok: true,
      tool: "create_workout_plan",
      message: "ok",
      data: { routines: [{ id: "r1" }] },
    },
    { ok: false, tool: "x", message: "no", data: { meals: [{ id: "nope" }] } },
  ]);
  assert.deepEqual(undo.mealIds, ["m1", "m2"]);
  assert.deepEqual(undo.routineIds, ["r1"]);
  assert.equal(undoPayloadHasItems(undo), true);
  assert.equal(undoPayloadHasItems({ mealIds: [], routineIds: [], waterIds: [], weightIds: [] }), false);
});

test("shouldAutoApply for water and start", () => {
  assert.equal(shouldAutoApply({ apply: true, waterMl: 250 }, "ок"), true);
  assert.equal(shouldAutoApply({ startWorkout: true }, "начни"), true);
});

test("Assistant J: stream path never silent-writes workoutDays", async () => {
  const results = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-14",
    date: "2026-10-14",
    actions: {
      apply: true,
      workoutDays: [{ day: "Пн", focus: "Грудь" }],
    },
    lastUserMessage: "Составь план зала",
  });
  assert.equal(results.length, 0);
});

test("Assistant K: stream path never silent-writes shopping or startWorkout", async () => {
  const shopping = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-14",
    date: "2026-10-14",
    actions: { apply: true, shopping: ["Молоко", "Яйца"] },
    lastUserMessage: "добавь в покупки молоко и яйца",
  });
  assert.equal(shopping.length, 0);

  const start = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-14",
    date: "2026-10-14",
    actions: { apply: true, startWorkout: true },
    lastUserMessage: "начни тренировку",
  });
  assert.equal(start.length, 0);
});

test("Assistant L: stream path never silent-writes meals or water", async () => {
  const meals = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-16",
    date: "2026-10-16",
    actions: {
      apply: true,
      meals: [{ name: "Омлет", kcal: 250 }],
    },
    lastUserMessage: "добавь омлет",
  });
  assert.equal(meals.length, 0);

  const water = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-16",
    date: "2026-10-16",
    actions: { apply: true, waterMl: 250 },
    lastUserMessage: "запиши 250 мл воды",
  });
  assert.equal(water.length, 0);
});

test("Assistant M: stream path never silent-writes weightKg", async () => {
  const weight = await executeAssistantWriteTools({
    userId: "u1",
    today: "2026-10-17",
    date: "2026-10-17",
    actions: { apply: true, weightKg: 72.5 },
    lastUserMessage: "запиши вес 72.5",
  });
  assert.equal(weight.length, 0);
});
