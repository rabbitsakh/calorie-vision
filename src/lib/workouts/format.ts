/** Shared display helpers for gym hub panels. */

export function formatWorkoutLoad(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 100
    ? Math.round(value).toLocaleString("ru-RU")
    : String(Math.round(value * 10) / 10);
}

export function formatWorkoutTrend(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}
