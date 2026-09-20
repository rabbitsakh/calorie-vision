/** Pace as seconds per km (lower is faster). Null if distance missing. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return durationSec / distanceKm;
}

/** Pace clock m:ss (only used for pace /km, not for logged cardio time). */
export function formatPaceClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const sec = Math.round(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Cardio session/set duration as whole or one-decimal minutes.
 * e.g. 1800 → "30 мин", 1830 → "30.5 мин"
 */
export function formatDurationMinutes(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0 мин";
  const minutes = totalSec / 60;
  const rounded = Math.round(minutes * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${label} мин`;
}

/** @deprecated Prefer formatDurationMinutes for cardio logs. Kept for pace clock. */
export function formatDuration(totalSec: number): string {
  return formatPaceClock(totalSec);
}

/** Format pace as m:ss / км. */
export function formatPace(secPerKm: number | null | undefined): string | null {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
  return `${formatPaceClock(secPerKm)}/км`;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "0";
  const rounded = Math.round(km * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Minutes → draft string (no seconds). */
export function durationSecToMinutesInput(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "";
  const minutes = totalSec / 60;
  const rounded = Math.round(minutes * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Parse user cardio duration as minutes only (e.g. "28" or "28.5").
 * Colon times are rejected — UI is minutes-only.
 */
export function parseDurationToSec(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text || text.includes(":")) return null;
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) return null;
  return Math.round(minutes * 60);
}

export function parseDistanceKm(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 500) return null;
  return Math.round(n * 1000) / 1000;
}

export type CardioSetLike = {
  distanceKm?: number | null;
  durationSec?: number | null;
};

export function cardioSetTotals(sets: readonly CardioSetLike[]): {
  distanceKm: number;
  durationSec: number;
  bestPaceSecPerKm: number | null;
} {
  let distanceKm = 0;
  let durationSec = 0;
  let bestPace: number | null = null;
  for (const s of sets) {
    const d = Number(s.distanceKm);
    const t = Number(s.durationSec);
    if (Number.isFinite(d) && d > 0) distanceKm += d;
    if (Number.isFinite(t) && t > 0) durationSec += t;
    const pace = paceSecPerKm(
      Number.isFinite(d) ? d : 0,
      Number.isFinite(t) ? t : 0,
    );
    if (pace != null && (bestPace == null || pace < bestPace)) {
      bestPace = pace;
    }
  }
  return {
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    durationSec: Math.round(durationSec),
    bestPaceSecPerKm: bestPace == null ? null : Math.round(bestPace * 10) / 10,
  };
}
