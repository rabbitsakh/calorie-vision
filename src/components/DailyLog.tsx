"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DietTargets } from "@/components/DietTargets";
import { Mascot } from "@/components/Mascot";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { FlameIcon } from "@/components/StreakIcon";
import type { DayMealsResponse, MealEntry } from "@/types";
import {
  formatDateWords,
  shiftDateKey,
} from "@/lib/dates";
import { MASCOT_COPY } from "@/lib/mascot-copy";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { withBasePath } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";
import {
  addMealTotals,
  appendPendingDelete,
  buildDiaryDisplayRows,
  collectHiddenMealIds,
  filterMealsResponse,
  findMealListIndex,
  mealListItemKey,
  mergeEntriesAfterUndo,
  pruneConfirmedTombstones,
  subtractMealTotals,
  type PendingDeleteSlot,
} from "@/lib/diary-delete-slots";
import { pluralDays } from "@/lib/russian-text";
import {
  diaryHasMealTypes,
  MEAL_TYPE_SECTION_ORDER,
  matchesDiarySourceFilter,
  mealTypeForListItem,
  organizeDiaryByMealType,
  sectionLabel,
  type DiarySourceFilter,
  type MealTypeSection,
} from "@/lib/diary-meal-sections";
import { DEFAULT_LOW_CONFIDENCE_THRESHOLD } from "@/lib/ai/recognition-confidence-calibration";
import { parseAllergensJson, type AllergenId } from "@/lib/allergens";
import { groupMealEntries } from "@/lib/meal-groups";
import { MealListRow, MealSectionHeader } from "@/components/DailyLogMealCards";
import type { EditPatch } from "@/components/DailyLogInlineEdit";

/** Inline undo row — expiry handled by DailyLog parent timer (survives re-renders). */
function UndoToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div className="undo-toast flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-300">Удалено</span>
        <span className="mt-0.5 block truncate font-medium">{message}</span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30"
        onClick={onUndo}
      >
        Отменить
      </button>
    </div>
  );
}

const UNDO_DELETE_MS = 5000;

type DailyLogProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged?: () => void;
  onTotalsChange?: (calories: number) => void;
  compact?: boolean;
  timezone?: string | null;
  /** Primary empty-state CTA — usually open camera. */
  onAddFood?: () => void;
  /** Secondary empty-state CTA — text entry. */
  onAddFoodText?: () => void;
};

export function DailyLog({ selectedDate, refreshKey, onChanged, onTotalsChange, compact, timezone, onAddFood }: DailyLogProps) {
  const day = useOptionalRationDay();
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 });
  const [userAllergens, setUserAllergens] = useState<AllergenId[]>([]);
  const [daySummary, setDaySummary] = useState<
    Pick<
      DayMealsResponse,
      "comparison" | "calorieTone" | "weightKg" | "dietLabel" | "sex" | "calorieExplanation"
    >
  >({
    comparison: null,
    calorieTone: null,
    weightKg: null,
    dietLabel: null,
    sex: null,
    calorieExplanation: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<PendingDeleteSlot[]>([]);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [showNormDetails, setShowNormDetails] = useState(() => {
    if (typeof window === "undefined") return !compact;
    if (!compact) return true;
    try {
      // First visit (no flag): open meal budget by default (#18)
      return localStorage.getItem("ration-norm-details") !== "0";
    } catch {
      return true;
    }
  });
  const attemptedImageMealIds = useRef(new Set<string>());
  const tombstoneMealIdsRef = useRef(new Set<string>());
  const confirmingDeleteKeysRef = useRef(new Set<string>());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const dayRefresh = day?.refresh;
  const dayData = day?.data ?? null;
  const dayLoading = day?.loading ?? false;
  const dayDate = day?.date;
  const hasProvider = day != null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { allergens?: unknown };
        if (!cancelled) setUserAllergens(parseAllergensJson(data.allergens));
      } catch {
        // soft hint only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleNormDetails() {
    setShowNormDetails((value) => {
      const next = !value;
      try {
        localStorage.setItem("ration-norm-details", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const applyMeals = useCallback(
    (data: DayMealsResponse) => {
      setEntries(data.entries);
      setTotals({
        calories: data.totalCalories,
        protein: data.totalProtein ?? 0,
        fat: data.totalFat ?? 0,
        carbs: data.totalCarbs ?? 0,
        fiber: data.totalFiber ?? 0,
        sugar: data.totalSugar ?? 0,
      });
      onTotalsChange?.(data.totalCalories);
      setDaySummary({
        comparison: data.comparison ?? null,
        calorieTone: data.calorieTone ?? null,
        weightKg: data.weightKg ?? null,
        dietLabel: data.dietLabel ?? null,
        sex: data.sex ?? null,
        calorieExplanation: data.calorieExplanation ?? null,
      });
    },
    [onTotalsChange],
  );

  const loadEntries = useCallback(async (quiet = false) => {
    const date = selectedDate;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(withBasePath(`/api/meals?date=${date}`), {
        cache: "no-store",
      });
      const data = (await response.json()) as DayMealsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить день");
      }

      if (selectedDateRef.current !== date) {
        return;
      }

      applyMeals(data);
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, [selectedDate, applyMeals]);

  const hiddenMealIds = useMemo(
    () => collectHiddenMealIds(pendingDeletes, tombstoneMealIdsRef.current),
    [pendingDeletes],
  );

  useEffect(() => {
    attemptedImageMealIds.current.clear();
    tombstoneMealIdsRef.current.clear();
    confirmingDeleteKeysRef.current.clear();
    setPendingDeletes([]);
  }, [selectedDate]);

  useEffect(() => {
    if (dayData?.date === selectedDate && dayData.meals) {
      // During undo window keep optimistic local entries — provider cache may be stale.
      if (pendingDeletes.length > 0) {
        setStreakDays(dayData.streak?.streak ?? 0);
        setLoading(false);
        setError(null);
        return;
      }

      pruneConfirmedTombstones(tombstoneMealIdsRef.current, dayData.meals.entries);
      const meals =
        hiddenMealIds.size > 0
          ? filterMealsResponse(dayData.meals, hiddenMealIds)
          : dayData.meals;
      applyMeals(meals);
      setStreakDays(dayData.streak?.streak ?? 0);
      setLoading(false);
      setError(null);
      return;
    }

    if (hasProvider && dayDate === selectedDate) {
      if (dayLoading || !dayData) {
        setLoading(true);
        return;
      }
    }

    if (!hasProvider) {
      void loadEntries();
    }
  }, [
    applyMeals,
    dayData,
    dayDate,
    dayLoading,
    hasProvider,
    hiddenMealIds,
    loadEntries,
    pendingDeletes.length,
    selectedDate,
  ]);

  useEffect(() => {
    if (dayData?.date === selectedDate && dayData.streak) {
      setStreakDays(dayData.streak.streak);
      return;
    }
    if (hasProvider && dayDate === selectedDate) {
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${selectedDate}`), {
          cache: "no-store",
        });
        const data = (await resp.json()) as { streak?: number };
        if (resp.ok && data.streak != null) {
          setStreakDays(data.streak);
        }
      } catch {
        // streak is non-critical
      }
    })();
  }, [dayData, dayDate, hasProvider, selectedDate, refreshKey]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const missingIds = entries
      .filter((entry) => !entry.imagePath && !attemptedImageMealIds.current.has(entry.id))
      .map((entry) => entry.id);
    const lookupWithImageIds = entries
      .filter((entry) => {
        if (!entry.imagePath || attemptedImageMealIds.current.has(`repair:${entry.id}`)) {
          return false;
        }
        const source = entry.recognitionSource?.trim() || "";
        return (
          source === "gigachat-lookup" ||
          source === "gigachat-barcode" ||
          source === "openfoodfacts-search" ||
          source === "openfoodfacts-barcode" ||
          source === "ru-sku-cache" ||
          source === "ru-nutrition-table"
        );
      })
      .map((entry) => entry.id);

    if (missingIds.length === 0 && lookupWithImageIds.length === 0) {
      return;
    }

    for (const id of missingIds) {
      attemptedImageMealIds.current.add(id);
    }
    for (const id of lookupWithImageIds) {
      attemptedImageMealIds.current.add(`repair:${id}`);
    }
    const date = selectedDate;

    const runBackfill = () => {
      void (async () => {
        try {
          const response = await fetch(withBasePath("/api/meals/images"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date }),
          });
          const data = (await response.json()) as { updated?: number; repaired?: number };
          const changed = (data.updated ?? 0) + (data.repaired ?? 0);
          if (response.ok && changed > 0 && selectedDateRef.current === date) {
            if (dayRefresh) {
              void dayRefresh(true);
            } else {
              void loadEntries(true);
            }
          }
        } catch {
          // Diary still works if image lookup fails.
        }
      })();
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const ric = typeof window !== "undefined"
      ? (window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
          cancelIdleCallback?: (id: number) => void;
        }).requestIdleCallback
      : undefined;
    const cic = typeof window !== "undefined"
      ? (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
      : undefined;

    if (typeof ric === "function") {
      idleId = ric(runBackfill, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(runBackfill, 200);
    }

    return () => {
      if (idleId != null && typeof cic === "function") cic(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [loading, error, entries, selectedDate, loadEntries, dayRefresh]);

  async function handleEdit(id: string, patch: EditPatch) {
    const response = await fetch(withBasePath(`/api/meals/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Не удалось обновить запись");
    }

    // Optimistic update so meal-type budget bars move immediately.
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        return {
          ...entry,
          dishName: patch.dishName,
          calories: patch.calories,
          protein: patch.protein ?? null,
          fat: patch.fat ?? null,
          carbs: patch.carbs ?? null,
          fiber: patch.fiber ?? null,
          sugar: patch.sugar ?? null,
          portionGrams: patch.portionGrams ?? null,
          mealType:
            patch.mealType === undefined
              ? entry.mealType
              : patch.mealType === null || patch.mealType === ""
                ? null
                : (patch.mealType as MealEntry["mealType"]),
          eatenAt: patch.eatenAt !== undefined ? patch.eatenAt : entry.eatenAt,
        };
      }),
    );
    // Allow photo backfill to retry after a rename.
    attemptedImageMealIds.current.delete(id);

    await reloadDayAfterMutation(true);
    onChanged?.();
    emitMascotReaction("save");
  }

  async function handleEatenAtChange(id: string, eatenAt: string) {
    setActionError(null);
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, eatenAt } : entry)),
    );

    const response = await fetch(withBasePath(`/api/meals/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eatenAt }),
      cache: "no-store",
    });
    if (!response.ok) {
      await reloadDayAfterMutation(true);
      setActionError("Не удалось изменить время — попробуйте ещё раз");
      return;
    }
    await reloadDayAfterMutation(true);
    onChanged?.();
    emitMascotReaction("save");
  }

  async function handleMealTypeChange(id: string, mealType: string | null) {
    setActionError(null);
    // Optimistic so budget bars update immediately.
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, mealType: mealType as MealEntry["mealType"] }
          : entry,
      ),
    );

    const response = await fetch(withBasePath(`/api/meals/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealType }),
      cache: "no-store",
    });
    if (!response.ok) {
      await reloadDayAfterMutation(true);
      setActionError("Не удалось сменить приём пищи — попробуйте ещё раз");
      return;
    }
    await reloadDayAfterMutation(true);
    onChanged?.();
  }

  async function handleDuplicate(id: string) {
    const response = await fetch(withBasePath(`/api/meals/${id}/duplicate`), {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) {
      await reloadDayAfterMutation(true);
      return;
    }
    await reloadDayAfterMutation(true);
    onChanged?.();
  }

  function handleImageChange(id: string, imagePath: string | null) {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, imagePath } : entry)),
    );
    if (imagePath) {
      attemptedImageMealIds.current.add(id);
    } else {
      attemptedImageMealIds.current.delete(id);
    }
    onChanged?.();
  }

  async function reloadDayAfterMutation(quiet = true) {
    if (dayRefresh) {
      await dayRefresh(quiet);
      return;
    }
    await loadEntries(quiet);
  }

  async function deleteMealsOnServer(ids: string[]) {
    const results = await Promise.all(
      ids.map(async (id) => {
        const response = await fetch(withBasePath(`/api/meals/${id}`), { method: "DELETE" });
        return { id, ok: response.ok, status: response.status };
      }),
    );
    const failed = results.filter((result) => !result.ok && result.status !== 404);
    if (failed.length > 0) {
      throw new Error("Не удалось удалить запись");
    }
  }

  async function performDelete(ids: string[]) {
    await deleteMealsOnServer(ids);
    if (dayRefresh) {
      void dayRefresh(true);
    } else {
      void loadEntries(true);
    }
    onChanged?.();
  }

  function requestDelete(ids: string[], label: string) {
    const snapshot = entries.filter((entry) => ids.includes(entry.id));
    if (snapshot.length === 0) return;

    for (const id of ids) {
      tombstoneMealIdsRef.current.add(id);
    }

    const items = groupMealEntries(entries);
    const index = findMealListIndex(items, ids);
    const removedKey = index >= 0 ? mealListItemKey(items[index]!) : null;
    const nextItem = index >= 0 ? items[index + 1] : undefined;
    const afterKey = nextItem ? mealListItemKey(nextItem) : null;
    const slot: PendingDeleteSlot = {
      key: `del-${ids.slice().sort().join("-")}-${Date.now()}`,
      ids,
      label,
      snapshot,
      afterKey,
      expiresAt: Date.now() + UNDO_DELETE_MS,
    };

    setEntries((prev) => prev.filter((entry) => !ids.includes(entry.id)));
    setTotals((prev) => {
      const next = subtractMealTotals(prev, snapshot);
      onTotalsChange?.(next.calories);
      return next;
    });
    setPendingDeletes((prev) =>
      removedKey ? appendPendingDelete(prev, slot, removedKey) : [...prev, slot],
    );
  }

  async function confirmDelete(slotKey: string) {
    if (confirmingDeleteKeysRef.current.has(slotKey)) return;
    confirmingDeleteKeysRef.current.add(slotKey);

    let slot: PendingDeleteSlot | undefined;
    setPendingDeletes((prev) => {
      slot = prev.find((item) => item.key === slotKey);
      return prev.filter((item) => item.key !== slotKey);
    });
    if (!slot) {
      confirmingDeleteKeysRef.current.delete(slotKey);
      return;
    }

    try {
      await performDelete(slot.ids);
    } catch {
      for (const id of slot.ids) {
        tombstoneMealIdsRef.current.delete(id);
      }
      setEntries((prev) => mergeEntriesAfterUndo(prev, slot!.snapshot));
      setTotals((prev) => {
        const next = addMealTotals(prev, slot!.snapshot);
        onTotalsChange?.(next.calories);
        return next;
      });
      setActionError("Не удалось удалить — запись восстановлена");
    } finally {
      confirmingDeleteKeysRef.current.delete(slotKey);
    }
  }

  function undoDelete(slotKey: string) {
    confirmingDeleteKeysRef.current.delete(slotKey);
    let slot: PendingDeleteSlot | undefined;
    setPendingDeletes((prev) => {
      slot = prev.find((item) => item.key === slotKey);
      return prev.filter((item) => item.key !== slotKey);
    });
    if (!slot) return;
    for (const id of slot.ids) {
      tombstoneMealIdsRef.current.delete(id);
    }
    setEntries((prev) => mergeEntriesAfterUndo(prev, slot!.snapshot));
    setTotals((prev) => {
      const next = addMealTotals(prev, slot!.snapshot);
      onTotalsChange?.(next.calories);
      return next;
    });
  }

  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [yesterdayHasMeals, setYesterdayHasMeals] = useState(false);
  const [yesterdayHasBreakfast, setYesterdayHasBreakfast] = useState(false);
  const [mealFilter, setMealFilter] = useState<"ALL" | MealTypeSection>("ALL");
  const [sourceFilter, setSourceFilter] = useState<DiarySourceFilter>("ALL");
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<MealTypeSection, boolean>>>({});

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    const empty = !loading && !error && entries.length === 0 && pendingDeletes.length === 0;
    if (!empty) {
      setYesterdayHasMeals(false);
      setYesterdayHasBreakfast(false);
      return;
    }
    const fromDate = shiftDateKey(selectedDate, -1);
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(withBasePath(`/api/meals?date=${fromDate}`), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setYesterdayHasMeals(false);
          setYesterdayHasBreakfast(false);
          return;
        }
        const data = (await response.json()) as DayMealsResponse;
        const entries = data.entries ?? [];
        setYesterdayHasMeals(entries.length > 0);
        setYesterdayHasBreakfast(entries.some((entry) => entry.mealType === "BREAKFAST"));
      } catch {
        if (!controller.signal.aborted) {
          setYesterdayHasMeals(false);
          setYesterdayHasBreakfast(false);
        }
      }
    })();
    return () => controller.abort();
  }, [loading, error, entries.length, pendingDeletes.length, selectedDate]);

  async function handleCopyYesterday() {
    setCopying(true);
    setCopyError(null);
    try {
      const fromDate = shiftDateKey(selectedDate, -1);
      const resp = await fetch(withBasePath("/api/meals/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate: selectedDate }),
      });
      const data = (await resp.json()) as { copied?: number; error?: string };
      if (resp.ok) {
        await reloadDayAfterMutation(false);
        onChanged?.();
      } else {
        setCopyError(data.error ?? "Не удалось скопировать");
      }
    } catch {
      setCopyError("Не удалось скопировать — проверьте сеть и попробуйте снова");
    } finally {
      setCopying(false);
    }
  }

  async function handleCopyYesterdayBreakfast() {
    setCopying(true);
    setCopyError(null);
    try {
      const fromDate = shiftDateKey(selectedDate, -1);
      const resp = await fetch(withBasePath("/api/meals/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate: selectedDate, mealType: "BREAKFAST" }),
      });
      const data = (await resp.json()) as { copied?: number; error?: string };
      if (resp.ok) {
        await reloadDayAfterMutation(false);
        onChanged?.();
      } else {
        setCopyError(data.error ?? "Не удалось скопировать завтрак");
      }
    } catch {
      setCopyError("Не удалось скопировать завтрак — проверьте сеть и попробуйте снова");
    } finally {
      setCopying(false);
    }
  }

  const displayDate = formatDateWords(selectedDate);
  const listItems = useMemo(() => groupMealEntries(entries), [entries]);
  const organizedItems = useMemo(
    () => organizeDiaryByMealType(listItems),
    [listItems],
  );
  const filteredItems = useMemo(() => {
    return organizedItems.filter((item) => {
      if (mealFilter !== "ALL" && mealTypeForListItem(item) !== mealFilter) return false;
      return matchesDiarySourceFilter(item, sourceFilter, DEFAULT_LOW_CONFIDENCE_THRESHOLD);
    });
  }, [organizedItems, mealFilter, sourceFilter]);
  const showMealSections = useMemo(() => diaryHasMealTypes(listItems), [listItems]);
  const sectionCounts = useMemo(() => {
    const counts: Partial<Record<MealTypeSection, number>> = {};
    for (const item of organizedItems) {
      const section = mealTypeForListItem(item);
      counts[section] = (counts[section] ?? 0) + 1;
    }
    return counts;
  }, [organizedItems]);
  const displayRows = useMemo(
    () => buildDiaryDisplayRows(filteredItems, pendingDeletes),
    [filteredItems, pendingDeletes],
  );

  const confirmDeleteRef = useRef(confirmDelete);
  confirmDeleteRef.current = confirmDelete;
  const pendingDeletesRef = useRef(pendingDeletes);
  pendingDeletesRef.current = pendingDeletes;

  useEffect(() => {
    if (pendingDeletes.length === 0) return;

    const tick = () => {
      const now = Date.now();
      for (const slot of pendingDeletesRef.current) {
        if (slot.expiresAt <= now) {
          void confirmDeleteRef.current(slot.key);
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 300);
    return () => window.clearInterval(intervalId);
  }, [pendingDeletes.length]);

  return (
    <section className={`card ${compact ? "p-3 md:p-4" : "p-6"}`}>
      <div className={`flex flex-col ${compact ? "gap-3" : "gap-5"}`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          {!compact ? (
            <div>
              <h2 className="text-xl font-bold">Дневник питания</h2>
              <p className="mt-1 text-sm text-slate-500">{displayDate}</p>
            </div>
          ) : (
            <h2 className="text-base font-bold">Дневник питания</h2>
          )}
          {streakDays >= 2 ? (
            <div className="flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
              <FlameIcon className="h-4 w-4 text-amber-600" />
              <span>{streakDays} {pluralDays(streakDays)}</span>
            </div>
          ) : null}

          {!compact ? (
            <div className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-white">
              <div className="text-[10px] uppercase tracking-wide text-teal-50">Итого за день</div>
              <div className="text-2xl font-bold">{totals.calories} ккал</div>
              <div className="text-[11px] text-teal-50">
                Б {totals.protein} · Ж {totals.fat} · У {totals.carbs}
              </div>
              {(totals.fiber > 0 || totals.sugar > 0) ? (
                <div className="mt-0.5 text-[11px] text-teal-100">
                  {totals.fiber > 0 ? `Клетч. ${totals.fiber}` : null}
                  {totals.fiber > 0 && totals.sugar > 0 ? " · " : null}
                  {totals.sugar > 0 ? `Сахар ${totals.sugar}` : null}
                </div>
              ) : null}
            </div>
          ) : (totals.fiber > 0 || totals.sugar > 0) ? (
            <p className="text-[11px] text-slate-500">
              {totals.fiber > 0 ? `Клетч. ${totals.fiber} г` : null}
              {totals.fiber > 0 && totals.sugar > 0 ? " · " : null}
              {totals.sugar > 0 ? `Сахар ${totals.sugar} г` : null}
            </p>
          ) : null}
        </div>

        {daySummary.comparison && daySummary.calorieTone && daySummary.weightKg != null ? (
          <div className="flex flex-col gap-3">
            {compact ? (
              <button
                type="button"
                className="self-start text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
                onClick={toggleNormDetails}
              >
                {showNormDetails ? "Скрыть норму и бюджет" : "Норма и бюджет по приёмам"}
              </button>
            ) : null}
            {(!compact || showNormDetails) ? (
              <>
                <DietTargets
                  comparison={daySummary.comparison}
                  calorieTone={daySummary.calorieTone}
                  weightKg={daySummary.weightKg}
                  dietLabel={daySummary.dietLabel}
                  sex={daySummary.sex}
                  calorieExplanation={daySummary.calorieExplanation}
                />
                {daySummary.comparison.calories.target > 0 ? (() => {
                  const target = daySummary.comparison!.calories.target;
                  const budgets = [
                    { label: "Завтрак", pct: 0.25 },
                    { label: "Обед", pct: 0.35 },
                    { label: "Ужин", pct: 0.30 },
                    { label: "Перекус", pct: 0.10 },
                  ];
                  const eaten = Object.fromEntries(
                    (["BREAKFAST","LUNCH","DINNER","SNACK"] as const).map((type, i) => [
                      budgets[i]!.label,
                      entries.filter((e) => e.mealType === type).reduce((s, e) => s + e.calories, 0),
                    ])
                  );
                  const hasTypes = entries.some((e) => e.mealType);
                  if (!hasTypes) return null;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-700">Бюджет по приёмам</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {budgets.map((b) => {
                          const alloc = Math.round(target * b.pct);
                          const used = eaten[b.label] ?? 0;
                          const pct = Math.min(100, Math.round((used / alloc) * 100));
                          const over = used > alloc;
                          return (
                            <div key={b.label} className="flex flex-col gap-0.5">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-medium text-slate-700">{b.label}</span>
                                <span className={over ? "text-rose-600" : "text-slate-500"}>{used}/{alloc}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${over ? "bg-rose-500" : "bg-teal-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })() : null}
              </>
            ) : null}
          </div>
        ) : !compact ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Чтобы увидеть рекомендуемый рацион и дефицит/профицит, укажите вес и выберите цель.
          </p>
        ) : null}

        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Загрузка дневника">
            <div className="skeleton-line h-12 w-full rounded-2xl" />
            <div className="skeleton-line h-12 w-full rounded-2xl" />
            <div className="skeleton-line h-12 w-5/6 rounded-2xl" />
          </div>
        ) : null}
        {error ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
              disabled={loading}
              onClick={() => {
                if (dayRefresh) {
                  void dayRefresh();
                } else {
                  void loadEntries();
                }
              }}
            >
              Обновить
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p className="text-sm text-red-600" role="alert">
            {actionError}
          </p>
        ) : null}

        {!loading && !error && entries.length === 0 && pendingDeletes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
            <Mascot pose="empty" size="md" title={MASCOT_COPY.emptyDiary.title} entrance />
            <p className="font-medium text-slate-700">{MASCOT_COPY.emptyDiary.headline}</p>
            <p className="max-w-xs text-sm">Кнопка «+» внизу — фото, текст или штрихкод.</p>
            {onAddFood ? (
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={() => onAddFood()}
              >
                Добавить
              </button>
            ) : null}
            {yesterdayHasBreakfast ? (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={copying}
                onClick={() => void handleCopyYesterdayBreakfast()}
              >
                {copying ? "Копируем..." : "Только вчерашний завтрак"}
              </button>
            ) : null}
            {yesterdayHasMeals ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={copying}
                  onClick={() => void handleCopyYesterday()}
                >
                  {copying ? "Копируем..." : "Весь вчерашний день"}
                </button>
                {copyError ? (
                  <p className="max-w-xs text-sm text-red-600" role="alert">
                    {copyError}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && entries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Фильтр приёмов пищи">
            <button
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                mealFilter === "ALL"
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              onClick={() => setMealFilter("ALL")}
            >
              Все
            </button>
            {MEAL_TYPE_SECTION_ORDER.map((type) => {
              const count = sectionCounts[type] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    mealFilter === type
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={() => setMealFilter(type)}
                >
                  {sectionLabel(type)}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
            <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden />
            {(
              [
                ["PHOTO", "С фото"],
                ["TEXT", "Текстом"],
                ["LOW_CONFIDENCE", "Низкая уверенность"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  sourceFilter === value
                    ? "bg-amber-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                onClick={() => setSourceFilter((prev) => (prev === value ? "ALL" : value))}
                aria-pressed={sourceFilter === value}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
          {!loading &&
          !error &&
          entries.length > 0 &&
          displayRows.length === 0 &&
          (mealFilter !== "ALL" || sourceFilter !== "ALL") ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Нет записей по этому фильтру.{" "}
              <button
                type="button"
                className="font-semibold text-teal-700 underline-offset-2 hover:underline"
                onClick={() => {
                  setMealFilter("ALL");
                  setSourceFilter("ALL");
                }}
              >
                Сбросить фильтр
              </button>
            </p>
          ) : null}
          {(() => {
            let lastSection: MealTypeSection | null = null;
            return displayRows.map((row) => {
              if (row.kind === "undo") {
                const slotKey = row.pending.key;
                return (
                  <UndoToast
                    key={slotKey}
                    message={row.pending.label}
                    onUndo={() => undoDelete(slotKey)}
                  />
                );
              }

              const item = row.item;
              const section = showMealSections ? mealTypeForListItem(item) : null;
              const showHeader = section != null && section !== lastSection;
              if (showHeader && section != null) {
                lastSection = section;
              }
              const sectionCollapsed =
                section != null && Boolean(collapsedSections[section]) && mealFilter === "ALL";
              if (sectionCollapsed && !showHeader) {
                return null;
              }

              return (
                <div key={mealListItemKey(item)} className="flex flex-col gap-2">
                  {showHeader && section != null ? (
                    <MealSectionHeader
                      section={section}
                      count={sectionCounts[section]}
                      collapsed={Boolean(collapsedSections[section])}
                      onToggle={
                        mealFilter === "ALL"
                          ? () =>
                              setCollapsedSections((prev) => ({
                                ...prev,
                                [section]: !prev[section],
                              }))
                          : undefined
                      }
                    />
                  ) : null}
                  {sectionCollapsed ? null : (
                  <MealListRow
                    item={item}
                    timezone={timezone}
                    userAllergens={userAllergens}
                    onDelete={(id) => {
                      const label = item.kind === "single"
                        ? decodeHtmlEntities(item.entry.dishName)
                        : decodeHtmlEntities(entries.find((e) => e.id === id)?.dishName ?? "блюдо");
                      requestDelete([id], label);
                    }}
                    onEdit={handleEdit}
                    onMealTypeChange={handleMealTypeChange}
                    onEatenAtChange={handleEatenAtChange}
                    onDuplicate={(id) => handleDuplicate(id)}
                    onImageChange={handleImageChange}
                    onDeleteGroup={(ids) => {
                      const label = item.kind === "group"
                        ? `${item.entries.length} блюда с одного фото`
                        : "блюда";
                      requestDelete(ids, label);
                    }}
                  />
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </section>
  );
}
