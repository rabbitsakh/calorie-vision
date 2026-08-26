import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatWeeklyDigestHtml,
  formatWeeklyDigestText,
  type WeeklyDigestSummary,
} from "./weekly-digest.ts";

const sample: WeeklyDigestSummary = {
  weekLabel: "19 авг. — 25 авг.",
  daysLogged: 5,
  avgCalories: 1800,
  avgWaterMl: 1600,
  calorieTarget: 1900,
  insights: ["Дневник: 5 из 7 дней — отличная регулярность."],
};

test("formatWeeklyDigestText includes week stats and opt-out hint", () => {
  const text = formatWeeklyDigestText(sample, "Анна Петрова");
  assert.match(text, /Здравствуйте, Анна!/);
  assert.match(text, /Дней с записями: 5/);
  assert.match(text, /1800/);
  assert.match(text, /Отключить дайджест/);
});

test("formatWeeklyDigestHtml escapes name and lists insights", () => {
  const html = formatWeeklyDigestHtml(sample, 'Анна<script>');
  assert.match(html, /Недельный итог/);
  assert.match(html, /Анна&lt;script&gt;/);
  assert.match(html, /отличная регулярность/);
  assert.doesNotMatch(html, /<script>/);
});
