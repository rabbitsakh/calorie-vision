"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { mascotArtUrl } from "@/lib/mascot-art";
import { playCelebrationChime } from "@/lib/celebration-chime";
import { isGamificationQuiet } from "@/lib/gamification-quiet";
import { subscribeMascotReaction } from "@/lib/mascot-reactions";
import {
  clearSaveCheerPending,
  isSaveCheerClaimedByFullscreen,
  SAVE_TOAST_DELAY_MS,
} from "@/lib/save-cheer-coordination";
import { withBasePath } from "@/lib/paths";
import { pickSaveReactionLine } from "@/lib/save-reaction-copy";

const TOAST_MS = 2400;

function preloadCheerArt() {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = withBasePath(mascotArtUrl("cheer"));
  void img.decode?.().catch(() => {
    // decode optional — src preload is enough for cache warm
  });
}

/**
 * Floating mini-cheer when the user saves a meal (soft Duo-style reaction).
 * Mascot is intentional — toast shows cheer art + a short line like «Отлично!».
 */
export function MascotSaveReaction() {
  const day = useOptionalRationDay();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("Записано!");
  const [toastKey, setToastKey] = useState(0);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    preloadCheerArt();
  }, []);

  useEffect(() => {
    return subscribeMascotReaction((kind) => {
      if (kind !== "save") return;
      if (showTimerRef.current != null) {
        window.clearTimeout(showTimerRef.current);
      }
      const mealsBefore = day?.data?.meals.entries.length ?? 0;
      setLine(
        pickSaveReactionLine({
          firstMealToday: mealsBefore <= 1,
          seed: Date.now(),
        }),
      );
      setToastKey((value) => value + 1);
      setOpen(false);

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (isSaveCheerClaimedByFullscreen()) {
          clearSaveCheerPending();
          return;
        }
        setOpen(true);
        clearSaveCheerPending();
        if (!isGamificationQuiet()) {
          playCelebrationChime("soft");
        }
      }, SAVE_TOAST_DELAY_MS);
    });
  }, [day?.data?.meals.entries.length]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current != null) {
        window.clearTimeout(showTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [open, toastKey]);

  if (!open) return null;

  return (
    <div
      key={toastKey}
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
