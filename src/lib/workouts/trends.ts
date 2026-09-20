import { roundLoad } from "@/lib/workouts/load";
import { muscleGroupLabel } from "@/lib/workouts/muscle-groups";

export type PeriodSession = {
  date: string;
  totalLoad: number;
  loadByGroup: Record<string, number>;
  cardioDistanceKm: number;
  cardioDurationSec: number;
};

export type PeriodStats = {
  sessionCount: number;
  tonnage: number;
  byGroup: Record<string, { load: number; label: string }>;
  cardioDistanceKm: number;
  cardioDurationSec: number;
};

export function aggregatePeriod(
  sessions: readonly PeriodSession[],
  from: string,
  to: string,
): PeriodStats {
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to);
  const byGroupRaw: Record<string, number> = {};
  let tonnage = 0;
  let cardioDistanceKm = 0;
  let cardioDurationSec = 0;
  for (const s of inRange) {
    tonnage += s.totalLoad;
    cardioDistanceKm += s.cardioDistanceKm;
    cardioDurationSec += s.cardioDurationSec;
    for (const [g, load] of Object.entries(s.loadByGroup)) {
      byGroupRaw[g] = (byGroupRaw[g] ?? 0) + load;
    }
  }
  return {
    sessionCount: inRange.length,
    tonnage: roundLoad(tonnage),
    byGroup: Object.fromEntries(
      Object.entries(byGroupRaw).map(([k, v]) => [
        k,
        { load: roundLoad(v), label: muscleGroupLabel(k) },
      ]),
    ),
    cardioDistanceKm: Math.round(cardioDistanceKm * 1000) / 1000,
    cardioDurationSec,
  };
}

export function trendPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return current > 0 && previous === 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** First day of month containing dateKey (YYYY-MM-DD). */
export function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

/** Last day of month containing dateKey. */
export function monthEndKey(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0));
  const dd = String(last.getUTCDate()).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${dd}`;
}
