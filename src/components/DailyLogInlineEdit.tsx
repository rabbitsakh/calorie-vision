"use client";

import { useEffect, useRef, useState } from "react";
import type { MealEntry } from "@/types";
import { MEAL_TYPE_LABELS, MEAL_TYPE_SHORT_LABELS } from "@/types";
import {
  dateKeyAndTimeToIso,
  formatTimeShort,
  toTimeInputValue,
} from "@/lib/dates";
import { withBasePath } from "@/lib/paths";
import { decodeHtmlEntities } from "@/lib/html-text";
import {
  formatMacro,
  nutritionBaseline,
  scaleNutritionByPortion,
  type NutritionValues,
} from "@/lib/nutrition";

export type EditPatch = {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  mealType?: string | null;
  eatenAt?: string | null;
};

export function mealTypeBadgeClass(mealType: string | null | undefined): string {
  if (mealType === "BREAKFAST") return "meal-type-badge-breakfast";
  if (mealType === "LUNCH") return "meal-type-badge-lunch";
  if (mealType === "DINNER") return "meal-type-badge-dinner";
  if (mealType === "SNACK") return "meal-type-badge-snack";
  return "meal-type-badge-default";
}

export function InlineEdit({
  entry,
  timezone,
  onSave,
  onCancel,
}: {
  entry: MealEntry;
  timezone?: string | null;
  onSave: (patch: EditPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const canScalePortion =
    entry.portionGrams != null && Number.isFinite(entry.portionGrams) && entry.portionGrams > 0;
  const portionBaselineRef = useRef<NutritionValues | null>(
    nutritionBaseline({
      calories: entry.calories,
      protein: entry.protein,
      fat: entry.fat,
      carbs: entry.carbs,
      fiber: entry.fiber,
      sugar: entry.sugar,
      portionGrams: entry.portionGrams,
    }),
  );
  const [dishName, setDishName] = useState(decodeHtmlEntities(entry.dishName));
  const [calories, setCalories] = useState(String(entry.calories));
  const [protein, setProtein] = useState(entry.protein != null ? String(entry.protein) : "");
  const [fat, setFat] = useState(entry.fat != null ? String(entry.fat) : "");
  const [carbs, setCarbs] = useState(entry.carbs != null ? String(entry.carbs) : "");
  const [fiber, setFiber] = useState(entry.fiber != null ? String(entry.fiber) : "");
  const [sugar, setSugar] = useState(entry.sugar != null ? String(entry.sugar) : "");
  const [portionGrams, setPortionGrams] = useState(entry.portionGrams != null ? String(entry.portionGrams) : "");
  const [mealType, setMealType] = useState(entry.mealType ?? "");
  const [eatenTime, setEatenTime] = useState(() =>
    toTimeInputValue(entry.eatenAt ?? entry.createdAt, timezone),
  );
  const [historyPortions, setHistoryPortions] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePortionChange(value: string) {
    setPortionGrams(value);
    const grams = Number(value);
    const baseline = portionBaselineRef.current;
    if (!baseline || !Number.isFinite(grams) || grams <= 0) {
      return;
    }
    const scaled = scaleNutritionByPortion(baseline, grams);
    if (!scaled) return;
    setCalories(String(scaled.calories));
    setProtein(scaled.protein != null ? formatMacro(scaled.protein) : "");
    setFat(scaled.fat != null ? formatMacro(scaled.fat) : "");
    setCarbs(scaled.carbs != null ? formatMacro(scaled.carbs) : "");
    setFiber(scaled.fiber != null ? formatMacro(scaled.fiber) : "");
    setSugar(scaled.sugar != null ? formatMacro(scaled.sugar) : "");
  }

  useEffect(() => {
    const name = dishName.trim();
    if (name.length < 2) {
      setHistoryPortions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const resp = await fetch(
            withBasePath(`/api/meals/portion-history?dishName=${encodeURIComponent(name)}`),
            { signal: controller.signal, cache: "no-store" },
          );
          if (!resp.ok) return;
          const data = (await resp.json()) as { portions?: number[] };
          setHistoryPortions(Array.isArray(data.portions) ? data.portions : []);
        } catch {
          // ignore
        }
      })();
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [dishName]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const eatenAt = dateKeyAndTimeToIso(entry.date, eatenTime, timezone);
      if (!eatenAt) {
        throw new Error("Укажите корректное время");
      }
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
        eatenAt,
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
          <input className="text-base" value={dishName} onChange={(e) => setDishName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="text-xs">Калории, ккал</label>
          <input type="number" min="1" inputMode="decimal" className="text-base" value={calories} onChange={(e) => setCalories(e.target.value)} required />
        </div>
        <div className="field">
          <label className="text-xs">Порция, г</label>
          <input type="number" min="1" inputMode="decimal" className="text-base" value={portionGrams} onChange={(e) => handlePortionChange(e.target.value)} />
          {historyPortions.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {historyPortions.map((grams) => (
                <button
                  key={grams}
                  type="button"
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    Number(portionGrams) === grams
                      ? "bg-teal-700 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => handlePortionChange(String(grams))}
                >
                  {grams} г
                </button>
              ))}
            </div>
          ) : null}
          {canScalePortion ? (
            <p className="mt-1 text-[11px] text-slate-500">Ккал и БЖУ пересчитаются от исходной порции</p>
          ) : null}
        </div>
        <div className="field">
          <label className="text-xs">Время</label>
          <input
            type="time"
            className="text-base"
            value={eatenTime}
            onChange={(e) => setEatenTime(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="text-xs">Белки, г</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" className="text-base" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Жиры, г</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" className="text-base" value={fat} onChange={(e) => setFat(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Углеводы, г</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" className="text-base" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Клетчатка, г</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" className="text-base" value={fiber} onChange={(e) => setFiber(e.target.value)} />
        </div>
        <div className="field">
          <label className="text-xs">Сахар, г</label>
          <input type="number" min="0" step="0.1" inputMode="decimal" className="text-base" value={sugar} onChange={(e) => setSugar(e.target.value)} />
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

export function MealTypeInlineChips({
  value,
  disabled,
  onChange,
}: {
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (mealType: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [value]);

  if (value && !expanded) {
    const short =
      MEAL_TYPE_SHORT_LABELS[value as keyof typeof MEAL_TYPE_SHORT_LABELS] ??
      MEAL_TYPE_LABELS[value as keyof typeof MEAL_TYPE_LABELS] ??
      value;
    const full = MEAL_TYPE_LABELS[value as keyof typeof MEAL_TYPE_LABELS] ?? short;
    return (
      <button
        type="button"
        disabled={disabled}
        className={`meal-type-badge ${mealTypeBadgeClass(value)}`}
        title={`${full} — нажмите, чтобы сменить`}
        aria-label={`${full}, сменить приём пищи`}
        onClick={() => setExpanded(true)}
      >
        {short}
      </button>
    );
  }

  return (
    <div className="meal-type-chips" role="group" aria-label="Приём пищи">
      {(Object.entries(MEAL_TYPE_SHORT_LABELS) as Array<[string, string]>).map(([type, label]) => {
        const active = value === type;
        const full = MEAL_TYPE_LABELS[type as keyof typeof MEAL_TYPE_LABELS] ?? label;
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            title={full}
            aria-label={full}
            aria-pressed={active}
            className={`meal-type-chip ${active ? "meal-type-chip-active" : "meal-type-chip-idle"}`}
            onClick={() => {
              onChange(type);
              setExpanded(false);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function MealTimeInlineEdit({
  entry,
  timezone,
  disabled,
  onChange,
}: {
  entry: MealEntry;
  timezone?: string | null;
  disabled?: boolean;
  onChange: (eatenAt: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const when = entry.eatenAt ?? entry.createdAt;
  const display = formatTimeShort(when, timezone);
  const timeValue = toTimeInputValue(when, timezone);

  useEffect(() => {
    setExpanded(false);
    setNudgeOpen(false);
  }, [when]);

  useEffect(() => {
    return () => {
      if (longPressRef.current != null) window.clearTimeout(longPressRef.current);
    };
  }, []);

  function shiftMinutes(delta: number) {
    const base = dateKeyAndTimeToIso(entry.date, timeValue, timezone);
    if (!base) return;
    const d = new Date(base);
    d.setMinutes(d.getMinutes() + delta);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const eatenAt = dateKeyAndTimeToIso(entry.date, `${hh}:${mm}`, timezone);
    if (eatenAt) onChange(eatenAt);
    setNudgeOpen(false);
  }

  function clearLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  if (nudgeOpen && !expanded) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          className="meal-time-badge"
          disabled={disabled}
          title="Минус 15 минут"
          onClick={() => shiftMinutes(-15)}
        >
          −15
        </button>
        <button
          type="button"
          className="meal-time-badge"
          disabled={disabled}
          title="Точное время"
          onClick={() => {
            setNudgeOpen(false);
            setExpanded(true);
          }}
        >
          {display}
        </button>
        <button
          type="button"
          className="meal-time-badge"
          disabled={disabled}
          title="Плюс 15 минут"
          onClick={() => shiftMinutes(15)}
        >
          +15
        </button>
      </span>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="meal-time-badge"
        title="Время приёма — нажмите, чтобы изменить; удерживайте ±15 мин"
        aria-label={`Время ${display}, изменить`}
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          setExpanded(true);
        }}
        onPointerDown={() => {
          longPressFiredRef.current = false;
          clearLongPress();
          longPressRef.current = window.setTimeout(() => {
            longPressRef.current = null;
            longPressFiredRef.current = true;
            setNudgeOpen(true);
          }, 420);
        }}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
      >
        {display}
      </button>
    );
  }

  return (
    <input
      type="time"
      className="meal-time-input"
      value={timeValue}
      disabled={disabled}
      autoFocus
      aria-label="Время приёма пищи"
      onChange={(event) => {
        const eatenAt = dateKeyAndTimeToIso(entry.date, event.target.value, timezone);
        if (eatenAt) {
          onChange(eatenAt);
          setExpanded(false);
        }
      }}
      onBlur={() => setExpanded(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setExpanded(false);
      }}
    />
  );
}
