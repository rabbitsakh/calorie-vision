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
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";

type NutritionFields = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
  source?: string;
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

export function ConfirmationCard({
  result,
  selectedDate,
  onCancel,
  onSaved,
}: ConfirmationCardProps) {
  const { recognition, imagePath: initialImagePath, previewUrl } = result;
  const [dishName, setDishName] = useState(() => decodeHtmlEntities(recognition.dishName));
  const [calories, setCalories] = useState(String(recognition.calories));
  const [protein, setProtein] = useState(String(recognition.protein ?? ""));
  const [fat, setFat] = useState(String(recognition.fat ?? ""));
  const [carbs, setCarbs] = useState(String(recognition.carbs ?? ""));
  const [portionGrams, setPortionGrams] = useState(String(recognition.portionGrams ?? ""));
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [baseline, setBaseline] = useState<NutritionValues | null>(() =>
    nutritionBaseline(recognition),
  );
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parseOptionalNumber(value: string): number | undefined {
    if (value.trim() === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function captureBaseline(
    next: Partial<{
      calories: string;
      protein: string;
      fat: string;
      carbs: string;
      portionGrams: string;
    }>,
  ) {
    const grams = Number(next.portionGrams ?? portionGrams);
    const kcal = Number(next.calories ?? calories);
    setBaseline(
      nutritionBaseline({
        calories: kcal,
        protein: parseOptionalNumber(next.protein ?? protein),
        fat: parseOptionalNumber(next.fat ?? fat),
        carbs: parseOptionalNumber(next.carbs ?? carbs),
        portionGrams: grams,
      }),
    );
  }

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setDishName(decodeHtmlEntities(recognition.dishName));
    setCalories(String(recognition.calories));
    setProtein(recognition.protein !== undefined ? String(recognition.protein) : "");
    setFat(recognition.fat !== undefined ? String(recognition.fat) : "");
    setCarbs(recognition.carbs !== undefined ? String(recognition.carbs) : "");
    setPortionGrams(recognition.portionGrams !== undefined ? String(recognition.portionGrams) : "");
    setBaseline(nutritionBaseline(recognition));
    setImagePath(initialImagePath);
  }, [recognition, initialImagePath]);

  useEffect(() => {
    const name = decodeHtmlEntities(recognition.dishName).trim();
    if (recognition.calories > 0 || !name || /не удалось распознать/i.test(name)) {
      return;
    }

    void handleLookup(name);
  }, [recognition.dishName, recognition.calories]);

  function applyNutrition(data: NutritionFields) {
    setDishName(decodeHtmlEntities(data.dishName));
    setCalories(String(data.calories));
    setProtein(data.protein !== undefined ? String(data.protein) : "");
    setFat(data.fat !== undefined ? String(data.fat) : "");
    setCarbs(data.carbs !== undefined ? String(data.carbs) : "");
    setPortionGrams(data.portionGrams !== undefined ? String(data.portionGrams) : "");
    setBaseline(nutritionBaseline(data));
  }

  function handlePortionChange(value: string) {
    setPortionGrams(value);
    const grams = Number(value);
    if (!Number.isFinite(grams) || grams <= 0) {
      return;
    }

    let base = baseline;
    if (!base) {
      const kcal = Number(calories);
      if (Number.isFinite(kcal) && kcal > 0) {
        base = nutritionBaseline({
          calories: kcal,
          protein: parseOptionalNumber(protein),
          fat: parseOptionalNumber(fat),
          carbs: parseOptionalNumber(carbs),
          portionGrams: grams,
        });
        if (base) {
          setBaseline(base);
        }
      }
    }

    if (!base) {
      return;
    }

    const scaled = scaleNutritionByPortion(base, grams);
    if (!scaled) {
      return;
    }

    setCalories(String(scaled.calories));
    if (scaled.protein !== undefined) {
      setProtein(formatMacro(scaled.protein));
    }
    if (scaled.fat !== undefined) {
      setFat(formatMacro(scaled.fat));
    }
    if (scaled.carbs !== undefined) {
      setCarbs(formatMacro(scaled.carbs));
    }
  }

  async function handleLookup(nameOverride?: string) {
    const query = (nameOverride ?? dishName).trim();
    if (!query) {
      setError("Введите название блюда для поиска");
      return;
    }

    setSearching(true);
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

      applyNutrition(data.recognition);
      if (!previewUrl && data.imagePath) {
        setImagePath(data.imagePath);
      }
      const sourceLabel = data.recognition.source
        ? RECOGNITION_SOURCE_LABELS[data.recognition.source]
        : undefined;
      setLookupMessage(sourceLabel ?? "Калорийность и БЖУ обновлены по названию блюда");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setSearching(false);
    }
  }

  const wasCorrected =
    dishName.trim() !== decodeHtmlEntities(recognition.dishName) ||
    Number(calories) !== recognition.calories;

  async function handleSave() {
    const parsedCalories = Number(calories);
    if (!dishName.trim() || !Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      setError("Проверьте название блюда и калорийность");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          dishName: dishName.trim(),
          calories: parsedCalories,
          protein: protein ? Number(protein) : undefined,
          fat: fat ? Number(fat) : undefined,
          carbs: carbs ? Number(carbs) : undefined,
          portionGrams: portionGrams ? Number(portionGrams) : undefined,
          confidence: recognition.confidence,
          imagePath: imagePath || undefined,
          wasCorrected,
          originalDish: decodeHtmlEntities(recognition.dishName),
          originalCalories: recognition.calories,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Ошибка сохранения");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const hasImage = Boolean(previewUrl || imagePath);

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold">Проверьте распознавание</h2>
          <p className="mt-1 text-sm text-slate-500">
            Измените порцию — калории и БЖУ пересчитаются сразу. Название можно уточнить поиском.
          </p>
        </div>

        <div className={`grid gap-5 ${hasImage ? "md:grid-cols-[220px_1fr]" : ""}`}>
          {hasImage ? (
            <div className="overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl ?? getImageUrl(imagePath)}
                alt={dishName.trim() || "Фото блюда"}
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
                Уверенность: {Math.round(recognition.confidence * 100)}%
                {recognition.barcode ? ` · штрихкод ${recognition.barcode}` : ""}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label htmlFor="dishName">Блюдо</label>
                <div className="input-with-action">
                  <input
                    id="dishName"
                    value={dishName}
                    placeholder="Например: борщ с мясом"
                    onChange={(event) => setDishName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleLookup();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    title="Найти калорийность и БЖУ"
                    aria-label="Найти калорийность и БЖУ"
                    disabled={searching || saving}
                    onClick={() => void handleLookup()}
                  >
                    {searching ? (
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <SearchIcon />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Измените название и нажмите лупу или Enter для пересчёта
                </p>
              </div>

              <div className="field">
                <label htmlFor="calories">Калории, ккал</label>
                <input
                  id="calories"
                  type="number"
                  min="1"
                  value={calories}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCalories(value);
                    captureBaseline({ calories: value });
                  }}
                />
              </div>

              <div className="field">
                <label htmlFor="portionGrams">Порция, г</label>
                <input
                  id="portionGrams"
                  type="number"
                  min="1"
                  value={portionGrams}
                  onChange={(event) => handlePortionChange(event.target.value)}
                />
                <p className="text-xs text-slate-500">Калории и БЖУ пересчитываются пропорционально порции</p>
              </div>

              <div className="field">
                <label htmlFor="protein">Белки, г</label>
                <input
                  id="protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={protein}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProtein(value);
                    captureBaseline({ protein: value });
                  }}
                />
              </div>

              <div className="field">
                <label htmlFor="fat">Жиры, г</label>
                <input
                  id="fat"
                  type="number"
                  min="0"
                  step="0.1"
                  value={fat}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFat(value);
                    captureBaseline({ fat: value });
                  }}
                />
              </div>

              <div className="field sm:col-span-2">
                <label htmlFor="carbs">Углеводы, г</label>
                <input
                  id="carbs"
                  type="number"
                  min="0"
                  step="0.1"
                  value={carbs}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCarbs(value);
                    captureBaseline({ carbs: value });
                  }}
                />
              </div>
            </div>

            {recognition.alternatives?.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-600">Возможные варианты</p>
                <div className="flex flex-wrap gap-2">
                  {recognition.alternatives.map((item) => {
                    const altName = decodeHtmlEntities(item.dishName);
                    return (
                    <button
                      key={altName}
                      type="button"
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
                      onClick={() => void handleLookup(altName)}
                    >
                      {altName} · {item.calories} ккал
                    </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {lookupMessage ? <p className="text-sm text-teal-700">{lookupMessage}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled={saving || searching} onClick={handleSave}>
            {saving ? "Сохраняем..." : "Да, сохранить"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving || searching} onClick={onCancel}>
            Отменить
          </button>
        </div>
      </div>
    </section>
  );
}
