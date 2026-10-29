"use client";

import type { ConfirmDishDraft } from "@/lib/confirm-dish-merge";
import { bumpPortion } from "@/lib/confirm-portion-step";
import { relativePortionChips } from "@/lib/confirm-portion-chips";
import { formatCalorieEstimate } from "@/lib/calorie-estimate-range";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { looksLikeDrinkName } from "@/lib/portion-unit";
import {
  formatConfidencePercent,
  getConfidenceTone,
} from "@/lib/recognition-confidence-ui";
import { DEFAULT_LOW_CONFIDENCE_THRESHOLD } from "@/lib/ai/recognition-confidence-calibration";

type Alt = NonNullable<FoodRecognitionResult["alternatives"]>[number];

type Props = {
  dish: ConfirmDishDraft;
  index: number;
  active: boolean;
  /** Short review marker: «БЖУ?», «?», «⚠». */
  flag: string | null;
  flagTitle?: string;
  allergen: boolean;
  disabled: boolean;
  onSelect: () => void;
  onPortion: (value: string) => void;
  /** Low-confidence: tap an alternative on the card (not only in expanded fields). */
  onApplyAlternative?: (alt: Alt) => void;
};

/** «Проверь и запиши»: one card per dish — range kcal, S/M/L, confidence, alts. */
export function ConfirmDishRow({
  dish,
  index,
  active,
  flag,
  flagTitle,
  allergen,
  disabled,
  onSelect,
  onPortion,
  onApplyAlternative,
}: Props) {
  const drink = looksLikeDrinkName(dish.dishName, dish.original.dishName, dish.original.brand);
  const unit = drink ? "мл" : "г";
  const grams = Number(dish.portionGrams);
  const kcal = Number(dish.calories);
  const bump = (dir: 1 | -1) => onPortion(String(bumpPortion(grams, dir, drink)));
  const base =
    Number(dish.original.portionGrams) > 0
      ? Number(dish.original.portionGrams)
      : Number.isFinite(grams) && grams > 0
        ? grams
        : 0;
  const chips = relativePortionChips(base, unit);
  const confidence =
    typeof dish.original.confidence === "number" ? dish.original.confidence : null;
  const tone =
    confidence != null
      ? getConfidenceTone(confidence, DEFAULT_LOW_CONFIDENCE_THRESHOLD)
      : null;
  const kcalLabel =
    confidence != null && Number.isFinite(kcal) && kcal > 0
      ? formatCalorieEstimate(kcal, confidence)
      : kcal > 0
        ? `${Math.round(kcal)} ккал`
        : "— ккал";
  const alts =
    tone === "low" && onApplyAlternative
      ? (dish.original.alternatives ?? []).slice(0, 3)
      : [];

  return (
    <div
      className={`confirm-dish-row ${active ? "confirm-dish-row--active" : ""}`}
      data-allergen-dish={allergen ? String(index) : undefined}
    >
      <div className="confirm-dish-row-top">
        <button
          type="button"
          className="confirm-dish-row-main"
          onClick={onSelect}
          aria-expanded={active}
          title={flagTitle}
        >
          <span className="confirm-dish-row-name">
            {dish.dishName || "Блюдо"}
            {allergen ? <span className="confirm-dish-row-flag confirm-dish-row-flag--warn"> ⚠</span> : null}
            {flag ? <span className="confirm-dish-row-flag"> {flag}</span> : null}
          </span>
          <span className="confirm-dish-row-kcal">{kcalLabel}</span>
        </button>
        {confidence != null && tone ? (
          <span
            className={`confirm-dish-row-conf confirm-dish-row-conf--${tone}`}
            title={flagTitle ?? `Уверенность ${formatConfidencePercent(confidence)}`}
          >
            {formatConfidencePercent(confidence)}
          </span>
        ) : null}
        <div className="confirm-dish-row-stepper" role="group" aria-label={`Порция: ${dish.dishName || "блюдо"}`}>
          <button
            type="button"
            className="confirm-dish-row-step"
            disabled={disabled}
            onClick={() => bump(-1)}
            aria-label="Меньше"
          >
            −
          </button>
          <label className="confirm-dish-row-grams">
            <input
              inputMode="decimal"
              value={dish.portionGrams}
              disabled={disabled}
              onChange={(e) => onPortion(e.target.value)}
              aria-label={`Порция, ${unit}`}
            />
            <span>{unit}</span>
          </label>
          <button
            type="button"
            className="confirm-dish-row-step"
            disabled={disabled}
            onClick={() => bump(1)}
            aria-label="Больше"
          >
            +
          </button>
        </div>
      </div>
      {chips.length > 0 ? (
        <div className="confirm-dish-row-chips" role="group" aria-label="Размер порции">
          {chips.map((chip) => {
            const selected = Math.abs(grams - chip.grams) < 0.51;
            return (
              <button
                key={`${chip.label}-${chip.grams}`}
                type="button"
                className={`confirm-dish-row-chip${selected ? " confirm-dish-row-chip--on" : ""}`}
                disabled={disabled}
                aria-pressed={selected}
                title={`${chip.grams} ${unit}`}
                onClick={() => onPortion(String(chip.grams))}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {alts.length > 0 ? (
        <div className="confirm-dish-row-alts" role="group" aria-label="Возможные варианты">
          <p className="confirm-dish-row-alts-label">Это может быть:</p>
          <div className="confirm-dish-row-alts-chips">
            {alts.map((item) => {
              const name = decodeHtmlEntities(item.dishName);
              return (
                <button
                  key={name}
                  type="button"
                  className="confirm-dish-row-alt"
                  disabled={disabled}
                  onClick={() => onApplyAlternative?.(item)}
                >
                  {name}
                  {item.calories > 0
                    ? ` · ${formatCalorieEstimate(item.calories, Math.min(confidence ?? 0.5, 0.7))}`
                    : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
