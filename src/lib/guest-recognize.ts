/**
 * Общий контракт загрузки фото: гость /try и дневник шлют одно поле `photo`.
 * Старый клиент с полем `image` тоже принимается, чтобы не отвечать «Фото не найдено».
 */

export const GUEST_RECOGNIZE_LIMIT = 2;
export const GUEST_RECOGNIZE_WINDOW_MS = 24 * 60 * 60_000;
export const RECOGNIZE_PHOTO_FIELD = "photo";
export const RECOGNIZE_PHOTO_ALIAS = "image";

export function appendRecognizePhoto(form: FormData, file: File, filename?: string): void {
  const name = filename?.trim() || file.name.trim() || "photo.jpg";
  form.append(RECOGNIZE_PHOTO_FIELD, file, name);
}

export function guestMacroLine(dish: {
  protein?: number;
  fat?: number;
  carbs?: number;
}): string | null {
  const fmt = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.round(value * 10) / 10)
      : null;
  const protein = fmt(dish.protein);
  const fat = fmt(dish.fat);
  const carbs = fmt(dish.carbs);
  if (protein == null && fat == null && carbs == null) return null;
  return `Б ${protein ?? "—"} · Ж ${fat ?? "—"} · У ${carbs ?? "—"}`;
}
