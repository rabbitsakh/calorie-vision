"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const TOAST_MS = 2600;
const HOST_ID = "cv-mascot-save-toast-host";

function getSaveToastHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-save-toast-host", "1");
  // Attach to <html> so body overflow-x cannot clip fixed UI on iOS
  // (same pattern as MobileTabBar / celebration portal).
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "margin:0",
    "padding:0",
    "border:none",
    "z-index:80",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");
  document.documentElement.appendChild(host);
  return host;
}

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
 * Portaled to <html> so the mascot is never clipped by body overflow on iOS.
 */
export function MascotSaveReaction() {
  const day = useOptionalRationDay();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("Записано!");
  const [toastKey, setToastKey] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setHost(getSaveToastHost());
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

  if (!open || !host) return null;

  return createPortal(
    <div
      key={toastKey}
      className="pointer-events-none absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[80] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="mascot-save-toast flex flex-col items-center overflow-visible rounded-2xl bg-teal-900/94 px-6 py-4 shadow-xl backdrop-blur-sm">
        <div className="mascot-save-toast-mascot relative flex items-center justify-center">
          <span className="mascot-save-toast-glow" aria-hidden />
          <Mascot pose="cheer" gesture="react" size="lg" entrance animate />
        </div>
        <p className="mascot-save-toast-line mt-1 max-w-[14rem] text-center text-sm font-bold leading-snug text-teal-50">
          {line}
        </p>
      </div>
    </div>,
    host,
  );
}
