/** Live workout session clock helpers. */

export type SessionClock = {
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  pausedAt: Date | string | null;
  pausedMs: number | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Elapsed active training time in seconds (excludes paused intervals).
 * `nowMs` defaults to Date.now(); pass fixed value in tests.
 */
export function sessionElapsedSec(clock: SessionClock, nowMs = Date.now()): number {
  const started = toMs(clock.startedAt);
  if (started == null) return 0;
  const ended = toMs(clock.endedAt);
  const pausedAt = toMs(clock.pausedAt);
  const pausedMs = Math.max(0, Number(clock.pausedMs) || 0);

  let end = ended ?? nowMs;
  let extraPause = 0;
  if (ended == null && pausedAt != null) {
    end = pausedAt;
  } else if (ended != null && pausedAt != null && pausedAt < ended) {
    // shouldn't accumulate mid-pause after finish; treat pause as frozen at pausedAt
    end = Math.min(ended, pausedAt);
  }
  if (ended == null && pausedAt != null) {
    extraPause = 0; // already using pausedAt as end
  }

  const raw = Math.max(0, end - started - pausedMs - extraPause);
  return Math.floor(raw / 1000);
}

export function formatSessionClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export type ClockStatus = "idle" | "running" | "paused" | "finished";

export function sessionClockStatus(clock: SessionClock): ClockStatus {
  if (toMs(clock.endedAt) != null) return "finished";
  if (toMs(clock.startedAt) == null) return "idle";
  if (toMs(clock.pausedAt) != null) return "paused";
  return "running";
}

/** Apply pause: freeze clock, accumulate nothing yet (pausedMs updated on resume). */
export function applyPause(
  clock: SessionClock,
  now = new Date(),
): { pausedAt: Date; pausedMs: number } {
  return {
    pausedAt: now,
    pausedMs: Math.max(0, Number(clock.pausedMs) || 0),
  };
}

/** Apply resume: add (now - pausedAt) into pausedMs, clear pausedAt. */
export function applyResume(
  clock: SessionClock,
  now = new Date(),
): { pausedAt: null; pausedMs: number } {
  const pausedAt = toMs(clock.pausedAt);
  const base = Math.max(0, Number(clock.pausedMs) || 0);
  const extra = pausedAt != null ? Math.max(0, now.getTime() - pausedAt) : 0;
  return { pausedAt: null, pausedMs: base + extra };
}

/** Short rest-end beep via Web Audio (best-effort). */
export function playRestEndBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
    window.setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    /* ignore autoplay / unsupported */
  }
}
