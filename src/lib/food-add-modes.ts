import type { FoodAddMode } from "@/lib/open-food-camera";

export const FOOD_ADD_LONG_PRESS_MS = 420;

export const FOOD_ADD_MODE_OPTIONS: Array<{
  id: FoodAddMode;
  label: string;
  openCamera?: boolean;
}> = [
  { id: "photo", label: "Фото", openCamera: true },
  { id: "text", label: "Текст" },
  { id: "barcode", label: "Штрихкод" },
];
