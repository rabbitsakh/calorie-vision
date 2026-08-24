/** Quiet hours for push reminders (local clock, 0–23). */

export function clampHour(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const hour = Math.trunc(n);
  if (hour < 0 || hour > 23) return null;
  return hour;
}

/**
 * True when `hour` falls in [start, end) in local time.
 * Supports ranges that wrap midnight (e.g. 22→7).
 * Equal start/end or either null → quiet hours disabled.
 */
export function isInQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false;
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (start < end) {
    return h >= start && h < end;
  }
  // Wraps midnight: e.g. 22–7 → 22,23,0,1,2,3,4,5,6
  return h >= start || h < end;
}

export function formatQuietHoursLabel(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null || end == null || start === end) {
    return "выключены";
  }
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${pad(start)}–${pad(end)}`;
}
