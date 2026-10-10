import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey, toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { normalizeAssistantActions, type AssistantActions } from "@/lib/admin-assistant";
import {
  buildRoutinePayloadFromActions,
  mealsPayloadFromActions,
} from "@/lib/assistant-apply";
import {
  mergeAssistantPrefs,
  normalizeAssistantPrefs,
  parseAssistantPrefs,
} from "@/lib/assistant-prefs";
import { validateSaveMealInput, buildMealCreateData } from "@/lib/save-meal";
import { touchExerciseLibraryMany } from "@/lib/workouts/library";
import { plannedSetsToJson, routineInclude, serializeRoutine } from "@/lib/workouts/routines";

export const dynamic = "force-dynamic";

/**
 * POST actions from assistant cards:
 * { kind: "meals"|"routine"|"prefs", date?, actions?, prefs? }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      date?: unknown;
      actions?: unknown;
      prefs?: unknown;
    } | null;
    if (!body || typeof body.kind !== "string") {
      return NextResponse.json({ error: "Укажите kind" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, assistantPrefsJson: true },
    });
    const today = toDateKeyTz(new Date(), user?.timezone);
    const date = requireDateKey(typeof body.date === "string" ? body.date : null) ?? today;

    if (body.kind === "prefs") {
      const next = normalizeAssistantPrefs(body.prefs);
      if (!next) {
        return NextResponse.json({ error: "Некорректные предпочтения" }, { status: 400 });
      }
      const merged = mergeAssistantPrefs(parseAssistantPrefs(user?.assistantPrefsJson), next);
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          assistantPrefsJson:
            merged.likes.length || merged.dislikes.length || merged.notes.length
              ? (merged as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
      return NextResponse.json({ ok: true, prefs: merged });
    }

    const actions = normalizeAssistantActions(body.actions) as AssistantActions | null;
    if (!actions) {
      return NextResponse.json({ error: "Нет действий" }, { status: 400 });
    }

    if (body.kind === "meals") {
      const entries = mealsPayloadFromActions(actions, date);
      if (!entries.length) {
        return NextResponse.json({ error: "Нет блюд в плане" }, { status: 400 });
      }
      const created: Array<{ id: string; dishName: string; calories: number }> = [];
      for (const raw of entries) {
        const validated = validateSaveMealInput(raw);
        if (validated.error || !validated.date) continue;
        const row = await prisma.mealEntry.create({
          data: buildMealCreateData(session.user.id, raw, validated.date),
        });
        created.push({ id: row.id, dishName: row.dishName, calories: row.calories });
      }
      if (!created.length) {
        return NextResponse.json({ error: "Не удалось сохранить блюда" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, meals: created });
    }

    if (body.kind === "routine") {
      const payload = buildRoutinePayloadFromActions(actions);
      if (!payload) {
        return NextResponse.json({ error: "Нет дней тренировок в плане" }, { status: 400 });
      }
      const maxOrder = await prisma.workoutRoutine.aggregate({
        where: { userId: session.user.id },
        _max: { sortOrder: true },
      });
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.workoutRoutine.create({
          data: {
            userId: session.user.id,
            name: payload.name,
            note: payload.note,
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
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
        await touchExerciseLibraryMany(
          tx,
          session.user.id,
          payload.exercises.map((ex) => ({ name: ex.name, muscleGroup: ex.muscleGroup })),
        );
        return row;
      });
      return NextResponse.json({ ok: true, routine: serializeRoutine(created) });
    }

    return NextResponse.json({ error: "Неизвестный kind" }, { status: 400 });
  } catch (error) {
    console.error("assistant apply", error);
    return NextResponse.json({ error: "Не удалось применить" }, { status: 500 });
  }
}
