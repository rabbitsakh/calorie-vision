"use client";

import {
  allergenLabel,
  matchAllergensInText,
  type AllergenId,
} from "@/lib/allergens";

/** Soft allergen hint under a dish name (diary / shopping). */
export function AllergenHint({
  text,
  allergens,
}: {
  text: string;
  allergens: AllergenId[];
}) {
  if (!allergens.length || !text.trim()) return null;
  const hits = matchAllergensInText(text, allergens);
  if (hits.length === 0) return null;
  return (
    <p className="mt-0.5 text-[11px] leading-snug text-amber-800">
      Возможно: {hits.map((id) => allergenLabel(id)).join(", ")}
    </p>
  );
}
