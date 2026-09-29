import type { FoodAddMode } from "@/lib/open-food-camera";

export const FOOD_ADD_LONG_PRESS_MS = 420;

export type FoodAddModeIcon =
  | "photo"
  | "gallery"
  | "text"
  | "barcode"
  | "water"
  | "weight"
  | "workout";

export type FoodAddModeOption = {
  id: FoodAddMode;
  label: string;
  hint: string;
  icon: FoodAddModeIcon;
  /**
   * When true, selecting this mode from a compact menu jumps straight to camera.
   * The center «+» sheet instead shows camera vs gallery first (never auto-opens).
   */
  openCamera?: boolean;
};

export const FOOD_ADD_MODE_OPTIONS: FoodAddModeOption[] = [
  {
    id: "photo",
    label: "Фото",
    hint: "Камера или галерея",
    icon: "photo",
  },
  {
    id: "text",
    label: "Текст",
    hint: "Название или голос",
    icon: "text",
  },
  {
    id: "barcode",
    label: "Штрихкод",
    hint: "Сканер или EAN",
    icon: "barcode",
  },
];

/** Soft day-part nudge among photo / water / weight. Never auto-opens camera. */
export type FoodAddSuggestedAction = "photo" | "water" | "weight" | "workout";

/**
 * Morning → вес, ночь → вода, иначе → фото еды.
 * Workout stays a tile in «+» but is never the time-based highlight (dinner
 * hours were wrongly nudging «тренировка»).
 * Hour is 0–23 local. Never navigates automatically.
 */
export function suggestFoodAddAction(hour: number): FoodAddSuggestedAction {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return "weight";
  if (h >= 22 || h < 5) return "water";
  return "photo";
}

export function foodAddSuggestedLabel(action: FoodAddSuggestedAction): string {
  switch (action) {
    case "weight":
      return "Сейчас удобнее: вес";
    case "water":
      return "Сейчас удобнее: вода";
    case "workout":
      return "Сейчас удобнее: тренировка";
    default:
      return "Сейчас удобнее: фото";
  }
}

export type FoodAddUtilityId = "water" | "weight" | "workout";

export type FoodAddUtilityOption = {
  id: FoodAddUtilityId;
  label: string;
  hint: string;
  icon: FoodAddModeIcon;
};

export const FOOD_ADD_UTILITY_OPTIONS: FoodAddUtilityOption[] = [
  {
    id: "water",
    label: "Вода",
    hint: "+200…500 мл",
    icon: "water",
  },
  {
    id: "weight",
    label: "Вес",
    hint: "кг за сегодня",
    icon: "weight",
  },
  {
    id: "workout",
    label: "Тренировка",
    hint: "Зал: подходы и кардио",
    icon: "workout",
  },
];

/** Photo source choice inside the «+» sheet (P0 follow-up). */
export const FOOD_ADD_PHOTO_SOURCES = [
  {
    id: "camera" as const,
    label: "Сфотографировать",
    hint: "Камера телефона",
    icon: "photo" as FoodAddModeIcon,
  },
  {
    id: "gallery" as const,
    label: "Выбрать из галереи",
    hint: "Уже снятое фото",
    icon: "gallery" as FoodAddModeIcon,
  },
];
