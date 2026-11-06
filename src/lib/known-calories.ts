/**
 * Ноль калорий и БЖУ — измерение. Пустое поле, NaN и минус — неизвестно.
 * Не подменять неизвестное числом 200.
 */

/** Конечное число ≥ 0, округлённое до ккал. Иначе null. */
export function knownCalories(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/** Подпись превью распознавания: без выдуманных 200 ккал. */
export function recognitionCalorieLabel(calories: number | null): string {
  if (calories == null || calories <= 0) return "калории не определены";
  return `${calories} ккал`;
}

/**
 * Поле карточки. Пустая строка — неизвестно.
 * «0» — настоящий ноль, его можно сохранить.
 */
export function caloriesFromField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return knownCalories(Number(trimmed.replace(",", ".")));
}

/** Пустая строка → null. «0» остаётся нулём, а не пропадает. */
export function macroFromField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 10) / 10;
}

export function photoConfirmCaloriesError(raw: string): string | null {
  if (caloriesFromField(raw) == null) {
    return "Проверьте название и калорийность каждого блюда";
  }
  return null;
}
