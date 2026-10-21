/**
 * Wave T — same-day weight overwrite needs an explicit confirm.
 * Treat values within 0.05 kg as the same (rounding noise).
 */

export type WeightDayConflict = {
  id: string;
  date: string;
  weightKg: number;
  measuredAt: string;
  note?: string | null;
};

export function weightsDiffer(a: number, b: number, epsilon = 0.05): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) > epsilon;
}

function fmtKg(kg: number): string {
  return Number(kg).toFixed(1).replace(/\.0$/, "");
}

export function formatWeightDayConflictPrompt(
  existingKg: number,
  nextKg: number,
): string {
  return `Сегодня уже записано ${fmtKg(existingKg)} кг. Заменить на ${fmtKg(nextKg)} кг?`;
}

/** Short CTA labels for offline queue / confirm sheets. */
export function formatWeightReplaceCta(nextKg: number): string {
  return `Заменить на ${fmtKg(nextKg)} кг`;
}

export function formatWeightKeepCta(existingKg: number): string {
  return `Оставить ${fmtKg(existingKg)} кг`;
}

export function isWeightDayConflictPayload(
  payload: unknown,
): payload is { error: string; conflict: WeightDayConflict } {
  if (!payload || typeof payload !== "object") return false;
  const conflict = (payload as { conflict?: unknown }).conflict;
  if (!conflict || typeof conflict !== "object") return false;
  const c = conflict as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.date === "string" &&
    typeof c.weightKg === "number" &&
    typeof c.measuredAt === "string"
  );
}
