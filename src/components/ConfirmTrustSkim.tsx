"use client";

import type { RefObject } from "react";
import { allergenLabel, type AllergenId } from "@/lib/allergens";

type ConfirmTrustSkimProps = {
  allergenHits: AllergenId[];
  allergenAck: boolean;
  onAllergenAckChange: (checked: boolean) => void;
  allergenBlockRef: RefObject<HTMLDivElement | null>;
  skimTrustLine: string | null;
  saveAsIs: boolean;
  saving: boolean;
  softSaveHint: string;
  anyMissingCalories: boolean;
  enriching: boolean;
};

export function ConfirmTrustSkim({
  allergenHits,
  allergenAck,
  onAllergenAckChange,
  allergenBlockRef,
  skimTrustLine,
  saveAsIs,
  saving,
  softSaveHint,
  anyMissingCalories,
  enriching,
}: ConfirmTrustSkimProps) {
  return (
    <>
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
              onChange={(e) => onAllergenAckChange(e.target.checked)}
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
        <p className="text-center text-xs text-[var(--muted)]">{softSaveHint}</p>
      ) : null}
      {anyMissingCalories && !enriching && !saving && !skimTrustLine ? (
        <p className="text-center text-xs text-amber-800">
          Без калорий сохранить нельзя — уточните название или введите ккал.
        </p>
      ) : null}
    </>
  );
}
