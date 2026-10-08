"use client";

import { MEAL_TYPE_LABELS } from "@/types";
import { Chip } from "@/components/Chip";
import { ConfidenceBadge, shouldSurfaceNutritionBasis } from "@/components/ConfirmConfidenceBadge";
import type { DishDraft } from "@/lib/confirm-card-draft";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { FOOD_LOOKUP_MODE_LABELS, RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import {
  confidenceShortLabel,
  formatConfidencePercent,
  getConfidenceTone,
  photoContextChipLabel,
  suggestedPhotoContextChips,
  type PhotoContextChip,
} from "@/lib/recognition-confidence-ui";
import { describeNutritionBasis } from "@/lib/recognition-nutrition";

type ConfirmDetailsFoldProps = {
  multi: boolean;
  dishes: DishDraft[];
  skimTone: ReturnType<typeof getConfidenceTone>;
  anyLowConfidence: boolean;
  lowConfidenceDishesLength: number;
  lowConfidenceThreshold: number;
  mealType: string;
  eatenTime: string;
  saving: boolean;
  searching: boolean;
  onRerunWithContext?: (context: PhotoContextChip) => void;
  lowestConfidenceDish: DishDraft | null;
  recognition: FoodRecognitionResult;
  totalCalories: number;
  onMealTypeToggle: (value: string) => void;
  onEatenTimeChange: (value: string) => void;
};

export function ConfirmDetailsFold({
  multi,
  dishes,
  skimTone,
  anyLowConfidence,
  lowConfidenceDishesLength,
  lowConfidenceThreshold,
  mealType,
  eatenTime,
  saving,
  searching,
  onRerunWithContext,
  lowestConfidenceDish,
  recognition,
  totalCalories,
  onMealTypeToggle,
  onEatenTimeChange,
}: ConfirmDetailsFoldProps) {
  return (
    <details className="confirm-details-fold">
      <summary>
        Подробнее
        {!multi && dishes[0]
          ? ` · ${formatConfidencePercent(dishes[0].original.confidence)}${
              skimTone !== "high" ? ` · ${confidenceShortLabel(skimTone)}` : ""
            }`
          : multi && anyLowConfidence
            ? ` · слабая ${lowConfidenceDishesLength}/${dishes.length}`
            : ""}
        {mealType
          ? ` · ${MEAL_TYPE_LABELS[mealType as keyof typeof MEAL_TYPE_LABELS] ?? mealType}`
          : ""}
      </summary>
      <div className="confirm-details-fold__body">
        {!multi && dishes[0] ? (
          <ConfidenceBadge
            confidence={dishes[0].original.confidence}
            threshold={lowConfidenceThreshold}
            photoKind={dishes[0].original.photoKind}
            source={dishes[0].original.source}
            dishName={dishes[0].dishName || dishes[0].original.dishName}
            nutritionBasis={
              shouldSurfaceNutritionBasis(dishes[0].original)
                ? describeNutritionBasis(dishes[0].original)
                : null
            }
          />
        ) : null}

        {/* Skim already shows the trust line — fold keeps deep badge/reshoot only. */}

        {(() => {
          if (!onRerunWithContext) return null;
          const tone = getConfidenceTone(
            lowestConfidenceDish?.original.confidence ??
              dishes[0]?.original.confidence ??
              0.5,
            lowConfidenceThreshold,
          );
          const chips = suggestedPhotoContextChips(tone, {
            photoKind:
              lowestConfidenceDish?.original.photoKind ?? recognition.photoKind,
            dishName: lowestConfidenceDish?.dishName ?? dishes[0]?.dishName,
          });
          if (chips.length === 0) return null;
          return (
            <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border-quiet)] bg-[var(--accent-summary-soft)]/80 px-3 py-2">
              <p className="text-xs font-semibold text-[var(--muted-strong)]">
                Переснять с подсказкой контекста
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="rounded-lg border border-[var(--border-quiet)] bg-[var(--card)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]"
                    disabled={saving || searching}
                    onClick={() => onRerunWithContext(chip)}
                  >
                    {photoContextChipLabel(chip)}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Приём пищи
            {eatenTime ? ` · ${eatenTime}` : ""}
          </p>
          <div className="chip-row-fill">
            {(Object.entries(MEAL_TYPE_LABELS) as Array<[string, string]>).map(
              ([value, label]) => (
                <Chip
                  key={value}
                  active={mealType === value}
                  disabled={saving}
                  onClick={() => onMealTypeToggle(mealType === value ? "" : value)}
                >
                  {label}
                </Chip>
              ),
            )}
          </div>
          <div className="field mt-3 max-w-[12rem]">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Время приёма
            </label>
            <input
              type="time"
              className="mt-1.5"
              value={eatenTime}
              disabled={saving}
              onChange={(e) => onEatenTimeChange(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1 text-xs text-[var(--muted-strong)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Распознавание
          </p>
          <p>
            {RECOGNITION_SOURCE_LABELS[recognition.source ?? "gigachat"] ?? "Распознавание по фото"}
            {recognition.photoKind === "barcode" ? " · штрихкод" : ""}
            {recognition.photoKind === "label" ? " · этикетка" : ""}
          </p>
          {recognition.lookupMode ? (
            <p>
              {FOOD_LOOKUP_MODE_LABELS[recognition.lookupMode]}
              {recognition.lookupMode === "branded" && recognition.brand
                ? `: ${recognition.brand}`
                : ""}
            </p>
          ) : null}
          <p>
            {multi
              ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
              : `Уверенность: ${formatConfidencePercent(recognition.confidence)}`}
            {recognition.barcode ? ` · ${recognition.barcode}` : ""}
            {!recognition.lookupMode && recognition.brand ? ` · ${recognition.brand}` : ""}
          </p>
        </div>
      </div>
    </details>
  );
}
