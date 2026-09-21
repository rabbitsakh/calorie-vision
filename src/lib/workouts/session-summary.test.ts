import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSessionSummary, formatSummaryLoadLine } from "./session-summary.ts";

test("buildSessionSummary counts PR and sets", () => {
  const card = buildSessionSummary({
    date: "2026-09-21",
    elapsedSec: 3600,
    totalLoad: 5000,
    cardioDistanceKm: 0,
    cardioDurationSec: 0,
    cardioOnly: false,
    deltaPctVsPrevious: 5,
    deltaPctVsTarget: 0,
    previousLoad: 4800,
    targetLoad: 5040,
    exercises: [
      {
        name: "Жим",
        load: 2000,
        setCount: 3,
        completedCount: 3,
        prLine: "PR 100×5",
      },
      { name: "Тяга", load: 3000, setCount: 3, completedCount: 2 },
    ],
  });
  assert.equal(card.prCount, 1);
  assert.equal(card.completedSets, 5);
  assert.equal(card.headline.includes("PR"), true);
  assert.equal(formatSummaryLoadLine(card), "5000 кг·повт");
});
