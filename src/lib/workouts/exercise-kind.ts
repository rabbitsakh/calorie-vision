export const EXERCISE_KINDS = ["strength", "cardio"] as const;

export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export function isExerciseKind(value: unknown): value is ExerciseKind {
  return typeof value === "string" && (EXERCISE_KINDS as readonly string[]).includes(value);
}

export function parseExerciseKind(raw: unknown, fallback: ExerciseKind = "strength"): ExerciseKind {
  if (isExerciseKind(raw)) return raw;
  return fallback;
}

/** Default kind when adding an exercise to a session with these muscle groups. */
export function defaultExerciseKind(sessionMuscleKeys: readonly string[]): ExerciseKind {
  const keys = sessionMuscleKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 1 && keys[0] === "cardio") return "cardio";
  return "strength";
}
