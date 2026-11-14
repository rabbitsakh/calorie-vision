"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  FOOD_CONFIRM_PORTION_SKIM,
  foodConfirmEnergyWarning,
  foodConfirmNutritionNote,
  foodConfirmToSaveInputs,
  prepareFoodConfirmSave,
  withFoodConfirmGrams,
  type FoodConfirmDish,
  type FoodConfirmSlot,
  type FoodConfirmSource,
  type FoodConfirmUnit,
} from "@/lib/food-confirm";
import { postConfirmedMeals } from "@/lib/food-confirm-save";
import { enqueueFailedSave } from "@/lib/meal-draft-queue";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";
import { FoodConfirmSheet, type FoodConfirmSheetProps } from "@/components/food-confirm-sheet";

const UNITS: FoodConfirmUnit[] = ["г", "мл", "шт"];
const SLOTS = Object.keys(MEAL_TYPE_LABELS) as MealType[];

type SimpleFoodConfirmProps = {
  dishes: FoodConfirmDish[];
  date: string;
  source: FoodConfirmSource;
  mealSlot?: FoodConfirmSlot | null;
  online?: boolean;
  disabled?: boolean;
  imageUrl?: string | null;
  eatenAt?: string;
  beforeSave?: () => string | null;
  onDishesChange?: (dishes: FoodConfirmDish[]) => void;
  onMealSlotChange?: (slot: FoodConfirmSlot | null) => void;
  onSaved?: (result: { mealIds: string[]; savedCount: number; totalCalories: number; skipped: number }) => void;
  onQueued?: (message: string) => void;
  onCancel?: () => void;
  /** Родитель рисует свою кнопку сохранения и сам вызывает ту же проверку. */
  editorOnly?: boolean;
};

function blankDish(source: FoodConfirmSource, mealSlot: FoodConfirmSlot | null): FoodConfirmDish {
  return {
    name: "",
    grams: null,
    unit: "г",
    kcal: null,
    protein: null,
    fat: null,
    carbs: null,
    mealSlot,
    unparsed: true,
    source,
  };
}

function SimpleFoodConfirm({
  dishes,
  date,
  source,
  mealSlot = null,
  online = true,
  disabled = false,
  imageUrl,
  eatenAt,
  beforeSave,
  onDishesChange,
  onMealSlotChange,
  onSaved,
  onQueued,
  onCancel,
  editorOnly = false,
}: SimpleFoodConfirmProps) {
  const [local, setLocal] = useState(dishes);
  const [ownSlot, setOwnSlot] = useState<FoodConfirmSlot | null>(mealSlot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const rows = onDishesChange ? dishes : local;
  const activeSlot = onMealSlotChange ? mealSlot : ownSlot;

  function commit(next: FoodConfirmDish[]) {
    if (onDishesChange) onDishesChange(next);
    else setLocal(next);
  }

  function patch(index: number, next: FoodConfirmDish) {
    commit(rows.map((row, i) => (i === index ? next : row)));
  }

  const warningsLive = useMemo(
    () =>
      rows
        .map((row) => {
          const warning = foodConfirmEnergyWarning(row);
          return warning ? `${row.name || "Блюдо"}: ${warning}` : null;
        })
        .filter((line): line is string => Boolean(line)),
    [rows],
  );

  async function save() {
    const blocked = beforeSave?.();
    if (blocked) {
      setError(blocked);
      return;
    }
    const stamped = rows.map((row) => ({
      ...row,
      mealSlot: activeSlot ?? row.mealSlot,
      source,
    }));
    const prepared = prepareFoodConfirmSave(stamped);
    setWarnings(prepared.warnings);
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    setBusy(true);
    setError(null);
    const inputs = foodConfirmToSaveInputs(prepared.ready, date, eatenAt);
    if (!online) {
      enqueueFailedSave(date, inputs.length > 1 ? { entries: inputs } : inputs[0]!);
      setBusy(false);
      onQueued?.("Офлайн — запись в дневник в очереди");
      onSaved?.({ mealIds: [], savedCount: 0, totalCalories: 0, skipped: prepared.skipped });
      return;
    }
    const result = await postConfirmedMeals(date, inputs);
    setBusy(false);
    if (!result.ok) {
      setError(result.queued ? `${result.error}. Сохранение в очереди.` : result.error);
      if (result.queued) onQueued?.(result.error);
      return;
    }
    onSaved?.({ ...result, skipped: prepared.skipped });
  }

  return (
    <div className="confirm-family mt-2 text-[12px] leading-snug text-[var(--ink)]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="confirm-family-hero" />
      ) : null}
      <p className="confirm-family-skim">
        {source === "barcode" ? "Штрихкод" : source === "photo" ? "Фото" : "Чат"} · {date} ·{" "}
        {FOOD_CONFIRM_PORTION_SKIM}
      </p>
      <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Приём пищи">
        {SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            disabled={disabled || busy}
            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
              activeSlot === slot
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "border-[var(--border)] text-[var(--muted-strong)]"
            }`}
            onClick={() => {
              const next = activeSlot === slot ? null : slot;
              if (onMealSlotChange) onMealSlotChange(next);
              else setOwnSlot(next);
            }}
          >
            {MEAL_TYPE_LABELS[slot]}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {rows.map((dish, index) => {
          const energy = foodConfirmEnergyWarning(dish);
          const nutritionNote = foodConfirmNutritionNote(dish);
          return (
            <div key={`${dish.name}-${index}`} className="confirm-family-dish">
              <input
                type="text"
                value={dish.name}
                disabled={disabled || busy}
                aria-label="Название блюда"
                placeholder="Название"
                className="confirm-family-input w-full font-semibold"
                onChange={(event) => patch(index, { ...dish, name: event.target.value, unparsed: false })}
              />
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <label className="confirm-family-label">
                  Порция
                  <input
                    type="number"
                    inputMode="numeric"
                    value={dish.grams ?? ""}
                    disabled={disabled || busy}
                    placeholder="укажите"
                    aria-label="Порция"
                    className="confirm-family-input"
                    onChange={(event) => {
                      const raw = event.target.value;
                      const grams = raw === "" ? null : Number(raw);
                      patch(
                        index,
                        withFoodConfirmGrams(
                          dish,
                          grams != null && Number.isFinite(grams) && grams > 0 ? grams : null,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="confirm-family-label">
                  Ед.
                  <select
                    value={dish.unit}
                    disabled={disabled || busy}
                    aria-label="Единица порции"
                    className="confirm-family-input"
                    onChange={(event) =>
                      patch(index, { ...dish, unit: event.target.value as FoodConfirmUnit })
                    }
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ["kcal", "ккал"],
                    ["protein", "Б"],
                    ["fat", "Ж"],
                    ["carbs", "У"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="confirm-family-label">
                    {label}
                    <input
                      type="number"
                      inputMode="decimal"
                      value={dish[key] ?? ""}
                      disabled={disabled || busy}
                      className="confirm-family-input"
                      onChange={(event) => {
                        const raw = event.target.value;
                        const value = raw === "" ? null : Number(raw);
                        patch(index, {
                          ...dish,
                          [key]: value != null && Number.isFinite(value) ? value : null,
                          unparsed: false,
                          nutritionBasis: undefined,
                          nutritionWarning: undefined,
                          per100: null,
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
              {dish.grams == null ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-800">
                  Порция не указана
                  {dish.per100 ? ` · ${Math.round(dish.per100.calories)} ккал на 100 ${dish.unit === "мл" ? "мл" : "г"}` : ""}
                </p>
              ) : null}
              {nutritionNote ? (
                <p
                  className={`mt-1 text-[10px] font-semibold ${
                    dish.nutritionBasis === "unknown" ? "text-amber-800" : "text-[var(--muted)]"
                  }`}
                >
                  {nutritionNote}
                </p>
              ) : null}
              {dish.unparsed && dish.kcal == null && dish.nutritionBasis !== "unknown" ? (
                <p className="mt-1 text-[10px] font-semibold text-[var(--muted)]">не разобрано</p>
              ) : null}
              {dish.nutritionWarning ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-800">{dish.nutritionWarning}</p>
              ) : null}
              {energy && !dish.nutritionWarning ? (
                <p className="mt-1 text-[10px] font-semibold text-amber-800">{energy}</p>
              ) : null}
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="mt-1 text-[10px] font-semibold text-[var(--muted)]"
                  disabled={disabled || busy}
                  onClick={() => commit(rows.filter((_, i) => i !== index))}
                >
                  Убрать
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {warningsLive.length && !warnings.length ? (
        <p className="mt-1.5 text-[10px] font-semibold text-amber-800">{warningsLive[0]}</p>
      ) : null}
      {warnings.map((line) => (
        <p key={line} className="mt-1 text-[10px] font-semibold text-amber-800">
          {line}
        </p>
      ))}
      {error ? <p className="mt-1.5 text-[11px] font-semibold text-rose-800">{error}</p> : null}
      {!editorOnly ? (
        <div className="confirm-family-actions mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className="confirm-family-cta"
            disabled={disabled || busy}
            onClick={() => void save()}
          >
            {busy ? "Пишу…" : online ? "Записать в дневник" : "В очередь офлайн"}
          </button>
          {rows.length < 8 ? (
            <button
              type="button"
              className="confirm-family-secondary"
              disabled={disabled || busy}
              onClick={() => commit([...rows, blankDish(source, activeSlot)])}
            >
              + ещё блюдо
            </button>
          ) : null}
          {onCancel ? (
            <button type="button" className="confirm-family-secondary" disabled={busy} onClick={onCancel}>
              Не записывать
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type FoodConfirmCardProps = SimpleFoodConfirmProps | FoodConfirmSheetProps;

/** Чат передаёт список блюд. Фото и штрихкод — результат распознавания и опции листа. */
export function FoodConfirmCard(props: SimpleFoodConfirmProps): ReactElement;
export function FoodConfirmCard(props: FoodConfirmSheetProps): ReactElement;
export function FoodConfirmCard(props: FoodConfirmCardProps) {
  if ("result" in props) {
    return <FoodConfirmSheet {...props} />;
  }
  return <SimpleFoodConfirm {...props} />;
}
