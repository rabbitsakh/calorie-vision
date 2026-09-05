export type ConfidenceTone = "high" | "medium" | "low";

export function formatConfidencePercent(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)}%`;
}

/** Three-band confidence for confirm-card badges and review hints. */
export function getConfidenceTone(confidence: number, lowThreshold: number): ConfidenceTone {
  if (confidence >= lowThreshold) {
    return "high";
  }
  if (confidence >= Math.max(0.35, lowThreshold - 0.12)) {
    return "medium";
  }
  return "low";
}

export function confidenceToneClasses(tone: ConfidenceTone): string {
  switch (tone) {
    case "high":
      return "border-emerald-200/80 bg-emerald-50/90 text-emerald-950";
    case "medium":
      return "border-teal-200/80 bg-teal-50/90 text-teal-950";
    case "low":
      return "border-amber-200/80 bg-amber-50/90 text-amber-950";
  }
}

export function confidenceShortLabel(tone: ConfidenceTone): string {
  switch (tone) {
    case "high":
      return "Высокая уверенность";
    case "medium":
      return "Средняя уверенность";
    case "low":
      return "Низкая уверенность";
  }
}

export function confidenceActionHint(
  tone: ConfidenceTone,
  opts?: { photoKind?: string; source?: string },
): string {
  if (opts?.photoKind === "barcode" && opts.source?.includes("openfoodfacts")) {
    return "Данные из базы по штрихкоду";
  }
  if (tone === "high") {
    return "Можно сохранить";
  }
  if (tone === "medium") {
    return "Быстро проверьте порцию";
  }
  return "Уточните название или калории";
}


/** Short "why" line under the confidence badge — shown for medium/low. */
export function confidenceWhyHint(
  tone: ConfidenceTone,
  opts?: { photoKind?: string; source?: string },
): string | null {
  if (opts?.photoKind === "barcode" && opts.source?.includes("openfoodfacts")) {
    return null;
  }
  if (tone === "high") {
    return null;
  }
  if (tone === "medium") {
    if (opts?.photoKind === "package" || opts?.photoKind === "label") {
      return "Упаковка читается неуверенно — сверьте название с этикеткой";
    }
    return "Модель не уверена в порции или названии";
  }
  if (opts?.photoKind === "package" || opts?.photoKind === "label") {
    return "Крупный шрифт на упаковке мог быть прочитан неверно";
  }
  if (opts?.photoKind === "barcode") {
    return "Штрихкод не дал надёжного совпадения в базе";
  }
  return "Фото неоднозначное — название и калории стоит проверить";
}

/** When to reshoot — only for low confidence. */
export function confidenceReshootHint(
  tone: ConfidenceTone,
  opts?: { photoKind?: string },
): string | null {
  if (tone !== "low") {
    return null;
  }
  if (opts?.photoKind === "package" || opts?.photoKind === "label") {
    return "Переснимите упаковку ближе, без бликов, чтобы было видно название";
  }
  if (opts?.photoKind === "barcode") {
    return "Переснимите штрихкод ровнее или введите название вручную";
  }
  return "Переснимите блюдо при хорошем свете, целиком в кадре";
}
