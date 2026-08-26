/** Soft intermittent-fasting eating window (local clock, 0–23). Not medical advice. */

import { clampHour, formatQuietHoursLabel, isInQuietHours } from "@/lib/quiet-hours";

export { clampHour };

/**
 * `start`/`end` define the **eating** window [start, end).
 * Supports ranges that wrap midnight (e.g. 12→20 or 20→8).
 * Equal start/end or either null → feature disabled (always “inside” eating).
 */
export function isOutsideEatingWindow(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false;
  return !isInQuietHours(hour, start, end);
}

export function formatEatingWindowLabel(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null || end == null || start === end) {
    return "выключено";
  }
  return formatQuietHoursLabel(start, end);
}
