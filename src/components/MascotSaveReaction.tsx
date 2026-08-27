"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { playCelebrationChime } from "@/lib/celebration-chime";
import { subscribeMascotReaction } from "@/lib/mascot-reactions";
import { pickSaveReactionLine } from "@/lib/save-reaction-copy";

const TOAST_MS = 1800;

/**
 * Floating mini-cheer when the user saves a meal (soft Duo-style reaction).
 */
export function MascotSaveReaction() {
  const day = useOptionalRationDay();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("Записано!");

  useEffect(() => {
    return subscribeMascotReaction((kind) => {
      if (kind !== "save") return;
      const mealsBefore = day?.data?.meals.entries.length ?? 0;
      setLine(
        pickSaveReactionLine({
          firstMealToday: mealsBefore <= 1,
          seed: Date.now(),
        }),
      );
      setOpen(true);
      playCelebrationChime("soft");
    });
  }, [day?.data?.meals.entries.length]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-28 left-1/2 z-[80] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="mascot-save-toast flex flex-col items-center rounded-2xl bg-teal-900/92 px-5 py-3.5 shadow-xl backdrop-blur-sm">
        <Mascot pose="cheer" gesture="react" size="md" entrance animate />
        <p className="mascot-save-toast-line mt-1.5 text-sm font-bold text-teal-50">{line}</p>
      </div>
    </div>
  );
}
