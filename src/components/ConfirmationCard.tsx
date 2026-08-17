"use client";

import { useEffect, useState } from "react";
import type { RecognitionResponse } from "@/types";
import { getImageUrl, withBasePath } from "@/lib/paths";

type ConfirmationCardProps = {
  result: RecognitionResponse;
  selectedDate: string;
  onCancel: () => void;
  onSaved: () => void;
};

export function ConfirmationCard({
  result,
  selectedDate,
  onCancel,
  onSaved,
}: ConfirmationCardProps) {
  const { recognition, imagePath, previewUrl } = result;
  const [dishName, setDishName] = useState(recognition.dishName);
  const [calories, setCalories] = useState(String(recognition.calories));
  const [protein, setProtein] = useState(String(recognition.protein ?? ""));
  const [fat, setFat] = useState(String(recognition.fat ?? ""));
  const [carbs, setCarbs] = useState(String(recognition.carbs ?? ""));
  const [portionGrams, setPortionGrams] = useState(String(recognition.portionGrams ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setDishName(recognition.dishName);
    setCalories(String(recognition.calories));
    setProtein(String(recognition.protein ?? ""));
    setFat(String(recognition.fat ?? ""));
    setCarbs(String(recognition.carbs ?? ""));
    setPortionGrams(String(recognition.portionGrams ?? ""));
  }, [recognition]);

  const wasCorrected =
    dishName.trim() !== recognition.dishName ||
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
          imagePath,
          wasCorrected,
          originalDish: recognition.dishName,
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

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold">Проверьте распознавание</h2>
          <p className="mt-1 text-sm text-slate-500">
            Всё верно? Подтвердите или исправьте блюдо и калории перед сохранением.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl ?? getImageUrl(imagePath)}
              alt="Загруженная еда"
              className="h-full min-h-52 w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
              Уверенность модели: {Math.round(recognition.confidence * 100)}%
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label htmlFor="dishName">Блюдо</label>
                <input
                  id="dishName"
                  value={dishName}
                  onChange={(event) => setDishName(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="calories">Калории, ккал</label>
                <input
                  id="calories"
                  type="number"
                  min="1"
                  value={calories}
                  onChange={(event) => setCalories(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="portionGrams">Порция, г</label>
                <input
                  id="portionGrams"
                  type="number"
                  min="1"
                  value={portionGrams}
                  onChange={(event) => setPortionGrams(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="protein">Белки, г</label>
                <input
                  id="protein"
                  type="number"
                  min="0"
                  step="0.1"
                  value={protein}
                  onChange={(event) => setProtein(event.target.value)}
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
                  onChange={(event) => setFat(event.target.value)}
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
                  onChange={(event) => setCarbs(event.target.value)}
                />
              </div>
            </div>

            {recognition.alternatives?.length ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-600">Возможные варианты</p>
                <div className="flex flex-wrap gap-2">
                  {recognition.alternatives.map((item) => (
                    <button
                      key={item.dishName}
                      type="button"
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200"
                      onClick={() => {
                        setDishName(item.dishName);
                        setCalories(String(item.calories));
                      }}
                    >
                      {item.dishName} · {item.calories} ккал
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? "Сохраняем..." : "Да, сохранить"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>
            Отменить
          </button>
        </div>
      </div>
    </section>
  );
}
