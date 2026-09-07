"use client";

import { useEffect, useMemo, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { DiarySticker } from "@/components/DiarySticker";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { buildDayHeroCopy } from "@/lib/day-hero-copy";
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
  fiber: number;
  fiberTarget: number | null;
  sugar: number;
  sugarTarget: number | null;
  showFiberSugar: boolean;
};

type DayHeroProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

function progressFromPayload(
  selectedDate: string,
  meals: {
    totalCalories: number;
    totalProtein: number;
    totalFiber?: number;
    totalSugar?: number;
    target: {
      calories: number;
      protein: number;
      fiber?: number;
      sugar?: number;
    } | null;
  },
  water: { totalMl: number; target: number },
  account?: {
    fiberTargetG?: number | null;
    sugarTargetG?: number | null;
  } | null,
): ProgressData {
  const holiday = isHolidayBufferOn(selectedDate);
  const baseCal = meals.target?.calories ?? null;
  const fiberOverride = account?.fiberTargetG ?? null;
  const sugarOverride = account?.sugarTargetG ?? null;
  return {
    calories: meals.totalCalories,
    calorieTarget: baseCal != null ? applyHolidayBuffer(baseCal, holiday) : null,
    protein: meals.totalProtein,
    proteinTarget: meals.target?.protein ?? null,
    waterMl: water.totalMl,
    waterTarget: water.target || WATER_DAILY_TARGET_ML,
    fiber: meals.totalFiber ?? 0,
    fiberTarget: fiberOverride != null ? fiberOverride : null,
    sugar: meals.totalSugar ?? 0,
    sugarTarget: sugarOverride != null ? sugarOverride : null,
    showFiberSugar: fiberOverride != null || sugarOverride != null,
  };
}

function HeroRing({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const over = pct > 105;

  return (
    <div className="day-hero-ring relative h-[4.35rem] w-[4.35rem] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(15,118,110,0.15)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={over ? "#d97706" : "#0f766e"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="day-hero-ring-label absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1.5">
        <span
          className={`font-display text-[0.8125rem] font-bold leading-none tracking-tight ${over ? "text-amber-700" : "text-teal-800"}`}
        >
          {Math.round(clamped)}%
        </span>
        <span className="text-[0.5rem] font-semibold uppercase leading-none tracking-wide text-slate-500">
          ккал
        </span>
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  detail,
  pct,
  warnOver = true,
}: {
  label: string;
  value: string;
  detail: string;
  pct: number;
  /** When false, over-target is fine (e.g. fiber). */
  warnOver?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const over = warnOver && pct > 105;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-xs font-semibold text-slate-700">
          {value}
          <span className="ml-1 font-normal text-slate-400">{detail}</span>
        </p>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${over ? "bg-amber-400" : "bg-teal-500"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function DayHeroSkeleton() {
  return (
    <section className="day-hero" aria-busy="true" aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="relative flex items-center gap-3">
        <div className="skeleton-ring !h-14 !w-14 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton-line !h-2 w-16" />
          <div className="skeleton-line !h-3.5 w-44 max-w-full" />
          <div className="skeleton-line !h-2.5 w-28" />
        </div>
        <div className="skeleton-ring !h-[4.35rem] !w-[4.35rem] shrink-0" aria-hidden />
      </div>
      <div className="relative mt-2.5 border-t border-teal-900/5 pt-2">
        <div className="min-w-0 space-y-2">
          <div className="skeleton-line !h-2 w-12" />
          <div className="skeleton-line !h-1 w-full" />
        </div>
      </div>
    </section>
  );
}

/**
 * First-viewport day composition: mascot + one phrase + calorie ring.
 * Replaces the denser «Сводка дня» card on the ration screen.
 */
export function DayHero({ selectedDate, today, refreshKey }: DayHeroProps) {
  const day = useOptionalRationDay();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    setData(null);
  }, [selectedDate]);

  useEffect(() => {
    if (day?.data?.date === selectedDate && day.data.meals) {
      setData(
        progressFromPayload(
          selectedDate,
          day.data.meals,
          day.data.water ?? {
            totalMl: 0,
            target: WATER_DAILY_TARGET_ML,
          },
          day.data.account,
        ),
      );
      return;
    }

    if (day && day.date === selectedDate) {
      return;
    }

    void (async () => {
      try {
        const [mealsResp, waterResp, accountResp] = await Promise.all([
          fetch(withBasePath(`/api/meals?date=${selectedDate}`)),
          fetch(withBasePath(`/api/water?date=${selectedDate}`)),
          fetch(withBasePath("/api/account")),
        ]);
        if (!mealsResp.ok) return;
        const meals = (await mealsResp.json()) as {
          totalCalories: number;
          totalProtein: number;
          totalFiber?: number;
          totalSugar?: number;
          target: {
            calories: number;
            protein: number;
            fiber?: number;
            sugar?: number;
          } | null;
        };
        const water = waterResp.ok
          ? ((await waterResp.json()) as { totalMl: number; target: number })
          : { totalMl: 0, target: WATER_DAILY_TARGET_ML };
        const account = accountResp.ok
          ? ((await accountResp.json()) as {
              fiberTargetG?: number | null;
              sugarTargetG?: number | null;
            })
          : null;
        setData(progressFromPayload(selectedDate, meals, water, account));
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey, day]);

  const waitingForData =
    !data &&
    (Boolean(day?.loading && day.date === selectedDate) ||
      Boolean(day && day.date === selectedDate && !day.data && !day.error) ||
      !day);

  const caloriePct =
    data?.calorieTarget && data.calorieTarget > 0
      ? (data.calories / data.calorieTarget) * 100
      : 0;
  const proteinPct =
    data?.proteinTarget && data.proteinTarget > 0
      ? (data.protein / data.proteinTarget) * 100
      : 0;

  const streak = day?.data?.streak?.streak ?? 0;
  const loggedToday = day?.data?.streak?.loggedToday ?? (data?.calories ?? 0) > 0;
  const holiday = isHolidayBufferOn(selectedDate);
  const isToday = selectedDate === today;

  const copy = useMemo(
    () =>
      buildDayHeroCopy({
        calories: data?.calories ?? 0,
        calorieTarget: data?.calorieTarget ?? null,
        caloriePct,
        streak,
        loggedToday,
        isToday,
        holiday,
      }),
    [data?.calories, data?.calorieTarget, caloriePct, streak, loggedToday, isToday, holiday],
  );

  if (waitingForData) {
    return <DayHeroSkeleton />;
  }

  const calLabel =
    data?.calorieTarget != null
      ? `${data.calories} / ${data.calorieTarget}`
      : data
        ? `${data.calories} ккал`
        : "—";

  return (
    <section className="day-hero" aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="relative flex items-center gap-3">
        <div className="day-hero-mascot relative shrink-0">
          <Mascot pose={copy.pose} size="sm" title={copy.headline} entrance animate />
          <DiarySticker className="absolute -bottom-1 -right-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-teal-800/70">
            {copy.eyebrow}
          </p>
          <p className="mt-0.5 font-display text-[0.98rem] font-semibold leading-snug text-slate-900 sm:text-base">
            {copy.headline}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {calLabel}
            {holiday ? " · праздн. запас" : ""}
          </p>
        </div>
        <HeroRing pct={data?.calorieTarget ? caloriePct : 0} />
      </div>

      {data ? (
        <div className="relative mt-2.5 flex flex-col gap-2 border-t border-teal-900/5 pt-2">
          <div className="flex gap-3">
            <MiniBar
              label="Белок"
              value={`${Math.round(data.protein)} г`}
              detail={data.proteinTarget ? `/ ${data.proteinTarget}` : ""}
              pct={data.proteinTarget ? proteinPct : 0}
            />
            <MiniBar
              label="Вода"
              value={`${Math.round(data.waterMl)} мл`}
              detail={data.waterTarget ? `/ ${data.waterTarget}` : ""}
              pct={
                data.waterTarget > 0
                  ? (data.waterMl / data.waterTarget) * 100
                  : 0
              }
            />
          </div>
          {data.showFiberSugar ? (
            <div className="flex gap-3">
              {data.fiberTarget != null ? (
                <MiniBar
                  label="Клетчатка"
                  value={`${Math.round(data.fiber)} г`}
                  detail={`/ ${Math.round(data.fiberTarget)}`}
                  pct={data.fiberTarget > 0 ? (data.fiber / data.fiberTarget) * 100 : 0}
                  warnOver={false}
                />
              ) : null}
              {data.sugarTarget != null ? (
                <MiniBar
                  label="Сахар"
                  value={`${Math.round(data.sugar)} г`}
                  detail={`/ ${Math.round(data.sugarTarget)}`}
                  pct={data.sugarTarget > 0 ? (data.sugar / data.sugarTarget) * 100 : 0}
                  warnOver
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
