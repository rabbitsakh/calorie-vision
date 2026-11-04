/**
 * Единственная запись подтверждённой еды: POST /api/meals.
 * Чат, фото и штрихкод сходятся сюда после одной и той же проверки.
 */

import { enqueueFailedSave } from "@/lib/meal-draft-queue";
import { withBasePath } from "@/lib/paths";
import { readApiJson } from "@/lib/read-api-json";
import type { SaveMealInput } from "@/lib/save-meal";

export type ConfirmedMealSaveResult =
  | { ok: true; mealIds: string[]; savedCount: number; totalCalories: number }
  | { ok: false; error: string; queued: boolean };

export async function postConfirmedMeals(
  date: string,
  inputs: SaveMealInput[],
): Promise<ConfirmedMealSaveResult> {
  if (!inputs.length) {
    return { ok: false, error: "Нет блюд для записи", queued: false };
  }
  const totalCalories = inputs.reduce((sum, row) => sum + (Number(row.calories) || 0), 0);
  const body = inputs.length > 1 ? { entries: inputs } : inputs[0]!;
  try {
    const response = await fetch(withBasePath("/api/meals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readApiJson<{
      error?: string;
      entry?: { id?: string };
      entries?: Array<{ id?: string }>;
    }>(response);
    if (!response.ok) {
      const error = data.error ?? "Ошибка сохранения";
      if (response.status >= 500) {
        enqueueFailedSave(date, body);
        return { ok: false, error, queued: true };
      }
      return { ok: false, error, queued: false };
    }
    const rows = data.entries ?? (data.entry ? [data.entry] : []);
    return {
      ok: true,
      mealIds: rows.map((row) => row.id).filter((id): id is string => Boolean(id)),
      savedCount: rows.length || inputs.length,
      totalCalories,
    };
  } catch (error) {
    enqueueFailedSave(date, body);
    return {
      ok: false,
      queued: true,
      error: error instanceof Error ? error.message : "Не удалось сохранить",
    };
  }
}
