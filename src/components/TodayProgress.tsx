"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

const WATER_TARGET = 2000;

type ProgressData = {
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
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
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const over = pct > 105;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 88 88" className="h-20 w-20 -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={over ? "#f43f5e" : "#0f766e"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-sm font-bold ${over ? "text-rose-600" : "text-teal-800"}`}>
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function ThinBar({
  label,
  pct,
  detail,
  color,
}: {
  label: string;
  pct: number;
  detail: string;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function TodayProgress({ selectedDate, refreshKey }: TodayProgressProps) {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
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
          target: { calories: number; protein: number } | null;
        };
        const water = waterResp.ok
          ? ((await waterResp.json()) as { totalMl: number })
          : { totalMl: 0 };

        setData({
          calories: meals.totalCalories,
          calorieTarget: meals.target?.calories ?? null,
          protein: meals.totalProtein,
          proteinTarget: meals.target?.protein ?? null,
          waterMl: water.totalMl,
        });
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey]);

  if (!data || (data.calories === 0 && data.waterMl === 0 && !data.calorieTarget)) {
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
  const waterPct = (data.waterMl / WATER_TARGET) * 100;

  let tip = "Добавьте первый приём пищи — и прогресс появится.";
  if (data.calorieTarget) {
    const remaining = Math.round(data.calorieTarget - data.calories);
    if (Math.abs(remaining) <= data.calorieTarget * 0.05) {
      tip = "Вы рядом с целью по калориям — отличный день!";
    } else if (remaining > 0) {
      tip = `Ещё ${remaining} ккал до дневной нормы.`;
    } else {
      tip = `На ${Math.abs(remaining)} ккал выше цели — можно чуть легче.`;
    }
  } else if (data.calories > 0) {
    tip = "Укажите цель в профиле — появится % пути к норме.";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">Путь к цели сегодня</p>
      <Ring
        pct={data.calorieTarget ? caloriePct : 0}
        label="Калории"
        value={
          data.calorieTarget
            ? `${data.calories} / ${data.calorieTarget}`
            : `${data.calories} ккал`
        }
        sub={data.calorieTarget ? "ккал" : "цель не задана"}
      />
      <div className="mt-3 flex flex-col gap-2.5">
        {data.proteinTarget ? (
          <ThinBar
            label="Белок"
            pct={proteinPct}
            detail={`${Math.round(data.protein)} / ${data.proteinTarget} г`}
            color={proteinPct > 105 ? "bg-rose-400" : "bg-teal-500"}
          />
        ) : null}
        <ThinBar
          label="Вода"
          pct={waterPct}
          detail={`${data.waterMl} / ${WATER_TARGET} мл`}
          color={waterPct >= 100 ? "bg-sky-500" : "bg-sky-400"}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">{tip}</p>
    </div>
  );
}
