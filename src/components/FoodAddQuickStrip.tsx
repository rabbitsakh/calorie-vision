"use client";

import { useCallback, useEffect, useState } from "react";
import { isLikelyOfflineError } from "@/lib/connectivity";
import { enqueueFailedSave } from "@/lib/meal-draft-queue";
import { trackFirstMealSaveGoal, trackMealSavedGoal } from "@/lib/metrika-funnel";
import { withBasePath } from "@/lib/paths";
import { buildQuickMealLogExtras } from "@/lib/quick-meal-log";
import { useTimezone } from "@/lib/use-timezone";
import type { SaveMealInput } from "@/lib/save-meal";

type QuickItem = {
  key: string;
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  mealType?: string | null;
  kind: "repeat" | "favorite";
};

type FoodAddQuickStripProps = {
  selectedDate: string;
  /** Prefill / override meal slot when logging. */
  mealType?: string;
  onLogged: () => void;
};

/**
 * Compact «Повторить» / «Избранное» chips inside the «+» picker (Wave P1).
 * Loads quietly; hidden when both lists are empty.
 */
export function FoodAddQuickStrip({ selectedDate, mealType, onLogged }: FoodAddQuickStripProps) {
  const timezone = useTimezone();
  const [items, setItems] = useState<QuickItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next: QuickItem[] = [];
    try {
      const [quickResp, favResp] = await Promise.all([
        fetch(withBasePath("/api/meals/quick-add")),
        fetch(withBasePath("/api/custom-foods")),
      ]);

      if (quickResp.ok) {
        const json = (await quickResp.json()) as {
          suggestions?: Array<{
            dishName: string;
            calories: number;
            protein: number | null;
            fat: number | null;
            carbs: number | null;
            fiber: number | null;
            sugar: number | null;
            portionGrams: number | null;
            mealType: string | null;
          }>;
        };
        for (const s of (json.suggestions ?? []).slice(0, 3)) {
          next.push({
            key: `r:${s.dishName}`,
            dishName: s.dishName,
            calories: s.calories,
            protein: s.protein,
            fat: s.fat,
            carbs: s.carbs,
            fiber: s.fiber,
            sugar: s.sugar,
            portionGrams: s.portionGrams,
            mealType: s.mealType,
            kind: "repeat",
          });
        }
      }

      if (favResp.ok) {
        const json = (await favResp.json()) as {
          foods?: Array<{
            id: string;
            name: string;
            calories: number;
            protein: number | null;
            fat: number | null;
            carbs: number | null;
            fiber: number | null;
            sugar: number | null;
            portionGrams: number | null;
            useCount?: number;
          }>;
        };
        const ordered = [...(json.foods ?? [])]
          .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
          .slice(0, 3);
        for (const f of ordered) {
          if (next.some((item) => item.dishName.toLowerCase() === f.name.toLowerCase())) continue;
          next.push({
            key: `f:${f.id}`,
            dishName: f.name,
            calories: f.calories,
            protein: f.protein,
            fat: f.fat,
            carbs: f.carbs,
            fiber: f.fiber,
            sugar: f.sugar,
            portionGrams: f.portionGrams,
            kind: "favorite",
          });
        }
      }
    } catch {
      // strip stays hidden when empty
    }

    // Cap total chips so the picker stays one screen.
    setItems(next.slice(0, 4));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logItem(item: QuickItem) {
    setBusyKey(item.key);
    setNotice(null);
    const extras = buildQuickMealLogExtras(selectedDate, timezone);
    const body: SaveMealInput = {
      date: selectedDate,
      dishName: item.dishName,
      calories: item.calories,
      protein: item.protein ?? undefined,
      fat: item.fat ?? undefined,
      carbs: item.carbs ?? undefined,
      fiber: item.fiber ?? undefined,
      sugar: item.sugar ?? undefined,
      portionGrams: item.portionGrams ?? undefined,
      mealType: mealType || item.mealType || extras.mealType,
      eatenAt: extras.eatenAt,
    };

    try {
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        trackFirstMealSaveGoal();
        trackMealSavedGoal();
        onLogged();
        return;
      }
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        enqueueFailedSave(selectedDate, body);
        setNotice("В очереди на устройстве");
        onLogged();
      }
    } finally {
      setBusyKey(null);
    }
  }

  if (items.length === 0) {
    return null;
  }

  const repeats = items.filter((i) => i.kind === "repeat");
  const favorites = items.filter((i) => i.kind === "favorite");

  return (
    <div className="food-add-quick-strip">
      {repeats.length > 0 ? (
        <div className="food-add-quick-block">
          <p className="food-add-quick-label">Повторить</p>
          <div className="food-add-quick-chips">
            {repeats.map((item) => (
              <button
                key={item.key}
                type="button"
                className="food-add-quick-chip"
                disabled={busyKey === item.key}
                onClick={() => void logItem(item)}
              >
                <span className="food-add-quick-chip-name">{item.dishName}</span>
                <span className="food-add-quick-chip-kcal">{item.calories} ккал</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {favorites.length > 0 ? (
        <div className="food-add-quick-block">
          <p className="food-add-quick-label">Избранное</p>
          <div className="food-add-quick-chips">
            {favorites.map((item) => (
              <button
                key={item.key}
                type="button"
                className="food-add-quick-chip food-add-quick-chip--fav"
                disabled={busyKey === item.key}
                onClick={() => void logItem(item)}
              >
                <span className="food-add-quick-chip-name">{item.dishName}</span>
                <span className="food-add-quick-chip-kcal">{item.calories} ккал</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {notice ? <p className="food-add-quick-notice">{notice}</p> : null}
    </div>
  );
}
