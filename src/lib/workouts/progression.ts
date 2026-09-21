/**
 * Per-exercise progression helpers: stall detection, deload, next-set autofill.
 */

export type ProgressionPoint = {
  date: string;
  topWeightKg: number;
  topReps: number;
  totalLoad: number;
};

export type ProgressionAdvice = {
  kind: "progress" | "hold" | "stall" | "deload" | "base";
  title: string;
  detail: string;
  suggestedKg: number | null;
};

/** True when last `window` sessions share the same top weight (±0.25 kg). */
export function isStalled(
  points: readonly ProgressionPoint[],
  window = 3,
): boolean {
  if (points.length < window) return false;
  const slice = points.slice(-window);
  const first = slice[0]!.topWeightKg;
  if (!Number.isFinite(first) || first <= 0) return false;
  return slice.every((p) => Math.abs(p.topWeightKg - first) < 0.26);
}

export function suggestDeloadKg(lastKg: number, factor = 0.9): number {
  if (!Number.isFinite(lastKg) || lastKg <= 0) return 0;
  return Math.round(lastKg * factor * 2) / 2;
}

export function bumpKg(kg: number, delta: number): number {
  return Math.round((kg + delta) * 2) / 2;
}

/**
 * Advice from recent timeline + session progress rate.
 * Stall (≥3 flat tops) → propose deload; else progress or hold.
 */
export function adviseProgression(
  points: readonly ProgressionPoint[],
  progressRate: number,
  lastWorkingKg: number | null,
): ProgressionAdvice {
  if (lastWorkingKg == null || lastWorkingKg <= 0) {
    return {
      kind: "base",
      title: "База",
      detail: "Зафиксируйте рабочий вес — дальше подскажем прогрессию.",
      suggestedKg: null,
    };
  }
  if (isStalled(points, 3)) {
    const deload = suggestDeloadKg(lastWorkingKg);
    return {
      kind: "stall",
      title: "Плато",
      detail: `Вес не рос ${Math.min(points.length, 3)} сессии. Deload → ${deload} кг, потом снова вверх.`,
      suggestedKg: deload,
    };
  }
  const rate = Number.isFinite(progressRate) ? Math.max(0, progressRate) : 0.05;
  const next = Math.round(lastWorkingKg * (1 + rate) * 2) / 2;
  if (rate <= 0) {
    return {
      kind: "hold",
      title: "Держим",
      detail: `Повторите ${lastWorkingKg} кг.`,
      suggestedKg: lastWorkingKg,
    };
  }
  return {
    kind: "progress",
    title: "Прогрессия",
    detail: `Цель +${Math.round(rate * 1000) / 10}% → ${next} кг.`,
    suggestedKg: next,
  };
}

export type AutofillSet = {
  weightKg: number | null;
  reps: number | null;
  setType: string;
};

/** Prefer next incomplete planned set; else clone last completed with optional kg bump. */
export function autofillNextDraft(
  sets: ReadonlyArray<{
    weightKg: number | null;
    reps: number | null;
    setType?: string | null;
    completed?: boolean | null;
  }>,
  options?: { progressRate?: number; bumpAfterComplete?: boolean },
): AutofillSet | null {
  const incomplete = sets.find((s) => s.completed === false);
  if (incomplete) {
    return {
      weightKg: incomplete.weightKg,
      reps: incomplete.reps,
      setType: incomplete.setType ?? "working",
    };
  }
  const completed = [...sets].reverse().find((s) => s.completed !== false);
  if (!completed) return null;
  let kg = completed.weightKg;
  if (
    options?.bumpAfterComplete &&
    kg != null &&
    Number.isFinite(kg) &&
    (options.progressRate ?? 0) > 0
  ) {
    kg = Math.round(kg * (1 + (options.progressRate ?? 0.05)) * 2) / 2;
  }
  return {
    weightKg: kg,
    reps: completed.reps,
    setType: completed.setType === "warmup" ? "working" : (completed.setType ?? "working"),
  };
}
