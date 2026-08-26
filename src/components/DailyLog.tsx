"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DietTargets } from "@/components/DietTargets";
import { Mascot } from "@/components/Mascot";
import { FlameIcon } from "@/components/StreakIcon";
import type { DayMealsResponse, MealEntry } from "@/types";
import { MEAL_TYPE_LABELS } from "@/types";
import { formatDateTime, formatDateWords } from "@/lib/dates";
import { MASCOT_COPY } from "@/lib/mascot-copy";
import { getImageUrl, withBasePath } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";
import { groupMealEntries, type MealListGroup, type MealListItem } from "@/lib/meal-groups";
import { MealPhotoPicker } from "@/components/MealPhotoPicker";
import {
  addMealTotals,
  appendPendingDelete,
  buildDiaryDisplayRows,
  findMealListIndex,
  mealListItemKey,
  mergeEntriesAfterUndo,
  subtractMealTotals,
  type PendingDeleteSlot,
} from "@/lib/diary-delete-slots";
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

/** Inline undo — own 4s timer per slot; callback refs avoid resetting the countdown. */
function UndoToast({
  message,
  onUndo,
  onExpired,
}: {
  message: string;
  onUndo: () => void;
  onExpired: () => void;
}) {
  const onExpiredRef = useRef(onExpired);
  const onUndoRef = useRef(onUndo);
  onExpiredRef.current = onExpired;
  onUndoRef.current = onUndo;

  useEffect(() => {
    const timer = setTimeout(() => onExpiredRef.current(), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="undo-toast flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-300">Удалено</span>
        <span className="mt-0.5 block truncate font-medium">{message}</span>
      </span>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30"
        onClick={() => onUndoRef.current()}
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

function mealStripeClass(mealType: string | null | undefined): string {
  if (mealType === "BREAKFAST") return "bg-amber-400";
  if (mealType === "LUNCH") return "bg-teal-500";
  if (mealType === "DINNER") return "bg-indigo-400";
  if (mealType === "SNACK") return "bg-rose-400";
  return "bg-slate-200";
}

function GroupedMealCard({
  group,
  timezone,
  onDelete,
  onDeleteGroup,
  onEdit,
  onMealTypeChange,
  onImageChange,
}: {
  group: MealListGroup;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
}) {
  const macros = formatMacros({
    protein: group.totalProtein,
    fat: group.totalFat,
    carbs: group.totalCarbs,
    fiber: group.totalFiber,
    sugar: group.totalSugar,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeBusyId, setTypeBusyId] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);

  /** Prefer group photo; fall back to any entry photo so the header is never blank. */
  const headerImage =
    group.imagePath ?? group.entries.find((entry) => entry.imagePath)?.imagePath ?? null;

  return (
    <article className="overflow-hidden rounded-2xl border border-teal-100 bg-slate-50">
      <div className="flex flex-col gap-4 p-4 md:flex-row">
        {headerImage ? (
          <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-white md:h-32 md:w-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImageUrl(headerImage)}
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
        {group.entries.map((entry) => {
          if (editingId === entry.id) {
            return (
              <div key={entry.id} className="p-3">
                <InlineEdit
                  entry={entry}
                  onSave={async (patch) => {
                    await onEdit(entry.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          }

          if (photoId === entry.id) {
            return (
              <div key={entry.id} className="p-3">
                <MealPhotoPicker
                  mealId={entry.id}
                  dishName={decodeHtmlEntities(entry.dishName)}
                  imagePath={entry.imagePath}
                  onApplied={(imagePath) => onImageChange(entry.id, imagePath)}
                  onClose={() => setPhotoId(null)}
                />
              </div>
            );
          }

          const thumb = entry.imagePath ?? headerImage;

          return (
            <div key={entry.id} className="flex items-stretch gap-0">
              <span className={`meal-stripe ${mealStripeClass(entry.mealType)}`} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white"
                  title="Сменить фото"
                  onClick={() => setPhotoId(entry.id)}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(thumb)}
                      alt={decodeHtmlEntities(entry.dishName)}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-slate-400">
                      <PhotoSearchIcon />
                      <span className="text-[9px] font-medium">фото</span>
                    </span>
                  )}
                </button>

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
                  <MealTypeInlineChips
                    value={entry.mealType}
                    disabled={typeBusyId === entry.id}
                    onChange={(mealType) => {
                      setTypeBusyId(entry.id);
                      void onMealTypeChange(entry.id, mealType).finally(() => setTypeBusyId(null));
                    }}
                  />
                </div>

                <p className="shrink-0 text-sm font-bold text-slate-800 sm:self-center">{entry.calories}</p>
                <div className="flex shrink-0 gap-1 sm:self-center">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Найти фото в интернете"
                    onClick={() => setPhotoId(entry.id)}
                  >
                    <PhotoSearchIcon />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Редактировать"
                    onClick={() => setEditingId(entry.id)}
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
            </div>
          );
        })}
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

function PhotoSearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 16l-5-5-8 8" strokeLinecap="round" strokeLinejoin="round" />
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

function MealTypeInlineChips({
  value,
  disabled,
  onChange,
}: {
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (mealType: string | null) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Приём пищи">
      {(Object.entries(MEAL_TYPE_LABELS) as Array<[string, string]>).map(([type, label]) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              active
                ? "bg-teal-700 text-white"
                : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
            onClick={() => onChange(active ? null : type)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SingleMealCard({
  entry,
  timezone,
  onDelete,
  onEdit,
  onMealTypeChange,
  onImageChange,
}: {
  entry: MealEntry;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [typeBusy, setTypeBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  if (editing) {
    return (
      <InlineEdit
        entry={entry}
        onSave={async (patch) => { await onEdit(entry.id, patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (photoOpen) {
    return (
      <MealPhotoPicker
        mealId={entry.id}
        dishName={decodeHtmlEntities(entry.dishName)}
        imagePath={entry.imagePath}
        onApplied={(imagePath) => onImageChange(entry.id, imagePath)}
        onClose={() => setPhotoOpen(false)}
      />
    );
  }

  return (
    <article className="flex items-stretch gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
      <span className={`meal-stripe ${mealStripeClass(entry.mealType)}`} aria-hidden />
      <button
        type="button"
        className="relative h-20 w-20 shrink-0 self-center overflow-hidden rounded-xl bg-white"
        title="Сменить фото"
        onClick={() => setPhotoOpen(true)}
      >
        {entry.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(entry.imagePath)}
            alt={decodeHtmlEntities(entry.dishName)}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <PhotoSearchIcon />
            <span className="text-[10px] font-medium">фото</span>
          </span>
        )}
      </button>

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
          <MealTypeInlineChips
            value={entry.mealType}
            disabled={typeBusy}
            onChange={(mealType) => {
              setTypeBusy(true);
              void onMealTypeChange(entry.id, mealType).finally(() => setTypeBusy(false));
            }}
          />
        </div>
        <p className="shrink-0 text-sm font-bold text-slate-800">{entry.calories}</p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Найти фото в интернете"
            onClick={() => setPhotoOpen(true)}
          >
            <PhotoSearchIcon />
          </button>
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

function MealListRow({
  item,
  timezone,
  onDelete,
  onDeleteGroup,
  onEdit,
  onMealTypeChange,
  onImageChange,
}: {
  item: MealListItem;
  timezone?: string | null;
  onDelete: (id: string) => void;
  onDeleteGroup: (ids: string[]) => void;
  onEdit: (id: string, patch: EditPatch) => Promise<void>;
  onMealTypeChange: (id: string, mealType: string | null) => Promise<void>;
  onImageChange: (id: string, imagePath: string | null) => void;
}) {
  if (item.kind === "group") {
    return (
      <GroupedMealCard
        group={item}
        timezone={timezone}
        onDelete={onDelete}
        onDeleteGroup={onDeleteGroup}
        onEdit={onEdit}
        onMealTypeChange={onMealTypeChange}
        onImageChange={onImageChange}
      />
    );
  }

  return (
    <SingleMealCard
      entry={item.entry}
      timezone={timezone}
      onDelete={onDelete}
      onEdit={onEdit}
      onMealTypeChange={onMealTypeChange}
      onImageChange={onImageChange}
    />
  );
}

export function DailyLog({ selectedDate, refreshKey, onChanged, onTotalsChange, compact, timezone, onAddFood }: DailyLogProps) {
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0 });
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
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

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
        calorieExplanation: data.calorieExplanation ?? null,
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
    attemptedImageMealIds.current.clear();
    setPendingDeletes([]);
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

    const missingIds = entries
      .filter((entry) => !entry.imagePath && !attemptedImageMealIds.current.has(entry.id))
      .map((entry) => entry.id);
    if (missingIds.length === 0) {
      return;
    }

    for (const id of missingIds) {
      attemptedImageMealIds.current.add(id);
    }
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
    // Allow photo backfill to retry after a rename.
    attemptedImageMealIds.current.delete(id);

    await loadEntries(true);
    onChanged?.();
  }

  async function handleMealTypeChange(id: string, mealType: string | null) {
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
      await loadEntries(true);
      return;
    }
    await loadEntries(true);
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

  async function performDelete(ids: string[]) {
    await Promise.all(
      ids.map((id) => fetch(withBasePath(`/api/meals/${id}`), { method: "DELETE" })),
    );
    await loadEntries(true);
    onChanged?.();
  }

  function requestDelete(ids: string[], label: string) {
    const snapshot = entries.filter((entry) => ids.includes(entry.id));
    if (snapshot.length === 0) return;

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
    let slot: PendingDeleteSlot | undefined;
    setPendingDeletes((prev) => {
      slot = prev.find((item) => item.key === slotKey);
      return prev.filter((item) => item.key !== slotKey);
    });
    if (!slot) return;
    await performDelete(slot.ids);
  }

  function undoDelete(slotKey: string) {
    let slot: PendingDeleteSlot | undefined;
    setPendingDeletes((prev) => {
      slot = prev.find((item) => item.key === slotKey);
      return prev.filter((item) => item.key !== slotKey);
    });
    if (!slot) return;
    setEntries((prev) => mergeEntriesAfterUndo(prev, slot!.snapshot));
    setTotals((prev) => {
      const next = addMealTotals(prev, slot!.snapshot);
      onTotalsChange?.(next.calories);
      return next;
    });
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
  const displayRows = useMemo(
    () => buildDiaryDisplayRows(listItems, pendingDeletes),
    [listItems, pendingDeletes],
  );

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

        {!loading && !error && entries.length === 0 && pendingDeletes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
            <Mascot pose="empty" size="md" title={MASCOT_COPY.emptyDiary.title} entrance />
            <p className="font-medium text-slate-700">{MASCOT_COPY.emptyDiary.headline}</p>
            <p className="max-w-xs text-sm">{MASCOT_COPY.emptyDiary.body}</p>
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
          {displayRows.map((row) => {
            if (row.kind === "undo") {
              const slotKey = row.pending.key;
              return (
                <UndoToast
                  key={slotKey}
                  message={row.pending.label}
                  onUndo={() => undoDelete(slotKey)}
                  onExpired={() => void confirmDelete(slotKey)}
                />
              );
            }

            const item = row.item;
            return (
              <MealListRow
                key={mealListItemKey(item)}
                item={item}
                timezone={timezone}
                onDelete={(id) => {
                  const label = item.kind === "single"
                    ? decodeHtmlEntities(item.entry.dishName)
                    : decodeHtmlEntities(entries.find((e) => e.id === id)?.dishName ?? "блюдо");
                  requestDelete([id], label);
                }}
                onEdit={handleEdit}
                onMealTypeChange={handleMealTypeChange}
                onImageChange={handleImageChange}
                onDeleteGroup={(ids) => {
                  const label = item.kind === "group"
                    ? `${item.entries.length} блюда с одного фото`
                    : "блюда";
                  requestDelete(ids, label);
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
