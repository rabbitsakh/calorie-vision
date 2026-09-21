export const EXERCISE_KINDS = [
  "strength",
  "cardio",
  "bodyweight",
  "duration",
  "weighted_bw",
  "assisted",
] as const;

export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export const EXERCISE_KIND_LABELS: Record<ExerciseKind, string> = {
  strength: "Силовое",
  cardio: "Кардио",
  bodyweight: "Свой вес",
  duration: "Время",
  weighted_bw: "+Вес",
  assisted: "Помощь",
};

export const EXERCISE_KIND_PLACEHOLDERS: Record<ExerciseKind, string> = {
  strength: "Жим лёжа",
  cardio: "Бег / велосипед",
  bodyweight: "Подтягивания",
  duration: "Планка",
  weighted_bw: "Подтягивания с весом",
  assisted: "Подтягивания с помощью",
};

export type KindFieldSpec = {
  usesWeight: boolean;
  usesReps: boolean;
  usesDistance: boolean;
  usesDuration: boolean;
  /** Counts toward session kg·reps tonnage. */
  countsTowardLoad: boolean;
};

export const KIND_FIELDS: Record<ExerciseKind, KindFieldSpec> = {
  strength: {
    usesWeight: true,
    usesReps: true,
    usesDistance: false,
    usesDuration: false,
    countsTowardLoad: true,
  },
  cardio: {
    usesWeight: false,
    usesReps: false,
    usesDistance: true,
    usesDuration: true,
    countsTowardLoad: false,
  },
  bodyweight: {
    usesWeight: false,
    usesReps: true,
    usesDistance: false,
    usesDuration: false,
    countsTowardLoad: false,
  },
  duration: {
    usesWeight: false,
    usesReps: false,
    usesDistance: false,
    usesDuration: true,
    countsTowardLoad: false,
  },
  weighted_bw: {
    usesWeight: true,
    usesReps: true,
    usesDistance: false,
    usesDuration: false,
    countsTowardLoad: true,
  },
  assisted: {
    usesWeight: true,
    usesReps: true,
    usesDistance: false,
    usesDuration: false,
    countsTowardLoad: false,
  },
};

export function isExerciseKind(value: unknown): value is ExerciseKind {
  return typeof value === "string" && (EXERCISE_KINDS as readonly string[]).includes(value);
}

export function parseExerciseKind(raw: unknown, fallback: ExerciseKind = "strength"): ExerciseKind {
  if (isExerciseKind(raw)) return raw;
  return fallback;
}

export function fieldsForKind(kind: ExerciseKind): KindFieldSpec {
  return KIND_FIELDS[kind];
}

export function kindLabel(kind: ExerciseKind | string): string {
  if (isExerciseKind(kind)) return EXERCISE_KIND_LABELS[kind];
  return kind;
}

/** Default kind when adding an exercise to a session with these muscle groups. */
export function defaultExerciseKind(sessionMuscleKeys: readonly string[]): ExerciseKind {
  const keys = sessionMuscleKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 1 && keys[0] === "cardio") return "cardio";
  return "strength";
}

/** Kinds that show a rest timer after a working set. */
export function kindUsesRestTimer(kind: ExerciseKind): boolean {
  return kind !== "cardio" && kind !== "duration";
}

/** Warmup / working / drop / failure chips — not meaningful for cardio. */
export function kindUsesSetTypes(kind: ExerciseKind): boolean {
  return kind !== "cardio";
}
