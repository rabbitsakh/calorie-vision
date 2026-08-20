import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeVapidSubject } from "./push.ts";

test("defaults empty subject to mailto support", () => {
  assert.equal(normalizeVapidSubject(""), "mailto:support@calorievision.ru");
  assert.equal(normalizeVapidSubject(null), "mailto:support@calorievision.ru");
});

test("keeps valid mailto and https subjects", () => {
  assert.equal(normalizeVapidSubject("mailto:a@b.ru"), "mailto:a@b.ru");
  assert.equal(normalizeVapidSubject("https://calorievision.ru"), "https://calorievision.ru");
});

test("prefixes bare domain and email", () => {
  assert.equal(normalizeVapidSubject("calorievision.ru"), "https://calorievision.ru");
  assert.equal(normalizeVapidSubject("support@calorievision.ru"), "mailto:support@calorievision.ru");
});
