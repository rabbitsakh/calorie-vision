"use client";

import { useEffect, useId, useRef } from "react";
import { FoodAddIcon } from "@/components/FoodAddIcons";
import { FoodAddQuickStrip } from "@/components/FoodAddQuickStrip";
import {
  FOOD_ADD_MODE_OPTIONS,
  FOOD_ADD_UTILITY_OPTIONS,
  type FoodAddModeOption,
} from "@/lib/food-add-modes";
import type { FoodAddMode } from "@/lib/open-food-camera";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";

type FoodAddModePickerProps = {
  selectedDate: string;
  mealType?: string;
  onSelect: (mode: FoodAddMode, openCamera: boolean) => void;
  onClose: () => void;
  onQuickLogged: () => void;
};

function mealTypeCaption(mealType?: string): string | null {
  if (!mealType) return null;
  const label = MEAL_TYPE_LABELS[mealType as MealType];
  return label ?? null;
}

/**
 * Center «+» choice sheet — grid of modes + water/weight + quick repeat/favorites.
 */
export function FoodAddModePicker({
  selectedDate,
  mealType,
  onSelect,
  onClose,
  onQuickLogged,
}: FoodAddModePickerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const slotLabel = mealTypeCaption(mealType);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pickMode(opt: FoodAddModeOption) {
    onSelect(opt.id, Boolean(opt.openCamera));
  }

  return (
    <div
      className="food-add-overlay food-add-overlay--in fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="food-add-sheet food-add-sheet--picker food-add-sheet--in flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p id={titleId} className="font-display text-base font-semibold tracking-tight text-slate-900">
              Добавить
            </p>
            <p className="text-xs text-slate-500">
              {slotLabel ? `Слот: ${slotLabel}` : "Еда, вода или вес"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn-quiet text-sm text-slate-500"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="flex flex-col gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:p-4">
          <div className="food-add-mode-grid" role="list">
            {FOOD_ADD_MODE_OPTIONS.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                role="listitem"
                className={`food-add-mode-tile food-add-mode-tile--in ${
                  opt.primary ? "food-add-mode-tile--primary" : ""
                }`}
                style={{ animationDelay: `${60 + index * 40}ms` }}
                onClick={() => pickMode(opt)}
              >
                <span className="food-add-mode-tile-icon" aria-hidden>
                  <FoodAddIcon name={opt.icon} className="h-7 w-7" />
                </span>
                <span className="food-add-mode-tile-label">{opt.label}</span>
                <span className="food-add-mode-tile-hint">{opt.hint}</span>
              </button>
            ))}
          </div>

          <div className="food-add-utility-row" role="list">
            {FOOD_ADD_UTILITY_OPTIONS.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                role="listitem"
                className={`food-add-utility-tile food-add-utility-tile--${opt.id} food-add-mode-tile--in`}
                style={{ animationDelay: `${180 + index * 40}ms` }}
                onClick={() => {
                  onClose();
                  if (opt.id === "water") requestOpenWaterQuick();
                  else requestOpenWeightQuick();
                }}
              >
                <span className="food-add-utility-icon" aria-hidden>
                  <FoodAddIcon name={opt.icon} className="h-5 w-5" />
                </span>
                <span className="food-add-utility-copy">
                  <span className="food-add-utility-label">{opt.label}</span>
                  <span className="food-add-utility-hint">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <FoodAddQuickStrip
            selectedDate={selectedDate}
            mealType={mealType}
            onLogged={onQuickLogged}
          />
        </div>
      </div>
    </div>
  );
}
