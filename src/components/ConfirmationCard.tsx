"use client";

import { useEffect, useState } from "react";
import {
  formatMacro,
  nutritionBaseline,
  scaleNutritionByPortion,
  type NutritionValues,
} from "@/lib/nutrition";
import type { RecognitionResponse } from "@/types";
import { getImageUrl, withBasePath } from "@/lib/paths";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { flattenRecognitionItems } from "@/lib/recognition-items";

type NutritionFields = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
  source?: string;
};

type DishDraft = {
  id: string;
  original: FoodRecognitionResult;
  dishName: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  portionGrams: string;
  baseline: NutritionValues | null;
};

type ConfirmationCardProps = {
  result: RecognitionResponse;
  selectedDate: string;
  onCancel: () => void;
  onSaved: () => void;
};

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function draftFromRecognition(item: FoodRecognitionResult, id: string): DishDraft {
  return {
    id,
    original: item,
    dishName: decodeHtmlEntities(item.dishName),
    calories: String(item.calories || ""),
    protein: item.protein !== undefined ? String(item.protein) : "",
    fat: item.fat !== undefined ? String(item.fat) : "",
    carbs: item.carbs !== undefined ? String(item.carbs) : "",
    portionGrams: item.portionGrams !== undefined ? String(item.portionGrams) : "",
    baseline: nutritionBaseline(item),
  };
}

function draftsFromRecognition(recognition: FoodRecognitionResult): DishDraft[] {
  return flattenRecognitionItems(recognition).map((item, index) =>
    draftFromRecognition(item, `${item.dishName}-${index}`),
  );
}

export function ConfirmationCard({
  result,
  selectedDate,
  onCancel,
  onSaved,
}: ConfirmationCardProps) {
  const { recognition, imagePath: initialImagePath, previewUrl } = result;
  const [dishes, setDishes] = useState<DishDraft[]>(() => draftsFromRecognition(recognition));
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [saving, setSaving] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setDishes(draftsFromRecognition(recognition));
    setImagePath(initialImagePath);
  }, [recognition, initialImagePath]);

  function updateDish(id: string, patch: Partial<DishDraft>) {
    setDishes((current) => current.map((dish) => (dish.id === id ? { ...dish, ...patch } : dish)));
  }

  function captureBaseline(dish: DishDraft, next: Partial<DishDraft>): NutritionValues | null {
    return nutritionBaseline({
      calories: Number(next.calories ?? dish.calories),
      protein: parseOptionalNumber(next.protein ?? dish.protein),
      fat: parseOptionalNumber(next.fat ?? dish.fat),
      carbs: parseOptionalNumber(next.carbs ?? dish.carbs),
      portionGrams: Number(next.portionGrams ?? dish.portionGrams),
    });
  }

  function handlePortionChange(dish: DishDraft, value: string) {
    const grams = Number(value);
    let base = dish.baseline;
    if (!base) {
      const kcal = Number(dish.calories);
      if (Number.isFinite(kcal) && kcal > 0 && Number.isFinite(grams) && grams > 0) {
        base = nutritionBaseline({
          calories: kcal,
          protein: parseOptionalNumber(dish.protein),
          fat: parseOptionalNumber(dish.fat),
          carbs: parseOptionalNumber(dish.carbs),
          portionGrams: grams,
        });
      }
    }

    const scaled =
      base && Number.isFinite(grams) && grams > 0 ? scaleNutritionByPortion(base, grams) : null;

    updateDish(dish.id, {
      portionGrams: value,
      baseline: base ?? dish.baseline,
      calories: scaled ? String(scaled.calories) : dish.calories,
      protein: scaled?.protein !== undefined ? formatMacro(scaled.protein) : dish.protein,
      fat: scaled?.fat !== undefined ? formatMacro(scaled.fat) : dish.fat,
      carbs: scaled?.carbs !== undefined ? formatMacro(scaled.carbs) : dish.carbs,
    });
  }

  async function handleLookup(dish: DishDraft, nameOverride?: string) {
    const query = (nameOverride ?? dish.dishName).trim();
    if (!query) {
      setError("Введите название блюда для поиска");
      return;
    }

    setSearchingId(dish.id);
    setError(null);
    setLookupMessage(null);

    try {
      const response = await fetch(withBasePath("/api/food/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: query }),
      });

      const data = (await response.json()) as {
        recognition?: NutritionFields;
        imagePath?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось найти блюдо");
      }

      if (!data.recognition) {
        throw new Error("Пустой ответ от сервера");
      }

      const next = data.recognition;
      updateDish(dish.id, {
        dishName: decodeHtmlEntities(next.dishName),
        calories: String(next.calories),
        protein: next.protein !== undefined ? String(next.protein) : "",
        fat: next.fat !== undefined ? String(next.fat) : "",
        carbs: next.carbs !== undefined ? String(next.carbs) : "",
        portionGrams: next.portionGrams !== undefined ? String(next.portionGrams) : "",
        baseline: nutritionBaseline(next),
      });
      if (!previewUrl && data.imagePath && dishes.length === 1) {
        setImagePath(data.imagePath);
      }
      const sourceLabel = next.source ? RECOGNITION_SOURCE_LABELS[next.source] : undefined;
      setLookupMessage(sourceLabel ?? "Калорийность и БЖУ обновлены по названию блюда");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setSearchingId(null);
    }
  }

  async function saveDish(dish: DishDraft, mealGroupId?: string) {
    const parsedCalories = Number(dish.calories);
    if (!dish.dishName.trim() || !Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      throw new Error("Проверьте название и калорийность каждого блюда");
    }

    const origProtein = dish.original.protein !== undefined ? Number(dish.original.protein) : undefined;
    const origFat = dish.original.fat !== undefined ? Number(dish.original.fat) : undefined;
    const origCarbs = dish.original.carbs !== undefined ? Number(dish.original.carbs) : undefined;
    const parsedProtein = dish.protein ? Number(dish.protein) : undefined;
    const parsedFat = dish.fat ? Number(dish.fat) : undefined;
    const parsedCarbs = dish.carbs ? Number(dish.carbs) : undefined;

    const wasCorrected =
      dish.dishName.trim() !== decodeHtmlEntities(dish.original.dishName) ||
      parsedCalories !== dish.original.calories ||
      parsedProtein !== origProtein ||
      parsedFat !== origFat ||
      parsedCarbs !== origCarbs;

    const response = await fetch(withBasePath("/api/meals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        dishName: dish.dishName.trim(),
        calories: parsedCalories,
        protein: dish.protein ? Number(dish.protein) : undefined,
        fat: dish.fat ? Number(dish.fat) : undefined,
        carbs: dish.carbs ? Number(dish.carbs) : undefined,
        portionGrams: dish.portionGrams ? Number(dish.portionGrams) : undefined,
        confidence: dish.original.confidence,
        imagePath: imagePath || undefined,
        mealGroupId,
        wasCorrected,
        originalDish: decodeHtmlEntities(dish.original.dishName),
        originalCalories: dish.original.calories,
        originalProtein: origProtein,
        originalFat: origFat,
        originalCarbs: origCarbs,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Ошибка сохранения");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const mealGroupId = dishes.length > 1 ? crypto.randomUUID() : undefined;
      const results = await Promise.allSettled(
        dishes.map((dish) => saveDish(dish, mealGroupId)),
      );

      const failures = results
        .map((result, index) =>
          result.status === "rejected"
            ? `${dishes[index]?.dishName || `Блюдо ${index + 1}`}: ${result.reason instanceof Error ? result.reason.message : "ошибка"}`
            : null,
        )
        .filter((message): message is string => message !== null);

      if (failures.length > 0) {
        setError(failures.join(" · "));
        return;
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const hasImage = Boolean(previewUrl || imagePath);
  const multi = dishes.length > 1;
  const totalCalories = dishes.reduce((sum, dish) => sum + (Number(dish.calories) || 0), 0);
  const searching = searchingId !== null;

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold">Проверьте распознавание</h2>
          <p className="mt-1 text-sm text-slate-500">
            {multi
              ? "На фото несколько блюд — каждое можно поправить и сохранить отдельно."
              : "Измените порцию — калории и БЖУ пересчитаются сразу. Название можно уточнить поиском."}
          </p>
        </div>

        <div className={`grid gap-5 ${hasImage ? "md:grid-cols-[220px_1fr]" : ""}`}>
          {hasImage ? (
            <div className="overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl ?? getImageUrl(imagePath)}
                alt={dishes.map((dish) => dish.dishName).join(", ") || "Фото блюда"}
                className="h-full min-h-52 w-full object-cover"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <p>
                {RECOGNITION_SOURCE_LABELS[recognition.source ?? "gigachat"] ?? "Распознавание по фото"}
              </p>
              <p className="mt-1 text-xs text-teal-800">
                {multi
                  ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
                  : `Уверенность: ${Math.round(recognition.confidence * 100)}%`}
                {recognition.barcode ? ` · штрихкод ${recognition.barcode}` : ""}
              </p>
            </div>

            {dishes.map((dish, index) => (
              <DishFields
                key={dish.id}
                dish={dish}
                index={index}
                multi={multi}
                searching={searchingId === dish.id}
                disabled={saving || searching}
                canRemove={multi}
                onChange={(patch) => updateDish(dish.id, patch)}
                onBaselineChange={(patch) =>
                  updateDish(dish.id, { ...patch, baseline: captureBaseline(dish, patch) })
                }
                onPortionChange={(value) => handlePortionChange(dish, value)}
                onLookup={(name) => void handleLookup(dish, name)}
                onApplyAlternative={(alt) => {
                  updateDish(dish.id, {
                    dishName: decodeHtmlEntities(alt.dishName),
                    calories: String(alt.calories),
                    protein: alt.protein !== undefined ? String(alt.protein) : "",
                    fat: alt.fat !== undefined ? String(alt.fat) : "",
                    carbs: alt.carbs !== undefined ? String(alt.carbs) : "",
                    portionGrams: alt.portionGrams !== undefined ? String(alt.portionGrams) : dish.portionGrams,
                    baseline: null,
                  });
                  setLookupMessage("Вариант применён");
                }}
                onRemove={() => setDishes((current) => current.filter((item) => item.id !== dish.id))}
              />
            ))}

            {multi ? (
              <button
                type="button"
                className="btn btn-secondary self-start text-sm"
                disabled={saving || searching}
                onClick={() =>
                  setDishes((current) => [
                    ...current,
                    draftFromRecognition(
                      { dishName: "", calories: 0, confidence: 0.5, photoKind: "meal" },
                      `new-${Date.now()}`,
                    ),
                  ])
                }
              >
                Добавить блюдо
              </button>
            ) : null}
          </div>
        </div>

        {lookupMessage ? <p className="text-sm text-teal-700">{lookupMessage}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled={saving || searching} onClick={() => void handleSave()}>
            {saving ? "Сохраняем..." : multi ? "Сохранить все блюда" : "Да, сохранить"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving || searching} onClick={onCancel}>
            Отменить
          </button>
        </div>
      </div>
    </section>
  );
}

function DishFields({
  dish,
  index,
  multi,
  searching,
  disabled,
  canRemove,
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
  disabled: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<DishDraft>) => void;
  onBaselineChange: (patch: Partial<DishDraft>) => void;
  onPortionChange: (value: string) => void;
  onLookup: (name?: string) => void;
  onApplyAlternative: (alt: NonNullable<FoodRecognitionResult["alternatives"]>[number]) => void;
  onRemove: () => void;
}) {
  const fieldId = (name: string) => `${name}-${dish.id}`;

  const alternativesSection = !multi && dish.original.alternatives?.length ? (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-600">Возможные варианты</p>
      <div className="flex flex-wrap gap-2">
        {dish.original.alternatives.map((item) => {
          const altName = decodeHtmlEntities(item.dishName);
          const hasMacros = item.protein !== undefined || item.fat !== undefined || item.carbs !== undefined;
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
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
              onClick={handleAltClick}
            >
              {altName} · {item.calories} ккал
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={multi ? "rounded-2xl border border-slate-200 p-4" : "flex flex-col gap-4"}>
      {multi ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">Блюдо {index + 1}</p>
          {canRemove ? (
            <button type="button" className="text-sm text-red-600 hover:text-red-700" disabled={disabled} onClick={onRemove}>
              Убрать
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor={fieldId("dishName")}>Блюдо</label>
          <div className="input-with-action">
            <input
              id={fieldId("dishName")}
              value={dish.dishName}
              placeholder="Например: борщ с мясом"
              onChange={(event) => onChange({ dishName: event.target.value })}
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
              disabled={disabled}
              onClick={() => onLookup()}
            >
              {searching ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <SearchIcon />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500">Измените название и нажмите лупу или Enter для пересчёта</p>
        </div>

        {alternativesSection}

        <div className="field">
          <label htmlFor={fieldId("calories")}>Калории, ккал</label>
          <input
            id={fieldId("calories")}
            type="number"
            min="1"
            value={dish.calories}
            onChange={(event) => onBaselineChange({ calories: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor={fieldId("portionGrams")}>Порция, г</label>
          <input
            id={fieldId("portionGrams")}
            type="number"
            min="1"
            value={dish.portionGrams}
            onChange={(event) => onPortionChange(event.target.value)}
          />
          <p className="text-xs text-slate-500">Калории и БЖУ пересчитываются пропорционально порции</p>
        </div>

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

        <div className="field sm:col-span-2">
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
      </div>
    </div>
  );
}
