/**
 * Map assistant cv-actions → meal saves / workout routine drafts.
 */

import type { AssistantActions } from "@/lib/admin-assistant";
import { isMuscleGroupKey, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

const FOCUS_HINTS: Array<{ re: RegExp; key: MuscleGroupKey }> = [
  { re: /груд|жим л[её]жа|chest|пекс/i, key: "chest" },
  { re: /спин|тяга|подтягив|back|широчай/i, key: "back" },
  { re: /ног|присед|выпад|бёдр|икр|legs|squat/i, key: "legs" },
  { re: /плеч|жим стоя|shoulders|дельт/i, key: "shoulders" },
  { re: /бицепс|biceps|сгиб/i, key: "biceps" },
  { re: /трицепс|triceps|разгиб/i, key: "triceps" },
  { re: /пресс|кор|abs|core/i, key: "abs" },
  { re: /кардио|бег|велосипед|эллипс|cardio/i, key: "cardio" },
];

export function muscleGroupsFromFocus(focus: string): MuscleGroupKey[] {
  const found: MuscleGroupKey[] = [];
  const seen = new Set<string>();
  for (const hint of FOCUS_HINTS) {
    if (!hint.re.test(focus)) continue;
    if (seen.has(hint.key)) continue;
    seen.add(hint.key);
    found.push(hint.key);
  }
  return found.length ? found : ["other"];
}

export function exercisesFromWorkoutDay(day: {
  focus: string;
  notes?: string;
}): Array<{ name: string; muscleGroup: MuscleGroupKey }> {
  const groups = muscleGroupsFromFocus(day.focus);
  const primary = groups[0] ?? "other";
  const names: string[] = [];
  if (day.notes) {
    for (const part of day.notes.split(/[,;/·•]|\n/)) {
      const n = part.trim().replace(/^\d+[\).\s-]*/, "").slice(0, 80);
      if (n.length >= 2) names.push(n);
      if (names.length >= 6) break;
    }
  }
  if (names.length === 0) {
    names.push(`${day.focus} — упражнение 1`.slice(0, 80));
    names.push(`${day.focus} — упражнение 2`.slice(0, 80));
    names.push(`${day.focus} — упражнение 3`.slice(0, 80));
  }
  return names.map((name, i) => ({
    name,
    muscleGroup: groups[i % groups.length] ?? primary,
  }));
}

export function buildRoutinePayloadFromActions(
  actions: AssistantActions,
  opts?: { namePrefix?: string },
): {
  name: string;
  note: string;
  muscleGroups: MuscleGroupKey[];
  exercises: Array<{ name: string; muscleGroup: MuscleGroupKey }>;
} | null {
  const days = actions.workoutDays ?? [];
  if (!days.length) return null;
  const allExercises: Array<{ name: string; muscleGroup: MuscleGroupKey }> = [];
  const muscleSet = new Set<MuscleGroupKey>();
  for (const day of days.slice(0, 7)) {
    const exs = exercisesFromWorkoutDay(day);
    for (const ex of exs) {
      allExercises.push({
        name: `${day.day}: ${ex.name}`.slice(0, 120),
        muscleGroup: ex.muscleGroup,
      });
      muscleSet.add(ex.muscleGroup);
    }
  }
  if (!allExercises.length) return null;
  const muscleGroups = [...muscleSet].filter(isMuscleGroupKey);
  const prefix = opts?.namePrefix?.trim() || "План AI";
  const name = `${prefix}: ${days
    .slice(0, 3)
    .map((d) => d.day)
    .join(", ")}`.slice(0, 120);
  const note = (actions.summary || days.map((d) => `${d.day} — ${d.focus}`).join("; ")).slice(
    0,
    200,
  );
  return {
    name,
    note,
    muscleGroups: muscleGroups.length ? muscleGroups : ["other"],
    exercises: allExercises.slice(0, 24),
  };
}

export function mealsPayloadFromActions(
  actions: AssistantActions,
  date: string,
): Array<{
  date: string;
  dishName: string;
  calories: number;
  recognitionSource: string;
}> {
  const meals = actions.meals ?? [];
  return meals
    .filter((m) => m.name.trim())
    .slice(0, 12)
    .map((m) => ({
      date,
      dishName: m.name.trim().slice(0, 200),
      calories: typeof m.kcal === "number" && Number.isFinite(m.kcal) ? Math.max(1, Math.round(m.kcal)) : 200,
      recognitionSource: "assistant",
    }));
}
