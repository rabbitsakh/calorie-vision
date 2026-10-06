"use client";

import { looksLikeDrinkName } from "@/lib/portion-unit";
import type { FoodRecognitionResult } from "@/lib/food-types";
import {
  confidenceActionHint,
  confidenceReshootHint,
  confidenceShortLabel,
  confidenceToneClasses,
  confidenceWhyHint,
  formatConfidencePercent,
  getConfidenceTone,
} from "@/lib/recognition-confidence-ui";

export function shouldSurfaceNutritionBasis(item: FoodRecognitionResult): boolean {
  const kind = item.photoKind;
  return (
    kind === "label" ||
    kind === "package" ||
    looksLikeDrinkName(item.dishName, item.brand)
  );
}

export function ConfidenceBadge({
  confidence,
  threshold,
  photoKind,
  source,
  dishName,
  nutritionBasis,
  inverted,
}: {
  confidence: number;
  threshold: number;
  photoKind?: string;
  source?: string;
  dishName?: string;
  nutritionBasis?: string | null;
  inverted?: boolean;
}) {
  const tone = getConfidenceTone(confidence, threshold);
  const classes = inverted
    ? "border-white/30 bg-black/35 text-white"
    : confidenceToneClasses(tone);
  const hintOpts = { photoKind, source, dishName };
  const why = confidenceWhyHint(tone, hintOpts);
  const reshoot = confidenceReshootHint(tone, hintOpts);

  return (
    <div className="flex max-w-full flex-col gap-1">
      <span
        className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-snug ${classes}`}
      >
        <span>{formatConfidencePercent(confidence)}</span>
        <span className={inverted ? "text-white/85" : "opacity-80"}>
          · {confidenceShortLabel(tone)} · {confidenceActionHint(tone, hintOpts)}
        </span>
      </span>
      {nutritionBasis ? (
        <p className={`text-xs font-medium leading-snug ${inverted ? "text-teal-100" : "text-teal-800"}`}>
          {nutritionBasis}
        </p>
      ) : null}
      {why ? (
        <p className={`text-xs leading-snug ${inverted ? "text-white/80" : "text-[var(--muted-strong)]"}`}>{why}</p>
      ) : null}
      {reshoot ? (
        <p className={`text-xs font-medium leading-snug ${inverted ? "text-amber-100" : "text-amber-800"}`}>
          {reshoot}
        </p>
      ) : null}
    </div>
  );
}
