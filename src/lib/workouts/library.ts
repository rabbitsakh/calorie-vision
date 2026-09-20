import type { Prisma, PrismaClient } from "@prisma/client";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";

type Db = PrismaClient | Prisma.TransactionClient;

export type LibraryEntryInput = {
  name: string;
  kind?: unknown;
  muscleGroup?: string | null;
};

/** Upsert library row and bump useCount / lastUsedAt. */
export async function touchExerciseLibrary(
  db: Db,
  userId: string,
  input: LibraryEntryInput,
): Promise<void> {
  const name = input.name.trim().slice(0, 120);
  const nameNorm = normalizeExerciseName(name);
  if (!nameNorm) return;

  const kind = parseExerciseKind(input.kind, "strength");
  const defaultMuscleGroup =
    input.muscleGroup && isMuscleGroupKey(input.muscleGroup) ? input.muscleGroup : null;

  const existing = await db.workoutExerciseLibrary.findUnique({
    where: { userId_nameNorm: { userId, nameNorm } },
  });

  if (!existing) {
    await db.workoutExerciseLibrary.create({
      data: {
        userId,
        name,
        nameNorm,
        kind,
        defaultMuscleGroup,
        useCount: 1,
        lastUsedAt: new Date(),
      },
    });
    return;
  }

  await db.workoutExerciseLibrary.update({
    where: { id: existing.id },
    data: {
      name,
      kind,
      ...(defaultMuscleGroup != null ? { defaultMuscleGroup } : {}),
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

export async function touchExerciseLibraryMany(
  db: Db,
  userId: string,
  entries: LibraryEntryInput[],
): Promise<void> {
  for (const entry of entries) {
    await touchExerciseLibrary(db, userId, entry);
  }
}

export type SerializedLibraryEntry = {
  id: string;
  name: string;
  kind: ExerciseKind;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: string;
};

export function serializeLibraryEntry(row: {
  id: string;
  name: string;
  kind: string;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: Date;
}): SerializedLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    kind: parseExerciseKind(row.kind, "strength"),
    defaultMuscleGroup: row.defaultMuscleGroup,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt.toISOString(),
  };
}

/**
 * If the user has no library rows yet, seed from past workout exercises.
 * Returns number of rows created.
 */
export async function seedLibraryFromHistory(db: Db, userId: string): Promise<number> {
  const existing = await db.workoutExerciseLibrary.count({ where: { userId } });
  if (existing > 0) return 0;

  const sessions = await db.workoutSession.findMany({
    where: { userId },
    include: { exercises: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 80,
  });

  const byNorm = new Map<
    string,
    { name: string; kind: string; muscleGroup: string | null; lastUsedAt: Date; useCount: number }
  >();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const nameNorm = normalizeExerciseName(ex.name);
      if (!nameNorm) continue;
      const prev = byNorm.get(nameNorm);
      if (!prev) {
        byNorm.set(nameNorm, {
          name: ex.name.trim().slice(0, 120),
          kind: ex.kind ?? "strength",
          muscleGroup: ex.muscleGroup,
          lastUsedAt: session.createdAt,
          useCount: 1,
        });
      } else {
        prev.useCount += 1;
        if (session.createdAt > prev.lastUsedAt) {
          prev.lastUsedAt = session.createdAt;
          prev.name = ex.name.trim().slice(0, 120);
          prev.kind = ex.kind ?? prev.kind;
          if (ex.muscleGroup) prev.muscleGroup = ex.muscleGroup;
        }
      }
    }
  }

  if (byNorm.size === 0) return 0;

  const now = new Date();
  await db.workoutExerciseLibrary.createMany({
    data: [...byNorm.entries()].map(([nameNorm, v]) => ({
      userId,
      name: v.name,
      nameNorm,
      kind: parseExerciseKind(v.kind, "strength"),
      defaultMuscleGroup:
        v.muscleGroup && isMuscleGroupKey(v.muscleGroup) ? v.muscleGroup : null,
      useCount: v.useCount,
      lastUsedAt: v.lastUsedAt,
      updatedAt: now,
    })),
  });

  return byNorm.size;
}
