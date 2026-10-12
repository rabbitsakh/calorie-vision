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
import { requireDateKey, shiftDateKey } from "@/lib/dates";
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

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру|выпил|воды|взвес|завес|начни|старт|съел|поел|залог(и|ить)?\s*еду|прием[ыа]?\s*пищ/i;

export function userWantsWrite(message: string): boolean {
  return WRITE_INTENT_RE.test(message.trim());
}

export function userWantsStartWorkout(message: string): boolean {
  return /начн(и|ать)|запусти\s*(трен|зал)|старт(уем|ани)?\s*(трен|зал|сегод)?/i.test(
    message.trim(),
  );
}

/** Resolve «сегодня» / «завтра» / YYYY-MM-DD / weekday label → date key. */
export function resolveAssistantDate(
  raw: string | undefined | null,
  today: string,
): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === "сегодня" || t === "today") return today;
  if (t === "завтра" || t === "tomorrow") return shiftDateKey(today, 1);
  if (t === "послезавтра") return shiftDateKey(today, 2);
  const exact = requireDateKey(raw.trim());
  if (exact) return exact;

  const wd = weekdayIndexFromLabel(raw.trim());
  if (wd == null) return null;
  const todayWd = planWeekdayFromDateKey(today);
  if (todayWd == null) return null;
  let delta = wd - todayWd;
  if (delta < 0) delta += 7;
  return shiftDateKey(today, delta);
}

export function weekdayIndexFromLabel(label: string): number | null {
  const t = label.trim().toLowerCase();
  if (!t) return null;
  const map: Array<[RegExp, number]> = [
    [/^(пн|понедельник|mon)/i, 0],
    [/^(вт|вторник|tue)/i, 1],
    [/^(ср|среда|wed)/i, 2],
    [/^(чт|четверг|thu)/i, 3],
    [/^(пт|пятница|fri)/i, 4],
    [/^(сб|суббота|sat)/i, 5],
    [/^(вс|воскресенье|sun)/i, 6],
  ];
  for (const [re, idx] of map) {
    if (re.test(t)) return idx;
  }
  const exact = (WEEKDAY_LABELS_RU as readonly string[]).findIndex(
    (l) => l.toLowerCase() === t,
  );
  return exact >= 0 ? exact : null;
}

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
}): Promise<AssistantToolResult> {
  const entries = mealsPayloadFromActions(opts.actions, opts.date);
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
    const updated = await prisma.weightEntry.update({
      where: { id: existing.id },
      data: { weightKg, measuredAt: new Date() },
    });
    return {
      ok: true,
      tool: "log_weight",
      message: `Вес ${opts.date}: ${weightKg} кг (обновил)`,
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
      message: `На ${WEEKDAY_LABELS_RU[weekday]} в плане нет тренировки`,
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
    return { ok: false, tool: "save_photo_drafts", message: "Не удалось сохранить" };
  }
  return {
    ok: true,
    tool: "save_photo_drafts",
    message: `В рацион: ${created.map((m) => `${m.dishName} — ${m.calories} ккал`).join("; ")}`,
    data: { meals: created, date: opts.date },
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
};

export function shouldAutoApply(
  actions: ExecutableActions | null,
  lastUserMessage: string,
): boolean {
  if (!actions) return false;
  if (actions.apply === true) return true;
  if (!userWantsWrite(lastUserMessage) && !userWantsStartWorkout(lastUserMessage)) {
    return false;
  }
  return Boolean(
    actions.meals?.length ||
      actions.workoutDays?.length ||
      actions.shopping?.length ||
      actions.waterMl != null ||
      actions.weightKg != null ||
      actions.startWorkout ||
      userWantsStartWorkout(lastUserMessage),
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

  const target =
    resolveAssistantDate(opts.actions.targetDate, opts.today) ?? opts.date;
  const results: AssistantToolResult[] = [];

  if (opts.actions.meals?.length) {
    results.push(
      await toolSaveMeals({
        userId: opts.userId,
        date: target,
        actions: opts.actions,
      }),
    );
  }

  if (opts.actions.workoutDays?.length) {
    results.push(
      await toolCreateWorkoutPlan({
        userId: opts.userId,
        today: opts.today,
        date: target,
        actions: opts.actions,
      }),
    );
  }

  if (opts.actions.shopping?.length) {
    results.push(
      await toolAddShopping({
        userId: opts.userId,
        names: opts.actions.shopping,
        date: target,
      }),
    );
  }

  if (typeof opts.actions.waterMl === "number") {
    results.push(
      await toolLogWater({
        userId: opts.userId,
        date: target,
        ml: opts.actions.waterMl,
      }),
    );
  }

  if (typeof opts.actions.weightKg === "number") {
    results.push(
      await toolLogWeight({
        userId: opts.userId,
        date: target,
        weightKg: opts.actions.weightKg,
      }),
    );
  }

  if (opts.actions.startWorkout || userWantsStartWorkout(opts.lastUserMessage)) {
    results.push(
      await toolStartTodaysRoutine({
        userId: opts.userId,
        date: target,
      }),
    );
  }

  return results;
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
