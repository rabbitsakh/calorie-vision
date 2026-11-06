/**
 * Layout helpers for stats charts.
 * Date ticks stay sparse on month/quarter.
 * Calorie value labels are placed on every logged day — a sparse subset hid bars
 * (week max 5 dropped two columns even when the number would fit).
 */

export const CALORIE_BAR_PLOT_HEIGHT_PX = 144;
export const CALORIE_BAR_LABEL_FONT_PX = 12;
export const CALORIE_BAR_LABEL_GAP_PX = 4;
/** Gap between day columns. Kept in sync with the chart flex gap. */
export const CALORIE_BAR_COLUMN_GAP_PX = 2;
/** Extra pixels above the tallest label so the glyph is not shaved by overflow. */
const CALORIE_LABEL_HEADROOM_SLACK_PX = 6;

export function chartRange(values: number[], paddingRatio = 0.1): { min: number; max: number } {
  const filtered = values.filter((v) => v > 0);
  if (filtered.length === 0) return { min: 0, max: 1 };
  const rawMin = Math.min(...filtered);
  const rawMax = Math.max(...filtered);
  if (rawMin === rawMax) {
    const pad = Math.max(rawMin * 0.05, 1);
    return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
  }
  const span = rawMax - rawMin;
  const pad = span * paddingRatio;
  return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
}

export function yAxisTicks(min: number, max: number, count = 4): number[] {
  if (count < 2) return [max, min];
  const span = max - min;
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(min + (span * i) / (count - 1));
  return ticks.reverse();
}

export function formatCalorieBarValue(value: number): string {
  return String(Math.round(value));
}

/** Bar height in the plot. Zero calories stay a stub, not a bar. */
export function calorieBarHeightPx(
  value: number,
  min: number,
  max: number,
  plotHeightPx = CALORIE_BAR_PLOT_HEIGHT_PX,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const span = Math.max(max - min, 1);
  return Math.max(Math.round(((value - min) / span) * plotHeightPx), 6);
}

/**
 * Block size of a vertical kcal label.
 * Digit advance of Manrope semibold is the vertical measure; pad so the last
 * digit is not clipped when the column uses overflow:hidden.
 */
export function verticalCalorieLabelHeightPx(
  text: string,
  fontPx = CALORIE_BAR_LABEL_FONT_PX,
): number {
  const chars = Math.max(Array.from(text).length, 1);
  return Math.ceil(chars * fontPx * 0.68 + fontPx * 0.55);
}

/** Cross size of that vertical label — a column must be at least this wide. */
export function calorieColumnMinWidthPx(fontPx = CALORIE_BAR_LABEL_FONT_PX): number {
  return Math.ceil(fontPx * 1.2 + 8);
}

export function calorieBarsContentMinWidthPx(
  dayCount: number,
  columnMinPx: number,
  gapPx = CALORIE_BAR_COLUMN_GAP_PX,
): number {
  if (dayCount <= 0) return 0;
  return dayCount * columnMinPx + Math.max(0, dayCount - 1) * gapPx;
}

export type CalorieLabelPlacement = {
  /** Distance from the bottom of the chart column, in px. */
  bottomPx: number;
  /** Label sits inside a tall bar because the space above it is shorter than the text. */
  inside: boolean;
};

/**
 * Keep the whole label inside the column.
 * Prefer the gap above the bar. If the bar reaches the top, tuck the text into the bar.
 */
export function placeCalorieValueLabel(input: {
  barHeightPx: number;
  totalHeightPx: number;
  labelHeightPx: number;
  gapPx?: number;
}): CalorieLabelPlacement {
  const gapPx = input.gapPx ?? CALORIE_BAR_LABEL_GAP_PX;
  const aboveBottom = input.barHeightPx + gapPx;
  if (aboveBottom + input.labelHeightPx <= input.totalHeightPx) {
    return { bottomPx: aboveBottom, inside: false };
  }
  const insideBottom = input.barHeightPx - gapPx - input.labelHeightPx;
  if (insideBottom >= 0) {
    return { bottomPx: insideBottom, inside: true };
  }
  return {
    bottomPx: Math.max(0, input.totalHeightPx - input.labelHeightPx),
    inside: false,
  };
}

export type CalorieBarLabel = {
  text: string;
  bottomPx: number;
  heightPx: number;
  inside: boolean;
};

export type CalorieBarModel = {
  index: number;
  value: number;
  heightPx: number;
  overTarget: boolean;
  label: CalorieBarLabel | null;
};

export type CalorieBarChartModel = {
  min: number;
  max: number;
  plotHeightPx: number;
  labelAreaHeightPx: number;
  totalHeightPx: number;
  columnMinPx: number;
  columnGapPx: number;
  contentMinWidthPx: number;
  bars: CalorieBarModel[];
};

export function planCalorieBarChart(input: {
  values: number[];
  target?: number | null;
  plotHeightPx?: number;
  fontPx?: number;
  gapPx?: number;
}): CalorieBarChartModel {
  const plotHeightPx = input.plotHeightPx ?? CALORIE_BAR_PLOT_HEIGHT_PX;
  const fontPx = input.fontPx ?? CALORIE_BAR_LABEL_FONT_PX;
  const gapPx = input.gapPx ?? CALORIE_BAR_LABEL_GAP_PX;
  const target = input.target != null && input.target > 0 ? input.target : null;

  const present = input.values.filter((value) => Number.isFinite(value) && value > 0);
  const { min, max } = chartRange(target != null ? [...present, target] : present);

  const labelHeights = input.values.map((value) =>
    Number.isFinite(value) && value > 0
      ? verticalCalorieLabelHeightPx(formatCalorieBarValue(value), fontPx)
      : 0,
  );
  const maxLabelHeight = labelHeights.reduce((tallest, height) => Math.max(tallest, height), 0);
  const labelAreaHeightPx =
    maxLabelHeight > 0 ? maxLabelHeight + gapPx + CALORIE_LABEL_HEADROOM_SLACK_PX : 8;
  const totalHeightPx = plotHeightPx + labelAreaHeightPx;
  const columnMinPx = calorieColumnMinWidthPx(fontPx);

  const bars: CalorieBarModel[] = input.values.map((value, index) => {
    const safe = Number.isFinite(value) ? value : 0;
    const heightPx = calorieBarHeightPx(safe, min, max, plotHeightPx);
    const overTarget = target != null && safe > target;
    if (safe <= 0) {
      return { index, value: safe, heightPx: 0, overTarget: false, label: null };
    }
    const text = formatCalorieBarValue(safe);
    const labelHeightPx = labelHeights[index] ?? verticalCalorieLabelHeightPx(text, fontPx);
    const place = placeCalorieValueLabel({
      barHeightPx: heightPx,
      totalHeightPx,
      labelHeightPx,
      gapPx,
    });
    return {
      index,
      value: safe,
      heightPx,
      overTarget,
      label: {
        text,
        bottomPx: place.bottomPx,
        heightPx: labelHeightPx,
        inside: place.inside,
      },
    };
  });

  return {
    min,
    max,
    plotHeightPx,
    labelAreaHeightPx,
    totalHeightPx,
    columnMinPx,
    columnGapPx: CALORIE_BAR_COLUMN_GAP_PX,
    contentMinWidthPx: calorieBarsContentMinWidthPx(input.values.length, columnMinPx),
    bars,
  };
}

export function axisLabelIndices(
  total: number,
  period: "week" | "month" | "quarter",
): Set<number> {
  if (total <= 0) return new Set();
  if (total === 1) return new Set([0]);
  const maxLabels = period === "week" ? Math.min(7, total) : period === "month" ? 5 : 4;
  if (total <= maxLabels) {
    return new Set(Array.from({ length: total }, (_, i) => i));
  }
  const indices = new Set<number>([0, total - 1]);
  const inner = maxLabels - 2;
  for (let i = 1; i <= inner; i += 1) {
    indices.add(Math.round((i * (total - 1)) / (inner + 1)));
  }
  return indices;
}

/**
 * Sparse callouts for the weight line, where horizontal labels collide.
 * Calorie bars do not use this — every logged day keeps its own number.
 */
export function sparseValueLabelIndices(
  points: Array<{ index: number; value: number }>,
  maxLabels: number,
): Set<number> {
  if (points.length === 0 || maxLabels <= 0) return new Set();
  if (points.length <= maxLabels) return new Set(points.map((p) => p.index));

  const byValue = [...points].sort((a, b) => a.value - b.value);
  const picks = new Map<number, { index: number; value: number }>();
  const add = (p: { index: number; value: number }) => picks.set(p.index, p);
  add(points[0]!);
  add(points[points.length - 1]!);
  add(byValue[0]!);
  add(byValue[byValue.length - 1]!);

  const minGap = Math.max(1, Math.floor(points.length / maxLabels));
  for (const p of points) {
    if (picks.size >= maxLabels) break;
    const tooClose = [...picks.values()].some((q) => Math.abs(q.index - p.index) < minGap);
    if (!tooClose) add(p);
  }

  if (picks.size > maxLabels) {
    return new Set([
      points[0]!.index,
      points[points.length - 1]!.index,
      byValue[0]!.index,
      byValue[byValue.length - 1]!.index,
    ]);
  }
  return new Set(picks.keys());
}
