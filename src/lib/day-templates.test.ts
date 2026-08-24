import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDayTemplate,
  deleteDayTemplate,
  loadDayTemplates,
} from "./day-templates.ts";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("creates, loads, and deletes day templates", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadDayTemplates(storage), []);

  const tpl = createDayTemplate(
    "Рабочий день",
    [
      { dishName: "Овсянка", calories: 350, mealType: "BREAKFAST" },
      { dishName: "Суп", calories: 400, mealType: "LUNCH" },
    ],
    storage,
    new Date("2026-08-24T12:00:00Z"),
  );

  assert.equal(tpl.name, "Рабочий день");
  assert.equal(tpl.meals.length, 2);
  assert.equal(loadDayTemplates(storage).length, 1);

  const remaining = deleteDayTemplate(tpl.id, storage);
  assert.equal(remaining.length, 0);
  assert.deepEqual(loadDayTemplates(storage), []);
});

test("ignores corrupt localStorage payloads", () => {
  const storage = memoryStorage();
  storage.setItem("cv-day-templates", "{not-json");
  assert.deepEqual(loadDayTemplates(storage), []);

  storage.setItem(
    "cv-day-templates",
    JSON.stringify([
      {
        id: "ok",
        name: "x",
        createdAt: "2026-01-01",
        meals: [{ dishName: "ok", calories: 1 }],
      },
      { id: 1, name: "nope" },
    ]),
  );
  assert.equal(loadDayTemplates(storage).length, 1);
});
