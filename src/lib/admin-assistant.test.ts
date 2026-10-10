import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAssistantSystemPrompt,
  buildContextSnapshot,
  formatAssistantContext,
  normalizeAssistantActions,
  parseAssistantMessages,
  parseAssistantMode,
  splitAssistantReply,
  type AssistantContextInput,
} from "./admin-assistant.ts";

const baseInput = (): AssistantContextInput => ({
  date: "2026-10-10",
  today: "2026-10-10",
  profile: {
    sex: "male",
    heightCm: 180,
    birthYear: 1990,
    goal: "lose",
    goalPace: "steady",
    activityLevel: "moderate",
  },
  weightKg: 80,
  weightTrend: [{ date: "2026-10-09", kg: 80.4 }],
  waterMl: 500,
  waterTargetMl: 2500,
  streakDays: 5,
  challenge: "Зал 2 (1/2)",
  day: {
    calories: 1200,
    protein: 80,
    fat: 40,
    carbs: 100,
    fiber: 10,
    sugar: 20,
    target: { calories: 2000, protein: 150, fat: 60, carbs: 200 },
    meals: [
      {
        dishName: "Овсянка",
        calories: 350,
        protein: 12,
        fat: 8,
        carbs: 55,
        portionGrams: 250,
        mealType: "BREAKFAST",
      },
    ],
  },
  recentDays: [{ date: "2026-10-09", calories: 1800, dishes: ["Борщ"] }],
  weekCalories: [{ date: "2026-10-10", calories: 1200 }],
  workouts: [
    {
      date: "2026-10-09",
      muscleLabels: ["Грудь"],
      exerciseCount: 4,
      setCount: 12,
      totalLoad: 8000,
      cardioDistanceKm: 0,
      cardioDurationSec: 0,
      ended: true,
      note: null,
      exercises: ["Жим"],
    },
  ],
  routines: [{ name: "Push", exerciseCount: 5, weekdays: [0, 2] }],
});

test("parseAssistantMessages rejects empty / non-user tail", () => {
  assert.equal(parseAssistantMessages([]), null);
  assert.equal(parseAssistantMessages([{ role: "assistant", content: "hi" }]), null);
});

test("parseAssistantMode defaults", () => {
  assert.equal(parseAssistantMode("gym"), "gym");
  assert.equal(parseAssistantMode("nope"), "all");
});

test("formatAssistantContext includes remainders and trend", () => {
  const text = formatAssistantContext(baseInput());
  assert.match(text, /Остаток на день/);
  assert.match(text, /Овсянка/);
  assert.match(text, /Грудь/);
  assert.match(text, /80\.4/);
  assert.match(text, /челлендж/i);
});

test("buildContextSnapshot remaining kcal", () => {
  const snap = buildContextSnapshot(baseInput());
  assert.equal(snap.remainingCalories, 800);
  assert.equal(snap.calories, 1200);
});

test("splitAssistantReply extracts cv-actions", () => {
  const raw = `Вот план.\n\n\`\`\`cv-actions\n{"shopping":["Творог","Курица"],"workoutDays":[{"day":"Пн","focus":"Ноги"}],"summary":"ок"}\n\`\`\`\n`;
  const { reply, actions } = splitAssistantReply(raw);
  assert.match(reply, /Вот план/);
  assert.ok(actions);
  assert.deepEqual(actions!.shopping, ["Творог", "Курица"]);
  assert.equal(actions!.workoutDays?.[0]?.focus, "Ноги");
});

test("normalizeAssistantActions filters junk", () => {
  assert.equal(normalizeAssistantActions({ shopping: [1, ""] }), null);
  const ok = normalizeAssistantActions({ meals: [{ name: "Суп", kcal: 300 }] });
  assert.equal(ok?.meals?.[0]?.name, "Суп");
});

test("buildAssistantSystemPrompt includes mode + fence + prefs", () => {
  const prompt = buildAssistantSystemPrompt("Вес: 80 кг.", "food", "Не предлагает: творог");
  assert.match(prompt, /Фокус на питании/);
  assert.match(prompt, /cv-actions/);
  assert.match(prompt, /Вес: 80 кг/);
  assert.match(prompt, /творог/);
});
