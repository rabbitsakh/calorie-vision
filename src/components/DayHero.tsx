"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LiveMascot } from "@/components/LiveMascot";
import { DiarySticker } from "@/components/DiarySticker";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { dayHeroAtmosphereClass } from "@/lib/day-atmosphere";
import { buildDayHeroCopy } from "@/lib/day-hero-copy";
import { applyHolidayBuffer, isHolidayBufferOn } from "@/lib/holiday-buffer";
import { hourInTimezone } from "@/lib/meal-type";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { withDateQuery } from "@/lib/use-selected-date";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

type ProgressData = {
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterTarget: number;
  weightKg: number | null;
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
    target: {
      calories: number;
      protein: number;
    } | null;
  },
  water: { totalMl: number; target: number },
  weightKg?: number | null,
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
    weightKg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
  };
}

function HeroRing({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const over = pct > 105;

  return (
    <div className="day-hero-ring relative h-[4.75rem] w-[4.75rem] shrink-0">
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
          className={`font-display text-[0.875rem] font-bold leading-none tracking-tight ${over ? "text-amber-700" : "text-teal-800"}`}
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

function DayHeroSkeleton() {
  return (
    <section className="day-hero day-hero--scene" aria-busy="true" aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="relative flex items-center gap-3 px-3.5 py-4 md:px-5">
        <div className="skeleton-ring !h-14 !w-14 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton-line !h-2 w-16" />
          <div className="skeleton-line !h-3.5 w-44 max-w-full" />
          <div className="skeleton-line !h-2.5 w-28" />
        </div>
        <div className="skeleton-ring !h-[4.75rem] !w-[4.75rem] shrink-0" aria-hidden />
      </div>
    </section>
  );
}

/**
 * First-viewport day scene: atmosphere + mascot + one phrase + calorie ring.
 * Secondary metrics / week door live outside the hero (Wave A / D).
 */
export function DayHero({ selectedDate, today, refreshKey }: DayHeroProps) {
  const day = useOptionalRationDay();
  const timezone = useTimezone();
  const [data, setData] = useState<ProgressData | null>(null);
  const atmosphere = dayHeroAtmosphereClass(hourInTimezone(new Date(), timezone));

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
          day.data.weightKg,
        ),
      );
      return;
    }

    if (day && day.date === selectedDate) {
      return;
    }

    void (async () => {
      try {
        const [mealsResp, waterResp, profileResp] = await Promise.all([
          fetch(withBasePath(`/api/meals?date=${selectedDate}`)),
          fetch(withBasePath(`/api/water?date=${selectedDate}`)),
          fetch(withBasePath(`/api/profile?date=${selectedDate}`)),
        ]);
        if (!mealsResp.ok) return;
        const meals = (await mealsResp.json()) as {
          totalCalories: number;
          totalProtein: number;
          target: {
            calories: number;
            protein: number;
          } | null;
        };
        const water = waterResp.ok
          ? ((await waterResp.json()) as { totalMl: number; target: number })
          : { totalMl: 0, target: WATER_DAILY_TARGET_ML };
        const profile = profileResp.ok
          ? ((await profileResp.json()) as { selectedWeightKg?: number | null })
          : null;
        setData(
          progressFromPayload(
            selectedDate,
            meals,
            water,
            profile?.selectedWeightKg ?? null,
          ),
        );
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
      ? `${data.calories} / ${data.calorieTarget} ккал`
      : data
        ? `${data.calories} ккал`
        : "—";

  return (
    <section className={`day-hero day-hero--scene ${atmosphere}`} aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="day-hero-scene-inner relative flex items-center gap-3 px-3.5 py-4 md:px-5 md:py-5">
        <div className="day-hero-mascot relative shrink-0">
          <LiveMascot
            pose={copy.pose}
            size="md"
            title={copy.headline}
            entrance
            idleReel
            interactive
          />
          <DiarySticker className="pointer-events-none absolute -bottom-1 -right-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-900/65">
            {copy.eyebrow}
          </p>
          <p className="mt-1 font-display text-[1.05rem] font-semibold leading-snug tracking-tight text-slate-900 sm:text-lg">
            {copy.headline}
          </p>
          <p className="mt-1.5 text-xs font-medium text-slate-600">
            {calLabel}
            {holiday ? " · праздн. запас" : ""}
          </p>
          {isToday ? (
            <Link
              href={withDateQuery("/plan", selectedDate)}
              className="mt-2 inline-flex text-[0.7rem] font-semibold text-teal-800/80 underline-offset-2 hover:text-teal-900 hover:underline"
            >
              Неделя и покупки
            </Link>
          ) : null}
        </div>
        <HeroRing pct={data?.calorieTarget ? caloriePct : 0} />
      </div>
    </section>
  );
}
