import type { Prisma } from "@prisma/client";
import { parseBlockMode, parseCircuitRounds, type BlockMode } from "@/lib/workouts/block-mode";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { muscleGroupLabel } from "@/lib/workouts/muscle-groups";
import { parseSetType, type SetType } from "@/lib/workouts/set-meta";
import { parseSupersetGroup } from "@/lib/workouts/supersets";
import { parsePlanLabel, parseWeekdays } from "@/lib/workouts/weekdays";

export type PlannedSet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: SetType;
};

export function parsePlannedSets(raw: unknown): PlannedSet[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedSet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const weightKg =
      row.weightKg == null || row.weightKg === ""
        ? null
        : Number.isFinite(Number(row.weightKg))
          ? Number(row.weightKg)
          : null;
    const reps =
      row.reps == null || row.reps === ""
        ? null
        : Number.isFinite(Number(row.reps))
          ? Math.round(Number(row.reps))
          : null;
    const distanceKm =
      row.distanceKm == null || row.distanceKm === ""
        ? null
        : Number.isFinite(Number(row.distanceKm))
          ? Number(row.distanceKm)
          : null;
    const durationSec =
      row.durationSec == null || row.durationSec === ""
        ? null
        : Number.isFinite(Number(row.durationSec))
          ? Math.round(Number(row.durationSec))
          : null;
    out.push({
      weightKg,
      reps,
      distanceKm,
      durationSec,
      setType: parseSetType(row.setType, "working"),
    });
  }
  return out;
}

export function plannedSetsToJson(sets: PlannedSet[]): Prisma.InputJsonValue {
  return sets.map((s) => ({
    weightKg: s.weightKg,
    reps: s.reps,
    distanceKm: s.distanceKm,
    durationSec: s.durationSec,
    setType: s.setType,
  }));
}

export const routineInclude = {
  muscles: true,
  exercises: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.WorkoutRoutineInclude;

export type RoutineRow = Prisma.WorkoutRoutineGetPayload<{ include: typeof routineInclude }>;

export type SerializedRoutine = {
  id: string;
  name: string;
  note: string | null;
  sortOrder: number;
  weekdays: number[];
  planLabel: string | null;
  muscleKeys: string[];
  muscleLabels: string[];
  exerciseCount: number;
  exercises: Array<{
    id: string;
    name: string;
    kind: ExerciseKind;
    muscleGroup: string | null;
    sortOrder: number;
    plannedSets: PlannedSet[];
    supersetGroup: string | null;
    blockMode: BlockMode;
    circuitRounds: number | null;
  }>;
  updatedAt: string;
};

export function serializeRoutine(row: RoutineRow): SerializedRoutine {
  const muscleKeys = row.muscles.map((m) => m.groupKey);
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    sortOrder: row.sortOrder,
    weekdays: parseWeekdays(row.weekdays),
    planLabel: row.planLabel?.trim() || null,
    muscleKeys,
    muscleLabels: muscleKeys.map(muscleGroupLabel),
    exerciseCount: row.exercises.length,
    exercises: row.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      kind: parseExerciseKind(ex.kind, "strength"),
      muscleGroup: ex.muscleGroup,
      sortOrder: ex.sortOrder,
      plannedSets: parsePlannedSets(ex.plannedSets),
      supersetGroup: ex.supersetGroup?.trim() || null,
      blockMode: parseBlockMode(ex.blockMode),
      circuitRounds: ex.circuitRounds ?? null,
    })),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type RoutineExerciseInput = {
  name: string;
  kind?: unknown;
  muscleGroup?: string | null;
  plannedSets?: unknown;
  supersetGroup?: unknown;
  blockMode?: unknown;
  circuitRounds?: unknown;
};

export function normalizeRoutineExerciseInputs(
  raw: unknown,
): Array<{
  name: string;
  kind: ExerciseKind;
  muscleGroup: string | null;
  plannedSets: PlannedSet[];
  supersetGroup: string | null;
  blockMode: BlockMode;
  circuitRounds: number | null;
}> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: Array<{
    name: string;
    kind: ExerciseKind;
    muscleGroup: string | null;
    plannedSets: PlannedSet[];
    supersetGroup: string | null;
    blockMode: BlockMode;
    circuitRounds: number | null;
  }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 120) : "";
    if (!name) continue;
    const muscleGroup =
      typeof row.muscleGroup === "string" && row.muscleGroup.trim()
        ? row.muscleGroup.trim().slice(0, 32)
        : null;
    const sg = parseSupersetGroup(row.supersetGroup);
    const mode = parseBlockMode(row.blockMode);
    out.push({
      name,
      kind: parseExerciseKind(row.kind, "strength"),
      muscleGroup,
      plannedSets: parsePlannedSets(row.plannedSets),
      supersetGroup: sg === undefined ? null : sg,
      blockMode: mode,
      circuitRounds: mode === "circuit" ? parseCircuitRounds(row.circuitRounds) : null,
    });
  }
  return out.length > 0 ? out : null;
}

export { parsePlanLabel, parseWeekdays };
