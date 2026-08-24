/** Tone for a calendar heatmap cell vs daily calorie target. */
export type HeatmapTone = "empty" | "under" | "good" | "over" | "logged";

/**
 * Map day calories to a heatmap tone.
 * With a target: under &lt;70%, good 70–110%, over &gt;110%.
 * Without a target: any logged day is "logged".
 */
export function heatmapCellTone(
  calories: number | null | undefined,
  target: number | null | undefined,
): HeatmapTone {
  const kcal = calories ?? 0;
  if (kcal <= 0) return "empty";
  if (!target || target <= 0) return "logged";
  const ratio = kcal / target;
  if (ratio < 0.7) return "under";
  if (ratio <= 1.1) return "good";
  return "over";
}

export const HEATMAP_TONE_CLASS: Record<HeatmapTone, string> = {
  empty: "bg-slate-100 text-slate-300",
  under: "bg-sky-200 text-sky-900",
  good: "bg-teal-500 text-white",
  over: "bg-rose-400 text-white",
  logged: "bg-teal-200 text-teal-900",
};
