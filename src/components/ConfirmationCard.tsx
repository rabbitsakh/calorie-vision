"use client";

import { useEffect, useRef, useState } from "react";
import { formatMacro, nutritionBaseline, scaleNutritionByPortion, type NutritionValues } from "@/lib/nutrition";
import type { RecognitionResponse } from "@/types";
import { MEAL_TYPE_LABELS } from "@/types";
import { inferMealTypeFromHour } from "@/lib/meal-type";
import { dateKeyAndTimeToIso, toTimeInputValue } from "@/lib/dates";
import { getImageUrl, withBasePath } from "@/lib/paths";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { looksLikeDrinkName } from "@/lib/portion-unit";
import { getRecognitionLowConfidenceThreshold } from "@/lib/ai/recognition-thresholds";
import {
  draftFromRecognition,
  draftsFromRecognition,
  mergeDishesFromRecognition,
  type ConfirmDishDraft,
} from "@/lib/confirm-dish-merge";
import { resolveConfirmHeroSrc } from "@/lib/confirm-hero";
import {
  confidenceActionHint,
  confidenceReshootHint,
  confidenceShortLabel,
  confidenceToneClasses,
  confidenceWhyHint,
  formatConfidencePercent,
  getConfidenceTone,
  photoContextChipLabel,
  suggestedPhotoContextChips,
  type PhotoContextChip,
} from "@/lib/recognition-confidence-ui";
import {
  applyAlternativeToPortion,
  applyFoodLookupToPortion,
  nutritionBaselineFromRecognition,
  recognitionNeedsPortionRescale,
  resolvePer100gForScaling,
  describeNutritionBasis,
  isMissingCaloriesForReview,
  isMissingMacrosForReview,
  scaleRecognitionToPortion,
  scaleRecognitionToDisplayPortion,
} from "@/lib/recognition-nutrition";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import {
  trackFirstMealSaveGoal,
  trackMealSavedGoal,
  trackFirstConfirmSaveGoal,
  trackConfirmSaveAsIsGoal,
  trackConfirmLookupGoal,
} from "@/lib/metrika-funnel";
import {
  canSaveAsIs,
  confirmReviewPrimaryCta,
  confirmSaveButtonLabel,
  confirmSkimTrustLine,
  saveAsIsHint,
  worstReviewDishIndex,
} from "@/lib/confirm-review-cta";
import {
  clearPendingConfirmDraft,
  enqueueFailedSave,
  upsertPendingConfirmDraft,
  type PendingConfirmDishUi,
  type PendingConfirmUi,
} from "@/lib/meal-draft-queue";
import type { SaveMealInput } from "@/lib/save-meal";
import { Chip } from "@/components/Chip";
import { DishFields } from "@/components/ConfirmDishFields";
import { isLikelyIos } from "@/lib/push-client";
import {
  allergenLabel,
  matchAllergensInText,
  parseAllergensJson,
  type AllergenId,
} from "@/lib/allergens";
import { wasRecognitionCorrected } from "@/lib/confirm-correction";

type NutritionFields = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
  source?: string;
};

type DishDraft = ConfirmDishDraft;

type ConfirmationCardProps = {
  result: RecognitionResponse;
  selectedDate: string;
  timezone?: string | null;
  /** Prefill from push deep link (`?meal=BREAKFAST`). */
  initialMealType?: string;
  /** Restored confirm edits from pending-confirm draft (1.11.1). */
  initialUi?: PendingConfirmUi | null;
  onCancel: () => void;
  onSaved: (meta?: {
    rememberedCorrection?: boolean;
    savedCount?: number;
    totalCalories?: number;
  }) => void;
  /** Fired when a save was queued offline after a network/API failure (#40). */
  onSaveQueued?: () => void;
  /** Low-confidence re-pass: parent sets photo context and opens camera. */
  onRerunWithContext?: (context: PhotoContextChip) => void;
};


function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serializeDishUi(dish: DishDraft): PendingConfirmDishUi {
  return {
    id: dish.id,
    dishName: dish.dishName,
    calories: dish.calories,
    protein: dish.protein,
    fat: dish.fat,
    carbs: dish.carbs,
    fiber: dish.fiber,
    sugar: dish.sugar,
    portionGrams: dish.portionGrams,
    baseline: dish.baseline,
  };
}

function applyUiToDishes(dishes: DishDraft[], ui?: PendingConfirmUi | null): DishDraft[] {
  if (!ui?.dishes?.length) return dishes;
  const byId = new Map(ui.dishes.map((item) => [item.id, item]));
  return dishes.map((dish, index) => {
    const saved = byId.get(dish.id) ?? ui.dishes![index];
    if (!saved) return dish;
    return {
      ...dish,
      dishName: saved.dishName,
      calories: saved.calories,
      protein: saved.protein,
      fat: saved.fat,
      carbs: saved.carbs,
      fiber: saved.fiber,
      sugar: saved.sugar,
      portionGrams: saved.portionGrams,
      baseline: saved.baseline ?? dish.baseline,
    };
  });
}

function resolveInitialMealType(
  initialMealType: string | undefined,
  ui: PendingConfirmUi | null | undefined,
): string {
  if (ui?.mealType && ui.mealType in MEAL_TYPE_LABELS) {
    return ui.mealType;
  }
  if (initialMealType && initialMealType in MEAL_TYPE_LABELS) {
    return initialMealType;
  }
  return inferMealTypeFromHour(new Date().getHours());
}

function dishFormDisabled(saving: boolean, searchingId: string | null): boolean {
  return saving || searchingId === "all";
}

function dishLookupDisabled(
  dishId: string,
  saving: boolean,
  searchingId: string | null,
  enriching: boolean,
): boolean {
  if (saving) return true;
  if (enriching) return false;
  if (searchingId === "all") return true;
  if (searchingId !== null && searchingId !== dishId) return false;
  return searchingId === dishId;
}

const DEFAULT_LOW_CONFIDENCE = getRecognitionLowConfidenceThreshold();

function dishNeedsReview(
  dish: DishDraft,
  lowConfidenceThreshold: number,
): { lowConfidence: boolean; missingCalories: boolean; missingMacros: boolean } {
  return {
    lowConfidence: dish.original.confidence < lowConfidenceThreshold,
    missingCalories: isMissingCaloriesForReview(
      Number(dish.calories),
      dish.original.per100g,
    ),
    missingMacros: isMissingMacrosForReview({
      dishName: dish.dishName,
      brand: dish.original.brand,
      calories: Number(dish.calories),
      protein: Number(dish.protein) || 0,
      fat: Number(dish.fat) || 0,
      carbs: Number(dish.carbs) || 0,
    }),
  };
}

function shouldSurfaceNutritionBasis(item: FoodRecognitionResult): boolean {
  const kind = item.photoKind;
  return (
    kind === "label" ||
    kind === "package" ||
    looksLikeDrinkName(item.dishName, item.brand)
  );
}

function ConfidenceBadge({
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
        <p className={`text-xs leading-snug ${inverted ? "text-white/80" : "text-slate-600"}`}>{why}</p>
      ) : null}
      {reshoot ? (
        <p className={`text-xs font-medium leading-snug ${inverted ? "text-amber-100" : "text-amber-800"}`}>
          {reshoot}
        </p>
      ) : null}
    </div>
  );
}


export function ConfirmationCard({
  result,
  selectedDate,
  timezone,
  initialMealType = "",
  initialUi = null,
  onCancel,
  onSaved,
  onSaveQueued,
  onRerunWithContext,
}: ConfirmationCardProps) {
  const { recognition, imagePath: initialImagePath, previewUrl, enriching = false } = result;
  const [dishes, setDishes] = useState<DishDraft[]>(() =>
    applyUiToDishes(draftsFromRecognition(recognition), initialUi),
  );
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [mealType, setMealType] = useState<string>(() =>
    resolveInitialMealType(initialMealType, initialUi),
  );
  const [eatenTime, setEatenTime] = useState(
    () => initialUi?.eatenTime || toTimeInputValue(new Date(), timezone),
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heroSrc, setHeroSrc] = useState(() => resolveConfirmHeroSrc(initialImagePath, previewUrl));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [activeDish, setActiveDish] = useState(() => {
    if (typeof initialUi?.activeDish === "number" && initialUi.activeDish >= 0) {
      return initialUi.activeDish;
    }
    // Multi-dish: open on the weakest item so «Уточнить» matches what the user sees.
    const initialDishes = applyUiToDishes(draftsFromRecognition(recognition), initialUi);
    if (initialDishes.length > 1) {
      return worstReviewDishIndex(
        initialDishes.map((dish) => {
          const review = dishNeedsReview(dish, DEFAULT_LOW_CONFIDENCE);
          return {
            confidence: dish.original.confidence,
            calories: Number(dish.calories) || 0,
            ...review,
          };
        }),
      );
    }
    return 0;
  });
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(DEFAULT_LOW_CONFIDENCE);
  const [userAllergens, setUserAllergens] = useState<AllergenId[]>([]);
  const [allergenAck, setAllergenAck] = useState(() => Boolean(initialUi?.allergenAck));
  const lookupAbortRef = useRef<AbortController | null>(null);
  const dishesListTouchedRef = useRef(false);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const heroFallbackTriedRef = useRef(false);
  const allergenBlockRef = useRef<HTMLDivElement>(null);
  const skipUiPersistRef = useRef(true);
  /** Once save/cancel starts, never write pending-confirm again (avoids post-save draft ghost). */
  const persistClosedRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const isIos = typeof navigator !== "undefined" && isLikelyIos();

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/recognition/settings"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { lowConfidenceThreshold?: number };
        if (Number.isFinite(data.lowConfidenceThreshold) && data.lowConfidenceThreshold! > 0) {
          setLowConfidenceThreshold(data.lowConfidenceThreshold!);
        }
      } catch {
        // keep env/default fallback
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { allergens?: unknown };
        setUserAllergens(parseAllergensJson(data.allergens));
      } catch {
        // soft hint only — ignore load failures
      }
    })();
  }, []);

  useEffect(() => {
    dishesListTouchedRef.current = false;
  }, [initialImagePath, previewUrl]);

  useEffect(() => {
    setDishes((current) =>
      mergeDishesFromRecognition(current, recognition, {
        preserveListLength: dishesListTouchedRef.current,
      }),
    );
  }, [recognition]);

  // Persist confirm edits into pending-confirm so reload / PWA kill keeps them (1.11.1).
  useEffect(() => {
    if (skipUiPersistRef.current) {
      skipUiPersistRef.current = false;
      return;
    }
    if (persistClosedRef.current || savingRef.current) return;
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      if (persistClosedRef.current || savingRef.current) return;
      const ui: PendingConfirmUi = {
        mealType,
        eatenTime,
        allergenAck,
        activeDish,
        dishes: dishes.map(serializeDishUi),
      };
      upsertPendingConfirmDraft(selectedDate, result, { ui });
    }, 300);
    return () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [allergenAck, activeDish, dishes, eatenTime, mealType, result, selectedDate]);

  function stopPersistingDraft(opts?: { clearDraft?: boolean }) {
    persistClosedRef.current = true;
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (opts?.clearDraft) {
      // Clear here (not only in parent) so a late timer / remount cannot resurrect the banner.
      clearPendingConfirmDraft(selectedDate);
    }
  }

  useEffect(() => {
    setImagePath(initialImagePath);
  }, [initialImagePath]);

  useEffect(() => {
    heroFallbackTriedRef.current = false;
    setHeroSrc(resolveConfirmHeroSrc(imagePath, previewUrl));
    setImageLoaded(false);
  }, [imagePath, previewUrl]);

  useEffect(() => {
    const img = heroImgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, [heroSrc]);

  function handleHeroLoad() {
    setImageLoaded(true);
  }

  function handleHeroError() {
    // Always prefer the persisted upload URL when available.
    if (!heroFallbackTriedRef.current && imagePath.trim() && heroSrc !== getImageUrl(imagePath)) {
      heroFallbackTriedRef.current = true;
      setHeroSrc(getImageUrl(imagePath));
      setImageLoaded(false);
      return;
    }
    // On iOS never fall back to blob — it often fails permanently in PWA.
    if (
      !isIos &&
      !heroFallbackTriedRef.current &&
      previewUrl?.startsWith("blob:") &&
      heroSrc !== previewUrl
    ) {
      heroFallbackTriedRef.current = true;
      setHeroSrc(previewUrl);
      setImageLoaded(false);
      return;
    }
    setImageLoaded(true);
  }

  function updateDish(id: string, patch: Partial<DishDraft>) {
    setDishes((current) => current.map((dish) => (dish.id === id ? { ...dish, ...patch } : dish)));
  }

  function captureBaseline(dish: DishDraft, next: Partial<DishDraft>): NutritionValues | null {
    if (resolvePer100gForScaling(dish.original)) {
      const nextCalories =
        next.calories !== undefined ? Number(next.calories) : Number(dish.calories);
      if (
        next.calories === undefined ||
        recognitionNeedsPortionRescale(dish.original, nextCalories)
      ) {
        return nutritionBaselineFromRecognition(dish.original);
      }
    }

    return nutritionBaseline({
      calories: Number(next.calories ?? dish.calories),
      protein: parseOptionalNumber(next.protein ?? dish.protein),
      fat: parseOptionalNumber(next.fat ?? dish.fat),
      carbs: parseOptionalNumber(next.carbs ?? dish.carbs),
      fiber: parseOptionalNumber(next.fiber ?? dish.fiber),
      sugar: parseOptionalNumber(next.sugar ?? dish.sugar),
      portionGrams: Number(next.portionGrams ?? dish.portionGrams),
    });
  }

  function resolvePortionBaseline(dish: DishDraft, nextPortionGrams?: number): NutritionValues | null {
    if (resolvePer100gForScaling(dish.original)) {
      return nutritionBaselineFromRecognition(dish.original);
    }

    if (dish.baseline) {
      return dish.baseline;
    }
    return nutritionBaselineFromRecognition({
      calories: Number(dish.calories) || dish.original.calories,
      protein: parseOptionalNumber(dish.protein) ?? dish.original.protein,
      fat: parseOptionalNumber(dish.fat) ?? dish.original.fat,
      carbs: parseOptionalNumber(dish.carbs) ?? dish.original.carbs,
      fiber: parseOptionalNumber(dish.fiber) ?? dish.original.fiber,
      sugar: parseOptionalNumber(dish.sugar) ?? dish.original.sugar,
      portionGrams:
        nextPortionGrams ??
        (Number(dish.portionGrams) > 0 ? Number(dish.portionGrams) : dish.original.portionGrams),
      per100g: dish.original.per100g,
      photoKind: dish.original.photoKind,
      source: dish.original.source,
    });
  }

  function handlePortionChange(dish: DishDraft, value: string) {
    const grams = Number(value);
    const base =
      resolvePortionBaseline(dish, Number.isFinite(grams) && grams > 0 ? grams : undefined) ??
      dish.baseline;

    let scaled: ReturnType<typeof scaleRecognitionToPortion> | ReturnType<typeof scaleNutritionByPortion> = null;
    if (Number.isFinite(grams) && grams > 0) {
      if (resolvePer100gForScaling(dish.original)) {
        scaled = scaleRecognitionToDisplayPortion(dish.original, grams);
      } else if (base) {
        scaled = scaleNutritionByPortion(base, grams);
      }
    }

    updateDish(dish.id, {
      portionGrams: value,
      baseline: base ?? dish.baseline,
      calories: scaled ? String(scaled.calories) : dish.calories,
      protein: scaled?.protein !== undefined ? formatMacro(scaled.protein) : dish.protein,
      fat: scaled?.fat !== undefined ? formatMacro(scaled.fat) : dish.fat,
      carbs: scaled?.carbs !== undefined ? formatMacro(scaled.carbs) : dish.carbs,
      fiber: scaled?.fiber !== undefined ? formatMacro(scaled.fiber) : dish.fiber,
      sugar: scaled?.sugar !== undefined ? formatMacro(scaled.sugar) : dish.sugar,
    });
  }

  async function handleLookup(dish: DishDraft, nameOverride?: string, signal?: AbortSignal) {
    const query = (nameOverride ?? dish.dishName).trim();
    if (!query) {
      setError("Введите название блюда для поиска");
      return;
    }

    setSearchingId(signal ? "all" : dish.id);
    setError(null);
    setLookupMessage(signal ? "Подбираем БЖУ для всех позиций…" : "Подбираем БЖУ…");

    try {
      const response = await fetch(withBasePath("/api/food/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: query }),
        signal,
      });

      const data = await readApiJson<{
        recognition?: NutritionFields;
        imagePath?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось найти блюдо");
      }

      if (!data.recognition) {
        throw new Error("Пустой ответ от сервера");
      }

      const next = data.recognition;
      const targetPortion =
        Number(dish.portionGrams) > 0
          ? Number(dish.portionGrams)
          : next.portionGrams && next.portionGrams > 0
            ? next.portionGrams
            : Number(dish.original.portionGrams) || 100;

      const merged = applyFoodLookupToPortion(dish.original, next, targetPortion);

      const patch: Partial<DishDraft> = {
        dishName: decodeHtmlEntities(merged.dishName),
        calories: String(merged.calories),
        protein: merged.protein !== undefined ? formatMacro(merged.protein) : "",
        fat: merged.fat !== undefined ? formatMacro(merged.fat) : "",
        carbs: merged.carbs !== undefined ? formatMacro(merged.carbs) : "",
        fiber: merged.fiber !== undefined ? formatMacro(merged.fiber) : "",
        sugar: merged.sugar !== undefined ? formatMacro(merged.sugar) : "",
        portionGrams: String(merged.portionGrams),
        baseline: nutritionBaselineFromRecognition({
          ...dish.original,
          ...merged,
          photoKind: dish.original.photoKind,
          source: next.source ?? dish.original.source,
        }),
      };
      setDishes((current) => {
        const nextDishes = current.map((item) =>
          item.id === dish.id ? { ...item, ...patch } : item,
        );
        // Multi-dish: after Уточнить, jump to the next weak item.
        if (!signal && nextDishes.length > 1) {
          const nextIdx = worstReviewDishIndex(
            nextDishes.map((d) => {
              const flag = dishNeedsReview(d, lowConfidenceThreshold);
              return {
                confidence: d.original.confidence,
                calories: Number(d.calories) || 0,
                missingCalories: flag.missingCalories,
                missingMacros: flag.missingMacros,
                lowConfidence: flag.lowConfidence,
              };
            }),
          );
          const stillNeeds = dishNeedsReview(nextDishes[nextIdx]!, lowConfidenceThreshold);
          if (
            stillNeeds.lowConfidence ||
            stillNeeds.missingCalories ||
            stillNeeds.missingMacros
          ) {
            queueMicrotask(() => setActiveDish(nextIdx));
          }
        }
        return nextDishes;
      });
      if (!previewUrl && data.imagePath && (dishes.length === 1 || !imagePath.trim())) {
        setImagePath(data.imagePath);
      }
      const sourceLabel = next.source ? RECOGNITION_SOURCE_LABELS[next.source] : undefined;
      setLookupMessage(sourceLabel ?? "Калорийность и БЖУ обновлены по названию блюда");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      setError(humanizeClientFetchError(err, "Ошибка поиска"));
    } finally {
      if (!signal) {
        setSearchingId(null);
      }
    }
  }

  async function runLookupPool(targets: DishDraft[], concurrency = 3) {
    const controller = new AbortController();
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = controller;
    let index = 0;
    let completed = 0;
    const total = targets.length;
    setLookupMessage(`Уточняем БЖУ: 0/${total}…`);

    async function worker() {
      while (index < targets.length) {
        if (controller.signal.aborted) {
          return;
        }
        const current = targets[index]!;
        index += 1;
        await handleLookup(current, undefined, controller.signal);
        completed += 1;
        if (!controller.signal.aborted) {
          setLookupMessage(`Уточняем БЖУ: ${completed}/${total}…`);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
    if (!controller.signal.aborted) {
      setLookupMessage(`Готово: уточнено ${completed} из ${total}`);
    }
  }

  async function buildSavePayload(dish: DishDraft, mealGroupId?: string) {
    const parsedCalories = Number(dish.calories);
    if (!dish.dishName.trim() || !Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      throw new Error("Проверьте название и калорийность каждого блюда");
    }

    const parsedProtein = parseOptionalNumber(dish.protein);
    const parsedFat = parseOptionalNumber(dish.fat);
    const parsedCarbs = parseOptionalNumber(dish.carbs);
    const parsedFiber = parseOptionalNumber(dish.fiber);
    const parsedSugar = parseOptionalNumber(dish.sugar);
    const parsedPortion = parseOptionalNumber(dish.portionGrams);

    const wasCorrected = wasRecognitionCorrected(
      {
        dishName: dish.dishName,
        calories: parsedCalories,
        protein: parsedProtein,
        fat: parsedFat,
        carbs: parsedCarbs,
        fiber: parsedFiber,
        sugar: parsedSugar,
        portionGrams: parsedPortion,
      },
      dish.original,
    );

    const eatenAt = dateKeyAndTimeToIso(selectedDate, eatenTime, timezone);
    if (!eatenAt) {
      throw new Error("Укажите корректное время приёма");
    }

    return {
      date: selectedDate,
      dishName: dish.dishName.trim(),
      calories: parsedCalories,
      protein: parsedProtein,
      fat: parsedFat,
      carbs: parsedCarbs,
      fiber: parsedFiber,
      sugar: parsedSugar,
      portionGrams: dish.portionGrams ? Number(dish.portionGrams) : undefined,
      confidence: dish.original.confidence,
      imagePath: imagePath || undefined,
      mealGroupId,
      mealType: mealType || undefined,
      eatenAt,
      wasCorrected,
      originalDish: decodeHtmlEntities(dish.original.dishName),
      originalCalories: dish.original.calories,
      originalProtein:
        dish.original.protein !== undefined ? Number(dish.original.protein) : undefined,
      originalFat: dish.original.fat !== undefined ? Number(dish.original.fat) : undefined,
      originalCarbs: dish.original.carbs !== undefined ? Number(dish.original.carbs) : undefined,
      originalFiber: dish.original.fiber !== undefined ? Number(dish.original.fiber) : undefined,
      originalSugar: dish.original.sugar !== undefined ? Number(dish.original.sugar) : undefined,
      recognitionSource: dish.original.source,
      photoKind: dish.original.photoKind,
      barcode: dish.original.barcode,
    };
  }

  async function handleLookupAll(opts?: { forceAll?: boolean }) {
    const forceAll = Boolean(opts?.forceAll);
    const targets = forceAll
      ? dishes.filter((dish) => dish.dishName.trim().length > 0)
      : dishes.filter((dish) => {
          const review = dishNeedsReview(dish, lowConfidenceThreshold);
          return review.lowConfidence || review.missingCalories || review.missingMacros;
        });
    if (targets.length === 0) {
      setLookupMessage(
        forceAll
          ? "Нет позиций для уточнения — укажите название"
          : "Все позиции уже выглядят достаточно точными",
      );
      return;
    }

    setSearchingId("all");
    setError(null);
    setLookupMessage(null);

    try {
      await runLookupPool(targets, 3);
      if (!lookupAbortRef.current?.signal.aborted) {
        setLookupMessage(`Уточнено ${targets.length} из ${dishes.length}`);
      }
    } finally {
      setSearchingId(null);
    }
  }

  async function handleSave() {
    if (savingRef.current) return;
    const hits = Array.from(
      new Set(
        dishes.flatMap((dish) => {
          const brand = dish.original.brand?.trim();
          const text = brand ? `${dish.dishName} ${brand}` : dish.dishName;
          return matchAllergensInText(text, userAllergens);
        }),
      ),
    );
    if (hits.length > 0 && !allergenAck) {
      setError("Сначала подтвердите проверку аллергенов — чекбокс выше.");
      const allergenDishIndex = dishes.findIndex((dish) => {
        const brand = dish.original.brand?.trim();
        const text = brand ? `${dish.dishName} ${brand}` : dish.dishName;
        return matchAllergensInText(text, userAllergens).length > 0;
      });
      if (allergenDishIndex >= 0 && dishes.length > 1) {
        setActiveDish(allergenDishIndex);
      }
      window.requestAnimationFrame(() => {
        allergenBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        const allergenChip =
          allergenDishIndex >= 0
            ? document.querySelector<HTMLButtonElement>(
                `[data-allergen-dish="${allergenDishIndex}"]`,
              )
            : null;
        if (allergenChip) {
          allergenChip.focus();
          return;
        }
        const checkbox = allergenBlockRef.current?.querySelector("input[type='checkbox']");
        if (checkbox instanceof HTMLInputElement) {
          checkbox.focus();
        }
      });
      return;
    }
    savingRef.current = true;
    // Block draft writes for the whole attempt — success/queue clear; soft failure reopens.
    persistClosedRef.current = true;
    setSaving(true);
    setError(null);
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    let queuedBody: SaveMealInput | { entries: SaveMealInput[] } | null = null;

    try {
      const mealGroupId = dishes.length > 1 ? crypto.randomUUID() : undefined;
      const payloads = await Promise.all(
        dishes.map((dish) => buildSavePayload(dish, mealGroupId)),
      );
      const rememberedCorrection = payloads.some((payload) => payload.wasCorrected);
      queuedBody = dishes.length > 1 ? { entries: payloads } : payloads[0]!;
      const saveFlags = dishes.map((dish) => dishNeedsReview(dish, lowConfidenceThreshold));
      const saveTotalCalories = payloads.reduce((sum, p) => sum + (Number(p.calories) || 0), 0);
      const softSave = canSaveAsIs({
        anyLowConfidence: saveFlags.some((flag) => flag.lowConfidence),
        anyMissingCalories: saveFlags.some((flag) => flag.missingCalories),
        anyMissingMacros: saveFlags.some((flag) => flag.missingMacros),
        totalCalories: saveTotalCalories,
      });

      if (dishes.length > 1) {
        const response = await fetch(withBasePath("/api/meals"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: payloads }),
        });
        const data = await readApiJson<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(data.error ?? "Ошибка сохранения");
        }
        trackFirstMealSaveGoal();
        trackMealSavedGoal();
        trackFirstConfirmSaveGoal();
        if (softSave) trackConfirmSaveAsIsGoal();
        stopPersistingDraft({ clearDraft: true });
        onSaved({
          rememberedCorrection,
          savedCount: dishes.length,
          totalCalories: saveTotalCalories,
        });
        return;
      }

      const response = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads[0]!),
      });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Ошибка сохранения");
      }

      trackFirstMealSaveGoal();
      trackMealSavedGoal();
      trackFirstConfirmSaveGoal();
      if (softSave) trackConfirmSaveAsIsGoal();
      stopPersistingDraft({ clearDraft: true });
      onSaved({
        rememberedCorrection,
        savedCount: 1,
        totalCalories: Number(payloads[0]!.calories) || 0,
      });
    } catch (err) {
      if (queuedBody) {
        // Offline queue owns the meal; drop pending-confirm so the next «+» is clean.
        stopPersistingDraft({ clearDraft: true });
        enqueueFailedSave(selectedDate, queuedBody);
        onSaveQueued?.();
        setError(
          err instanceof Error
            ? `${err.message}. Сохранение в очереди — отправим, когда сеть появится.`
            : "Не удалось сохранить. Сохранение в очереди на устройстве.",
        );
      } else {
        // Soft failure — keep crash-recovery draft and allow further edits.
        persistClosedRef.current = false;
        setError(err instanceof Error ? err.message : "Не удалось сохранить");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const hasImage = Boolean(heroSrc);
  const multi = dishes.length > 1;
  const totalCalories = dishes.reduce((sum, dish) => sum + (Number(dish.calories) || 0), 0);
  const bulkLookupRunning = searchingId === "all";
  const formDisabled = dishFormDisabled(saving, searchingId);
  const searching = searchingId !== null;
  const reviewFlags = dishes.map((dish) => dishNeedsReview(dish, lowConfidenceThreshold));
  const anyMissingCalories = reviewFlags.some((flag) => flag.missingCalories);
  const anyMissingMacros = reviewFlags.some((flag) => flag.missingMacros);
  const anyLowConfidence = reviewFlags.some((flag) => flag.lowConfidence);
  const needsReview = anyMissingCalories || anyMissingMacros || anyLowConfidence;
  const lowConfidenceDishes = dishes.filter(
    (dish) => dishNeedsReview(dish, lowConfidenceThreshold).lowConfidence,
  );
  const lowestConfidenceDish =
    lowConfidenceDishes.length > 0
      ? lowConfidenceDishes.reduce((worst, dish) =>
          dish.original.confidence < worst.original.confidence ? dish : worst,
        )
      : null;
  const reviewTargetDish = (() => {
    if (!needsReview || dishes.length === 0) return null;
    const active = dishes[Math.min(activeDish, dishes.length - 1)];
    if (active) {
      const flag = dishNeedsReview(active, lowConfidenceThreshold);
      if (flag.lowConfidence || flag.missingCalories || flag.missingMacros) return active;
    }
    const worstIdx = worstReviewDishIndex(
      dishes.map((dish, i) => ({
        confidence: dish.original.confidence,
        calories: Number(dish.calories) || 0,
        missingCalories: reviewFlags[i]!.missingCalories,
        missingMacros: reviewFlags[i]!.missingMacros,
        lowConfidence: reviewFlags[i]!.lowConfidence,
      })),
    );
    return dishes[worstIdx] ?? lowestConfidenceDish;
  })();
  const reviewCta = confirmReviewPrimaryCta({
    enriching,
    enrichmentTimedOut: Boolean(recognition.enrichmentTimedOut),
    needsReview,
    multi,
    missingMacros: anyMissingMacros,
    missingCalories: anyMissingCalories,
  });
  const saveAsIs = canSaveAsIs({
    anyLowConfidence,
    anyMissingCalories,
    anyMissingMacros,
    totalCalories,
  });
  const saveLabel = confirmSaveButtonLabel({
    saving,
    enriching,
    multi,
    saveAsIs,
  });
  const softSaveHint = saveAsIsHint({
    anyMissingMacros,
    anyLowConfidence,
  });
  const skimTrustLine = confirmSkimTrustLine({
    enriching,
    enrichmentTimedOut: Boolean(recognition.enrichmentTimedOut),
    needsReview,
    anyMissingCalories,
    anyMissingMacros,
    anyLowConfidence,
    multi,
    lowConfidenceCount: lowConfidenceDishes.length,
    dishCount: dishes.length,
    lowestConfidencePercent: lowestConfidenceDish
      ? formatConfidencePercent(lowestConfidenceDish.original.confidence)
      : null,
  });
  const skimTone =
    !multi && dishes[0]
      ? getConfidenceTone(dishes[0].original.confidence, lowConfidenceThreshold)
      : anyLowConfidence
        ? "low"
        : "high";
  const allergenHits = Array.from(
    new Set(
      dishes.flatMap((dish) => {
        const brand = dish.original.brand?.trim();
        const text = brand ? `${dish.dishName} ${brand}` : dish.dishName;
        return matchAllergensInText(text, userAllergens);
      }),
    ),
  );
  return (
    <section id="food-add-panel" className="confirm-card-section card overflow-hidden p-0 md:p-6">
      <div className="flex flex-col gap-5 p-4 md:p-0">
        {hasImage ? (
          <div className="confirm-hero -mx-4 -mt-4 md:mx-0 md:mt-0 md:rounded-2xl">
            {!imageLoaded ? (
              <div className="absolute inset-0 min-h-36 animate-pulse bg-slate-200" aria-hidden />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={heroImgRef}
              src={heroSrc}
              alt={dishes.map((dish) => dish.dishName).join(", ") || "Фото блюда"}
              onLoad={handleHeroLoad}
              onError={handleHeroError}
              className={imageLoaded ? "" : "opacity-0"}
            />
            <div className="confirm-hero-overlay">
              <h2 className="font-display text-lg font-bold">Проверьте и сохраните</h2>
              <p className="mt-0.5 text-sm text-white/85">
                {multi
                  ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
                  : dishes[0]?.dishName || "Порция и калории"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-xl font-bold">Проверьте и сохраните</h2>
            <p className="mt-1 text-sm text-slate-500">
              {multi
                ? "Несколько блюд — поправьте порции и сохраните."
                : "Порция и калории — сохраните. БЖУ при необходимости ниже."}
            </p>
          </div>
        )}

        {multi ? (
          <div className="chip-row" role="tablist" aria-label="Позиции на фото">
            {dishes.map((dish, index) => {
              const brand = dish.original.brand?.trim();
              const text = brand ? `${dish.dishName} ${brand}` : dish.dishName;
              const dishAllergenHits = matchAllergensInText(text, userAllergens);
              const hasAllergen = dishAllergenHits.length > 0;
              return (
                <Chip
                  key={dish.id}
                  active={index === activeDish}
                  data-allergen-dish={hasAllergen ? String(index) : undefined}
                  title={
                    hasAllergen
                      ? `Возможен аллерген: ${dishAllergenHits.map((id) => allergenLabel(id)).join(", ")}`
                      : reviewFlags[index]?.missingMacros
                        ? "Есть ккал, нет БЖУ — откройте и нажмите «Уточнить»"
                        : reviewFlags[index]?.lowConfidence
                          ? "Слабая уверенность — откройте и нажмите «Уточнить»"
                          : undefined
                  }
                  onClick={() => setActiveDish(index)}
                >
                  {index + 1}. {dish.dishName || "Блюдо"}
                  {Number(dish.calories) > 0 ? ` · ${Math.round(Number(dish.calories))}` : ""}
                  {hasAllergen ? " ⚠" : ""}
                  {reviewFlags[index]?.missingMacros
                    ? " · БЖУ?"
                    : reviewFlags[index]?.lowConfidence
                      ? " · ?"
                      : ""}
                </Chip>
              );
            })}
          </div>
        ) : null}

        {/* Soft status only while enriching — keeps skim free of trust wall. */}
        {enriching ? (
          <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950">
            {totalCalories > 0
              ? `${totalCalories} ккал — можно сохранить`
              : "Уточняем по базе — можно сохранить"}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {(multi ? dishes.filter((_, index) => index === Math.min(activeDish, dishes.length - 1)) : dishes).map(
            (dish) => {
              const index = dishes.findIndex((item) => item.id === dish.id);
              return (
                <DishFields
                  key={dish.id}
                  dish={dish}
                  index={index}
                  multi={multi}
                  searching={searchingId === dish.id}
                  lookupDisabled={dishLookupDisabled(dish.id, saving, searchingId, enriching)}
                  formDisabled={formDisabled}
                  canRemove={multi}
                  review={reviewFlags[index]!}
                  hideInlineLookupCta={Boolean(reviewCta)}
                  onChange={(patch) => updateDish(dish.id, patch)}
                  onBaselineChange={(patch) =>
                    updateDish(dish.id, { ...patch, baseline: captureBaseline(dish, patch) })
                  }
                  onPortionChange={(value) => handlePortionChange(dish, value)}
                  onLookup={(name) => void handleLookup(dish, name)}
                  onApplyAlternative={(alt) => {
                    const targetPortion =
                      Number(dish.portionGrams) > 0
                        ? Number(dish.portionGrams)
                        : Number(dish.original.portionGrams) || 100;

                    const merged = applyAlternativeToPortion(dish.original, alt, targetPortion);

                    updateDish(dish.id, {
                      dishName: decodeHtmlEntities(merged.dishName),
                      calories: String(merged.calories),
                      protein: merged.protein !== undefined ? formatMacro(merged.protein) : "",
                      fat: merged.fat !== undefined ? formatMacro(merged.fat) : "",
                      carbs: merged.carbs !== undefined ? formatMacro(merged.carbs) : "",
                      fiber: merged.fiber !== undefined ? formatMacro(merged.fiber) : "",
                      sugar: merged.sugar !== undefined ? formatMacro(merged.sugar) : "",
                      portionGrams: String(merged.portionGrams),
                      baseline: nutritionBaselineFromRecognition({
                        ...dish.original,
                        ...merged,
                      }),
                    });
                    setLookupMessage("Вариант применён");
                  }}
                  onRemove={() => {
                    dishesListTouchedRef.current = true;
                    setDishes((current) => current.filter((item) => item.id !== dish.id));
                    setActiveDish((value) => Math.max(0, Math.min(value, dishes.length - 2)));
                  }}
                />
              );
            },
          )}

          {multi ? (
            <button
              type="button"
              className="btn btn-secondary self-start text-sm"
              disabled={formDisabled}
              onClick={() => {
                dishesListTouchedRef.current = true;
                setDishes((current) => {
                  const next = [
                    ...current,
                    draftFromRecognition(
                      { dishName: "", calories: 0, confidence: 0.5, photoKind: "meal" },
                      `new-${Date.now()}`,
                    ),
                  ];
                  setActiveDish(next.length - 1);
                  return next;
                });
              }}
            >
              Добавить блюдо
            </button>
          ) : null}
        </div>

        {lookupMessage ? <p className="text-sm text-[var(--accent)]">{lookupMessage}</p> : null}
        {error ? (
          <div className="rounded-xl bg-red-50 px-3 py-2">
            {error.split("\n").map((line, i) => (
              <p key={i} className="text-sm text-red-600">{line}</p>
            ))}
          </div>
        ) : null}

        {/* Allergen ack stays on skim — required for save when hits exist. */}
        {allergenHits.length > 0 ? (
          <div
            ref={allergenBlockRef}
            id="confirm-allergen-ack"
            className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <label className="flex items-start gap-2 text-xs font-medium text-amber-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allergenAck}
                onChange={(e) => setAllergenAck(e.target.checked)}
              />
              <span>
                Аллерген: {allergenHits.map((id) => allergenLabel(id)).join(", ")} — проверил(а)
              </span>
            </label>
          </div>
        ) : null}

        {/* W1: trust line + soft hints above sticky CTAs (visible above dock). */}
        {skimTrustLine ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-snug text-amber-950"
            role="status"
          >
            {skimTrustLine}
          </p>
        ) : null}
        {saveAsIs && !saving ? (
          <p className="text-center text-xs text-slate-500">{softSaveHint}</p>
        ) : null}
        {anyMissingCalories && !enriching && !saving && !skimTrustLine ? (
          <p className="text-center text-xs text-amber-800">
            Без калорий сохранить нельзя — уточните название или введите ккал.
          </p>
        ) : null}

        {/* W1: when review needed, Уточнить is primary; Save is soft «как есть». */}
        <div className="confirm-card-actions">
          {multi ? (
            <p className="w-full text-center text-xs font-medium text-slate-500">
              {dishes.length} позиций · {totalCalories || "—"} ккал
            </p>
          ) : null}
          {needsReview && reviewCta ? (
            <button
              type="button"
              className="btn btn-primary inline-flex items-center justify-center gap-2"
              disabled={
                formDisabled ||
                (reviewCta.mode === "lookup-one"
                  ? !reviewTargetDish || searchingId === reviewTargetDish.id
                  : bulkLookupRunning)
              }
              onClick={() => {
                trackConfirmLookupGoal();
                if (reviewCta.mode === "force-all") {
                  void handleLookupAll({ forceAll: true });
                  return;
                }
                if (reviewCta.mode === "lookup-all") {
                  void handleLookupAll();
                  return;
                }
                if (!reviewTargetDish) return;
                const idx = dishes.findIndex((d) => d.id === reviewTargetDish.id);
                if (idx >= 0) setActiveDish(idx);
                void handleLookup(reviewTargetDish);
              }}
            >
              {reviewCta.mode === "force-all" || reviewCta.mode === "lookup-all"
                ? bulkLookupRunning
                  ? reviewCta.busyLabel
                  : reviewCta.label
                : searchingId === reviewTargetDish?.id || bulkLookupRunning
                  ? reviewCta.busyLabel
                  : reviewCta.label}
            </button>
          ) : null}
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 ${
              needsReview && reviewCta ? "btn btn-secondary" : "btn btn-primary"
            }`}
            disabled={saving || searching || (anyMissingCalories && !enriching)}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <span className="daisy-loading daisy-loading-sm" aria-hidden>
                  <span /><span /><span />
                </span>
                Сохраняем...
              </>
            ) : (
              saveLabel
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => {
              stopPersistingDraft({ clearDraft: true });
              onCancel();
            }}
          >
            Отменить
          </button>
        </div>

        {/* D3: one fold for trust / meal time / recognition meta / reshoot context. */}
        <details className="confirm-details-fold">
          <summary>
            Подробнее
            {!multi && dishes[0]
              ? ` · ${formatConfidencePercent(dishes[0].original.confidence)}${
                  skimTone !== "high" ? ` · ${confidenceShortLabel(skimTone)}` : ""
                }`
              : multi && anyLowConfidence
                ? ` · слабая ${lowConfidenceDishes.length}/${dishes.length}`
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
                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Переснять с подсказкой контекста
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-50"
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                      onClick={() => setMealType(mealType === value ? "" : value)}
                    >
                      {label}
                    </Chip>
                  ),
                )}
              </div>
              <div className="field mt-3 max-w-[12rem]">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Время приёма
                </label>
                <input
                  type="time"
                  className="mt-1.5"
                  value={eatenTime}
                  disabled={saving}
                  onChange={(e) => setEatenTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Распознавание
              </p>
              <p>
                {RECOGNITION_SOURCE_LABELS[recognition.source ?? "gigachat"] ?? "Распознавание по фото"}
                {recognition.photoKind === "barcode" ? " · штрихкод" : ""}
                {recognition.photoKind === "label" ? " · этикетка" : ""}
              </p>
              <p>
                {multi
                  ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
                  : `Уверенность: ${formatConfidencePercent(recognition.confidence)}`}
                {recognition.barcode ? ` · ${recognition.barcode}` : ""}
                {recognition.brand ? ` · ${recognition.brand}` : ""}
              </p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
