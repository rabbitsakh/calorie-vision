"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DietTargets } from "@/components/DietTargets";
import { Mascot } from "@/components/Mascot";
import { FlameIcon } from "@/components/StreakIcon";
import type { DayMealsResponse, MealEntry } from "@/types";
import { MEAL_TYPE_LABELS } from "@/types";
import { formatDateTime, formatDateWords } from "@/lib/dates";
import { getImageUrl, withBasePath } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";
import { groupMealEntries, type MealListGroup, type MealListItem } from "@/lib/meal-groups";
import { pluralDays } from "@/lib/russian-text";

type EditPatch = {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  mealType?: string | null;
};

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" strokeLinecap="round" />
      <path d="M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

/** Inline undo toast — appears for 4 s, calls onUndo if pressed or onExpired if not */
function UndoToast({
  message,
  onUndo,
  onExpired,
}: {
  message: string;
  onUndo: () => void;
  onExpired: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onExpired, 4000);
    return () => clearTimeout(timer);
  }, [onExpired]);

  return (
    <div className="undo-toast flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
        onClick={onUndo}
      >
        Отменить
      </button>
    </div>
  );
}

type DailyLogProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged?: () => void;
  onTotalsChange?: (calories: number) => void;
  compact?: boolean;
  timezone?: string | null;
  onAddFood?: () => void;
};

function formatMacros(entry: Pick<MealEntry, "protein" | "fat" | "carbs" | "fiber" | "sugar">): string {
  const parts: string[] = [];
  if (entry.protein) {
    parts.push(`Б ${entry.protein}`);
  }
  if (entry.fat) {
    parts.push(`Ж ${entry.fat}`);
  }
  if (entry.carbs) {
    parts.push(`У ${entry.carbs}`);
  }
  if (entry.fiber) {
    parts.push(`клетчатка ${entry.fiber}`);
  }
  if (entry.sugar) {
    parts.push(`сахар ${entry.sugar}`);
  }
  return parts.join(" · ");
}

function MealEntryDetails({
  entry,
  timezone,
}: {
  entry: MealEntry;
  timezone?: string | null;
}) {
  const macros = formatMacros(entry);

  return (
    <p className="mt-1 text-sm text-slate-500">
      {entry.calories} ккал
      {entry.portionGrams ? ` · ${entry.portionGrams} г` : ""}
      {macros ? ` · ${macros}` : ""}
      {" · "}
      {formatDateTime(entry.createdAt, timezone)}
    </p>
  );
}

function GroupedMealCard({
  group,
  timezone,
  onDelete,
  onDeleteGroup,
}: {
  group: MealListGroup;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
}) {
  const macros = formatMacros({
    protein: group.totalProtein,
    fat: group.totalFat,
    carbs: group.totalCarbs,
    fiber: group.totalFiber,
    sugar: group.totalSugar,
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-teal-100 bg-slate-50">
      <div className="flex flex-col gap-4 p-4 md:flex-row">
        {group.imagePath ? (
          <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-white md:h-32 md:w-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(group.imagePath)}
              alt={group.entries.map((entry) => decodeHtmlEntities(entry.dishName)).join(", ")}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">С одного фото</h3>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
              {group.entries.length} {group.entries.length === 1 ? "блюдо" : group.entries.length < 5 ? "блюда" : "блюд"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {group.totalCalories} ккал
            {macros ? ` · ${macros}` : ""}
            {" · "}
            {formatDateTime(group.createdAt, timezone)}
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Удалить все блюда с фото"
          onClick={() => onDeleteGroup(group.entries.map((e) => e.id))}
        >
          <TrashIcon />
        </button>
      </div>

      <div className="divide-y divide-slate-100 border-t border-slate-100 bg-white/70">
        {group.entries.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{decodeHtmlEntities(entry.dishName)}</h4>
                {entry.wasCorrected ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    исправлено
                  </span>
                ) : null}
              </div>
              <MealEntryDetails entry={entry} timezone={timezone} />
            </div>

            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title="Удалить"
              onClick={() => onDelete(entry.id)}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinejoin="round" />
    </svg>
  );
}

function InlineEdit({
  entry,
  onSave,
  onCancel,
}: {
  entry: MealEntry;
  onSave: (patch: EditPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [dishName, setDishName] = useState(decodeHtmlEntities(entry.dishName));
  const [calories, setCalories] = useState(String(entry.calories));
  const [protein, setProtein] = useState(entry.protein != null ? String(entry.protein) : "");
  const [fat, setFat] = useState(entry.fat != null ? String(entry.fat) : "");
  const [carbs, setCarbs] = useState(entry.carbs != null ? String(entry.carbs) : "");
  const [fiber, setFiber] = useState(entry.fiber != null ? String(entry.fiber) : "");
  const [sugar, setSugar] = useState(entry.sugar != null ? String(entry.sugar) : "");
  const [portionGrams, setPortionGrams] = useState(entry.portionGrams != null ? String(entry.portionGrams) : "");
  const [mealType, setMealType] = useState(entry.mealType ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        dishName,
        calories: Number(calories),
        protein: protein ? Number(protein) : null,
        fat: fat ? Number(fat) : null,
        carbs: carbs ? Number(carbs) : null,
        fiber: fiber ? Number(fiber) : null,
        sugar: sugar ? Number(sugar) : null,
        portionGrams: portionGrams ? Number(portionGrams) : null,
        mealType: mealType || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3 rounded-2xl border border-teal-200 bg-teal-50/30 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label className="text-xs">Название</label>
          <input value={dishName} onChange={(e) => setDishName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="text-xs">Калории, ккал</label>
          <input type="number" min="1" value={calories} onChange={(e) => setCalories(e.target.value)} required />
        </div>
        <div className="field">
          <label className="text-xs">Порция, г</label>
          <input type="number" min="1" value={portionGrams} onChange={(e) => setPortionGrams(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Белки, г</label>
          <input type="number" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Жиры, г</label>
          <input type="number" min="0" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Углеводы, г</label>
          <input type="number" min="0" step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Клетчатка, г</label>
          <input type="number" min="0" step="0.1" value={fiber} onChange={(e) => setFiber(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Сахар, г</label>
          <input type="number" min="0" step="0.1" value={sugar} onChange={(e) => setSugar(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-semibold text-slate-500">Приём пищи</p>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(MEAL_TYPE_LABELS) as Array<[string, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  mealType === value
                    ? "bg-teal-700 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => setMealType(mealType === value ? "" : value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-on-tint text-sm text-teal-800" disabled={saving}>{saving ? "Сохраняем..." : "Сохранить"}</button>
        <button type="button" className="btn btn-secondary text-sm" onClick={onCancel} disabled={saving}>Отмена</button>
      </div>
    </form>
  );
}

function SingleMealCard({
  entry,
  timezone,
  onDelete,
  onEdit,
}: {
  entry: MealEntry;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineEdit
        entry={entry}
        onSave={async (patch) => { await onEdit(entry.id, patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <article className="flex items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      <span
        className={`meal-stripe ${
          entry.mealType === "BREAKFAST"
            ? "bg-amber-400"
            : entry.mealType === "LUNCH"
              ? "bg-teal-500"
              : entry.mealType === "DINNER"
                ? "bg-indigo-400"
                : entry.mealType === "SNACK"
                  ? "bg-rose-400"
                  : "bg-slate-200"
        }`}
        aria-hidden
      />
      {entry.imagePath ? (
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white self-center ml-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageUrl(entry.imagePath)}
            alt={decodeHtmlEntities(entry.dishName)}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{decodeHtmlEntities(entry.dishName)}</h3>
            {entry.wasCorrected ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                исправлено
              </span>
            ) : null}
          </div>
          <MealEntryDetails entry={entry} timezone={timezone} />
        </div>
        <p className="shrink-0 text-sm font-bold text-slate-800">{entry.calories}</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Редактировать"
            onClick={() => setEditing(true)}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Удалить"
            onClick={() => onDelete(entry.id)}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

type PendingDelete = {
  ids: string[];
  label: string;
};

function MealListRow({
  item,
  timezone,
  onDelete,
  onDeleteGroup,
  onEdit,
}: {
  item: MealListItem;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
}) {
  if (item.kind === "group") {
    return (
      <GroupedMealCard
        group={item}
        timezone={timezone}
        onDelete={onDelete}
        onDeleteGroup={onDeleteGroup}
      />
    );
  }

  return <SingleMealCard entry={item.entry} timezone={timezone} onDelete={onDelete} onEdit={onEdit} />;
}

export function DailyLog({ selectedDate, refreshKey, onChanged, onTotalsChange, compact, timezone, onAddFood }: DailyLogProps) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 });
  const [daySummary, setDaySummary] = useState<
    Pick<DayMealsResponse, "comparison" | "calorieTone" | "weightKg" | "dietLabel" | "sex">
  >({
    comparison: null,
    calorieTone: null,
    weightKg: null,
    dietLabel: null,
    sex: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [showNormDetails, setShowNormDetails] = useState(false);
  const attemptedImageDates = useRef(new Set<string>());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

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
      });
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, [selectedDate, onTotalsChange]);

  useEffect(() => {
    attemptedImageDates.current.delete(selectedDate);
    void loadEntries();
  }, [loadEntries, refreshKey, selectedDate]);

  useEffect(() => {
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
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    const missing = entries.some((entry) => !entry.imagePath);
    if (!missing || attemptedImageDates.current.has(selectedDate)) {
      return;
    }

    attemptedImageDates.current.add(selectedDate);
    const date = selectedDate;

    void (async () => {
      try {
        const response = await fetch(withBasePath("/api/meals/images"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
        const data = (await response.json()) as { updated?: number };
        if (response.ok && (data.updated ?? 0) > 0 && selectedDateRef.current === date) {
          await loadEntries(true);
        }
      } catch {
        // Diary still works if image lookup fails.
      }
    })();
  }, [loading, error, entries, selectedDate, loadEntries]);

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
        };
      }),
    );

    await loadEntries(true);
    onChanged?.();
  }

  async function performDelete(ids: string[]) {
    await Promise.all(
      ids.map((id) => fetch(withBasePath(`/api/meals/${id}`), { method: "DELETE" })),
    );
    await loadEntries();
    onChanged?.();
  }

  function requestDelete(ids: string[], label: string) {
    // Optimistically hide the entry right away so the UI feels instant
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
    setPendingDelete({ ids, label });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { ids } = pendingDelete;
    setPendingDelete(null);
    await performDelete(ids);
  }

  function undoDelete() {
    setPendingDelete(null);
    // Restore by reloading
    void loadEntries(true);
  }

  const [copying, setCopying] = useState(false);

  async function handleCopyYesterday() {
    setCopying(true);
    try {
      const d = new Date(selectedDate + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      const fromDate = d.toISOString().slice(0, 10);
      const resp = await fetch(withBasePath("/api/meals/copy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate: selectedDate }),
      });
      const data = (await resp.json()) as { copied?: number; error?: string };
      if (resp.ok) {
        await loadEntries();
        onChanged?.();
      } else {
        alert(data.error ?? "Не удалось скопировать");
      }
    } finally {
      setCopying(false);
    }
  }

  const displayDate = formatDateWords(selectedDate);
  const listItems = useMemo(() => groupMealEntries(entries), [entries]);

  return (
    <section className={`card ${compact ? "p-4 md:p-5" : "p-6"}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          {!compact ? (
            <div>
              <h2 className="text-xl font-bold">Дневник питания</h2>
              <p className="mt-1 text-sm text-slate-500">{displayDate}</p>
            </div>
          ) : (
            <h2 className="text-lg font-bold">Дневник питания</h2>
          )}
          {streakDays >= 2 ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              <FlameIcon className="h-5 w-5 text-amber-600" />
              <span>{streakDays} {pluralDays(streakDays)} подряд</span>
            </div>
          ) : null}

          <div className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-white">
            <div className="text-xs uppercase tracking-wide text-teal-50">Итого за день</div>
            <div className="text-2xl font-bold">{totals.calories} ккал</div>
            <div className="text-xs text-teal-50">
              Белки {totals.protein} · Жиры {totals.fat} · Углеводы {totals.carbs}
            </div>
            {(totals.fiber > 0 || totals.sugar > 0) ? (
              <div className="mt-1 text-xs text-teal-100">
                {totals.fiber > 0 ? `Клетчатка ${totals.fiber} г` : null}
                {totals.fiber > 0 && totals.sugar > 0 ? " · " : null}
                {totals.sugar > 0 ? `Сахар ${totals.sugar} г` : null}
              </div>
            ) : null}
          </div>
        </div>

        {daySummary.comparison && daySummary.calorieTone && daySummary.weightKg != null ? (
          <div className="flex flex-col gap-3">
            {compact ? (
              <button
                type="button"
                className="self-start text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
                onClick={() => setShowNormDetails((value) => !value)}
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
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-700">Бюджет по приёмам пищи</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {budgets.map((b) => {
                          const alloc = Math.round(target * b.pct);
                          const used = eaten[b.label] ?? 0;
                          const pct = Math.min(100, Math.round((used / alloc) * 100));
                          const over = used > alloc;
                          return (
                            <div key={b.label} className="flex flex-col gap-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-slate-700">{b.label}</span>
                                <span className={over ? "text-rose-600" : "text-slate-500"}>{used} / {alloc} ккал</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-2 rounded-full transition-all duration-500 ${over ? "bg-rose-500" : "bg-teal-500"}`} style={{ width: `${pct}%` }} />
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

        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {pendingDelete ? (
          <UndoToast
            message={`Удалено: ${pendingDelete.label}`}
            onUndo={undoDelete}
            onExpired={() => void confirmDelete()}
          />
        ) : null}

        {!loading && !error && entries.length === 0 && !pendingDelete ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
            <Mascot pose="empty" size="md" />
            <p>За этот день пока нет записей.</p>
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => onAddFood?.()}
            >
              Сфотографировать
            </button>
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={copying}
              onClick={() => void handleCopyYesterday()}
            >
              {copying ? "Копируем..." : "Повторить вчерашний день"}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {listItems.map((item) => (
            <MealListRow
              key={item.kind === "group" ? item.groupId : item.entry.id}
              item={item}
              timezone={timezone}
              onDelete={(id) => {
                const label = item.kind === "single"
                  ? decodeHtmlEntities(item.entry.dishName)
                  : decodeHtmlEntities(entries.find((e) => e.id === id)?.dishName ?? "блюдо");
                requestDelete([id], label);
              }}
              onEdit={handleEdit}
              onDeleteGroup={(ids) => {
                const label = item.kind === "group"
                  ? `${item.entries.length} блюда с одного фото`
                  : "блюда";
                requestDelete(ids, label);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
