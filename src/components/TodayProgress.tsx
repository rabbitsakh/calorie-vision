"use client";

import { useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { buildGoalAwareCalorieTip } from "@/lib/diet";
import { applyHolidayBuffer, isHolidayBufferOn } from "@/lib/holiday-buffer";
import { withBasePath } from "@/lib/paths";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

type ProgressData = {
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterTarget: number;
  goal: "LOSE" | "GAIN" | "MAINTAIN" | null;
};

type TodayProgressProps = {
  selectedDate: string;
  refreshKey: number;
};

function Ring({
  pct,
  label,
  value,
  sub,
}: {
  pct: number;
  label: string;
  value: string;
  sub: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const over = pct > 105;

  return (
    <div className="flex shrink-0 flex-col items-center text-center">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={over ? "var(--danger)" : "var(--accent)"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${over ? "text-rose-600" : "text-teal-800"}`}>
            {Math.round(clamped)}%
          </span>
          <span className="text-[0.6rem] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        </div>
      </div>
      <p className="mt-1.5 text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[0.65rem] text-slate-500">{sub}</p>
    </div>
  );
}

function BigMetric({
  label,
  value,
  unit,
  detail,
  pct,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  pct: number;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const over = pct > 105;
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none text-slate-900 sm:text-3xl">
        {value}
        <span className="ml-1 text-sm font-semibold text-slate-500">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${over ? "bg-rose-400" : "bg-teal-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function progressFromPayload(
  selectedDate: string,
  meals: {
    totalCalories: number;
    totalProtein: number;
    goal?: "LOSE" | "GAIN" | "MAINTAIN" | null;
    target: { calories: number; protein: number } | null;
  },
  water: { totalMl: number; target: number },
): ProgressData {
  const holiday = isHolidayBufferOn(selectedDate);
  const baseCal = meals.target?.calories ?? null;
  return {
    calories: meals.totalCalories,
    calorieTarget: baseCal != null ? applyHolidayBuffer(baseCal, holiday) : null,
    protein: meals.totalProtein,
    proteinTarget: meals.target?.protein ?? null,
    waterMl: water.totalMl,
    waterTarget: water.target || WATER_DAILY_TARGET_ML,
    goal: meals.goal ?? null,
  };
}

export function TodayProgress({ selectedDate, refreshKey }: TodayProgressProps) {
  const day = useOptionalRationDay();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (day?.data?.date === selectedDate && day.data.meals) {
      setData(
        progressFromPayload(selectedDate, day.data.meals, day.data.water ?? {
          totalMl: 0,
          target: WATER_DAILY_TARGET_ML,
        }),
      );
      return;
    }

    if (day && day.date === selectedDate) {
      return;
    }

    void (async () => {
      try {
        const [mealsResp, waterResp] = await Promise.all([
          fetch(withBasePath(`/api/meals?date=${selectedDate}`)),
          fetch(withBasePath(`/api/water?date=${selectedDate}`)),
        ]);
        if (!mealsResp.ok) return;
        const meals = (await mealsResp.json()) as {
          totalCalories: number;
          totalProtein: number;
          goal?: "LOSE" | "GAIN" | "MAINTAIN" | null;
          target: { calories: number; protein: number } | null;
        };
        const water = waterResp.ok
          ? ((await waterResp.json()) as { totalMl: number; target: number })
          : { totalMl: 0, target: WATER_DAILY_TARGET_ML };

        setData(progressFromPayload(selectedDate, meals, water));
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey, day]);

  if (!data || (data.calories === 0 && !data.calorieTarget && data.waterMl === 0)) {
    return null;
  }

  const caloriePct =
    data.calorieTarget && data.calorieTarget > 0
      ? (data.calories / data.calorieTarget) * 100
      : 0;
  const proteinPct =
    data.proteinTarget && data.proteinTarget > 0
      ? (data.protein / data.proteinTarget) * 100
      : 0;
  const waterPct =
    data.waterTarget > 0 ? (data.waterMl / data.waterTarget) * 100 : 0;

  const holiday = isHolidayBufferOn(selectedDate);

  let tip = "Добавьте первый приём пищи — и прогресс появится.";
  if (data.calorieTarget && data.calories > 0) {
    tip = buildGoalAwareCalorieTip({
      actual: data.calories,
      target: data.calorieTarget,
      goal: data.goal,
      tense: "today",
    });
    if (holiday) tip = `${tip} Учтён праздничный запас.`;
  } else if (data.calorieTarget) {
    tip = holiday
      ? "Праздничный запас включён. Добавьте первый приём пищи."
      : "Добавьте первый приём пищи — и прогресс появится.";
  } else if (data.calories > 0) {
    tip = "Укажите цель в профиле — появится % пути к норме.";
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <Ring
          pct={data.calorieTarget ? caloriePct : 0}
          label="Калории"
          value={
            data.calorieTarget
              ? `${data.calories} / ${data.calorieTarget}`
              : `${data.calories} ккал`
          }
          sub={
            data.calorieTarget
              ? holiday
                ? "ккал · праздн. запас"
                : "ккал к цели"
              : "цель не задана"
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="font-display text-sm font-semibold text-slate-800">Сводка дня</p>
          <div className="flex gap-2">
            <BigMetric
              label="Белок"
              value={String(Math.round(data.protein))}
              unit="г"
              detail={
                data.proteinTarget
                  ? `из ${data.proteinTarget} г`
                  : "цель в профиле"
              }
              pct={data.proteinTarget ? proteinPct : 0}
            />
            <BigMetric
              label="Вода"
              value={data.waterMl >= 1000 ? (data.waterMl / 1000).toFixed(1) : String(data.waterMl)}
              unit={data.waterMl >= 1000 ? "л" : "мл"}
              detail={`из ${data.waterTarget} мл`}
              pct={waterPct}
            />
          </div>
          <p className="text-xs leading-snug text-slate-600">{tip}</p>
        </div>
      </div>
    </div>
  );
}
