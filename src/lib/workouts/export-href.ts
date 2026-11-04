import { mondayOfWeek, shiftDateKey } from "@/lib/dates";
import { exportDownloadName, exportQueryPath } from "@/lib/export/paths";
import { monthEndKey } from "@/lib/workouts/trends";

export type WorkoutExportFormat = "csv" | "pdf";

/** Same-origin path the diary export uses, with a workouts resource. */
export function workoutExportPath(
  format: WorkoutExportFormat,
  from?: string | null,
  to?: string | null,
): string {
  return exportQueryPath("workouts", format, from, to);
}

export function workoutExportFilename(
  format: WorkoutExportFormat,
  from?: string | null,
  to?: string | null,
): string {
  return exportDownloadName("workouts", format, from, to);
}

/**
 * Date window for the gym history filters.
 * «Все» (and a day without a picked date) exports the whole log.
 */
export function workoutHistoryExportRange(input: {
  filterPeriod: "all" | "week" | "month" | "day";
  filterDate: string | null;
  todayKey: string;
  /** 0-based month, same as the gym calendar. */
  calMonth: number;
  calYear: number;
}): { from: string | null; to: string | null } {
  if (input.filterPeriod === "day" && input.filterDate) {
    return { from: input.filterDate, to: input.filterDate };
  }
  if (input.filterPeriod === "week") {
    const start = mondayOfWeek(input.todayKey);
    return { from: start, to: shiftDateKey(start, 6) };
  }
  if (input.filterPeriod === "month") {
    const ym = `${String(input.calYear).padStart(4, "0")}-${String(input.calMonth + 1).padStart(2, "0")}`;
    const from = `${ym}-01`;
    return { from, to: monthEndKey(from) };
  }
  return { from: null, to: null };
}
