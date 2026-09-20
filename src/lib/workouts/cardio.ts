/** Pace as seconds per km (lower is faster). Null if distance missing. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  return durationSec / distanceKm;
}

export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const sec = Math.round(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Format pace as m:ss / км. */
export function formatPace(secPerKm: number | null | undefined): string | null {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
  return `${formatDuration(secPerKm)}/км`;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "0";
  const rounded = Math.round(km * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Parse user duration input:
 * - "mm:ss" or "h:mm:ss"
 * - plain minutes (e.g. "28" or "28.5")
 */
export function parseDurationToSec(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  if (text.includes(":")) {
    const parts = text.split(":").map((p) => p.trim());
    if (parts.length === 2 || parts.length === 3) {
      const nums = parts.map((p) => Number(p));
      if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
      if (parts.length === 2) {
        const [m, s] = nums as [number, number];
        if (s >= 60) return null;
        return Math.round(m * 60 + s);
      }
      const [h, m, s] = nums as [number, number, number];
      if (m >= 60 || s >= 60) return null;
      return Math.round(h * 3600 + m * 60 + s);
    }
    return null;
  }
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
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
