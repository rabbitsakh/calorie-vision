/** Confirm-screen review CTA + pending-draft summary helpers (trust wave). */

export type ConfirmPhotoKind =
  | "meal"
  | "label"
  | "package"
  | "barcode"
  | "sticker"
  | string
  | null
  | undefined;

export function photoKindShortLabel(kind: ConfirmPhotoKind): string | null {
  switch (kind) {
    case "barcode":
      return "штрихкод";
    case "label":
      return "этикетка";
    case "package":
      return "упаковка";
    case "sticker":
      return "стикер";
    case "meal":
      return "фото";
    default:
      return null;
  }
}

export type ConfirmReviewCtaMode = "force-all" | "lookup-one" | "lookup-all";

export type ConfirmReviewCta = {
  mode: ConfirmReviewCtaMode;
  label: string;
  busyLabel: string;
};

/**
 * Single primary action for the trust banner.
 * Multi-dish defaults to refining the weakest dish — not bulk «Уточнить все».
 */
export function confirmReviewPrimaryCta(input: {
  enriching: boolean;
  enrichmentTimedOut: boolean;
  needsReview: boolean;
  multi: boolean;
}): ConfirmReviewCta | null {
  if (input.enriching) return null;
  if (input.enrichmentTimedOut) {
    return { mode: "force-all", label: "Досчитать", busyLabel: "Считаем…" };
  }
  if (!input.needsReview) return null;
  if (input.multi) {
    return { mode: "lookup-one", label: "Уточнить", busyLabel: "Уточняем…" };
  }
  return { mode: "lookup-one", label: "Уточнить по названию", busyLabel: "Уточняем…" };
}

export function formatPendingConfirmHint(input: {
  dishName: string | null;
  calories: number | null;
  photoKind?: ConfirmPhotoKind;
  multiCount?: number;
}): string {
  const parts: string[] = [];
  if (input.multiCount && input.multiCount > 1) {
    parts.push(`${input.multiCount} позиции`);
  } else if (input.dishName) {
    parts.push(`«${input.dishName}»`);
  }
  if (input.calories != null && input.calories > 0) {
    parts.push(`~${Math.round(input.calories)} ккал`);
  }
  const kind = photoKindShortLabel(input.photoKind);
  if (kind) parts.push(kind);
  if (parts.length === 0) {
    return "Черновик на устройстве — продолжите порцию и сохранение.";
  }
  return `${parts.join(" · ")} — продолжите порцию и сохранение.`;
}

/** Index of the dish that most needs review (lowest confidence, else missing kcal/macros). */
export function worstReviewDishIndex(
  dishes: Array<{
    confidence: number;
    calories: number;
    missingCalories: boolean;
    missingMacros?: boolean;
    lowConfidence: boolean;
  }>,
): number {
  if (dishes.length === 0) return 0;
  let worst = -1;
  let worstConf = Number.POSITIVE_INFINITY;
  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i]!;
    if (!d.lowConfidence && !d.missingCalories && !d.missingMacros) continue;
    if (d.lowConfidence && d.confidence < worstConf) {
      worst = i;
      worstConf = d.confidence;
    } else if (worst < 0 && (d.missingCalories || d.missingMacros)) {
      worst = i;
    }
  }
  return worst >= 0 ? worst : 0;
}

/** Low confidence with usable kcal — allow completing the log without forcing lookup. */
export function canSaveAsIs(input: {
  anyLowConfidence: boolean;
  anyMissingCalories: boolean;
  anyMissingMacros?: boolean;
  totalCalories: number;
}): boolean {
  return (
    input.anyLowConfidence &&
    !input.anyMissingCalories &&
    !input.anyMissingMacros &&
    input.totalCalories > 0
  );
}

export function confirmSaveButtonLabel(input: {
  saving: boolean;
  enriching: boolean;
  multi: boolean;
  saveAsIs: boolean;
}): string {
  if (input.saving) return "Сохраняем...";
  if (input.saveAsIs) return "Сохранить";
  if (input.enriching) return "Сохранить";
  if (input.multi) return "Сохранить все";
  return "Сохранить";
}

export function saveAsIsHint(): string {
  return "Оценка приблизительная — можно сохранить как есть и поправить порцию позже в дневнике.";
}
