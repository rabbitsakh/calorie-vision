/**
 * План склейки библиотеки упражнений со справочником.
 * Сухой прогон и --apply строят один и тот же план.
 * Маппинг названий (matchExerciseName) здесь не меняется.
 *
 * В --apply порядок внутри группы такой:
 * 1. Упражнения (и их подходы) и шаблоны перепривязываются к каноническому имени.
 * 2. Лишние строки библиотеки удаляются.
 * 3. Оставляемая строка переименовывается.
 * Если nameNorm справочника уже занят, оставляем именно эту строку.
 */

import { matchExerciseName } from "@/lib/workouts/catalog-link";
import { catalogById, EXERCISE_CATALOG } from "@/lib/workouts/exercise-catalog";

export type LibraryRow = {
  id: string;
  userId: string;
  name: string;
  nameNorm: string;
  kind: string;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: Date;
  catalogId: string | null;
};

export type LibraryWrite = {
  name: string;
  nameNorm: string;
  catalogId: string;
  useCount: number;
  lastUsedAt: Date;
  kind: string;
  defaultMuscleGroup: string | null;
};

export type LibraryMergePlan = {
  keeperId: string;
  data: LibraryWrite;
  deleteIds: string[];
  before: LibraryRow[];
};

export type LinkUncertain = {
  name: string;
  candidate: string;
  score: number;
  reason: string;
};

export type ExerciseRebind = {
  id: string;
  name: string;
  catalogId: string;
};

export type RoutineRebind = {
  id: string;
  name: string;
};

export type CatalogLinkOp =
  | ({ type: "rebind-exercise" } & ExerciseRebind)
  | ({ type: "rebind-routine" } & RoutineRebind)
  | { type: "delete-library"; ids: string[] }
  | { type: "rename-library"; id: string; data: LibraryWrite };

export type CatalogRollback = {
  exercises: Array<{ id: string; name: string; catalogId: string | null }>;
  routineExercises: Array<{ id: string; name: string }>;
  libraryUpdates: LibraryRow[];
  libraryDeleted: LibraryRow[];
};

export type RollbackOp =
  | { type: "restore-library"; row: LibraryRow }
  | { type: "recreate-library"; row: LibraryRow }
  | { type: "restore-exercise"; id: string; name: string; catalogId: string | null }
  | { type: "restore-routine"; id: string; name: string };

function copyLibrary(row: LibraryRow): LibraryRow {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    nameNorm: row.nameNorm,
    kind: row.kind,
    defaultMuscleGroup: row.defaultMuscleGroup,
    useCount: row.useCount,
    lastUsedAt: new Date(row.lastUsedAt),
    catalogId: row.catalogId,
  };
}

function catalogIdsForNorm(nameNorm: string): string[] {
  return EXERCISE_CATALOG.filter((row) => row.nameNorm === nameNorm).map((row) => row.id);
}

/**
 * Группы уверенных совпадений по пользователю.
 * Строка, у которой nameNorm уже равен справочнику, входит в группу
 * даже без тренировок и даже если само имя не попало в уверенные.
 * Неоднозначное имя (несколько карточек справочника с одним nameNorm)
 * по-прежнему не склеивается.
 */
export function planLibraryMerges(rows: readonly LibraryRow[]): {
  plans: LibraryMergePlan[];
  uncertain: LinkUncertain[];
} {
  const plans: LibraryMergePlan[] = [];
  const uncertain: LinkUncertain[] = [];
  const byUser = new Map<string, LibraryRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(copyLibrary(row));
    byUser.set(row.userId, list);
  }

  for (const userRows of byUser.values()) {
    const groups = new Map<string, LibraryRow[]>();
    const groupedIds = new Set<string>();
    for (const row of userRows) {
      const match = matchExerciseName(row.name);
      if (match.status !== "confident") continue;
      const list = groups.get(match.catalogId) ?? [];
      list.push(row);
      groups.set(match.catalogId, list);
      groupedIds.add(row.id);
    }

    for (const [catalogId, group] of groups) {
      const canonical = catalogById(catalogId);
      if (!canonical) continue;

      const holder = userRows.find(
        (row) => row.nameNorm === canonical.nameNorm && !group.some((item) => item.id === row.id),
      );
      if (holder) {
        const owners = catalogIdsForNorm(canonical.nameNorm);
        const canAbsorb = owners.length === 1 && owners[0] === catalogId && !groupedIds.has(holder.id);
        if (!canAbsorb) {
          uncertain.push({
            name: group.map((row) => row.name).join(" / "),
            candidate: canonical.name,
            score: 1,
            reason: "каноническое имя уже занято другой записью библиотеки",
          });
          continue;
        }
        group.push(holder);
        groupedIds.add(holder.id);
      }

      const byUse = [...group].sort(
        (a, b) => b.useCount - a.useCount || b.lastUsedAt.getTime() - a.lastUsedAt.getTime(),
      )[0]!;
      const keeper = group.find((row) => row.nameNorm === canonical.nameNorm) ?? byUse;
      const useCount = group.reduce((sum, row) => sum + row.useCount, 0);
      const lastUsedAt = group.reduce(
        (max, row) => (row.lastUsedAt > max ? row.lastUsedAt : max),
        keeper.lastUsedAt,
      );
      plans.push({
        keeperId: keeper.id,
        data: {
          name: canonical.name,
          nameNorm: canonical.nameNorm,
          catalogId,
          useCount,
          lastUsedAt,
          kind: canonical.kind,
          defaultMuscleGroup:
            keeper.defaultMuscleGroup ?? byUse.defaultMuscleGroup ?? canonical.primary[0] ?? null,
        },
        deleteIds: group.filter((row) => row.id !== keeper.id).map((row) => row.id),
        before: group.map(copyLibrary),
      });
    }
  }

  return { plans, uncertain };
}

/**
 * Сначала перепривязка упражнений (подходы висят на упражнении) и шаблонов,
 * затем удаление лишних строк библиотеки, и только потом переименование.
 */
export function buildApplyOperations(input: {
  plans: readonly LibraryMergePlan[];
  exercisePatches: readonly ExerciseRebind[];
  routinePatches: readonly RoutineRebind[];
}): CatalogLinkOp[] {
  const ops: CatalogLinkOp[] = [];
  for (const patch of input.exercisePatches) {
    ops.push({ type: "rebind-exercise", ...patch });
  }
  for (const patch of input.routinePatches) {
    ops.push({ type: "rebind-routine", ...patch });
  }
  for (const plan of input.plans) {
    if (plan.deleteIds.length > 0) {
      ops.push({ type: "delete-library", ids: [...plan.deleteIds] });
    }
    ops.push({ type: "rename-library", id: plan.keeperId, data: plan.data });
  }
  return ops;
}

/**
 * Сначала возвращаем оставляемой строке прежний nameNorm.
 * Иначе воссоздание удалённой строки с тем же ключом нарушает unique(userId, nameNorm).
 */
export function buildRollbackOperations(data: CatalogRollback): RollbackOp[] {
  return [
    ...data.libraryUpdates.map((row) => ({ type: "restore-library" as const, row })),
    ...data.libraryDeleted.map((row) => ({ type: "recreate-library" as const, row })),
    ...data.exercises.map((row) => ({ type: "restore-exercise" as const, ...row })),
    ...data.routineExercises.map((row) => ({ type: "restore-routine" as const, ...row })),
  ];
}
