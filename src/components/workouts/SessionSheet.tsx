"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Нижний лист поверх WebView. Портал в documentElement: внутри .cv-app-main
 * (overflow: auto) position:fixed на Android прилипает к низу всей страницы.
 */
export function GymSheetFrame({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const main = document.querySelector(".cv-app-main");
    const prevOverflow = main instanceof HTMLElement ? main.style.overflow : "";
    if (main instanceof HTMLElement) main.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (main instanceof HTMLElement) main.style.overflow = prevOverflow;
    };
  }, [mounted, onClose]);

  useEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    const input = panel?.querySelector<HTMLElement>("input, textarea, select");
    input?.focus({ preventScroll: true });
    const vv = window.visualViewport;
    if (!vv || !panel) return;
    const sync = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      panel.style.marginBottom = keyboard > 0 ? `${keyboard}px` : "";
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [mounted, label]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="cv-gym-sheet-backdrop"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="gym-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.documentElement,
  );
}

export function SessionSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <GymSheetFrame label={title} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <button
          type="button"
          className="min-h-[44px] px-2 text-sm font-medium text-[var(--muted-strong)]"
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
      {children}
    </GymSheetFrame>
  );
}
