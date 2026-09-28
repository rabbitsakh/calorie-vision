"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { FoodAddIcon } from "@/components/FoodAddIcons";
import { listFocusable, trapFocusKeydown } from "@/lib/food-add-focus";
import {
  FOOD_ADD_MODE_OPTIONS,
  FOOD_ADD_PHOTO_SOURCES,
  FOOD_ADD_UTILITY_OPTIONS,
  foodAddSuggestedLabel,
  suggestFoodAddAction,
} from "@/lib/food-add-modes";
import { hourInTimezone } from "@/lib/meal-type";
import { openFoodAdd, requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import { useTimezone } from "@/lib/use-timezone";

export { FOOD_ADD_LONG_PRESS_MS, FOOD_ADD_MODE_OPTIONS } from "@/lib/food-add-modes";

type FoodAddModeMenuProps = {
  open: boolean;
  onClose: () => void;
  /** `up` = above trigger (tab bar); `down` = below (header). */
  placement?: "up" | "down";
  className?: string;
};

/** Desktop header chevron menu — same visual language as the mobile «+» sheet (P4). */
export function FoodAddModeMenu({
  open,
  onClose,
  placement = "up",
  className = "",
}: FoodAddModeMenuProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const timezone = useTimezone();
  const suggested = useMemo(
    () => suggestFoodAddAction(hourInTimezone(new Date(), timezone)),
    [timezone],
  );
  const [photoStep, setPhotoStep] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhotoStep(false);
      return;
    }
    const root = rootRef.current;
    const focusables = root ? listFocusable(root) : [];
    focusables[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (photoStep) {
          setPhotoStep(false);
          return;
        }
        onClose();
        return;
      }
      if (root) trapFocusKeydown(event, root);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) onClose();
    }
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => window.addEventListener("mousedown", onPointer), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, photoStep]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      id={listId}
      role="menu"
      aria-label="Что добавить"
      className={`food-add-desktop-menu absolute z-[65] w-64 ${
        placement === "up"
          ? "bottom-[calc(100%+0.45rem)] left-1/2 -translate-x-1/2"
          : "top-[calc(100%+0.45rem)]"
      } ${className}`}
    >
      <p className="food-add-desktop-menu-hint" aria-live="polite">
        {photoStep ? "Камера или галерея" : foodAddSuggestedLabel(suggested)}
      </p>
      {photoStep ? (
        <div className="food-add-desktop-menu-list" role="none">
          <button
            type="button"
            role="menuitem"
            className="food-add-desktop-item"
            onClick={() => setPhotoStep(false)}
          >
            <span className="food-add-desktop-item-copy">
              <span className="food-add-desktop-item-label">← Назад</span>
              <span className="food-add-desktop-item-hint">К способам добавления</span>
            </span>
          </button>
          {FOOD_ADD_PHOTO_SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              role="menuitem"
              className={`food-add-desktop-item ${
                src.id === "camera" ? "food-add-desktop-item--suggested" : ""
              }`}
              onClick={() => {
                onClose();
                openFoodAdd({
                  mode: "photo",
                  openCamera: src.id === "camera",
                  openGallery: src.id === "gallery",
                });
              }}
            >
              <span
                className={`food-add-desktop-item-icon ${
                  src.id === "camera" ? "food-add-desktop-item-icon--accent" : ""
                }`}
                aria-hidden
              >
                <FoodAddIcon name={src.icon} className="h-5 w-5" />
              </span>
              <span className="food-add-desktop-item-copy">
                <span className="food-add-desktop-item-label">{src.label}</span>
                <span className="food-add-desktop-item-hint">{src.hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="food-add-desktop-menu-list" role="none">
            {FOOD_ADD_MODE_OPTIONS.map((opt) => {
              const isSuggested = suggested === "photo" && opt.id === "photo";
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  className={`food-add-desktop-item ${isSuggested ? "food-add-desktop-item--suggested" : ""}`}
                  onClick={() => {
                    if (opt.id === "photo") {
                      setPhotoStep(true);
                      return;
                    }
                    onClose();
                    openFoodAdd({ mode: opt.id, openCamera: opt.openCamera });
                  }}
                >
                  <span
                    className={`food-add-desktop-item-icon ${
                      isSuggested ? "food-add-desktop-item-icon--accent" : ""
                    }`}
                    aria-hidden
                  >
                    <FoodAddIcon name={opt.icon} className="h-5 w-5" />
                  </span>
                  <span className="food-add-desktop-item-copy">
                    <span className="food-add-desktop-item-label">{opt.label}</span>
                    <span className="food-add-desktop-item-hint">{opt.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="food-add-desktop-menu-sep" role="separator" />
          <div className="food-add-desktop-menu-list" role="none">
            {FOOD_ADD_UTILITY_OPTIONS.map((opt) => {
              const isSuggested =
                (suggested === "water" && opt.id === "water") ||
                (suggested === "weight" && opt.id === "weight") ||
                (suggested === "workout" && opt.id === "workout");
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  className={`food-add-desktop-item food-add-desktop-item--${opt.id} ${
                    isSuggested ? "food-add-desktop-item--suggested" : ""
                  }`}
                  onClick={() => {
                    onClose();
                    if (opt.id === "water") requestOpenWaterQuick();
                    else if (opt.id === "weight") requestOpenWeightQuick();
                    else router.push(withBasePath("/workouts?new=1"));
                  }}
                >
                  <span
                    className={`food-add-desktop-item-icon food-add-desktop-item-icon--${opt.id}`}
                    aria-hidden
                  >
                    <FoodAddIcon name={opt.icon} className="h-5 w-5" />
                  </span>
                  <span className="food-add-desktop-item-copy">
                    <span className="food-add-desktop-item-label">{opt.label}</span>
                    <span className="food-add-desktop-item-hint">{opt.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
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
 * Center «+»: single tap opens the full choice sheet
 * (фото / текст / штрихкод / вода / вес / тренировка).
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
