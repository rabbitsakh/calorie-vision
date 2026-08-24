"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { playCelebrationChime } from "@/lib/celebration-chime";
import { subscribeMascotReaction } from "@/lib/mascot-reactions";

/**
 * Floating mini-cheer when the user saves a meal (soft Duo-style reaction).
 */
export function MascotSaveReaction() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeMascotReaction((kind) => {
      if (kind !== "save") return;
      setOpen(true);
      playCelebrationChime("soft");
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 1400);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-28 left-1/2 z-[80] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="mascot-save-toast flex flex-col items-center rounded-2xl bg-teal-900/90 px-5 py-3 shadow-xl backdrop-blur-sm">
        <Mascot pose="cheer" gesture="react" size="md" entrance animate />
        <p className="mt-1 text-xs font-bold text-teal-50">Записано!</p>
      </div>
    </div>
  );
}
