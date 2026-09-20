import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPause,
  applyResume,
  formatSessionClock,
  sessionClockStatus,
  sessionElapsedSec,
} from "./session-clock.ts";

describe("sessionElapsedSec", () => {
  it("counts running time minus pauses", () => {
    const started = new Date("2026-09-20T10:00:00.000Z");
    const now = Date.parse("2026-09-20T10:10:00.000Z");
    assert.equal(
      sessionElapsedSec(
        { startedAt: started, endedAt: null, pausedAt: null, pausedMs: 60_000 },
        now,
      ),
      9 * 60,
    );
  });

  it("freezes while paused", () => {
    const started = new Date("2026-09-20T10:00:00.000Z");
    const pausedAt = new Date("2026-09-20T10:05:00.000Z");
    const now = Date.parse("2026-09-20T10:20:00.000Z");
    assert.equal(
      sessionElapsedSec(
        { startedAt: started, endedAt: null, pausedAt, pausedMs: 0 },
        now,
      ),
      5 * 60,
    );
  });

  it("uses endedAt when finished", () => {
    assert.equal(
      sessionElapsedSec({
        startedAt: "2026-09-20T10:00:00.000Z",
        endedAt: "2026-09-20T10:30:00.000Z",
        pausedAt: null,
        pausedMs: 120_000,
      }),
      28 * 60,
    );
  });
});

describe("pause/resume + format", () => {
  it("accumulates pause on resume", () => {
    const pausedAt = new Date("2026-09-20T10:05:00.000Z");
    const now = new Date("2026-09-20T10:07:00.000Z");
    const r = applyResume({ startedAt: null, endedAt: null, pausedAt, pausedMs: 1000 }, now);
    assert.equal(r.pausedAt, null);
    assert.equal(r.pausedMs, 1000 + 120_000);
    assert.equal(formatSessionClock(65), "01:05");
    assert.equal(sessionClockStatus({ startedAt: new Date(), endedAt: null, pausedAt: null, pausedMs: 0 }), "running");
    assert.equal(
      sessionClockStatus({
        startedAt: new Date(),
        endedAt: null,
        pausedAt: new Date(),
        pausedMs: 0,
      }),
      "paused",
    );
    const p = applyPause({ startedAt: new Date(), endedAt: null, pausedAt: null, pausedMs: 0 }, now);
    assert.ok(p.pausedAt);
  });
});
