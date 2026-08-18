export function normalizeDishName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

export function shouldSkipDishName(name: string): boolean {
  const normalized = normalizeDishName(name);
  return normalized.length < 2 || /не удалось распознать/.test(normalized);
}

export function mealNeedsImage(imagePath: string | null | undefined): boolean {
  if (!imagePath || !imagePath.trim()) {
    return true;
  }

  return imagePath.startsWith("http://") || imagePath.startsWith("https://");
}
