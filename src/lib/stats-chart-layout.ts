/** Layout helpers for stats charts — keep labels sparse on narrow screens. */

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
 * Pick a sparse subset of point indices for value callouts so labels do not collide.
 * Prefers endpoints and local extrema.
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
