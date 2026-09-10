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
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { toDateKeyTz } from "@/lib/dates";
import {
  FOOD_SAVED_EVENT,
  OPEN_FOOD_ADD_EVENT,
  type FoodAddMode,
  type OpenFoodAddDetail,
} from "@/lib/open-food-camera";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
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

export function FoodAddHost({ date, enabled = true, children }: FoodAddHostProps) {
  const timezone = useTimezone();
  const today = toDateKeyTz(new Date(), timezone);
  const selectedDate = date && date.length >= 8 ? date : today;

  const [phase, setPhase] = useState<Phase>("closed");
  const [mode, setMode] = useState<FoodAddMode>("photo");
  const [openCameraOnce, setOpenCameraOnce] = useState(false);
  const [mealType, setMealType] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launchKey, setLaunchKey] = useState(0);
  const [resumeKey, setResumeKey] = useState(0);

  const closeAll = useCallback(() => {
    if (confirmOpen) return;
    setPhase("closed");
    setOpenCameraOnce(false);
  }, [confirmOpen]);

  const openSheet = useCallback((nextMode: FoodAddMode, camera: boolean) => {
    setMode(nextMode);
    setOpenCameraOnce(camera && nextMode === "photo");
    setLaunchKey((k) => k + 1);
    setPhase("sheet");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function onOpen(event: Event) {
      const detail = (event as CustomEvent<OpenFoodAddDetail>).detail ?? {};
      if (detail.mealType) {
        setMealType(detail.mealType);
      }
      if (detail.resumePending) {
        setOpenCameraOnce(false);
        setResumeKey((k) => k + 1);
        setLaunchKey((k) => k + 1);
        setPhase("sheet");
        return;
      }
      if (!detail.mode) {
        setPhase("picker");
        return;
      }
      openSheet(detail.mode, Boolean(detail.openCamera));
    }

    window.addEventListener(OPEN_FOOD_ADD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FOOD_ADD_EVENT, onOpen);
  }, [enabled, openSheet]);

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
              onSelect={(next) => openSheet(next, false)}
              onClose={closeAll}
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
                  {confirmOpen ? "Проверка" : "Добавить еду"}
                </p>
                {confirmOpen ? (
                  <span className="text-xs text-slate-400">Сначала сохраните или отмените</span>
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
                  launchKey={launchKey}
                  resumeKey={resumeKey}
                  layout="plain"
                  disabled={!sheetVisible}
                  onSaved={() => {
                    window.dispatchEvent(new Event(FOOD_SAVED_EVENT));
                    setConfirmOpen(false);
                    setPhase("closed");
                    setOpenCameraOnce(false);
                  }}
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

function FoodAddModePicker({
  onSelect,
  onClose,
}: {
  onSelect: (mode: FoodAddMode) => void;
  onClose: () => void;
}) {
  const options: Array<{ id: FoodAddMode; label: string; hint: string }> = [
    { id: "photo", label: "Фото", hint: "Сфотографировать блюдо или этикетку" },
    { id: "text", label: "Текст", hint: "Название или голос" },
    { id: "barcode", label: "Штрихкод", hint: "Сканер или ввод EAN" },
  ];

  return (
    <div
      className="food-add-overlay fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-add-picker-title"
      onClick={onClose}
    >
      <div
        className="food-add-sheet flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p id="food-add-picker-title" className="font-semibold text-slate-900">
              Добавить
            </p>
            <p className="text-xs text-slate-500">Еда или вес</p>
          </div>
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="flex flex-col gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:p-4">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex min-h-14 flex-col items-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/60"
              onClick={() => onSelect(opt.id)}
            >
              <span className="text-base font-semibold text-slate-900">{opt.label}</span>
              <span className="text-xs text-slate-500">{opt.hint}</span>
            </button>
          ))}
          <button
            type="button"
            className="flex min-h-14 flex-col items-start rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-left transition-colors hover:border-teal-400 hover:bg-teal-50"
            onClick={() => {
              onClose();
              requestOpenWeightQuick();
            }}
          >
            <span className="text-base font-semibold text-slate-900">Вес</span>
            <span className="text-xs text-slate-500">Записать кг за сегодня</span>
          </button>
        </div>
      </div>
    </div>
  );
}
