"use client";

import { Mascot } from "@/components/Mascot";
import { MASCOT_COPY } from "@/lib/mascot-copy";

type DailyLogEmptyProps = {
  sceneFeed?: boolean;
  mealFilter?: string;
  onAddFood?: (mealType?: string) => void;
  onAddFoodText?: () => void;
  yesterdayHasMeals: boolean;
  yesterdayHasBreakfast: boolean;
  showCopyOptions: boolean;
  onToggleCopyOptions: () => void;
  copying: boolean;
  copyError: string | null;
  onCopyYesterdayBreakfast: () => void;
  onCopyYesterday: () => void;
};

/** Wave 4: theatrical empty day — primary «+», optional text, tertiary copy-yesterday. */
export function DailyLogEmpty({
  sceneFeed = false,
  mealFilter = "ALL",
  onAddFood,
  onAddFoodText,
  yesterdayHasMeals,
  yesterdayHasBreakfast,
  showCopyOptions,
  onToggleCopyOptions,
  copying,
  copyError,
  onCopyYesterdayBreakfast,
  onCopyYesterday,
}: DailyLogEmptyProps) {
  return (
    <div
      className={`ration-empty-day flex flex-col items-center gap-3 px-4 py-10 text-center ${
        sceneFeed ? "" : "rounded-2xl border border-dashed border-slate-200 text-slate-500"
      }`}
    >
      <Mascot pose="empty" size="lg" title={MASCOT_COPY.emptyDiary.title} entrance />
      <p className="text-lg font-semibold text-slate-900">
        {MASCOT_COPY.emptyDiary.headline}
      </p>
      <p className="max-w-xs text-sm text-slate-600">{MASCOT_COPY.emptyDiary.body}</p>
      {onAddFood ? (
        <button
          type="button"
          className="btn btn-primary min-h-12 px-6 text-base"
          onClick={() => onAddFood(mealFilter !== "ALL" ? mealFilter : undefined)}
        >
          Добавить через «+»
        </button>
      ) : null}
      {onAddFoodText ? (
        <button
          type="button"
          className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
          onClick={onAddFoodText}
        >
          Текстом
        </button>
      ) : null}
      {yesterdayHasMeals || yesterdayHasBreakfast ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-teal-800 hover:underline"
            onClick={onToggleCopyOptions}
            aria-expanded={showCopyOptions}
          >
            {showCopyOptions ? "Скрыть" : "Скопировать вчера"}
          </button>
          {showCopyOptions ? (
            <div className="flex flex-col items-center gap-2">
              {yesterdayHasBreakfast ? (
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={copying}
                  onClick={onCopyYesterdayBreakfast}
                >
                  {copying ? "Копируем..." : "Только вчерашний завтрак"}
                </button>
              ) : null}
              {yesterdayHasMeals ? (
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  disabled={copying}
                  onClick={onCopyYesterday}
                >
                  {copying ? "Копируем..." : "Весь вчерашний день"}
                </button>
              ) : null}
              {copyError ? (
                <p className="max-w-xs text-sm text-red-600" role="alert">
                  {copyError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
