"use client";

import { useEffect, useState } from "react";
import { buildGoalAwareCalorieTip } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";

type ProgressData = {
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
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
        const mealsResp = await fetch(withBasePath(`/api/meals?date=${selectedDate}`));
        if (!mealsResp.ok) return;
        const meals = (await mealsResp.json()) as {
          totalCalories: number;
          totalProtein: number;
          goal?: "LOSE" | "GAIN" | "MAINTAIN" | null;
          target: { calories: number; protein: number } | null;
        };

        setData({
          calories: meals.totalCalories,
          calorieTarget: meals.target?.calories ?? null,
          protein: meals.totalProtein,
          proteinTarget: meals.target?.protein ?? null,
          goal: meals.goal ?? null,
        });
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey]);

  if (!data || (data.calories === 0 && !data.calorieTarget)) {
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

  let tip = "Добавьте первый приём пищи — и прогресс появится.";
  if (data.calorieTarget && data.calories > 0) {
    tip = buildGoalAwareCalorieTip({
      actual: data.calories,
      target: data.calorieTarget,
      goal: data.goal,
      tense: "today",
    });
  } else if (data.calorieTarget) {
    tip = "Добавьте первый приём пищи — и прогресс появится.";
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
          sub={data.calorieTarget ? "ккал к цели" : "цель не задана"}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="font-display text-sm font-semibold text-slate-800">Сводка дня</p>
          {data.proteinTarget ? (
            <ThinBar
              label="Белок"
              pct={proteinPct}
              detail={`${Math.round(data.protein)} / ${data.proteinTarget} г`}
              color={proteinPct > 105 ? "bg-rose-400" : "bg-teal-500"}
            />
          ) : (
            <p className="text-xs text-slate-500">Укажите цель в профиле — появится норма белка.</p>
          )}
          <p className="text-xs leading-snug text-slate-600">{tip}</p>
        </div>
      </div>
    </div>
  );
}
