import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey, toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { normalizeAssistantActions, type AssistantActions } from "@/lib/admin-assistant";
import {
  checkAssistantWriteLimit,
  rateLimitResponse,
} from "@/lib/assistant-rate-limit";
import {
  mergeAssistantPrefs,
  normalizeAssistantPrefs,
  parseAssistantPrefs,
} from "@/lib/assistant-prefs";
import {
  resolveAssistantDate,
  toolAddShopping,
  toolCreateWorkoutPlan,
  toolDeleteMeals,
  toolLogWater,
  toolLogWeight,
  toolPatchMeals,
  toolSaveMeals,
  toolSavePhotoDrafts,
  toolStartTodaysRoutine,
  toolUndoWrites,
  type AssistantUndoPayload,
} from "@/lib/assistant-tools";

export const dynamic = "force-dynamic";

function parseUndo(raw: unknown): AssistantUndoPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const ids = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, 40)
      : [];
  const payload: AssistantUndoPayload = {
    mealIds: ids(obj.mealIds),
    routineIds: ids(obj.routineIds),
    waterIds: ids(obj.waterIds),
    weightIds: ids(obj.weightIds),
  };
  if (
    !payload.mealIds.length &&
    !payload.routineIds.length &&
    !payload.waterIds.length &&
    !payload.weightIds.length
  ) {
    return null;
  }
  return payload;
}

/**
 * POST actions from assistant cards / undo / photo confirm:
 * { kind: "meals"|"routine"|"shopping"|"start"|"water"|"prefs"|"undo"|"photo"|"weight"|"deleteMeals"|"patchMeals", date?, actions?, prefs?, undo?, drafts?, imagePath? }
 */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const rate = await checkAssistantWriteLimit(session.user.id);
    if (!rate.allowed) {
      const body = rateLimitResponse(rate.retryAfterSec);
      return NextResponse.json(body, {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      });
    }

    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      date?: unknown;
      actions?: unknown;
      prefs?: unknown;
      undo?: unknown;
      imagePath?: unknown;
      drafts?: unknown;
      mealType?: unknown;
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

    if (body.kind === "undo") {
      const undo = parseUndo(body.undo);
      if (!undo) {
        return NextResponse.json({ error: "Нечего отменять" }, { status: 400 });
      }
      const result = await toolUndoWrites({ userId: session.user.id, undo });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result });
    }

    if (body.kind === "photo") {
      const imagePath = typeof body.imagePath === "string" ? body.imagePath.trim() : "";
      const drafts = Array.isArray(body.drafts) ? body.drafts : [];
      if (!imagePath || !drafts.length) {
        return NextResponse.json({ error: "Нет черновика фото" }, { status: 400 });
      }
      const mealType =
        body.mealType === "BREAKFAST" ||
        body.mealType === "LUNCH" ||
        body.mealType === "DINNER" ||
        body.mealType === "SNACK"
          ? body.mealType
          : undefined;
      const parsedDrafts = drafts
        .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
        .map((d) => {
          const rawSlot = d.mealType;
          const draftMealType =
            rawSlot === "BREAKFAST" ||
            rawSlot === "LUNCH" ||
            rawSlot === "DINNER" ||
            rawSlot === "SNACK"
              ? (rawSlot as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK")
              : undefined;
          return {
            dishName: typeof d.dishName === "string" ? d.dishName : "Блюдо",
            calories: typeof d.calories === "number" ? d.calories : 200,
            protein: typeof d.protein === "number" ? d.protein : undefined,
            fat: typeof d.fat === "number" ? d.fat : undefined,
            carbs: typeof d.carbs === "number" ? d.carbs : undefined,
            fiber: typeof d.fiber === "number" ? d.fiber : undefined,
            sugar: typeof d.sugar === "number" ? d.sugar : undefined,
            portionGrams: typeof d.portionGrams === "number" ? d.portionGrams : undefined,
            mealType: draftMealType,
            confidence: typeof d.confidence === "number" ? d.confidence : undefined,
            photoKind: typeof d.photoKind === "string" ? d.photoKind : undefined,
            barcode: typeof d.barcode === "string" ? d.barcode : undefined,
            brand: typeof d.brand === "string" ? d.brand : undefined,
            recognitionSource:
              typeof d.recognitionSource === "string" ? d.recognitionSource : undefined,
          };
        });
      const result = await toolSavePhotoDrafts({
        userId: session.user.id,
        date,
        imagePath,
        drafts: parsedDrafts,
        mealType,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    const actions = normalizeAssistantActions(body.actions) as AssistantActions | null;
    if (!actions) {
      return NextResponse.json({ error: "Нет действий" }, { status: 400 });
    }

    if (body.kind === "meals") {
      const mealDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolSaveMeals({
        userId: session.user.id,
        date: mealDate,
        actions,
        timezone: user?.timezone,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...(result.data as object), tools: [result] });
    }

    if (body.kind === "weight") {
      const kg = actions.weightKg;
      if (typeof kg !== "number") {
        return NextResponse.json({ error: "Нет веса" }, { status: 400 });
      }
      const weightDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolLogWeight({
        userId: session.user.id,
        date: weightDate,
        weightKg: kg,
        overwrite: true,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    if (body.kind === "water") {
      const ml = actions.waterMl;
      if (typeof ml !== "number") {
        return NextResponse.json({ error: "Нет объёма воды" }, { status: 400 });
      }
      const waterDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolLogWater({
        userId: session.user.id,
        date: waterDate,
        ml,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    if (body.kind === "routine") {
      const result = await toolCreateWorkoutPlan({
        userId: session.user.id,
        today,
        date,
        actions,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...(result.data as object), tools: [result] });
    }

    if (body.kind === "shopping") {
      const names = actions.shopping ?? [];
      if (!names.length) {
        return NextResponse.json({ error: "Нет покупок" }, { status: 400 });
      }
      const shoppingDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolAddShopping({
        userId: session.user.id,
        names,
        date: shoppingDate,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    if (body.kind === "start") {
      const startDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolStartTodaysRoutine({
        userId: session.user.id,
        date: startDate,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    if (body.kind === "deleteMeals") {
      const matches = actions.deleteMeals ?? [];
      if (!matches.length) {
        return NextResponse.json({ error: "Нет блюд для удаления" }, { status: 400 });
      }
      const deleteDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolDeleteMeals({
        userId: session.user.id,
        date: deleteDate,
        matches,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    if (body.kind === "patchMeals") {
      const patches = actions.patchMeals ?? [];
      if (!patches.length) {
        return NextResponse.json({ error: "Нет правок" }, { status: 400 });
      }
      const patchDate =
        resolveAssistantDate(actions.targetDate, today) ??
        requireDateKey(typeof body.date === "string" ? body.date : null) ??
        date;
      const result = await toolPatchMeals({
        userId: session.user.id,
        date: patchDate,
        patches,
        timezone: user?.timezone,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, result, tools: [result] });
    }

    return NextResponse.json({ error: "Неизвестный kind" }, { status: 400 });
  } catch (error) {
    console.error("assistant apply", error);
    return NextResponse.json({ error: "Не удалось применить" }, { status: 500 });
  }
}
