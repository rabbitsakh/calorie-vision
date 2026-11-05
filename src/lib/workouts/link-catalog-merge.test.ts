import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExerciseName } from "./exercise-name.ts";
import {
  buildApplyOperations,
  buildRollbackOperations,
  planLibraryMerges,
  type CatalogLinkOp,
  type CatalogRollback,
  type LibraryRow,
  type RollbackOp,
} from "./link-catalog-merge.ts";

function row(partial: {
  id: string;
  name: string;
  nameNorm?: string;
  useCount?: number;
  lastUsedAt?: Date;
  defaultMuscleGroup?: string | null;
  catalogId?: string | null;
  userId?: string;
  kind?: string;
}): LibraryRow {
  return {
    id: partial.id,
    userId: partial.userId ?? "user-1",
    name: partial.name,
    nameNorm: partial.nameNorm ?? normalizeExerciseName(partial.name),
    kind: partial.kind ?? "strength",
    defaultMuscleGroup: partial.defaultMuscleGroup ?? null,
    useCount: partial.useCount ?? 0,
    lastUsedAt: partial.lastUsedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    catalogId: partial.catalogId ?? null,
  };
}

type LibState = Map<string, LibraryRow>;
type ExerciseState = { id: string; name: string; catalogId: string | null; setIds: string[] };

function cloneLibs(rows: readonly LibraryRow[]): LibState {
  return new Map(rows.map((item) => [item.id, { ...item, lastUsedAt: new Date(item.lastUsedAt) }]));
}

function assertUnique(libs: LibState): void {
  const seen = new Set<string>();
  for (const item of libs.values()) {
    const key = `${item.userId}\0${item.nameNorm}`;
    if (seen.has(key)) {
      throw new Error("Unique constraint failed on WorkoutExerciseLibrary_userId_nameNorm_key");
    }
    seen.add(key);
  }
}

function applyOps(libs: LibState, exercises: Map<string, ExerciseState>, ops: readonly CatalogLinkOp[]): void {
  for (const op of ops) {
    if (op.type === "rebind-exercise") {
      const exercise = exercises.get(op.id);
      if (!exercise) throw new Error(`нет упражнения ${op.id}`);
      exercise.name = op.name;
      exercise.catalogId = op.catalogId;
      continue;
    }
    if (op.type === "rebind-routine") continue;
    if (op.type === "delete-library") {
      for (const id of op.ids) libs.delete(id);
      continue;
    }
    const current = libs.get(op.id);
    if (!current) throw new Error(`нет строки библиотеки ${op.id}`);
    libs.set(op.id, {
      ...current,
      name: op.data.name,
      nameNorm: op.data.nameNorm,
      catalogId: op.data.catalogId,
      useCount: op.data.useCount,
      lastUsedAt: new Date(op.data.lastUsedAt),
      kind: op.data.kind,
      defaultMuscleGroup: op.data.defaultMuscleGroup,
    });
    assertUnique(libs);
  }
}

function applyRollback(libs: LibState, exercises: Map<string, ExerciseState>, ops: readonly RollbackOp[]): void {
  for (const op of ops) {
    if (op.type === "restore-library") {
      const current = libs.get(op.row.id);
      if (!current) throw new Error(`нет строки библиотеки ${op.row.id}`);
      libs.set(op.row.id, { ...op.row, lastUsedAt: new Date(op.row.lastUsedAt) });
      assertUnique(libs);
      continue;
    }
    if (op.type === "recreate-library") {
      if (libs.has(op.row.id)) throw new Error(`строка ${op.row.id} уже есть`);
      libs.set(op.row.id, { ...op.row, lastUsedAt: new Date(op.row.lastUsedAt) });
      assertUnique(libs);
      continue;
    }
    if (op.type === "restore-exercise") {
      const exercise = exercises.get(op.id);
      if (!exercise) throw new Error(`нет упражнения ${op.id}`);
      exercise.name = op.name;
      exercise.catalogId = op.catalogId;
    }
  }
}

test("коллизия nameNorm: оставляем каноническую строку и не переименовываем её раньше удаления", () => {
  const canonical = row({
    id: "lib-canon",
    name: "Подъём штанги на бицепс",
    useCount: 0,
    defaultMuscleGroup: null,
    lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const synonym = row({
    id: "lib-syn",
    name: "подъем на бицепс",
    useCount: 12,
    defaultMuscleGroup: "shoulders",
    lastUsedAt: new Date("2026-10-01T00:00:00.000Z"),
  });
  const { plans, uncertain } = planLibraryMerges([synonym, canonical]);
  assert.equal(uncertain.length, 0);
  assert.equal(plans.length, 1);
  const plan = plans[0]!;
  assert.equal(plan.keeperId, "lib-canon");
  assert.deepEqual(plan.deleteIds, ["lib-syn"]);
  assert.equal(plan.data.name, "Подъём штанги на бицепс");
  assert.equal(plan.data.nameNorm, "подъем штанги на бицепс");
  assert.equal(plan.data.catalogId, "bb-curl");
  assert.equal(plan.data.useCount, 12);
  assert.equal(plan.data.defaultMuscleGroup, "shoulders");
  assert.equal(plan.data.lastUsedAt.toISOString(), "2026-10-01T00:00:00.000Z");

  const exercisePatches = [
    { id: "ex-1", name: "Подъём штанги на бицепс", catalogId: "bb-curl" },
  ];
  const ops = buildApplyOperations({
    plans,
    exercisePatches,
    routinePatches: [{ id: "rt-1", name: "Подъём штанги на бицепс" }],
  });
  const rebindAt = ops.findIndex((op) => op.type === "rebind-exercise");
  const routineAt = ops.findIndex((op) => op.type === "rebind-routine");
  const deleteAt = ops.findIndex((op) => op.type === "delete-library");
  const renameAt = ops.findIndex((op) => op.type === "rename-library");
  assert.ok(rebindAt >= 0 && routineAt > rebindAt && deleteAt > routineAt && renameAt > deleteAt);

  const libs = cloneLibs([canonical, synonym]);
  const exercises = new Map<string, ExerciseState>([
    ["ex-1", { id: "ex-1", name: "подъем на бицепс", catalogId: null, setIds: ["set-1", "set-2"] }],
  ]);
  const setsBefore = exercises.get("ex-1")!.setIds;
  applyOps(libs, exercises, ops);
  assert.equal(libs.size, 1);
  const kept = libs.get("lib-canon")!;
  assert.equal(kept.nameNorm, "подъем штанги на бицепс");
  assert.equal(kept.useCount, 12);
  assert.equal(exercises.get("ex-1")!.name, "Подъём штанги на бицепс");
  assert.equal(exercises.get("ex-1")!.catalogId, "bb-curl");
  assert.equal(exercises.get("ex-1")!.setIds, setsBefore);

  const renameSynonymFirst: CatalogLinkOp[] = [
    { type: "rename-library", id: "lib-syn", data: plan.data },
    { type: "delete-library", ids: ["lib-canon"] },
  ];
  assert.throws(
    () => applyOps(cloneLibs([canonical, synonym]), new Map(), renameSynonymFirst),
    /WorkoutExerciseLibrary_userId_nameNorm_key/,
  );

  const rollback: CatalogRollback = {
    exercises: [{ id: "ex-1", name: "подъем на бицепс", catalogId: null }],
    routineExercises: [],
    libraryUpdates: plan.before.filter((item) => item.id === plan.keeperId),
    libraryDeleted: plan.before.filter((item) => item.id !== plan.keeperId),
  };
  const rollbackOps = buildRollbackOperations(rollback);
  const restoreAt = rollbackOps.findIndex((op) => op.type === "restore-library");
  const recreateAt = rollbackOps.findIndex((op) => op.type === "recreate-library");
  assert.ok(restoreAt >= 0 && recreateAt > restoreAt);
  applyRollback(libs, exercises, rollbackOps);
  assert.equal(libs.get("lib-canon")!.useCount, 0);
  assert.equal(libs.get("lib-canon")!.catalogId, null);
  assert.equal(libs.get("lib-syn")!.name, "подъем на бицепс");
  assert.equal(libs.get("lib-syn")!.nameNorm, "подъем на бицепс");
  assert.equal(exercises.get("ex-1")!.name, "подъем на бицепс");
  assert.equal(exercises.get("ex-1")!.catalogId, null);
});

test("строка с каталожным nameNorm без тренировок входит в группу и остаётся", () => {
  const orphan = row({
    id: "lib-orphan",
    name: "заметка без тренировки",
    nameNorm: "тяга гантели в наклоне",
    useCount: 0,
  });
  const synonym = row({
    id: "lib-row",
    name: "тяга гантели",
    useCount: 5,
    lastUsedAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  const wide = row({
    id: "lib-wide",
    name: "широкий пулдаун",
    useCount: 3,
  });
  const wideCanon = row({
    id: "lib-wide-canon",
    name: "Тяга верхнего блока широким хватом",
    useCount: 0,
  });

  const { plans, uncertain } = planLibraryMerges([synonym, orphan, wide, wideCanon]);
  assert.equal(uncertain.length, 0);
  const dbRow = plans.find((plan) => plan.data.catalogId === "db-row");
  const pulldown = plans.find((plan) => plan.data.catalogId === "pulldown-wide");
  assert.ok(dbRow);
  assert.equal(dbRow.keeperId, "lib-orphan");
  assert.deepEqual(dbRow.deleteIds, ["lib-row"]);
  assert.equal(dbRow.data.name, "Тяга гантели в наклоне");
  assert.equal(dbRow.data.useCount, 5);
  assert.ok(pulldown);
  assert.equal(pulldown.keeperId, "lib-wide-canon");
  assert.deepEqual(pulldown.deleteIds, ["lib-wide"]);
});

test("без коллизии остаётся строка с большим useCount, неоднозначный «Велосипед» не склеивается", () => {
  const light = row({
    id: "lib-light",
    name: "подъем на бицепс",
    useCount: 2,
    lastUsedAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  const heavy = row({
    id: "lib-heavy",
    name: "бицепс штанга",
    useCount: 9,
    lastUsedAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  const crunch = row({ id: "lib-crunch", name: "велосипед на пресс", useCount: 4 });
  const plain = row({ id: "lib-bike", name: "Велосипед", useCount: 0 });

  const merged = planLibraryMerges([light, heavy]);
  assert.equal(merged.uncertain.length, 0);
  assert.equal(merged.plans.length, 1);
  assert.equal(merged.plans[0]!.keeperId, "lib-heavy");
  assert.deepEqual(merged.plans[0]!.deleteIds, ["lib-light"]);
  assert.equal(merged.plans[0]!.data.nameNorm, "подъем штанги на бицепс");

  const ambiguous = planLibraryMerges([crunch, plain]);
  assert.equal(ambiguous.plans.length, 0);
  assert.equal(ambiguous.uncertain.length, 1);
  assert.equal(ambiguous.uncertain[0]!.candidate, "Велосипед");
  assert.match(ambiguous.uncertain[0]!.reason, /уже занято/);
});

test("откат сначала освобождает nameNorm оставляемой строки, потом восстанавливает удалённую", () => {
  const synonym = row({
    id: "lib-syn",
    name: "подъем на бицепс",
    nameNorm: "подъем на бицепс",
    useCount: 12,
  });
  const canonical = row({
    id: "lib-canon",
    name: "Подъём штанги на бицепс",
    nameNorm: "подъем штанги на бицепс",
    useCount: 0,
  });
  const afterBadApply = cloneLibs([
    {
      ...synonym,
      name: canonical.name,
      nameNorm: canonical.nameNorm,
      catalogId: "bb-curl",
      useCount: 12,
    },
  ]);
  const rollback = buildRollbackOperations({
    exercises: [],
    routineExercises: [],
    libraryUpdates: [synonym],
    libraryDeleted: [canonical],
  });
  assert.equal(rollback[0]?.type, "restore-library");
  assert.equal(rollback[1]?.type, "recreate-library");

  const recreateFirst: RollbackOp[] = [rollback[1]!, rollback[0]!];
  assert.throws(
    () => applyRollback(cloneLibs([...afterBadApply.values()]), new Map(), recreateFirst),
    /WorkoutExerciseLibrary_userId_nameNorm_key/,
  );

  applyRollback(afterBadApply, new Map(), rollback);
  assert.equal(afterBadApply.get("lib-syn")!.nameNorm, "подъем на бицепс");
  assert.equal(afterBadApply.get("lib-canon")!.nameNorm, "подъем штанги на бицепс");
  assert.equal(afterBadApply.get("lib-canon")!.name, "Подъём штанги на бицепс");
});
