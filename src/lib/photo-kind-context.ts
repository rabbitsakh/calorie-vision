/**
 * Map model photoKind → FoodAddPanel chip when user left "Авто".
 * Chips remain an explicit override for the next shot.
 */
export function photoKindToContextChip(
  photoKind: string | null | undefined,
): "plate" | "label" | "restaurant" | null {
  const kind = (photoKind ?? "").trim().toLowerCase();
  if (kind === "meal") return "plate";
  if (kind === "package" || kind === "label" || kind === "barcode") return "label";
  return null;
}
