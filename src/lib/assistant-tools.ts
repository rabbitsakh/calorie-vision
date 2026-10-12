/**
 * Server-side agent tools for the AI assistant:
 * save meals, schedule workout routines, recognize photo → diary.
 */

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
import { prisma } from "@/lib/prisma";
import { buildMealCreateData, validateSaveMealInput, type SaveMealInput } from "@/lib/save-meal";
import { saveImageBuffer } from "@/lib/upload";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import { plannedSetsToJson, routineInclude, serializeRoutine } from "@/lib/workouts/routines";
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

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру/i;

export function userWantsWrite(message: string): boolean {
  return WRITE_INTENT_RE.test(message.trim());
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
    // Fallback: single combined routine (legacy shape)
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
      data: { routines: [s] },
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

export async function toolRecognizeAndSaveMeal(opts: {
  userId: string;
  date: string;
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
}): Promise<AssistantToolResult> {
  try {
    const recognition = await recognizeFoodWithAI(opts.buffer, opts.filename, opts.userId);
    const imagePath = await saveImageBuffer(
      opts.buffer,
      opts.mimeType || "image/jpeg",
      { ownerUserId: opts.userId },
    );
    const input: SaveMealInput = {
      date: opts.date,
      dishName: recognition.dishName || "Блюдо",
      calories: recognition.calories || 200,
      protein: recognition.protein,
      fat: recognition.fat,
      carbs: recognition.carbs,
      fiber: recognition.fiber,
      sugar: recognition.sugar,
      portionGrams: recognition.portionGrams,
      confidence: recognition.confidence,
      imagePath,
      recognitionSource: recognition.source ?? "assistant-photo",
      photoKind: recognition.photoKind,
      barcode: recognition.barcode ?? undefined,
      brand: recognition.brand ?? undefined,
      mealType: opts.mealType,
    };
    const validated = validateSaveMealInput(input);
    if (validated.error || !validated.date) {
      return {
        ok: false,
        tool: "recognize_and_save_meal",
        message: validated.error || "Не удалось сохранить блюдо с фото",
      };
    }
    const row = await prisma.mealEntry.create({
      data: buildMealCreateData(opts.userId, input, validated.date),
    });
    return {
      ok: true,
      tool: "recognize_and_save_meal",
      message: `По фото в рацион ${opts.date}: ${row.dishName} — ${row.calories} ккал`,
      data: {
        meal: { id: row.id, dishName: row.dishName, calories: row.calories },
        recognition: {
          dishName: recognition.dishName,
          calories: recognition.calories,
          confidence: recognition.confidence,
        },
      },
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

export type ExecutableActions = AssistantActions & {
  apply?: boolean;
  targetDate?: string;
};

export function shouldAutoApply(
  actions: ExecutableActions | null,
  lastUserMessage: string,
): boolean {
  if (!actions) return false;
  if (actions.apply === true) return true;
  if (!userWantsWrite(lastUserMessage)) return false;
  return Boolean(actions.meals?.length || actions.workoutDays?.length);
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
