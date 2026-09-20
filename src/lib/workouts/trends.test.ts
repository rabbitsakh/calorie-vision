import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregatePeriod,
  monthEndKey,
  monthStartKey,
  trendPct,
} from "./trends.ts";

describe("month keys", () => {
  it("computes start/end", () => {
    assert.equal(monthStartKey("2026-09-20"), "2026-09-01");
    assert.equal(monthEndKey("2026-09-20"), "2026-09-30");
    assert.equal(monthEndKey("2026-02-10"), "2026-02-28");
  });
});

describe("aggregatePeriod", () => {
  it("keeps tonnage and cardio separate", () => {
    const stats = aggregatePeriod(
      [
        {
          date: "2026-09-10",
          totalLoad: 1000,
          loadByGroup: { chest: 1000 },
          cardioDistanceKm: 0,
          cardioDurationSec: 0,
        },
        {
          date: "2026-09-12",
          totalLoad: 0,
          loadByGroup: {},
          cardioDistanceKm: 5.2,
          cardioDurationSec: 1500,
        },
      ],
      "2026-09-01",
      "2026-09-30",
    );
    assert.equal(stats.sessionCount, 2);
    assert.equal(stats.tonnage, 1000);
    assert.equal(stats.cardioDistanceKm, 5.2);
    assert.equal(stats.byGroup.chest?.load, 1000);
  });
});

describe("trendPct", () => {
  it("computes percent change", () => {
    assert.equal(trendPct(1100, 1000), 10);
    assert.equal(trendPct(0, 0), null);
  });
});
