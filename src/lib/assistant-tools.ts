/**
 * Server-side agent tools for the AI assistant:
 * meals, workout plan, photo→diary, shopping, water, weight, start routine, undo.
 */

import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import type { AssistantActions } from "@/lib/admin-assistant";
import {
  buildRoutinePayloadFromActions,
  exercisesFromWorkoutDay,
  mealsPayloadFromActions,
  muscleGroupsFromFocus,
} from "@/lib/assistant-apply";
import { resolveAssistantDate, weekdayIndexFromLabel } from "@/lib/assistant-date";
import {
  matchIsMealSlot,
  parseMealTimeHHMM,
  type MealTypeKey,
} from "@/lib/assistant-meal-time";
import { buildMealPatchFields } from "@/lib/assistant-meal-patch";
import { dateKeyAndTimeToIso } from "@/lib/dates";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { flattenRecognitionItems } from "@/lib/recognition-items";
import { prisma } from "@/lib/prisma";
import { buildMealCreateData, validateSaveMealInput, type SaveMealInput } from "@/lib/save-meal";
import {
  normalizeShoppingName,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { saveImageBuffer } from "@/lib/upload";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { parsePlannedSets, plannedSetsToJson, routineInclude, serializeRoutine } from "@/lib/workouts/routines";
import {
  serializeSessionDetail,
  sessionInclude,
} from "@/lib/workouts/serialize";
import {
  planWeekdayFromDateKey,
  parseWeekdays,
  WEEKDAY_LABELS_RU,
} from "@/lib/workouts/weekdays";
import {
  userWantsGymEdit,
  userWantsRepeatWorkout,
  userWantsStartWorkout,
  userWantsWrite,
} from "@/lib/assistant-intent";

export { resolveAssistantDate, weekdayIndexFromLabel };

export type AssistantToolResult = {
  ok: boolean;
  tool: string;
  message: string;
  data?: unknown;
};

export type AssistantUndoPayload = {
  mealIds: string[];
  routineIds: string[];
  waterIds: string[];
  weightIds: string[];
};

export {
  userWantsGymEdit,
  userWantsRepeatWorkout,
  userWantsStartWorkout,
  userWantsWrite,
};

function mealTypeFromNote(
  note?: string,
): "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | undefined {
  if (!note) return undefined;
  if (/завтрак/i.test(note)) return "BREAKFAST";
  if (/обед/i.test(note)) return "LUNCH";
  if (/ужин/i.test(note)) return "DINNER";
  if (/перекус|снек|snack/i.test(note)) return "SNACK";
  return undefined;
}

function emptyUndo(): AssistantUndoPayload {
  return { mealIds: [], routineIds: [], waterIds: [], weightIds: [] };
}

export function mergeUndo(
  a: AssistantUndoPayload,
  b: Partial<AssistantUndoPayload> | null | undefined,
): AssistantUndoPayload {
  return {
    mealIds: [...a.mealIds, ...(b?.mealIds ?? [])],
    routineIds: [...a.routineIds, ...(b?.routineIds ?? [])],
    waterIds: [...a.waterIds, ...(b?.waterIds ?? [])],
    weightIds: [...a.weightIds, ...(b?.weightIds ?? [])],
  };
}

export function collectUndoFromTools(results: AssistantToolResult[]): AssistantUndoPayload {
  let out = emptyUndo();
  for (const r of results) {
    if (!r.ok || !r.data || typeof r.data !== "object") continue;
    const data = r.data as Record<string, unknown>;
    if (Array.isArray(data.meals)) {
      const ids = data.meals
        .map((m) => (m && typeof m === "object" ? (m as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === "string");
      out = mergeUndo(out, { mealIds: ids });
    }
    if (data.meal && typeof data.meal === "object") {
      const id = (data.meal as { id?: unknown }).id;
      if (typeof id === "string") out = mergeUndo(out, { mealIds: [id] });
    }
    if (Array.isArray(data.routines)) {
      const ids = data.routines
        .map((m) => (m && typeof m === "object" ? (m as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === "string");
      out = mergeUndo(out, { routineIds: ids });
    }
    if (typeof data.waterId === "string") {
      out = mergeUndo(out, { waterIds: [data.waterId] });
    }
    if (typeof data.weightId === "string") {
      out = mergeUndo(out, { weightIds: [data.weightId] });
    }
  }
  return out;
}

export function undoPayloadHasItems(payload: AssistantUndoPayload | null | undefined): boolean {
  if (!payload) return false;
  return (
    payload.mealIds.length +
      payload.routineIds.length +
      payload.waterIds.length +
      payload.weightIds.length >
    0
  );
}

export async function toolSaveMeals(opts: {
  userId: string;
  date: string;
  actions: AssistantActions;
  timezone?: string | null;
}): Promise<AssistantToolResult> {
  const entries = mealsPayloadFromActions(opts.actions, opts.date, opts.timezone);
  if (!entries.length) {
    return { ok: false, tool: "save_meals", message: "Нет блюд для записи" };
  }
  const created: Array<{ id: string; dishName: string; calories: number }> = [];
  const meals = opts.actions.meals ?? [];
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i]!;
    const note = meals[i]?.note;
    const input: SaveMealInput = {
      ...raw,
      mealType: mealTypeFromNote(note),
    };
    const validated = validateSaveMealInput(input);
    if (validated.error || !validated.date) continue;
    const row = await prisma.mealEntry.create({
      data: buildMealCreateData(opts.userId, input, validated.date),
    });
    created.push({ id: row.id, dishName: row.dishName, calories: row.calories });
  }
  if (!created.length) {
    return { ok: false, tool: "save_meals", message: "Не удалось сохранить блюда" };
  }
  const names = created.map((m) => `${m.dishName} (${m.calories} ккал)`).join(", ");
  return {
    ok: true,
    tool: "save_meals",
    message: `В рацион ${opts.date}: ${names}`,
    data: { meals: created, date: opts.date },
  };
}

/** Create one routine per workout day with weekdays set (shows in plan). */
export async function toolCreateWorkoutPlan(opts: {
  userId: string;
  today: string;
  date: string;
  actions: AssistantActions;
}): Promise<AssistantToolResult> {
  const days = opts.actions.workoutDays ?? [];
  if (!days.length) {
    return { ok: false, tool: "create_workout_plan", message: "Нет дней тренировок" };
  }

  const maxOrder = await prisma.workoutRoutine.aggregate({
    where: { userId: opts.userId },
    _max: { sortOrder: true },
  });
  let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const created: Array<{ id: string; name: string; weekdays: number[]; date?: string }> = [];

  for (const day of days.slice(0, 7)) {
    const resolvedDate =
      resolveAssistantDate(day.day, opts.today) ??
      resolveAssistantDate(opts.actions.targetDate, opts.today) ??
      opts.date;
    const wd =
      weekdayIndexFromLabel(day.day) ??
      planWeekdayFromDateKey(resolvedDate) ??
      planWeekdayFromDateKey(opts.date);
    if (wd == null) continue;

    const exs = exercisesFromWorkoutDay(day);
    const groups = muscleGroupsFromFocus(day.focus);
    const dayLabel = WEEKDAY_LABELS_RU[wd] ?? day.day;
    const name = `AI ${dayLabel}: ${day.focus}`.slice(0, 120);
    const note = (day.notes || opts.actions.summary || day.focus).slice(0, 200);

    const row = await prisma.$transaction(async (tx) => {
      const routine = await tx.workoutRoutine.create({
        data: {
          userId: opts.userId,
          name,
          note,
          sortOrder: nextOrder++,
          weekdays: parseWeekdays([wd]) as unknown as Prisma.InputJsonValue,
          muscles: {
            create: groups.map((groupKey) => ({ groupKey })),
          },
          exercises: {
            create: exs.map((ex, i) => ({
              name: ex.name,
              muscleGroup: ex.muscleGroup,
              sortOrder: i,
              plannedSets: plannedSetsToJson([]),
            })),
          },
        },
        include: routineInclude,
      });
      await touchExerciseLibraryMany(
        tx,
        opts.userId,
        exs.map((ex) => ({ name: ex.name, muscleGroup: ex.muscleGroup })),
      );
      return routine;
    });

    const serialized = serializeRoutine(row);
    created.push({
      id: serialized.id,
      name: serialized.name,
      weekdays: serialized.weekdays,
      date: resolvedDate,
    });
  }

  if (!created.length) {
    const payload = buildRoutinePayloadFromActions(opts.actions);
    if (!payload) {
      return { ok: false, tool: "create_workout_plan", message: "Не удалось собрать план" };
    }
    const wd = planWeekdayFromDateKey(opts.date);
    const row = await prisma.workoutRoutine.create({
      data: {
        userId: opts.userId,
        name: payload.name,
        note: payload.note,
        sortOrder: nextOrder,
        weekdays:
          wd != null
            ? (parseWeekdays([wd]) as unknown as Prisma.InputJsonValue)
            : undefined,
        muscles: {
          create: payload.muscleGroups.map((groupKey) => ({ groupKey })),
        },
        exercises: {
          create: payload.exercises.map((ex, i) => ({
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            sortOrder: i,
            plannedSets: plannedSetsToJson([]),
          })),
        },
      },
      include: routineInclude,
    });
    const s = serializeRoutine(row);
    return {
      ok: true,
      tool: "create_workout_plan",
      message: `В план зала: «${s.name}»`,
      data: { routines: [{ id: s.id, name: s.name, weekdays: s.weekdays }] },
    };
  }

  const labels = created.map((r) => r.name).join("; ");
  return {
    ok: true,
    tool: "create_workout_plan",
    message: `В план зала: ${labels}`,
    data: { routines: created },
  };
}

export async function toolAddShopping(opts: {
  userId: string;
  names: string[];
  date?: string;
}): Promise<AssistantToolResult> {
  const names = opts.names
    .map((n) => n.trim().replace(/\s+/g, " ").slice(0, 200))
    .filter(Boolean)
    .slice(0, 30);
  if (!names.length) {
    return { ok: false, tool: "add_shopping", message: "Нет продуктов для списка" };
  }

  const row = await prisma.shoppingList.findUnique({
    where: { userId: opts.userId },
    select: { items: true },
  });
  const existing = Array.isArray(row?.items) ? (row!.items as ShoppingListItem[]) : [];
  const list: ShoppingListItem[] = existing
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string",
    )
    .map((item) => ({
      id: item.id,
      name: String(item.name).trim().slice(0, 200),
      checked: Boolean(item.checked),
      ...(typeof item.sourceDate === "string" ? { sourceDate: item.sourceDate } : {}),
    }));

  const seen = new Set(list.map((item) => normalizeShoppingName(item.name)));
  const added: string[] = [];
  const now = Date.now();
  for (const name of names) {
    const key = normalizeShoppingName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      id: `shop-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      checked: false,
      ...(opts.date ? { sourceDate: opts.date } : {}),
    });
    added.push(name);
  }

  if (!added.length) {
    return {
      ok: true,
      tool: "add_shopping",
      message: "В покупках уже есть эти позиции",
      data: { added: [] },
    };
  }

  await prisma.shoppingList.upsert({
    where: { userId: opts.userId },
    create: { userId: opts.userId, items: list as unknown as Prisma.InputJsonValue },
    update: { items: list as unknown as Prisma.InputJsonValue },
  });

  return {
    ok: true,
    tool: "add_shopping",
    message: `В покупки: ${added.join(", ")}`,
    data: { added },
  };
}

export async function toolLogWater(opts: {
  userId: string;
  date: string;
  ml: number;
}): Promise<AssistantToolResult> {
  const ml = Math.round(opts.ml);
  if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) {
    return { ok: false, tool: "log_water", message: "Объём воды: 1–5000 мл" };
  }
  const entry = await prisma.waterEntry.create({
    data: { userId: opts.userId, date: opts.date, ml },
  });
  const all = await prisma.waterEntry.findMany({
    where: { userId: opts.userId, date: opts.date },
  });
  const totalMl = all.reduce((sum, e) => sum + e.ml, 0);
  return {
    ok: true,
    tool: "log_water",
    message: `Вода +${ml} мл (${opts.date}), всего ${totalMl} мл`,
    data: { waterId: entry.id, ml, totalMl, date: opts.date },
  };
}

export async function toolLogWeight(opts: {
  userId: string;
  date: string;
  weightKg: number;
  /** When false/omit — refuse overwrite and ask UI to confirm. */
  overwrite?: boolean;
}): Promise<AssistantToolResult> {
  const weightKg = Math.round(Number(opts.weightKg) * 10) / 10;
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
    return { ok: false, tool: "log_weight", message: "Вес: 20–300 кг" };
  }
  const existing = await prisma.weightEntry.findFirst({
    where: { userId: opts.userId, date: opts.date },
    orderBy: [{ date: "asc" }, { measuredAt: "asc" }, { createdAt: "asc" }],
  });
  if (existing) {
    if (!opts.overwrite) {
      return {
        ok: false,
        tool: "log_weight",
        message: `На ${opts.date} уже ${existing.weightKg} кг. Подтверди замену на ${weightKg} кг.`,
        data: {
          needsConfirm: true,
          existingKg: existing.weightKg,
          weightKg,
          date: opts.date,
          weightId: existing.id,
        },
      };
    }
    const updated = await prisma.weightEntry.update({
      where: { id: existing.id },
      data: { weightKg, measuredAt: new Date() },
    });
    return {
      ok: true,
      tool: "log_weight",
      message: `Вес ${opts.date}: ${weightKg} кг (заменил ${existing.weightKg} → ${weightKg})`,
      data: { weightId: updated.id, weightKg, date: opts.date, replaced: true },
    };
  }
  const created = await prisma.weightEntry.create({
    data: {
      userId: opts.userId,
      date: opts.date,
      weightKg,
      measuredAt: new Date(),
    },
  });
  return {
    ok: true,
    tool: "log_weight",
    message: `Вес ${opts.date}: ${weightKg} кг`,
    data: { weightId: created.id, weightKg, date: opts.date },
  };
}

function mealMatchKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
}

function mealMatchesQuery(dishName: string, match: string): boolean {
  const a = mealMatchKey(dishName);
  const b = mealMatchKey(match);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function resolvePatchSlot(
  match: string | undefined,
  mealType?: MealTypeKey | string | null,
): MealTypeKey | null {
  if (
    mealType === "BREAKFAST" ||
    mealType === "LUNCH" ||
    mealType === "DINNER" ||
    mealType === "SNACK"
  ) {
    return mealType;
  }
  return matchIsMealSlot(match);
}

function rowsForMealEdit<T extends { dishName: string; mealType: string | null }>(
  rows: T[],
  opts: { match: string; mealType?: MealTypeKey | string | null },
): T[] {
  const slot = resolvePatchSlot(opts.match, opts.mealType);
  if (slot) {
    return rows.filter((r) => r.mealType === slot);
  }
  const hit = rows.find((r) => mealMatchesQuery(r.dishName, opts.match));
  return hit ? [hit] : [];
}

export async function toolDeleteMeals(opts: {
  userId: string;
  date: string;
  matches: NonNullable<AssistantActions["deleteMeals"]>;
}): Promise<AssistantToolResult> {
  const queries = opts.matches.slice(0, 20);
  if (!queries.length) {
    return { ok: false, tool: "delete_meals", message: "Нет блюд для удаления" };
  }
  const rows = await prisma.mealEntry.findMany({
    where: { userId: opts.userId, date: opts.date },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const toDelete: typeof rows = [];
  for (const q of queries) {
    for (const row of rowsForMealEdit(rows, q)) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      toDelete.push(row);
    }
  }
  if (!toDelete.length) {
    const labels = queries.map((q) => q.match).filter(Boolean).join(", ");
    return {
      ok: false,
      tool: "delete_meals",
      message: `Не нашёл в рационе ${opts.date}: ${labels}`,
    };
  }
  const ids = toDelete.map((r) => r.id);
  await prisma.mealEntry.deleteMany({
    where: { userId: opts.userId, id: { in: ids } },
  });
  const names = toDelete.map((r) => r.dishName).join(", ");
  return {
    ok: true,
    tool: "delete_meals",
    message: `Удалил из рациона ${opts.date}: ${names}`,
    data: { mealIds: ids, date: opts.date },
  };
}

export async function toolPatchMeals(opts: {
  userId: string;
  date: string;
  patches: NonNullable<AssistantActions["patchMeals"]>;
  timezone?: string | null;
}): Promise<AssistantToolResult> {
  const patches = opts.patches.slice(0, 20);
  if (!patches.length) {
    return { ok: false, tool: "patch_meals", message: "Нет правок" };
  }
  const rows = await prisma.mealEntry.findMany({
    where: { userId: opts.userId, date: opts.date },
    orderBy: { createdAt: "asc" },
  });
  const updated: Array<{
    id: string;
    dishName: string;
    calories: number;
    time?: string;
    mealType?: string;
  }> = [];
  for (const patch of patches) {
    const targets = rowsForMealEdit(rows, patch);
    if (!targets.length) continue;
    const time = parseMealTimeHHMM(patch.time);
    const eatenAtIso = time ? dateKeyAndTimeToIso(opts.date, time, opts.timezone) : null;
    for (const row of targets) {
      const fields = buildMealPatchFields(
        {
          dishName: row.dishName,
          calories: row.calories,
          protein: row.protein,
          fat: row.fat,
          carbs: row.carbs,
          fiber: row.fiber,
          sugar: row.sugar,
          portionGrams: row.portionGrams,
          mealType: row.mealType,
        },
        patch,
        { eatenAtIso },
      );
      if (!fields) continue;
      const data: Prisma.MealEntryUpdateInput = {};
      if (fields.dishName != null) data.dishName = fields.dishName;
      if (fields.calories != null) data.calories = fields.calories;
      if (fields.protein !== undefined) data.protein = fields.protein;
      if (fields.fat !== undefined) data.fat = fields.fat;
      if (fields.carbs !== undefined) data.carbs = fields.carbs;
      if (fields.fiber !== undefined) data.fiber = fields.fiber;
      if (fields.sugar !== undefined) data.sugar = fields.sugar;
      if (fields.portionGrams !== undefined) data.portionGrams = fields.portionGrams;
      if (fields.mealType != null) data.mealType = fields.mealType;
      if (fields.eatenAt) data.eatenAt = fields.eatenAt;
      if (!Object.keys(data).length) continue;
      const saved = await prisma.mealEntry.update({ where: { id: row.id }, data });
      updated.push({
        id: saved.id,
        dishName: saved.dishName,
        calories: saved.calories,
        ...(time ? { time } : {}),
        ...(fields.mealType ? { mealType: fields.mealType } : {}),
      });
    }
  }
  if (!updated.length) {
    return {
      ok: false,
      tool: "patch_meals",
      message: `Не нашёл блюда для правки на ${opts.date}`,
    };
  }
  const names = updated
    .map((m) => `${m.dishName} (${m.calories} ккал${m.time ? ` · ${m.time}` : ""})`)
    .join(", ");
  return {
    ok: true,
    tool: "patch_meals",
    message: `Обновил в рационе ${opts.date}: ${names}`,
    data: { meals: updated, date: opts.date },
  };
}

export async function toolStartTodaysRoutine(opts: {
  userId: string;
  date: string;
}): Promise<AssistantToolResult> {
  const weekday = planWeekdayFromDateKey(opts.date);
  if (weekday == null) {
    return { ok: false, tool: "start_routine", message: "Некорректная дата" };
  }
  const routines = await prisma.workoutRoutine.findMany({
    where: { userId: opts.userId },
    include: routineInclude,
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });
  const planned = routines.filter((r) => parseWeekdays(r.weekdays).includes(weekday));
  const routine = planned[0];
  if (!routine) {
    return {
      ok: false,
      tool: "start_routine",
      message: `На ${WEEKDAY_LABELS_RU[weekday]} в плане нет тренировки. Можно «повторить последнюю» или открыть зал и начать пустую.`,
      data: { suggestRepeat: true },
    };
  }
  if (!routine.muscles.length || !routine.exercises.length) {
    return { ok: false, tool: "start_routine", message: `Шаблон «${routine.name}» пустой` };
  }

  const muscleKeys = routine.muscles.map((m) => m.groupKey);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.workoutSession.create({
      data: {
        userId: opts.userId,
        date: opts.date,
        progressRate: DEFAULT_PROGRESS_RATE,
        note: routine.note,
        startedAt: new Date(),
        muscles: { create: muscleKeys.map((groupKey) => ({ groupKey })) },
      },
    });
    const exercises = [...routine.exercises].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    for (const [i, ex] of exercises.entries()) {
      const createdEx = await tx.workoutExercise.create({
        data: {
          sessionId: row.id,
          name: ex.name,
          kind: ex.kind,
          muscleGroup: ex.muscleGroup,
          sortOrder: i,
          ...(ex.supersetGroup ? { supersetGroup: ex.supersetGroup } : {}),
          blockMode: ex.blockMode,
          ...(ex.circuitRounds != null ? { circuitRounds: ex.circuitRounds } : {}),
        },
      });
      const planned = parsePlannedSets(ex.plannedSets);
      if (planned.length) {
        await tx.workoutSet.createMany({
          data: planned.map((s, si) => ({
            exerciseId: createdEx.id,
            sortOrder: si,
            weightKg: s.weightKg,
            reps: s.reps,
            distanceKm: s.distanceKm,
            durationSec: s.durationSec,
            setType: s.setType,
            completed: false,
          })),
        });
      }
    }
    await touchExerciseLibraryMany(
      tx,
      opts.userId,
      exercises.map((ex) => ({
        name: ex.name,
        kind: ex.kind,
        muscleGroup: ex.muscleGroup,
      })),
    );
    return tx.workoutSession.findUniqueOrThrow({
      where: { id: row.id },
      include: sessionInclude,
    });
  });

  const session = serializeSessionDetail(created);
  return {
    ok: true,
    tool: "start_routine",
    message: `Стартовал «${routine.name}» на ${opts.date}`,
    data: { sessionId: session.id, routineId: routine.id, name: routine.name },
  };
}

/** Blank live session when there is no plan for the day. */
export async function toolStartEmptyWorkout(opts: {
  userId: string;
  date: string;
  muscleGroup?: string | null;
}): Promise<AssistantToolResult> {
  const group =
    opts.muscleGroup && isMuscleGroupKey(opts.muscleGroup) ? opts.muscleGroup : "other";
  const created = await prisma.workoutSession.create({
    data: {
      userId: opts.userId,
      date: opts.date,
      progressRate: DEFAULT_PROGRESS_RATE,
      startedAt: new Date(),
      muscles: { create: [{ groupKey: group }] },
    },
    include: sessionInclude,
  });
  const session = serializeSessionDetail(created);
  return {
    ok: true,
    tool: "start_empty",
    message: `Открыл пустую тренировку на ${opts.date} — добавь упражнения`,
    data: { sessionId: session.id, date: opts.date },
  };
}

/**
 * Add exercises / log sets on the open (or last finished) session for `date`.
 * «Добавь жим», «поставь 80×8 на жим».
 */
export async function toolPatchWorkout(opts: {
  userId: string;
  date: string;
  patch: NonNullable<AssistantActions["patchWorkout"]>;
}): Promise<AssistantToolResult> {
  const addExercises = opts.patch.addExercises ?? [];
  const logSets = opts.patch.logSets ?? [];
  if (!addExercises.length && !logSets.length) {
    return { ok: false, tool: "patch_workout", message: "Нет правок тренировки" };
  }

  let session = await prisma.workoutSession.findFirst({
    where: {
      userId: opts.userId,
      date: opts.date,
      ...(opts.patch.sessionId ? { id: opts.patch.sessionId } : {}),
    },
    include: sessionInclude,
    orderBy: [{ endedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!session && !opts.patch.sessionId) {
    // Prefer any open session today; else last finished that day already queried.
    session = await prisma.workoutSession.findFirst({
      where: {
        userId: opts.userId,
        date: opts.date,
        endedAt: null,
      },
      include: sessionInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  }
  if (!session) {
    return {
      ok: false,
      tool: "patch_workout",
      message: `Нет тренировки на ${opts.date}. Сначала начни или повтори зал.`,
    };
  }

  const notes: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const ex of addExercises.slice(0, 12)) {
      const name = ex.name.trim().slice(0, 120);
      if (!name) continue;
      const groupRaw = ex.muscleGroup?.trim() ?? "";
      const muscleGroup =
        groupRaw && isMuscleGroupKey(groupRaw)
          ? groupRaw
          : muscleGroupsFromFocus(name)[0] ?? "other";
      const maxOrder = await tx.workoutExercise.aggregate({
        where: { sessionId: session!.id },
        _max: { sortOrder: true },
      });
      const createdEx = await tx.workoutExercise.create({
        data: {
          sessionId: session!.id,
          name,
          kind: muscleGroup === "cardio" ? "cardio" : "strength",
          muscleGroup,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      const sets = (ex.sets ?? []).slice(0, 12);
      if (sets.length) {
        await tx.workoutSet.createMany({
          data: sets.map((s, i) => ({
            exerciseId: createdEx.id,
            weightKg:
              typeof s.weightKg === "number" && Number.isFinite(s.weightKg) ? s.weightKg : null,
            reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? Math.round(s.reps) : null,
            setType: "working",
            completed: false,
            sortOrder: i,
          })),
        });
      }
      notes.push(sets.length ? `${name} (+${sets.length} подх.)` : name);
      await touchExerciseLibraryMany(tx, opts.userId, [
        { name, kind: muscleGroup === "cardio" ? "cardio" : "strength", muscleGroup },
      ]);
    }

    const fresh = await tx.workoutSession.findUniqueOrThrow({
      where: { id: session!.id },
      include: { exercises: true },
    });
    for (const log of logSets.slice(0, 20)) {
      const match = log.match.trim().toLowerCase();
      if (!match) continue;
      const exercises = [...fresh.exercises].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );
      const target =
        exercises.find((e) => e.name.toLowerCase() === match) ??
        exercises.find((e) => e.name.toLowerCase().includes(match));
      if (!target) {
        notes.push(`не нашёл «${log.match}»`);
        continue;
      }
      const maxOrder = await tx.workoutSet.aggregate({
        where: { exerciseId: target.id },
        _max: { sortOrder: true },
      });
      await tx.workoutSet.create({
        data: {
          exerciseId: target.id,
          weightKg:
            typeof log.weightKg === "number" && Number.isFinite(log.weightKg)
              ? log.weightKg
              : null,
          reps:
            typeof log.reps === "number" && Number.isFinite(log.reps)
              ? Math.round(log.reps)
              : null,
          setType: "working",
          completed: true,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      const w =
        typeof log.weightKg === "number" ? `${log.weightKg}` : "—";
      const r = typeof log.reps === "number" ? `${Math.round(log.reps)}` : "—";
      notes.push(`${target.name} ${w}×${r}`);
    }
  });

  if (!notes.length) {
    return { ok: false, tool: "patch_workout", message: "Не удалось применить правки" };
  }
  return {
    ok: true,
    tool: "patch_workout",
    message: `Зал ${opts.date}: ${notes.join(", ")}`,
    data: { sessionId: session.id, date: opts.date, notes },
  };
}

/**
 * Clone the most recent finished session (exercises + sets) onto `date`.
 * Optional `sourceDate` prefers a finished session on that calendar day.
 */
export async function toolRepeatLastWorkout(opts: {
  userId: string;
  date: string;
  sourceDate?: string | null;
  copySets?: boolean;
}): Promise<AssistantToolResult> {
  const copySets = opts.copySets !== false;
  const source = await prisma.workoutSession.findFirst({
    where: {
      userId: opts.userId,
      endedAt: { not: null },
      ...(opts.sourceDate ? { date: opts.sourceDate } : {}),
    },
    include: sessionInclude,
    orderBy: [{ date: "desc" }, { endedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!source) {
    return {
      ok: false,
      tool: "repeat_workout",
      message: opts.sourceDate
        ? `Нет тренировки за ${opts.sourceDate} для повтора`
        : "Нет завершённой тренировки для повтора",
    };
  }
  const muscleKeys = source.muscles.map((m) => m.groupKey);
  if (!muscleKeys.length) {
    return {
      ok: false,
      tool: "repeat_workout",
      message: "У исходной тренировки нет групп мышц",
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.workoutSession.create({
      data: {
        userId: opts.userId,
        date: opts.date,
        progressRate: source.progressRate ?? DEFAULT_PROGRESS_RATE,
        note: source.note,
        startedAt: new Date(),
        muscles: { create: muscleKeys.map((groupKey) => ({ groupKey })) },
      },
    });
    const exercises = [...source.exercises].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    for (const [i, ex] of exercises.entries()) {
      const createdEx = await tx.workoutExercise.create({
        data: {
          sessionId: row.id,
          name: ex.name,
          kind: ex.kind ?? "strength",
          muscleGroup: ex.muscleGroup,
          note: ex.note,
          sortOrder: i,
        },
      });
      if (copySets) {
        const sets = [...ex.sets].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
        );
        if (sets.length) {
          await tx.workoutSet.createMany({
            data: sets.map((s, j) => ({
              exerciseId: createdEx.id,
              weightKg: s.weightKg,
              reps: s.reps,
              distanceKm: s.distanceKm,
              durationSec: s.durationSec,
              setType: s.setType ?? "working",
              completed: false,
              rpe: s.rpe,
              sortOrder: j,
            })),
          });
        }
      }
    }
    await touchExerciseLibraryMany(
      tx,
      opts.userId,
      exercises.map((ex) => ({
        name: ex.name,
        kind: ex.kind,
        muscleGroup: ex.muscleGroup,
      })),
    );
    return tx.workoutSession.findUniqueOrThrow({
      where: { id: row.id },
      include: sessionInclude,
    });
  });

  const session = serializeSessionDetail(created);
  const muscles = source.muscles.map((m) => m.groupKey).join(", ");
  return {
    ok: true,
    tool: "repeat_workout",
    message: `Повторил тренировку ${source.date}${muscles ? ` (${muscles})` : ""} → ${opts.date}`,
    data: {
      sessionId: session.id,
      sourceId: source.id,
      sourceDate: source.date,
      date: opts.date,
    },
  };
}

export async function toolRecognizeAndSaveMeal(opts: {
  userId: string;
  date: string;
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  /** When false — recognize only, do not write meals (photo confirm). */
  save?: boolean;
}): Promise<AssistantToolResult> {
  const save = opts.save !== false;
  try {
    const recognition = await recognizeFoodWithAI(opts.buffer, opts.filename, opts.userId);
    const imagePath = await saveImageBuffer(
      opts.buffer,
      opts.mimeType || "image/jpeg",
      { ownerUserId: opts.userId },
    );
    const items = flattenRecognitionItems(recognition);
    const drafts = items.map((item) => ({
      dishName: item.dishName || "Блюдо",
      calories: item.calories || 200,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      fiber: item.fiber,
      sugar: item.sugar,
      portionGrams: item.portionGrams,
      confidence: item.confidence,
      photoKind: item.photoKind,
      barcode: item.barcode ?? undefined,
      brand: item.brand ?? undefined,
      recognitionSource: item.source ?? "assistant-photo",
    }));

    if (!save) {
      const preview = drafts
        .map((d) => `${d.dishName} — ${d.calories} ккал`)
        .join("; ");
      return {
        ok: true,
        tool: "recognize_meal_preview",
        message: `На фото: ${preview}. Подтверди, чтобы добавить в рацион.`,
        data: {
          pending: true,
          date: opts.date,
          imagePath,
          drafts,
          mealType: opts.mealType,
        },
      };
    }

    const mealGroupId = drafts.length > 1 ? randomUUID() : undefined;
    const created: Array<{ id: string; dishName: string; calories: number }> = [];
    for (const draft of drafts) {
      const input: SaveMealInput = {
        date: opts.date,
        dishName: draft.dishName,
        calories: draft.calories,
        protein: draft.protein,
        fat: draft.fat,
        carbs: draft.carbs,
        fiber: draft.fiber,
        sugar: draft.sugar,
        portionGrams: draft.portionGrams,
        confidence: draft.confidence,
        imagePath,
        mealGroupId,
        recognitionSource: draft.recognitionSource,
        photoKind: draft.photoKind,
        barcode: draft.barcode,
        brand: draft.brand,
        mealType: opts.mealType,
      };
      const validated = validateSaveMealInput(input);
      if (validated.error || !validated.date) continue;
      const row = await prisma.mealEntry.create({
        data: buildMealCreateData(opts.userId, input, validated.date),
      });
      created.push({ id: row.id, dishName: row.dishName, calories: row.calories });
    }
    if (!created.length) {
      return {
        ok: false,
        tool: "recognize_and_save_meal",
        message: "Не удалось сохранить блюдо с фото",
      };
    }
    const names = created.map((m) => `${m.dishName} — ${m.calories} ккал`).join("; ");
    return {
      ok: true,
      tool: "recognize_and_save_meal",
      message: `По фото в рацион ${opts.date}: ${names}`,
      data: { meals: created, date: opts.date, imagePath },
    };
  } catch (error) {
    console.error("assistant recognize_and_save_meal", error);
    return {
      ok: false,
      tool: "recognize_and_save_meal",
      message: "Не удалось распознать фото. Попробуйте ещё раз.",
    };
  }
}

export async function toolSavePhotoDrafts(opts: {
  userId: string;
  date: string;
  imagePath: string;
  drafts: Array<{
    dishName: string;
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
    portionGrams?: number;
    mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
    confidence?: number;
    photoKind?: string;
    barcode?: string;
    brand?: string;
    recognitionSource?: string;
  }>;
  mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
}): Promise<AssistantToolResult> {
  const drafts = opts.drafts.slice(0, 8);
  if (!drafts.length) {
    return { ok: false, tool: "save_photo_drafts", message: "Нет блюд для сохранения" };
  }
  const mealGroupId = drafts.length > 1 ? randomUUID() : undefined;
  const created: Array<{ id: string; dishName: string; calories: number }> = [];
  for (const draft of drafts) {
    const draftMealType =
      draft.mealType === "BREAKFAST" ||
      draft.mealType === "LUNCH" ||
      draft.mealType === "DINNER" ||
      draft.mealType === "SNACK"
        ? draft.mealType
        : opts.mealType;
    const input: SaveMealInput = {
      date: opts.date,
      dishName: draft.dishName || "Блюдо",
      calories: draft.calories || 200,
      protein: draft.protein,
      fat: draft.fat,
      carbs: draft.carbs,
      fiber: draft.fiber,
      sugar: draft.sugar,
      portionGrams: draft.portionGrams,
      confidence: draft.confidence,
      imagePath: opts.imagePath,
      mealGroupId,
      recognitionSource: draft.recognitionSource ?? "assistant-photo",
      photoKind: draft.photoKind,
      barcode: draft.barcode,
      brand: draft.brand,
      mealType: draftMealType,
    };
    const validated = validateSaveMealInput(input);
    if (validated.error || !validated.date) continue;
    const row = await prisma.mealEntry.create({
      data: buildMealCreateData(opts.userId, input, validated.date),
    });
    created.push({ id: row.id, dishName: row.dishName, calories: row.calories });
  }
  if (!created.length) {
    return { ok: false, tool: "save_photo_drafts", message: "Не удалось сохранить" };
  }
  const skipped = drafts.length - created.length;
  const partial = skipped > 0;
  return {
    ok: true,
    tool: "save_photo_drafts",
    message: partial
      ? `Сохранено ${created.length} из ${drafts.length}: ${created
          .map((m) => `${m.dishName} — ${m.calories} ккал`)
          .join("; ")}`
      : `В рацион: ${created.map((m) => `${m.dishName} — ${m.calories} ккал`).join("; ")}`,
    data: {
      meals: created,
      date: opts.date,
      saved: created.length,
      skipped,
      partial,
    },
  };
}

export async function toolUndoWrites(opts: {
  userId: string;
  undo: AssistantUndoPayload;
}): Promise<AssistantToolResult> {
  const { undo } = opts;
  if (!undoPayloadHasItems(undo)) {
    return { ok: false, tool: "undo", message: "Нечего отменять" };
  }
  let meals = 0;
  let routines = 0;
  let water = 0;
  let weights = 0;

  if (undo.mealIds.length) {
    const res = await prisma.mealEntry.deleteMany({
      where: { userId: opts.userId, id: { in: undo.mealIds.slice(0, 40) } },
    });
    meals = res.count;
  }
  if (undo.routineIds.length) {
    const res = await prisma.workoutRoutine.deleteMany({
      where: { userId: opts.userId, id: { in: undo.routineIds.slice(0, 20) } },
    });
    routines = res.count;
  }
  if (undo.waterIds.length) {
    const res = await prisma.waterEntry.deleteMany({
      where: { userId: opts.userId, id: { in: undo.waterIds.slice(0, 20) } },
    });
    water = res.count;
  }
  if (undo.weightIds.length) {
    const res = await prisma.weightEntry.deleteMany({
      where: { userId: opts.userId, id: { in: undo.weightIds.slice(0, 20) } },
    });
    weights = res.count;
  }

  const parts = [
    meals ? `блюд ${meals}` : null,
    routines ? `шаблонов ${routines}` : null,
    water ? `воды ${water}` : null,
    weights ? `веса ${weights}` : null,
  ].filter(Boolean);
  if (!parts.length) {
    return { ok: false, tool: "undo", message: "Записи уже удалены или недоступны" };
  }
  return {
    ok: true,
    tool: "undo",
    message: `Отменил: ${parts.join(", ")}`,
    data: { meals, routines, water, weights },
  };
}

export type ExecutableActions = AssistantActions & {
  apply?: boolean;
  targetDate?: string;
  waterMl?: number;
  weightKg?: number;
  startWorkout?: boolean;
  repeatWorkout?: boolean;
  startEmptyWorkout?: boolean;
  patchWorkout?: AssistantActions["patchWorkout"];
};

export function shouldAutoApply(
  actions: ExecutableActions | null,
  lastUserMessage: string,
): boolean {
  if (!actions) return false;
  if (actions.apply === true) return true;
  if (
    !userWantsWrite(lastUserMessage) &&
    !userWantsStartWorkout(lastUserMessage) &&
    !userWantsRepeatWorkout(lastUserMessage) &&
    !userWantsGymEdit(lastUserMessage)
  ) {
    return false;
  }
  return Boolean(
    actions.meals?.length ||
      actions.deleteMeals?.length ||
      actions.patchMeals?.length ||
      actions.workoutDays?.length ||
      actions.shopping?.length ||
      actions.waterMl != null ||
      actions.weightKg != null ||
      actions.startWorkout ||
      actions.repeatWorkout ||
      actions.startEmptyWorkout ||
      actions.patchWorkout?.addExercises?.length ||
      actions.patchWorkout?.logSets?.length ||
      userWantsStartWorkout(lastUserMessage) ||
      userWantsRepeatWorkout(lastUserMessage) ||
      userWantsGymEdit(lastUserMessage),
  );
}

/** Run write tools for cv-actions when user asked to save / apply flag set. */
export async function executeAssistantWriteTools(opts: {
  userId: string;
  today: string;
  date: string;
  actions: ExecutableActions;
  lastUserMessage: string;
}): Promise<AssistantToolResult[]> {
  if (!shouldAutoApply(opts.actions, opts.lastUserMessage)) return [];

  // Assistant J–N: all write kinds go through /api/assistant/apply after ActionCard CTA.
  // Stream path never silent-writes meals, water, weight, plan, shopping, start, delete, or patch.
  return [];
}

export function formatToolResultsForReply(results: AssistantToolResult[]): string {
  if (!results.length) return "";
  return results.map((r) => (r.ok ? `✓ ${r.message}` : `✗ ${r.message}`)).join("\n");
}

export function decodeImageBase64(
  raw: unknown,
  mimeRaw: unknown,
): { buffer: Buffer; filename: string; mimeType: string } | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let b64 = raw.trim();
  let mime = typeof mimeRaw === "string" && mimeRaw.trim() ? mimeRaw.trim() : "image/jpeg";
  const dataUrl = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(b64);
  if (dataUrl) {
    mime = dataUrl[1]!;
    b64 = dataUrl[2]!;
  }
  if (!/^image\//i.test(mime)) return null;
  try {
    const buffer = Buffer.from(b64, "base64");
    if (buffer.length < 32 || buffer.length > 12 * 1024 * 1024) return null;
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return { buffer, filename: `assistant-photo.${ext}`, mimeType: mime };
  } catch {
    return null;
  }
}
