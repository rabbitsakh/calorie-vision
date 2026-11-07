import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSignupAttribution } from "./signup-attribution-report.ts";

const now = new Date("2026-11-07T12:00:00Z");

test("отчёт группирует utm и считает 7, 30 дней и всё время", () => {
  const rows = aggregateSignupAttribution(
    [
      {
        createdAt: new Date("2026-11-06T12:00:00Z"),
        signupAttribution: { utm_source: "vk", utm_medium: "cpc", utm_campaign: "nov" },
      },
      {
        createdAt: new Date("2026-10-20T12:00:00Z"),
        signupAttribution: { utm_source: "vk", utm_medium: "cpc", utm_campaign: "nov" },
      },
      {
        createdAt: new Date("2026-08-01T12:00:00Z"),
        signupAttribution: { utm_source: "vk", utm_medium: "cpc", utm_campaign: "nov" },
      },
      {
        createdAt: new Date("2026-11-07T08:00:00Z"),
        signupAttribution: null,
      },
      {
        createdAt: new Date("2026-11-01T08:00:00Z"),
        signupAttribution: { foo: "bar" },
      },
    ],
    now,
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    source: "vk",
    medium: "cpc",
    campaign: "nov",
    unlabeled: false,
    d7: 1,
    d30: 2,
    all: 3,
  });
  assert.equal(rows[1]?.unlabeled, true);
  assert.equal(rows[1]?.source, "без метки");
  assert.equal(rows[1]?.d7, 2);
  assert.equal(rows[1]?.all, 2);
});
