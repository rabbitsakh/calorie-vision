"use client";

import { useEffect, useRef, useState } from "react";
import { formatMacro, nutritionBaseline, scaleNutritionByPortion, type NutritionValues } from "@/lib/nutrition";
import type { RecognitionResponse } from "@/types";
import { MEAL_TYPE_LABELS } from "@/types";
import { getImageUrl, withBasePath } from "@/lib/paths";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { looksLikeDrinkName, looksLikeSnackBarName } from "@/lib/portion-unit";
import { flattenRecognitionItems } from "@/lib/recognition-items";
import { getRecognitionLowConfidenceThreshold } from "@/lib/ai/recognition-thresholds";
import {
  applyAlternativeToPortion,
  applyFoodLookupToPortion,
  nutritionBaselineFromRecognition,
  recognitionNeedsPortionRescale,
  resolveDisplayPortionGrams,
  resolvePer100gForScaling,
  scaleRecognitionToPortion,
} from "@/lib/recognition-nutrition";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import { Chip } from "@/components/Chip";

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

type DishDraft = {
  id: string;
  original: FoodRecognitionResult;
  dishName: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  sugar: string;
  portionGrams: string;
  baseline: NutritionValues | null;
};

type ConfirmationCardProps = {
  result: RecognitionResponse;
  selectedDate: string;
  onCancel: () => void;
  onSaved: (meta?: { rememberedCorrection?: boolean }) => void;
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
  const baseline = nutritionBaselineFromRecognition(item);
  const portionGrams = resolveDisplayPortionGrams(item);
  const scaled = portionGrams ? scaleRecognitionToPortion(item, portionGrams) : null;

  return {
    id,
    original: item,
    dishName: decodeHtmlEntities(item.dishName),
    calories: String((scaled?.calories ?? item.calories) || ""),
    protein: (scaled?.protein ?? item.protein) !== undefined ? String(scaled?.protein ?? item.protein) : "",
    fat: (scaled?.fat ?? item.fat) !== undefined ? String(scaled?.fat ?? item.fat) : "",
    carbs: (scaled?.carbs ?? item.carbs) !== undefined ? String(scaled?.carbs ?? item.carbs) : "",
    fiber: (scaled?.fiber ?? item.fiber) !== undefined ? String(scaled?.fiber ?? item.fiber) : "",
    sugar: (scaled?.sugar ?? item.sugar) !== undefined ? String(scaled?.sugar ?? item.sugar) : "",
    portionGrams: portionGrams !== undefined ? String(portionGrams) : "",
    baseline,
  };
}

function draftsFromRecognition(recognition: FoodRecognitionResult): DishDraft[] {
  return flattenRecognitionItems(recognition).map((item, index) =>
    draftFromRecognition(item, `${item.dishName}-${index}`),
  );
}

/** Keep user-selected portion when SSE enrichment updates recognition. */
function mergeDishesFromRecognition(
  current: DishDraft[],
  recognition: FoodRecognitionResult,
): DishDraft[] {
  const incoming = draftsFromRecognition(recognition);
  if (current.length === 0 || current.length !== incoming.length) {
    return incoming;
  }

  return incoming.map((draft, index) => {
    const previous = current[index];
    if (!previous) {
      return draft;
    }

    const preservedPortion = Number(previous.portionGrams);
    const incomingPortion = Number(draft.portionGrams);
    const activePortion =
      Number.isFinite(preservedPortion) && preservedPortion > 0 ? preservedPortion : incomingPortion;

    const needsRescale =
      Number.isFinite(activePortion) &&
      activePortion > 0 &&
      recognitionNeedsPortionRescale(draft.original, Number(draft.calories));

    const baseline = nutritionBaselineFromRecognition(draft.original) ?? draft.baseline;

    if (needsRescale) {
      const scaled = scaleRecognitionToPortion(draft.original, activePortion);
      return {
        ...draft,
        portionGrams: String(activePortion),
        baseline,
        calories: String(scaled.calories),
        protein: scaled.protein !== undefined ? formatMacro(scaled.protein) : draft.protein,
        fat: scaled.fat !== undefined ? formatMacro(scaled.fat) : draft.fat,
        carbs: scaled.carbs !== undefined ? formatMacro(scaled.carbs) : draft.carbs,
        fiber: scaled.fiber !== undefined ? formatMacro(scaled.fiber) : draft.fiber,
        sugar: scaled.sugar !== undefined ? formatMacro(scaled.sugar) : draft.sugar,
      };
    }

    if (
      !Number.isFinite(preservedPortion) ||
      preservedPortion <= 0 ||
      preservedPortion === incomingPortion
    ) {
      return draft;
    }

    if (!baseline) {
      return { ...draft, portionGrams: previous.portionGrams };
    }

    const scaled = scaleNutritionByPortion(baseline, preservedPortion);
    if (!scaled) {
      return { ...draft, portionGrams: previous.portionGrams, baseline };
    }

    return {
      ...draft,
      portionGrams: previous.portionGrams,
      baseline,
      calories: String(scaled.calories),
      protein: scaled.protein !== undefined ? formatMacro(scaled.protein) : draft.protein,
      fat: scaled.fat !== undefined ? formatMacro(scaled.fat) : draft.fat,
      carbs: scaled.carbs !== undefined ? formatMacro(scaled.carbs) : draft.carbs,
      fiber: scaled.fiber !== undefined ? formatMacro(scaled.fiber) : draft.fiber,
      sugar: scaled.sugar !== undefined ? formatMacro(scaled.sugar) : draft.sugar,
    };
  });
}

const LOW_CONFIDENCE = getRecognitionLowConfidenceThreshold();

function dishNeedsReview(dish: DishDraft): { lowConfidence: boolean; missingCalories: boolean } {
  const calories = Number(dish.calories);
  return {
    lowConfidence: dish.original.confidence < LOW_CONFIDENCE,
    missingCalories: !Number.isFinite(calories) || calories <= 0,
  };
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Prefer saved upload URL — blob previews often fail on iOS PWA. */
function resolveConfirmHeroSrc(imagePath: string, previewUrl?: string): string {
  const persisted = imagePath.trim();
  if (persisted) {
    return getImageUrl(persisted);
  }
  if (previewUrl?.trim()) {
    return previewUrl;
  }
  return "";
}

const MEAL_PORTION_CHIPS = [100, 150, 200, 250] as const;
const DRINK_PORTION_CHIPS = [200, 250, 330, 500, 1000, 1500] as const;

function looksLikeDrink(dish: DishDraft): boolean {
  return looksLikeDrinkName(dish.dishName, dish.original.dishName);
}

function portionChipOptions(dish: DishDraft): Array<{ label: string; grams: number }> {
  const drink = looksLikeDrink(dish);
  const base: Array<{ label: string; grams: number }> = (
    drink ? DRINK_PORTION_CHIPS : MEAL_PORTION_CHIPS
  ).map((grams) => ({
    label: drink ? `${grams} мл` : `${grams} г`,
    grams,
  }));

  const packGrams = dish.original.portionGrams;
  const packaged =
    dish.original.photoKind === "package" ||
    dish.original.photoKind === "barcode" ||
    dish.original.photoKind === "label";

  if (packaged && packGrams && packGrams > 0 && !base.some((chip) => chip.grams === packGrams)) {
    const bar = looksLikeSnackBarName(dish.dishName, dish.original.dishName);
    base.unshift({
      label: bar
        ? `1 шт (${packGrams} г)`
        : drink
          ? `Вся упаковка (${packGrams} мл)`
          : `Вся упаковка (${packGrams} г)`,
      grams: packGrams,
    });
  }

  return base;
}

export function ConfirmationCard({
  result,
  selectedDate,
  onCancel,
  onSaved,
}: ConfirmationCardProps) {
  const { recognition, imagePath: initialImagePath, previewUrl, enriching = false } = result;
  const [dishes, setDishes] = useState<DishDraft[]>(() => draftsFromRecognition(recognition));
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [mealType, setMealType] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heroSrc, setHeroSrc] = useState(() => resolveConfirmHeroSrc(initialImagePath, previewUrl));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [activeDish, setActiveDish] = useState(0);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const heroFallbackTriedRef = useRef(false);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setDishes((current) => mergeDishesFromRecognition(current, recognition));
  }, [recognition]);

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
    if (!heroFallbackTriedRef.current && previewUrl?.startsWith("blob:") && imagePath.trim()) {
      heroFallbackTriedRef.current = true;
      setHeroSrc(getImageUrl(imagePath));
      setImageLoaded(false);
      return;
    }
    if (!heroFallbackTriedRef.current && previewUrl?.startsWith("blob:") && heroSrc !== previewUrl) {
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
        scaled = scaleRecognitionToPortion(dish.original, grams);
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
          photoKind: dish.original.photoKind,
          source: next.source ?? dish.original.source,
        }),
      });
      if (!previewUrl && data.imagePath && dishes.length === 1) {
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

    async function worker() {
      while (index < targets.length) {
        if (controller.signal.aborted) {
          return;
        }
        const current = targets[index]!;
        index += 1;
        await handleLookup(current, undefined, controller.signal);
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()));
  }

  async function buildSavePayload(dish: DishDraft, mealGroupId?: string) {
    const parsedCalories = Number(dish.calories);
    if (!dish.dishName.trim() || !Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      throw new Error("Проверьте название и калорийность каждого блюда");
    }

    const origProtein = dish.original.protein !== undefined ? Number(dish.original.protein) : undefined;
    const origFat = dish.original.fat !== undefined ? Number(dish.original.fat) : undefined;
    const origCarbs = dish.original.carbs !== undefined ? Number(dish.original.carbs) : undefined;
    const origFiber = dish.original.fiber !== undefined ? Number(dish.original.fiber) : undefined;
    const origSugar = dish.original.sugar !== undefined ? Number(dish.original.sugar) : undefined;
    const parsedProtein = parseOptionalNumber(dish.protein);
    const parsedFat = parseOptionalNumber(dish.fat);
    const parsedCarbs = parseOptionalNumber(dish.carbs);
    const parsedFiber = parseOptionalNumber(dish.fiber);
    const parsedSugar = parseOptionalNumber(dish.sugar);

    const wasCorrected =
      dish.dishName.trim() !== decodeHtmlEntities(dish.original.dishName) ||
      parsedCalories !== dish.original.calories ||
      parsedProtein !== origProtein ||
      parsedFat !== origFat ||
      parsedCarbs !== origCarbs ||
      parsedFiber !== origFiber ||
      parsedSugar !== origSugar;

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
      wasCorrected,
      originalDish: decodeHtmlEntities(dish.original.dishName),
      originalCalories: dish.original.calories,
      originalProtein: origProtein,
      originalFat: origFat,
      originalCarbs: origCarbs,
      originalFiber: origFiber,
      originalSugar: origSugar,
      recognitionSource: dish.original.source,
      photoKind: dish.original.photoKind,
      barcode: dish.original.barcode,
    };
  }

  async function handleLookupAll() {
    const targets = dishes.filter((dish) => {
      const review = dishNeedsReview(dish);
      return review.lowConfidence || review.missingCalories;
    });
    if (targets.length === 0) {
      setLookupMessage("Все позиции уже выглядят достаточно точными");
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
    setSaving(true);
    setError(null);

    try {
      const mealGroupId = dishes.length > 1 ? crypto.randomUUID() : undefined;
      const payloads = await Promise.all(
        dishes.map((dish) => buildSavePayload(dish, mealGroupId)),
      );
      const rememberedCorrection = payloads.some((payload) => payload.wasCorrected);

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
        onSaved({ rememberedCorrection });
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

      onSaved({ rememberedCorrection });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const hasImage = Boolean(heroSrc);
  const multi = dishes.length > 1;
  const totalCalories = dishes.reduce((sum, dish) => sum + (Number(dish.calories) || 0), 0);
  const searching = searchingId !== null;
  const bulkLookupRunning = searchingId === "all";
  const reviewFlags = dishes.map(dishNeedsReview);
  const anyMissingCalories = reviewFlags.some((flag) => flag.missingCalories);
  const anyLowConfidence = reviewFlags.some((flag) => flag.lowConfidence);
  const needsReview = anyMissingCalories || anyLowConfidence;

  return (
    <section id="food-add-panel" className="card overflow-hidden p-0 md:p-6">
      <div className="flex flex-col gap-5 p-4 md:p-0">
        {hasImage ? (
          <div className="confirm-hero -mx-4 -mt-4 md:mx-0 md:mt-0 md:rounded-2xl">
            {!imageLoaded ? (
              <div className="absolute inset-0 min-h-44 animate-pulse bg-slate-200" aria-hidden />
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
              <p className="mt-0.5 text-sm text-white/80">
                {multi
                  ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
                  : dishes[0]?.dishName || "Проверьте порцию и калории"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold">Проверьте и сохраните</h2>
            <p className="mt-1 text-sm text-slate-500">
              {multi
                ? "Несколько блюд — поправьте порции и сохраните."
                : "Проверьте порцию и калории. БЖУ можно уточнить ниже."}
            </p>
          </div>
        )}

        {enriching ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
            <p className="font-semibold">Подтягиваем данные из базы…</p>
            <p className="mt-1 text-teal-900/90">
              Название и калории уже на экране — можно проверить порцию и сохранить, не дожидаясь уточнения.
            </p>
          </div>
        ) : null}

        {needsReview ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">
              {anyMissingCalories
                ? "Не хватает калорий по одной или нескольким позициям"
                : "Низкая уверенность распознавания"}
            </p>
            <p className="mt-1 text-amber-900/90">
              {anyMissingCalories
                ? "Уточните название и нажмите «Уточнить по названию» — подтянем КБЖУ из базы."
                : "Проверьте название и калории. Если блюдо другое — уточните по названию."}
            </p>
            {multi ? (
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-amber-900 underline-offset-2 hover:underline"
                disabled={saving || searching || enriching}
                onClick={() => void handleLookupAll()}
              >
                {bulkLookupRunning ? "Уточняем все..." : "Уточнить все позиции"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <p>
            {RECOGNITION_SOURCE_LABELS[recognition.source ?? "gigachat"] ?? "Распознавание по фото"}
          </p>
          <p className="mt-1 text-xs text-teal-800">
            {multi
              ? `${dishes.length} позиций · всего ${totalCalories || "—"} ккал`
              : `Уверенность: ${formatConfidence(recognition.confidence)}`}
            {recognition.barcode ? ` · штрихкод ${recognition.barcode}` : ""}
          </p>
        </div>

        {multi ? (
          <div className="chip-row">
            {dishes.map((dish, index) => (
              <Chip
                key={dish.id}
                active={index === activeDish}
                title={
                  reviewFlags[index]?.lowConfidence
                    ? index === activeDish
                      ? "Нажмите ещё раз, чтобы уточнить по названию"
                      : "Низкая уверенность — выберите и нажмите ещё раз для уточнения"
                    : undefined
                }
                onClick={() => {
                  if (
                    index === activeDish &&
                    reviewFlags[index]?.lowConfidence &&
                    searchingId === null &&
                    !saving &&
                    !enriching
                  ) {
                    void handleLookup(dish);
                    return;
                  }
                  setActiveDish(index);
                }}
              >
                {index + 1}. {dish.dishName || "Блюдо"}
                {reviewFlags[index]?.lowConfidence ? " · ?" : ""}
              </Chip>
            ))}
          </div>
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
                  disabled={saving || searching || enriching}
                  canRemove={multi}
                  review={reviewFlags[index]!}
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
                    setDishes((current) => current.filter((item) => item.id !== dish.id));
                    setActiveDish((value) => Math.max(0, value - 1));
                  }}
                />
              );
            },
          )}

          {multi ? (
            <button
              type="button"
              className="btn btn-secondary self-start text-sm"
              disabled={saving || searching || enriching}
              onClick={() => {
                setDishes((current) => [
                  ...current,
                  draftFromRecognition(
                    { dishName: "", calories: 0, confidence: 0.5, photoKind: "meal" },
                    `new-${Date.now()}`,
                  ),
                ]);
                setActiveDish(dishes.length);
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
        {!mealType ? (
          <p className="text-xs text-slate-500">
            Укажите приём пищи — так удобнее смотреть бюджет дня
          </p>
        ) : null}

        <div className="chip-row-fill">
          {(Object.entries(MEAL_TYPE_LABELS) as Array<[string, string]>).map(([value, label]) => (
            <Chip
              key={value}
              active={mealType === value}
              onClick={() => setMealType(mealType === value ? "" : value)}
            >
              {label}
            </Chip>
          ))}
        </div>
        <div className="sticky-actions">
          <button type="button" className="btn btn-primary inline-flex items-center justify-center gap-2" disabled={saving || searching} onClick={() => void handleSave()}>
            {saving ? (
              <>
                <span className="daisy-loading daisy-loading-sm" aria-hidden>
                  <span /><span /><span />
                </span>
                Сохраняем...
              </>
            ) : enriching ? (
              "Да, сохранить"
            ) : multi ? (
              "Сохранить все блюда"
            ) : (
              "Да, сохранить"
            )}
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
  review,
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
  review: { lowConfidence: boolean; missingCalories: boolean };
  onChange: (patch: Partial<DishDraft>) => void;
  onBaselineChange: (patch: Partial<DishDraft>) => void;
  onPortionChange: (value: string) => void;
  onLookup: (name?: string) => void;
  onApplyAlternative: (alt: NonNullable<FoodRecognitionResult["alternatives"]>[number]) => void;
  onRemove: () => void;
}) {
  const fieldId = (name: string) => `${name}-${dish.id}`;
  const showReviewCta = review.lowConfidence || review.missingCalories;
  const [showAdvanced, setShowAdvanced] = useState(
    () => review.lowConfidence || review.missingCalories,
  );

  const alternativesSection = dish.original.alternatives?.length ? (
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
    <div
      className={
        multi
          ? `rounded-2xl border p-4 ${
              showReviewCta ? "border-amber-300 bg-amber-50/40" : "border-slate-200"
            }`
          : "flex flex-col gap-4"
      }
    >
      {multi ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Блюдо {index + 1}</p>
            <p className="text-xs text-slate-500">
              Уверенность: {formatConfidence(dish.original.confidence)}
              {review.missingCalories ? " · нет калорий" : ""}
              {review.lowConfidence ? " · низкая уверенность" : ""}
            </p>
          </div>
          {canRemove ? (
            <button type="button" className="text-sm text-red-600 hover:text-red-700" disabled={disabled} onClick={onRemove}>
              Убрать
            </button>
          ) : null}
        </div>
      ) : null}

      {review.lowConfidence ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Низкая уверенность ({formatConfidence(dish.original.confidence)}) — проверьте название или нажмите «Уточнить по названию».
        </p>
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
          {showReviewCta ? (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-amber-800 underline-offset-2 hover:underline"
              disabled={disabled}
              onClick={() => onLookup()}
            >
              Уточнить по названию
            </button>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={fieldId("calories")}>Калории, ккал</label>
          <input
            id={fieldId("calories")}
            type="number"
            inputMode="decimal"
            min="1"
            value={dish.calories}
            onChange={(event) => onBaselineChange({ calories: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor={fieldId("portionGrams")}>
            {looksLikeDrink(dish) ? "Порция, мл" : "Порция, г"}
          </label>
          <input
            id={fieldId("portionGrams")}
            type="number"
            inputMode="decimal"
            min="1"
            value={dish.portionGrams}
            onChange={(event) => onPortionChange(event.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {portionChipOptions(dish).map((chip, chipIndex) => {
              const active = Number(dish.portionGrams) === chip.grams;
              return (
                <Chip
                  key={chip.label}
                  active={active}
                  disabled={disabled}
                  className={chipIndex === 0 && /упаковка|шт/i.test(chip.label) ? "min-h-11" : ""}
                  onClick={() => onPortionChange(String(chip.grams))}
                >
                  {chip.label}
                </Chip>
              );
            })}
          </div>
          <p className="text-xs text-slate-500">Калории и БЖУ пересчитываются пропорционально порции</p>
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? "Скрыть уточнения" : "Уточнить БЖУ, клетчатку и сахар"}
          </button>
        </div>

        {showAdvanced ? (
          <>
            {alternativesSection}

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

            <div className="field">
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

            <div className="field">
              <label htmlFor={fieldId("fiber")}>Клетчатка, г</label>
              <input
                id={fieldId("fiber")}
                type="number"
                min="0"
                step="0.1"
                value={dish.fiber}
                onChange={(event) => onBaselineChange({ fiber: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor={fieldId("sugar")}>Сахар, г</label>
              <input
                id={fieldId("sugar")}
                type="number"
                min="0"
                step="0.1"
                value={dish.sugar}
                onChange={(event) => onBaselineChange({ sugar: event.target.value })}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
