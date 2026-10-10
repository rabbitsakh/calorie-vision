import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAssistantSystemPrompt,
  formatAssistantContext,
  parseAssistantMessages,
} from "./admin-assistant.ts";

test("parseAssistantMessages rejects empty / non-user tail", () => {
  assert.equal(parseAssistantMessages([]), null);
  assert.equal(parseAssistantMessages([{ role: "assistant", content: "hi" }]), null);
  assert.equal(parseAssistantMessages([{ role: "system", content: "x" }]), null);
});

test("parseAssistantMessages accepts user tail", () => {
  const parsed = parseAssistantMessages([
    { role: "user", content: " Что поесть? " },
    { role: "assistant", content: "Творог" },
    { role: "user", content: "А на ужин?" },
  ]);
  assert.ok(parsed);
  assert.equal(parsed!.length, 3);
  assert.equal(parsed![0]!.content, "Что поесть?");
});

test("formatAssistantContext includes meals and workouts", () => {
  const text = formatAssistantContext({
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
    waterMl: 500,
    waterTargetMl: 2500,
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
      },
    ],
    routines: [{ name: "Push", exerciseCount: 5 }],
  });
  assert.match(text, /Овсянка/);
  assert.match(text, /Грудь/);
  assert.match(text, /Push/);
});

test("buildAssistantSystemPrompt wraps context", () => {
  const prompt = buildAssistantSystemPrompt("Вес: 80 кг.");
  assert.match(prompt, /Вес: 80 кг/);
  assert.match(prompt, /Calorie Vision/);
});
