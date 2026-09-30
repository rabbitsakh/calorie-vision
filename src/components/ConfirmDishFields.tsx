"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/Chip";
import { portionChipOptions } from "@/lib/confirm-portion-chips";
import type { ConfirmDishDraft } from "@/lib/confirm-dish-merge";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { formatMacro } from "@/lib/nutrition";
import { withBasePath } from "@/lib/paths";
import { looksLikeDrinkName } from "@/lib/portion-unit";
import { formatConfidencePercent } from "@/lib/recognition-confidence-ui";
import { dishLooksLikeAlcohol } from "@/lib/ru-nutrition-lookup";

type DishDraft = ConfirmDishDraft;

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function looksLikeDrink(dish: DishDraft): boolean {
  return looksLikeDrinkName(dish.dishName, dish.original.dishName, dish.original.brand);
}

export function DishFields({
  dish,
  index,
  multi,
  searching,
  lookupDisabled,
  formDisabled,
  canRemove,
  review,
  onChange,
  onBaselineChange,
  onPortionChange,
  onLookup,
  onApplyAlternative,
  onRemove,
}: {
  dish: DishDraft;
  index: number;
  multi: boolean;
  searching: boolean;
  lookupDisabled: boolean;
  formDisabled: boolean;
  canRemove: boolean;
  review: { lowConfidence: boolean; missingCalories: boolean; missingMacros: boolean };
  onChange: (patch: Partial<DishDraft>) => void;
  onBaselineChange: (patch: Partial<DishDraft>) => void;
  onPortionChange: (value: string) => void;
  onLookup: (name?: string) => void;
  onApplyAlternative: (alt: NonNullable<FoodRecognitionResult["alternatives"]>[number]) => void;
  onRemove: () => void;
}) {
  const fieldId = (name: string) => `${name}-${dish.id}`;
  const showReviewCta =
    review.lowConfidence || review.missingCalories || review.missingMacros;
  const [showAdvanced, setShowAdvanced] = useState(showReviewCta);
  const [wrongDishHint, setWrongDishHint] = useState(false);
  const [historyPortions, setHistoryPortions] = useState<number[]>([]);
  const dishNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const name = dish.dishName.trim();
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
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [dish.dishName]);

  function handleWrongDish() {
    setWrongDishHint(true);
    const input = dishNameRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }

  const alternativesSection = dish.original.alternatives?.length ? (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-600">Возможные варианты</p>
      <div className="flex flex-wrap gap-2">
        {dish.original.alternatives.map((item) => {
          const altName = decodeHtmlEntities(item.dishName);
          const hasMacros = item.protein !== undefined || item.fat !== undefined || item.carbs !== undefined;
          const macroHint = hasMacros
            ? ` · Б ${formatMacro(item.protein ?? 0)} Ж ${formatMacro(item.fat ?? 0)} У ${formatMacro(item.carbs ?? 0)}`
            : "";
          const handleAltClick = () => {
            if (hasMacros) {
              onApplyAlternative(item);
            } else {
              onLookup(altName);
            }
          };
          return (
            <button
              key={altName}
              type="button"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200 disabled:opacity-50"
              disabled={formDisabled || lookupDisabled}
              onClick={handleAltClick}
              title={hasMacros ? "Применить вариант с БЖУ" : "Уточнить по названию"}
            >
              {altName} · {item.calories} ккал{macroHint}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={
        multi
          ? `rounded-2xl border p-4 ${
              showReviewCta ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
            }`
          : "flex flex-col gap-4"
      }
    >
      {multi ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Блюдо {index + 1}</p>
            <p className="text-xs text-slate-500">
              Уверенность: {formatConfidencePercent(dish.original.confidence)}
              {review.missingCalories ? " · нет калорий" : ""}
              {review.missingMacros ? " · нет БЖУ" : ""}
              {review.lowConfidence ? " · низкая уверенность" : ""}
            </p>
          </div>
          {canRemove ? (
            <button
              type="button"
              className="text-sm text-red-600 hover:text-red-700"
              disabled={formDisabled}
              onClick={onRemove}
            >
              Убрать
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={fieldId("dishName")}>Блюдо</label>
            <button
              type="button"
              className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
              disabled={formDisabled}
              onClick={handleWrongDish}
            >
              Не то
            </button>
          </div>
          <div className="input-with-action">
            <input
              ref={dishNameRef}
              id={fieldId("dishName")}
              value={dish.dishName}
              placeholder="Например: борщ с мясом"
              onChange={(event) => {
                onChange({ dishName: event.target.value });
                if (wrongDishHint) {
                  setWrongDishHint(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onLookup();
                }
              }}
            />
            <button
              type="button"
              className="btn-icon"
              title="Найти калорийность и БЖУ"
              aria-label="Найти калорийность и БЖУ"
              disabled={lookupDisabled}
              onClick={() => onLookup()}
            >
              {searching ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <SearchIcon />
              )}
            </button>
          </div>
                    {(() => {
            const recognizedName = decodeHtmlEntities(dish.original.dishName).trim();
            const currentName = dish.dishName.trim();
            if (
              recognizedName &&
              currentName &&
              recognizedName.toLowerCase() !== currentName.toLowerCase()
            ) {
              return (
                <p className="mt-1 text-xs text-slate-600">
                  Было: <span className="font-medium">{recognizedName}</span>
                  {" → "}
                  стало: <span className="font-medium">{currentName}</span>
                </p>
              );
            }
            if (dish.original.source === "correction-memory") {
              return (
                <p className="mt-1 text-xs text-teal-800">
                  Подставлено из вашего прошлого исправления
                </p>
              );
            }
            return null;
          })()}
          {wrongDishHint ? (
            <p className="mt-1 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
              Исправьте название и сохраните — приложение запомнит исправление и подставит его в
              следующий раз.
            </p>
          ) : null}
          {showReviewCta ? (
            <button
              type="button"
              className="btn btn-secondary mt-2 w-full text-sm sm:w-auto"
              disabled={lookupDisabled}
              onClick={() => onLookup()}
            >
              Уточнить по названию
            </button>
          ) : null}
          {showReviewCta && alternativesSection ? (
            <div className="mt-3">{alternativesSection}</div>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={fieldId("calories")}>Калории, ккал</label>
          <input
            id={fieldId("calories")}
            type="number"
            inputMode="decimal"
            min="1"
            className="text-base"
            value={dish.calories}
            onChange={(event) => onBaselineChange({ calories: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor={fieldId("portionGrams")}>
            {looksLikeDrink(dish) ? "Порция, мл" : "Порция, г"}
          </label>
          <input
            id={fieldId("portionGrams")}
            type="number"
            inputMode="decimal"
            min="1"
            className="text-base"
            value={dish.portionGrams}
            onChange={(event) => onPortionChange(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {portionChipOptions(dish, historyPortions).map((chip, chipIndex) => {
              const active = Number(dish.portionGrams) === chip.grams;
              return (
                <Chip
                  key={chip.label}
                  active={active}
                  disabled={formDisabled}
                  className={chipIndex === 0 && /упаковка|шт/i.test(chip.label) ? "min-h-11" : ""}
                  onClick={() => onPortionChange(String(chip.grams))}
                >
                  {chip.label}
                </Chip>
              );
            })}
          </div>
          {dish.fiber.trim() || dish.sugar.trim() ? (
            <p className="mt-1 text-xs text-slate-500">
              {[
                dish.fiber.trim() ? `клетчатка ${dish.fiber.trim()} г` : null,
                dish.sugar.trim() ? `сахар ${dish.sugar.trim()} г` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? "Скрыть уточнения" : "Уточнить БЖУ, клетчатку и сахар"}
          </button>
        </div>

        {showAdvanced ? (
          <>
            {review.missingMacros && !review.missingCalories ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:col-span-2">
                Есть калории, но БЖУ неполные — нажмите «Уточнить БЖУ» или заполните белки/жиры/углеводы
                вручную.
              </p>
            ) : null}

            {review.lowConfidence ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:col-span-2">
                Низкая уверенность ({formatConfidencePercent(dish.original.confidence)}) — проверьте
                название или нажмите «Уточнить по названию».
              </p>
            ) : null}

            {dishLooksLikeAlcohol(dish.dishName) ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:col-span-2">
                Алкоголь — «пустые» калории: учтите в дневной норме без нутриентной пользы.
              </p>
            ) : null}

            {!showReviewCta ? alternativesSection : null}

            <div className="field">
              <label htmlFor={fieldId("protein")}>Белки, г</label>
              <input
                id={fieldId("protein")}
                type="number"
                min="0"
                step="0.1"
                value={dish.protein}
                onChange={(event) => onBaselineChange({ protein: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={fieldId("fat")}>Жиры, г</label>
              <input
                id={fieldId("fat")}
                type="number"
                min="0"
                step="0.1"
                value={dish.fat}
                onChange={(event) => onBaselineChange({ fat: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={fieldId("carbs")}>Углеводы, г</label>
              <input
                id={fieldId("carbs")}
                type="number"
                min="0"
                step="0.1"
                value={dish.carbs}
                onChange={(event) => onBaselineChange({ carbs: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={fieldId("fiber")}>Клетчатка, г</label>
              <input
                id={fieldId("fiber")}
                type="number"
                min="0"
                step="0.1"
                value={dish.fiber}
                onChange={(event) => onBaselineChange({ fiber: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={fieldId("sugar")}>Сахар, г</label>
              <input
                id={fieldId("sugar")}
                type="number"
                min="0"
                step="0.1"
                value={dish.sugar}
                onChange={(event) => onBaselineChange({ sugar: event.target.value })}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
