/**
 * Morning moment «цель в жиме» — short label + next kg (+delta from last).
 */

import { formatSuggestedKg, suggestNextWeightKg } from "@/lib/workouts/suggested-load";

export type LiftGoalExercise = {
  name: string;
  kind?: string | null;
  plannedSets?: Array<{ weightKg?: number | null }>;
};

/** Prefer compound strength names; skip cardio/bodyweight-only fluff. */
export function pickMorningLiftExercise(
  exercises: LiftGoalExercise[] | null | undefined,
): LiftGoalExercise | null {
  if (!exercises?.length) return null;
  const strength = exercises.filter((e) => {
    const k = (e.kind ?? "strength").toLowerCase();
    return k === "strength" || k === "barbell" || k === "dumbbell" || k === "machine";
  });
  const pool = strength.length ? strength : exercises;
  const scored = [...pool].sort((a, b) => scoreName(b.name) - scoreName(a.name));
  return scored[0] ?? null;
}

function scoreName(name: string): number {
  const n = name.toLowerCase();
  if (/жим|присед|тяг|станов|bench|squat|dead/.test(n)) return 3;
  if (/гант|штан|жим/.test(n)) return 2;
  return 1;
}

/** «Жим лёжа» → «Жим»; keep short for the hero line. */
export function shortExerciseLabel(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Упражнение";
  const first = trimmed.split(/[,(–—-]/)[0]?.trim() || trimmed;
  if (first.length <= 18) return first;
  return `${first.slice(0, 16).trim()}…`;
}

export function plannedMaxKg(ex: LiftGoalExercise): number | null {
  const weights = (ex.plannedSets ?? [])
    .map((s) => Number(s.weightKg))
    .filter((w) => Number.isFinite(w) && w > 0);
  if (!weights.length) return null;
  return Math.max(...weights);
}

/**
 * «Жим · 80 кг (+2.5)» or «Жим · 80 кг» when no last session.
 */
export function formatMorningLiftGoalHint(input: {
  exerciseName: string;
  lastKg: number | null;
  progressRate?: number;
  plannedKg?: number | null;
}): string | null {
  const label = shortExerciseLabel(input.exerciseName);
  const last = input.lastKg != null && input.lastKg > 0 ? input.lastKg : null;
  const planned = input.plannedKg != null && input.plannedKg > 0 ? input.plannedKg : null;

  if (last != null) {
    const next = suggestNextWeightKg(last, input.progressRate ?? 0.05);
    if (next == null) return `${label} · ${formatSuggestedKg(last)} кг`;
    const delta = Math.round((next - last) * 10) / 10;
    if (Math.abs(delta) < 0.05) {
      return `${label} · ${formatSuggestedKg(next)} кг`;
    }
    const sign = delta > 0 ? "+" : "";
    return `${label} · ${formatSuggestedKg(next)} кг (${sign}${formatSuggestedKg(delta)})`;
  }

  if (planned != null) {
    return `${label} · ${formatSuggestedKg(planned)} кг`;
  }

  return null;
}
