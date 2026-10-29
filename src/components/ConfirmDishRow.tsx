"use client";

import type { ConfirmDishDraft } from "@/lib/confirm-dish-merge";
import { bumpPortion } from "@/lib/confirm-portion-step";
import { looksLikeDrinkName } from "@/lib/portion-unit";

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
};

/** «Проверь и запиши»: one line per dish — grams edited in place, kcal follows. */
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
}: Props) {
  const drink = looksLikeDrinkName(dish.dishName, dish.original.dishName, dish.original.brand);
  const unit = drink ? "мл" : "г";
  const grams = Number(dish.portionGrams);
  const kcal = Number(dish.calories);
  const bump = (dir: 1 | -1) => onPortion(String(bumpPortion(grams, dir, drink)));

  return (
    <div
      className={`confirm-dish-row ${active ? "confirm-dish-row--active" : ""}`}
      data-allergen-dish={allergen ? String(index) : undefined}
    >
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
        <span className="confirm-dish-row-kcal">{kcal > 0 ? `${Math.round(kcal)} ккал` : "— ккал"}</span>
      </button>
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
  );
}
