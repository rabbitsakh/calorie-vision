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
 * Macros gap prefers «Уточнить БЖУ» so Save is not mistaken for a full verify.
 */
export function confirmReviewPrimaryCta(input: {
  enriching: boolean;
  enrichmentTimedOut: boolean;
  needsReview: boolean;
  multi: boolean;
  /** Prefer macros-specific CTA when kcal exist but BJU do not. */
  missingMacros?: boolean;
  missingCalories?: boolean;
}): ConfirmReviewCta | null {
  if (input.enriching) return null;
  if (input.enrichmentTimedOut) {
    return { mode: "force-all", label: "Досчитать", busyLabel: "Считаем…" };
  }
  if (!input.needsReview) return null;
  if (input.missingMacros && !input.missingCalories) {
    return { mode: "lookup-one", label: "Уточнить БЖУ", busyLabel: "Уточняем…" };
  }
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

/**
 * Soft-save path: usable kcal but trust is incomplete (low confidence and/or empty BJU).
 * Missing calories still block save entirely in the card.
 */
export function canSaveAsIs(input: {
  anyLowConfidence: boolean;
  anyMissingCalories: boolean;
  anyMissingMacros?: boolean;
  totalCalories: number;
}): boolean {
  if (input.anyMissingCalories || input.totalCalories <= 0) return false;
  return input.anyLowConfidence || Boolean(input.anyMissingMacros);
}

export function confirmSaveButtonLabel(input: {
  saving: boolean;
  enriching: boolean;
  multi: boolean;
  saveAsIs: boolean;
}): string {
  if (input.saving) return "Сохраняем...";
  // Trust: label the soft path so Save is not mistaken for “verified”.
  if (input.saveAsIs) return "Сохранить как есть";
  if (input.enriching) return "Сохранить";
  if (input.multi) return "Сохранить все";
  return "Сохранить";
}

export function saveAsIsHint(input?: {
  anyMissingMacros?: boolean;
  anyLowConfidence?: boolean;
}): string {
  if (input?.anyMissingMacros && !input.anyLowConfidence) {
    return "БЖУ не заполнены — можно сохранить ккал как есть и уточнить белки/жиры/углеводы позже.";
  }
  if (input?.anyMissingMacros && input.anyLowConfidence) {
    return "Оценка приблизительная, БЖУ пустые — можно сохранить как есть и поправить в дневнике.";
  }
  return "Оценка приблизительная — можно сохранить как есть и поправить порцию позже в дневнике.";
}

/**
 * One skim-visible trust line above sticky CTAs (W1).
 * Keeps D3 skim: does not expand BJU or the details fold.
 */
export function confirmSkimTrustLine(input: {
  enriching: boolean;
  enrichmentTimedOut: boolean;
  needsReview: boolean;
  anyMissingCalories: boolean;
  anyMissingMacros: boolean;
  anyLowConfidence: boolean;
  multi: boolean;
  lowConfidenceCount?: number;
  dishCount?: number;
  lowestConfidencePercent?: string | null;
}): string | null {
  if (input.enriching) return null;
  if (input.enrichmentTimedOut) {
    return "Уточнение не завершилось — проверьте ккал";
  }
  if (!input.needsReview) return null;
  if (input.anyMissingCalories) {
    return "Нет калорий — уточните название или введите ккал";
  }
  if (input.anyMissingMacros) {
    return "Ккал есть, БЖУ неполные — уточните или сохраните как есть";
  }
  if (input.anyLowConfidence && input.multi) {
    const n = input.lowConfidenceCount ?? 0;
    const total = input.dishCount ?? 0;
    return total > 0
      ? `Слабая уверенность · ${n}/${total} — уточните или сохраните как есть`
      : "Слабая уверенность — уточните или сохраните как есть";
  }
  if (input.anyLowConfidence) {
    return input.lowestConfidencePercent
      ? `Слабая уверенность (${input.lowestConfidencePercent}) — уточните или сохраните как есть`
      : "Слабая уверенность — уточните или сохраните как есть";
  }
  return "Проверьте блюдо перед сохранением";
}

/** Format post-save toast with kcal so the diary feels confirmed. */
export function formatSavedMealToast(input: {
  savedCount?: number;
  totalCalories?: number;
  rememberedCorrection?: boolean;
}): string {
  if (input.rememberedCorrection) {
    return "Запомнили исправление — в следующий раз подставим автоматически";
  }
  const kcal =
    input.totalCalories != null && input.totalCalories > 0
      ? Math.round(input.totalCalories)
      : null;
  if (input.savedCount && input.savedCount > 1) {
    return kcal != null
      ? `Сохранено ${input.savedCount} блюд · ${kcal} ккал`
      : `Сохранено ${input.savedCount} блюд`;
  }
  if (kcal != null) return `Сохранено · ${kcal} ккал`;
  return "Сохранено";
}
