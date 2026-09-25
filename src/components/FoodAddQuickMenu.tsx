"use client";

import { useCallback, useEffect, useId, type ReactNode } from "react";
import { openFoodAdd, requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { FOOD_ADD_MODE_OPTIONS } from "@/lib/food-add-modes";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";

export { FOOD_ADD_LONG_PRESS_MS, FOOD_ADD_MODE_OPTIONS } from "@/lib/food-add-modes";

type FoodAddModeMenuProps = {
  open: boolean;
  onClose: () => void;
  /** `up` = above trigger (tab bar); `down` = below (header). */
  placement?: "up" | "down";
  className?: string;
};

/** Compact mode list (desktop chevron / optional overflow). */
export function FoodAddModeMenu({
  open,
  onClose,
  placement = "up",
  className = "",
}: FoodAddModeMenuProps) {
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      const root = document.getElementById(listId);
      if (root && target && !root.contains(target)) onClose();
    }
    window.addEventListener("keydown", onKey);
    // Defer so the opening click/pointer doesn't instantly close.
    const t = window.setTimeout(() => window.addEventListener("mousedown", onPointer), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, listId]);

  if (!open) return null;

  return (
    <div
      id={listId}
      role="menu"
      aria-label="Что добавить"
      className={`absolute left-1/2 z-[65] w-44 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg ${
        placement === "up" ? "bottom-[calc(100%+0.45rem)]" : "top-[calc(100%+0.45rem)]"
      } ${className}`}
    >
      {FOOD_ADD_MODE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="menuitem"
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-900"
          onClick={() => {
            onClose();
            openFoodAdd({ mode: opt.id, openCamera: opt.openCamera });
          }}
        >
          {opt.label}
        </button>
      ))}
      <div className="my-1 border-t border-slate-100" role="separator" />
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-900"
        onClick={() => {
          onClose();
          requestOpenWaterQuick();
        }}
      >
        Вода
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-900"
        onClick={() => {
          onClose();
          requestOpenWeightQuick();
        }}
      >
        Вес
      </button>
    </div>
  );
}

type LongPressAddButtonProps = {
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  /** Accessible name for the main control. */
  "aria-label"?: string;
};

/**
 * Center «+»: single tap opens the full choice sheet (фото / текст / штрихкод / вода / вес).
 * No long-press — Android WebView often ate short taps while the hold timer ran.
 */
export function LongPressAddButton({
  disabled,
  className,
  children,
  "aria-label": ariaLabel = "Добавить",
}: LongPressAddButtonProps) {
  const openPicker = useCallback(() => {
    if (disabled) return;
    requestOpenFoodAddPicker();
  }, [disabled]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        className="tab-add-btn flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-0.5"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        {children}
      </button>
    </div>
  );
}
