"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FoodAddIcon } from "@/components/FoodAddIcons";
import { FoodAddQuickStrip } from "@/components/FoodAddQuickStrip";
import {
  FOOD_ADD_MODE_OPTIONS,
  FOOD_ADD_PHOTO_SOURCES,
  FOOD_ADD_UTILITY_OPTIONS,
  type FoodAddModeOption,
  type FoodAddUtilityOption,
} from "@/lib/food-add-modes";
import type { FoodAddMode } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import { MEAL_TYPE_LABELS, type MealType } from "@/types";

export type FoodAddSelectOptions = {
  openCamera?: boolean;
  openGallery?: boolean;
};

type FoodAddModePickerProps = {
  selectedDate: string;
  mealType?: string;
  onSelect: (mode: FoodAddMode, options?: FoodAddSelectOptions) => void;
  onClose: () => void;
  onQuickLogged: () => void;
};

type PickerStep = "root" | "photo";

function mealTypeCaption(mealType?: string): string | null {
  if (!mealType) return null;
  const label = MEAL_TYPE_LABELS[mealType as MealType];
  return label ?? null;
}

/**
 * Center «+» choice sheet — grid of modes + water/weight/workout + quick repeat/favorites.
 * Photo opens a camera vs gallery sub-step (never jumps straight to the camera).
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
  const router = useRouter();
  const [step, setStep] = useState<PickerStep>("root");
  const slotLabel = mealTypeCaption(mealType);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (step === "photo") setStep("root");
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  function pickMode(opt: FoodAddModeOption) {
    if (opt.id === "photo") {
      setStep("photo");
      return;
    }
    onSelect(opt.id);
  }

  function runUtility(opt: FoodAddUtilityOption) {
    onClose();
    if (opt.id === "water") {
      requestOpenWaterQuick();
      return;
    }
    if (opt.id === "weight") {
      requestOpenWeightQuick();
      return;
    }
    router.push(withBasePath("/workouts?new=1"));
  }

  const title = step === "photo" ? "Фото" : "Добавить";
  const subtitle =
    step === "photo"
      ? "Камера или уже снятое фото"
      : slotLabel
        ? `Слот: ${slotLabel}`
        : "Еда, вода, вес или зал";

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
              {title}
            </p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {step === "photo" ? (
              <button
                type="button"
                className="btn-quiet text-sm text-slate-500"
                onClick={() => setStep("root")}
              >
                Назад
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              className="btn-quiet text-sm text-slate-500"
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:p-4">
          {step === "photo" ? (
            <div className="food-add-photo-sources" role="list">
              {FOOD_ADD_PHOTO_SOURCES.map((src, index) => (
                <button
                  key={src.id}
                  type="button"
                  role="listitem"
                  className={`food-add-photo-source food-add-mode-tile--in ${
                    src.id === "camera" ? "food-add-photo-source--primary" : ""
                  }`}
                  style={{ animationDelay: `${60 + index * 40}ms` }}
                  onClick={() =>
                    onSelect("photo", {
                      openCamera: src.id === "camera",
                      openGallery: src.id === "gallery",
                    })
                  }
                >
                  <span className="food-add-photo-source-icon" aria-hidden>
                    <FoodAddIcon name={src.icon} className="h-6 w-6" />
                  </span>
                  <span className="food-add-photo-source-copy">
                    <span className="food-add-photo-source-label">{src.label}</span>
                    <span className="food-add-photo-source-hint">{src.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
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

              <div className="food-add-utility-row food-add-utility-row--three" role="list">
                {FOOD_ADD_UTILITY_OPTIONS.map((opt, index) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="listitem"
                    className={`food-add-utility-tile food-add-utility-tile--${opt.id} food-add-mode-tile--in`}
                    style={{ animationDelay: `${180 + index * 40}ms` }}
                    onClick={() => runUtility(opt)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
