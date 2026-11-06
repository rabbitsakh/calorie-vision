import assert from "node:assert/strict";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatsBarChart } from "../components/StatsBarChart.tsx";

// tsx compiles JSX with the classic runtime; Next itself uses the automatic one.
Object.assign(globalThis, { React });

/** Вымышленная неделя: высокий день выше цели и средний день раньше теряли число. */
const WEEK = [
  { date: "2026-10-31", calories: 1480 },
  { date: "2026-11-01", calories: 2520 },
  { date: "2026-11-02", calories: 910 },
  { date: "2026-11-03", calories: 2380 },
  { date: "2026-11-04", calories: 690 },
  { date: "2026-11-05", calories: 1120 },
  { date: "2026-11-06", calories: 1290 },
];

function renderChart(
  days: Array<{ date: string; calories: number }>,
  period: "week" | "month" | "quarter",
  target = 2000,
) {
  return renderToStaticMarkup(
    createElement(StatsBarChart, { days, period, targetValue: target }),
  );
}

function readLabels(html: string) {
  const height = Number(/data-chart-height="(\d+)"/.exec(html)?.[1]);
  const labels = [...html.matchAll(/data-calorie-value="(\d+)"[^>]*data-label-bottom="(\d+)"[^>]*data-label-height="(\d+)"/g)].map(
    (match) => ({
      text: match[1] ?? "",
      bottom: Number(match[2]),
      labelHeight: Number(match[3]),
    }),
  );
  return { height, labels };
}

test("рендер недели содержит ккал каждого дня внутри холста", () => {
  const html = renderChart(WEEK, "week");
  const { height, labels } = readLabels(html);
  assert.deepEqual(
    labels.map((label) => label.text),
    ["1480", "2520", "910", "2380", "690", "1120", "1290"],
  );
  assert.ok(height > 0);
  for (const label of labels) {
    assert.ok(label.bottom >= 0);
    assert.ok(label.bottom + label.labelHeight <= height);
  }
  assert.equal(html.match(/data-over-target="true"/g)?.length, 2);
  assert.match(html, /2380/);
  assert.match(html, /1120/);
});

test("рендер 30 и 90 дней не выбрасывает дни с едой", () => {
  for (const [count, period] of [
    [30, "month"],
    [90, "quarter"],
  ] as const) {
    const days = Array.from({ length: count }, (_, index) => ({
      date: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
      calories: index % 6 === 0 ? 0 : 1000 + (index % 8) * 180,
    }));
    const html = renderChart(days, period, 2000);
    const { labels } = readLabels(html);
    const expected = days.filter((day) => day.calories > 0).map((day) => String(day.calories));
    assert.deepEqual(
      labels.map((label) => label.text),
      expected,
    );
    assert.match(html, /data-calorie-scroll/);
  }
});
