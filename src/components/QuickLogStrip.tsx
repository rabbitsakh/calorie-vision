"use client";

import { useCallback, useEffect, useState } from "react";
import { enqueueFailedSave } from "@/lib/meal-draft-queue";
import { trackFirstMealSaveGoal, trackMealSavedGoal } from "@/lib/metrika-funnel";
import { withBasePath } from "@/lib/paths";
import { buildQuickMealLogExtras } from "@/lib/quick-meal-log";
import { useTimezone } from "@/lib/use-timezone";
import type { SaveMealInput } from "@/lib/save-meal";

const QUICK_ADD_CACHE_KEY = "cv-quick-add-cache-v1";
const FAVORITES_CACHE_KEY = "cv-favorites-cache-v1";

type QuickAddResponse = {
  yesterdayDate: string;
  yesterdayCount: number;
};

type FavoriteFood = {
  id: string;
  name: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  portionGrams: number | null;
  useCount: number;
};

type QuickLogStripProps = {
  selectedDate: string;
  refreshKey: number;
  /** Hide when diary is empty — empty DailyLog already offers copy-yesterday. */
  mealCount: number;
  onSaved: () => void;
};

function readQuickAddCache(): QuickAddResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUICK_ADD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickAddResponse;
    if (!parsed || typeof parsed.yesterdayCount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readFavoritesCache(): FavoriteFood[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FavoriteFood =>
        item != null &&
        typeof item === "object" &&
        typeof (item as FavoriteFood).id === "string" &&
        typeof (item as FavoriteFood).name === "string" &&
        typeof (item as FavoriteFood).calories === "number",
    );
  } catch {
    return [];
  }
}

function isLikelyOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /failed to fetch|network|offline/i.test(err.message)) return true;
  return false;
}

/**
 * Compact day-1+ strip: «Как вчера» + top favorites above the fold.
 * Full QuickAddAgain accordion stays below for templates / more.
 */
export function QuickLogStrip({
  selectedDate,
  refreshKey,
  mealCount,
  onSaved,
}: QuickLogStripProps) {
  const timezone = useTimezone();
  const [yesterdayDate, setYesterdayDate] = useState<string | null>(null);
  const [yesterdayCount, setYesterdayCount] = useState(0);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cachedQa = readQuickAddCache();
    if (cachedQa) {
      setYesterdayDate(cachedQa.yesterdayDate);
      setYesterdayCount(cachedQa.yesterdayCount);
    }
    const cachedFav = readFavoritesCache();
    if (cachedFav.length > 0) setFavorites(cachedFav.slice(0, 2));

    try {
      const [qaResp, favResp] = await Promise.all([
        fetch(withBasePath("/api/meals/quick-add")),
        fetch(withBasePath("/api/custom-foods")),
      ]);
      if (qaResp.ok) {
        const qa = (await qaResp.json()) as QuickAddResponse;
        setYesterdayDate(qa.yesterdayDate);
        setYesterdayCount(qa.yesterdayCount);
      }
      if (favResp.ok) {
        const fav = (await favResp.json()) as { foods?: FavoriteFood[] };
        const list = Array.isArray(fav.foods) ? fav.foods : [];
        const sorted = [...list].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
        setFavorites(sorted.slice(0, 2));
      }
    } catch {
      // keep cache
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function copyYesterday() {
    if (!yesterdayDate || yesterdayCount <= 0) return;
    setBusy("yesterday");
    setNotice(null);
    try {
      const resp = await fetch(withBasePath("/api/meals/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: yesterdayDate, toDate: selectedDate }),
      });
      const payload = (await resp.json()) as { error?: string };
      if (resp.ok) {
        trackFirstMealSaveGoal();
        trackMealSavedGoal();
        onSaved();
      } else {
        setNotice(payload.error ?? "Не удалось скопировать");
      }
    } catch {
      setNotice("Нет сети — копирование недоступно офлайн");
    } finally {
      setBusy(null);
    }
  }

  async function logFavorite(food: FavoriteFood) {
    setBusy(food.id);
    setNotice(null);
    const { mealType, eatenAt } = buildQuickMealLogExtras(selectedDate, timezone);
    const body: SaveMealInput = {
      date: selectedDate,
      dishName: food.name,
      calories: food.calories,
      protein: food.protein ?? undefined,
      fat: food.fat ?? undefined,
      carbs: food.carbs ?? undefined,
      fiber: food.fiber ?? undefined,
      sugar: food.sugar ?? undefined,
      portionGrams: food.portionGrams ?? undefined,
      mealType,
      eatenAt,
    };
    try {
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        void fetch(withBasePath(`/api/custom-foods/${food.id}/use`), { method: "POST" });
        trackFirstMealSaveGoal();
        trackMealSavedGoal();
        onSaved();
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueFailedSave(selectedDate, body);
        setNotice("Офлайн: в очереди");
        onSaved();
      }
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        enqueueFailedSave(selectedDate, body);
        setNotice("Офлайн: в очереди");
        onSaved();
      }
    } finally {
      setBusy(null);
    }
  }

  if (mealCount <= 0) return null;

  const showYesterday = yesterdayCount > 0 && Boolean(yesterdayDate);
  const topFavs = favorites.slice(0, 2);
  if (!showYesterday && topFavs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-0.5" aria-label="Быстрый лог">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Быстрый лог
        </p>
        {notice ? <p className="truncate text-xs text-amber-800">{notice}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {showYesterday ? (
          <button
            type="button"
            className="chip min-h-9 bg-teal-100 font-semibold text-teal-900"
            disabled={busy !== null}
            onClick={() => void copyYesterday()}
          >
            {busy === "yesterday" ? "Копируем…" : `Как вчера · ${yesterdayCount}`}
          </button>
        ) : null}
        {topFavs.map((food) => (
          <button
            key={food.id}
            type="button"
            className="chip min-h-9 max-w-[11rem] truncate"
            disabled={busy !== null}
            title={`${food.name} · ${food.calories} ккал`}
            onClick={() => void logFavorite(food)}
          >
            {busy === food.id ? "…" : `${food.name} · ${food.calories}`}
          </button>
        ))}
      </div>
    </div>
  );
}
