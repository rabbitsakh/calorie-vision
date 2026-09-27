import type { FoodAddMode } from "@/lib/open-food-camera";

export const FOOD_ADD_LONG_PRESS_MS = 420;

export type FoodAddModeIcon = "photo" | "text" | "barcode" | "water" | "weight";

export type FoodAddModeOption = {
  id: FoodAddMode;
  label: string;
  hint: string;
  icon: FoodAddModeIcon;
  /** Photo opens the device camera after the sheet. */
  openCamera?: boolean;
  /** Primary tile (accent) in the picker grid. */
  primary?: boolean;
};

export const FOOD_ADD_MODE_OPTIONS: FoodAddModeOption[] = [
  {
    id: "photo",
    label: "Фото",
    hint: "Блюдо или этикетка",
    icon: "photo",
    openCamera: true,
    primary: true,
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

export type FoodAddUtilityOption = {
  id: "water" | "weight";
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
];
