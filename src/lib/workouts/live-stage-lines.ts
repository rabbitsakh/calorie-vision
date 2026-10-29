type StageSet = { completed: boolean; reps: number | null };
type StageExercise = { id: string; name: string; supersetGroup?: string | null; sets: StageSet[] };

/** Share of completed sets, 0…1 — drives the exercise progress strip. */
export function exerciseDoneShare(ex: Pick<StageExercise, "sets">): number {
  if (ex.sets.length === 0) return 0;
  return ex.sets.filter((s) => s.completed).length / ex.sets.length;
}

/** «Далее: Брусья · 3 × 10» — next exercise after the focused one (skips its superset group). */
export function nextExerciseLine(exercises: StageExercise[], focusId: string): string | null {
  const idx = exercises.findIndex((e) => e.id === focusId);
  if (idx < 0) return null;
  const group = exercises[idx]!.supersetGroup;
  const next = exercises.slice(idx + 1).find((e) => !group || e.supersetGroup !== group);
  if (!next) return null;
  const reps = next.sets.find((s) => s.reps != null)?.reps;
  const count = next.sets.length;
  const tail = count > 0 ? (reps != null ? ` · ${count} × ${reps}` : ` · ${count} подх.`) : "";
  return `Далее: ${next.name}${tail}`;
}
