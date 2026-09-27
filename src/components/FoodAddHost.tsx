"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FoodAddModePicker } from "@/components/FoodAddModePicker";
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { toDateKeyTz } from "@/lib/dates";
import { hourInTimezone, inferMealTypeFromHour } from "@/lib/meal-type";
import {
  FOOD_SAVED_EVENT,
  OPEN_FOOD_ADD_EVENT,
  type FoodAddMode,
  type OpenFoodAddDetail,
} from "@/lib/open-food-camera";
import { useTimezone } from "@/lib/use-timezone";

type FoodAddUiValue = {
  confirmOpen: boolean;
  sheetOpen: boolean;
  disabled: boolean;
};

const FoodAddUiContext = createContext<FoodAddUiValue>({
  confirmOpen: false,
  sheetOpen: false,
  disabled: false,
});

export function useFoodAddUi(): FoodAddUiValue {
  return useContext(FoodAddUiContext);
}

type Phase = "closed" | "picker" | "sheet";

type FoodAddHostProps = {
  /** Selected diary date when known (ration/stats). Falls back to today. */
  date?: string;
  /** Hide host entirely (admin pages). */
  enabled?: boolean;
  children: ReactNode;
};

function inferCurrentMealType(timezone?: string | null): string {
  return inferMealTypeFromHour(hourInTimezone(new Date(), timezone));
}

export function FoodAddHost({ date, enabled = true, children }: FoodAddHostProps) {
  const timezone = useTimezone();
  const today = toDateKeyTz(new Date(), timezone);
  const selectedDate = date && date.length >= 8 ? date : today;

  const [phase, setPhase] = useState<Phase>("closed");
  const [mode, setMode] = useState<FoodAddMode>("photo");
  const [openCameraOnce, setOpenCameraOnce] = useState(false);
  const [openGalleryOnce, setOpenGalleryOnce] = useState(false);
  const [mealType, setMealType] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launchKey, setLaunchKey] = useState(0);
  const [resumeKey, setResumeKey] = useState(0);

  const closeAll = useCallback(() => {
    if (confirmOpen) return;
    setPhase("closed");
    setOpenCameraOnce(false);
    setOpenGalleryOnce(false);
  }, [confirmOpen]);

  const openSheet = useCallback(
    (nextMode: FoodAddMode, opts?: { openCamera?: boolean; openGallery?: boolean }) => {
      setMode(nextMode);
      setOpenCameraOnce(Boolean(opts?.openCamera) && nextMode === "photo");
      setOpenGalleryOnce(Boolean(opts?.openGallery) && nextMode === "photo" && !opts?.openCamera);
      setLaunchKey((k) => k + 1);
      setPhase("sheet");
    },
    [],
  );

  const finishSaved = useCallback(() => {
    window.dispatchEvent(new Event(FOOD_SAVED_EVENT));
    setConfirmOpen(false);
    setPhase("closed");
    setOpenCameraOnce(false);
    setOpenGalleryOnce(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function onOpen(event: Event) {
      const detail = (event as CustomEvent<OpenFoodAddDetail>).detail ?? {};
      if (detail.mealType) {
        setMealType(detail.mealType);
      } else if (!detail.mode && !detail.resumePending) {
        // Bare «+» picker — stamp the current day-part slot.
        setMealType(inferCurrentMealType(timezone));
      }
      if (detail.resumePending) {
        setOpenCameraOnce(false);
        setOpenGalleryOnce(false);
        setResumeKey((k) => k + 1);
        setLaunchKey((k) => k + 1);
        setPhase("sheet");
        return;
      }
      if (!detail.mode) {
        setPhase("picker");
        return;
      }
      openSheet(detail.mode, {
        openCamera: detail.openCamera,
        openGallery: detail.openGallery,
      });
    }

    window.addEventListener(OPEN_FOOD_ADD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FOOD_ADD_EVENT, onOpen);
  }, [enabled, openSheet, timezone]);

  // Offline draft / confirm while sheet was closed → reveal sheet.
  useEffect(() => {
    if (confirmOpen && phase === "closed") {
      setPhase("sheet");
    }
  }, [confirmOpen, phase]);

  const sheetVisible = enabled && (phase === "sheet" || confirmOpen);
  const sheetOpen = enabled && (phase === "picker" || sheetVisible);

  const value = useMemo<FoodAddUiValue>(
    () => ({
      confirmOpen,
      sheetOpen,
      disabled: confirmOpen,
    }),
    [confirmOpen, sheetOpen],
  );

  return (
    <FoodAddUiContext.Provider value={value}>
      {children}
      {enabled ? (
        <>
          {phase === "picker" ? (
            <FoodAddModePicker
              selectedDate={selectedDate}
              mealType={mealType}
              onSelect={(next, opts) => openSheet(next, opts)}
              onClose={closeAll}
              onQuickLogged={finishSaved}
            />
          ) : null}

          {/* Keep panel mounted (hidden) so offline drafts can auto-open confirm. */}
          <div
            className={
              sheetVisible
                ? "food-add-overlay fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
                : "hidden"
            }
            role={sheetVisible ? "dialog" : undefined}
            aria-modal={sheetVisible ? true : undefined}
            aria-labelledby={sheetVisible ? "food-add-sheet-title" : undefined}
            aria-hidden={!sheetVisible}
            onClick={() => {
              if (!confirmOpen) closeAll();
            }}
          >
            <div
              className="food-add-sheet flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[88vh] sm:rounded-3xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <p id="food-add-sheet-title" className="font-semibold text-slate-900">
                  {confirmOpen ? "Проверьте и сохраните" : "Добавить еду"}
                </p>
                {confirmOpen ? (
                  <span className="text-xs text-slate-400">Сохраните или отмените</span>
                ) : (
                  <button type="button" className="btn-quiet text-sm text-slate-500" onClick={closeAll}>
                    Закрыть
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:p-4">
                <FoodAddPanel
                  selectedDate={selectedDate}
                  initialMealType={mealType}
                  initialMode={mode}
                  autoOpenCamera={openCameraOnce}
                  autoOpenGallery={openGalleryOnce}
                  launchKey={launchKey}
                  resumeKey={resumeKey}
                  layout="plain"
                  disabled={!sheetVisible}
                  onSaved={finishSaved}
                  onPendingChange={setConfirmOpen}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </FoodAddUiContext.Provider>
  );
}
