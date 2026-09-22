/** Default rest presets shown in the UI (seconds). */
export const REST_OPTIONS = [60, 90, 120, 180] as const;

export function formatRestClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolve rest length. Ignores click events / garbage so
 * `onClick={startRest}` cannot poison the timer with NaN.
 */
export function resolveRestDuration(overrideSec: unknown, defaultSec: number): number {
  const fallback =
    typeof defaultSec === "number" && Number.isFinite(defaultSec) && defaultSec > 0
      ? Math.round(defaultSec)
      : 90;
  if (typeof overrideSec !== "number" || !Number.isFinite(overrideSec) || overrideSec <= 0) {
    return fallback;
  }
  return Math.min(60 * 30, Math.round(overrideSec));
}
