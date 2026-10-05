"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCelebrationGate } from "@/components/CelebrationOrchestrator";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { subscribeMascotReaction } from "@/lib/mascot-reactions";
import {
  clearSaveCheerPending,
  isSaveCheerClaimedByFullscreen,
  SAVE_TOAST_DELAY_MS,
} from "@/lib/save-cheer-coordination";
import { pluralDays } from "@/lib/russian-text";
import { pickSaveReactionLine } from "@/lib/save-reaction-copy";

const TOAST_MS = 2200;
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
    "left:0",
    "right:0",
    "bottom:0",
    "width:100%",
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

/**
 * Quiet post-save confirmation (adult product).
 * Text toast only — no mascot cheer / chime / Duo pop.
 */
export function MascotSaveReaction() {
  const day = useOptionalRationDay();
  const gate = useCelebrationGate();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState("Приём сохранён");
  const [detail, setDetail] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const fullscreenActive = Boolean(gate?.activeId);

  useEffect(() => {
    setHost(getSaveToastHost());
  }, []);

  useEffect(() => {
    return subscribeMascotReaction((kind) => {
      if (kind !== "save") return;
      if (showTimerRef.current != null) {
        window.clearTimeout(showTimerRef.current);
      }
      const mealsBefore = day?.data?.meals.entries.length ?? 0;
      const streak = day?.data?.streak?.streak ?? 0;
      setLine(
        pickSaveReactionLine({
          firstMealToday: mealsBefore <= 1,
          seed: Date.now(),
        }),
      );
      setDetail(streak >= 2 ? `Серия ${streak} ${pluralDays(streak)}` : null);
      setToastKey((value) => value + 1);
      setOpen(false);

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (isSaveCheerClaimedByFullscreen() || Boolean(gate?.activeId)) {
          clearSaveCheerPending();
          return;
        }
        setOpen(true);
        clearSaveCheerPending();
      }, SAVE_TOAST_DELAY_MS);
    });
  }, [day?.data?.meals.entries.length, day?.data?.streak?.streak, gate?.activeId]);

  useEffect(() => {
    if (fullscreenActive && open) setOpen(false);
  }, [fullscreenActive, open]);

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
      className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="save-quiet-toast rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-white px-4 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
        <p className="text-sm font-semibold text-slate-900">{line}</p>
        {detail ? <p className="mt-0.5 text-xs font-medium text-slate-500">{detail}</p> : null}
      </div>
    </div>,
    host,
  );
}
