"use client";

import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { dayHeroAtmosphereClass } from "@/lib/day-atmosphere";
import { buildDayHeroCopy } from "@/lib/day-hero-copy";
import { applyHolidayBuffer, isHolidayBufferOn } from "@/lib/holiday-buffer";
import { hourInTimezone } from "@/lib/meal-type";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";
import {
  estimateDayWorkoutBurnKcal,
  formatWorkoutBurnHint,
  type WorkoutBurnSessionLike,
} from "@/lib/workout-day-burn";

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
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const over = pct > 105;

  return (
    <div className="day-hero-ring relative h-[6.25rem] w-[6.25rem] shrink-0 sm:h-[6.75rem] sm:w-[6.75rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={over ? "var(--warn)" : "var(--accent)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="day-hero-ring-label absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1.5">
        <span
          className={`text-[1.25rem] font-bold leading-none tracking-tight tabular-nums sm:text-[1.35rem] ${over ? "text-[var(--warn)]" : "text-[var(--accent-ink)]"}`}
        >
          {Math.round(clamped)}%
        </span>
        <span className="text-[0.6rem] font-semibold uppercase leading-none tracking-wide text-[var(--accent-ink)]/55">
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
      <div className="day-hero-scene-inner relative flex items-center gap-4 px-4 py-5 md:px-6 md:py-6">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="skeleton-line !h-2 w-16" />
          <div className="skeleton-line !h-4 w-48 max-w-full" />
          <div className="skeleton-line !h-2.5 w-32" />
        </div>
        <div className="skeleton-ring !h-[6.25rem] !w-[6.25rem] shrink-0" aria-hidden />
      </div>
    </section>
  );
}

/**
 * First-viewport day scene: one phrase + calorie ring (adult product).
 * Mascot no longer anchors the hero — G1 adult redesign.
 */
export function DayHero({ selectedDate, today, refreshKey }: DayHeroProps) {
  const day = useOptionalRationDay();
  const timezone = useTimezone();
  const [data, setData] = useState<ProgressData | null>(null);
  const [workoutBurnKcal, setWorkoutBurnKcal] = useState(0);
  const [workoutSessionCount, setWorkoutSessionCount] = useState(0);
  const atmosphere = dayHeroAtmosphereClass(hourInTimezone(new Date(), timezone));

  useEffect(() => {
    setData(null);
    setWorkoutBurnKcal(0);
    setWorkoutSessionCount(0);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/workouts?date=${selectedDate}&limit=20`));
        if (!resp.ok || cancelled) return;
        const payload = (await resp.json()) as {
          sessions?: WorkoutBurnSessionLike[];
        };
        const sessions = (payload.sessions ?? []).filter(
          (s) => Boolean(s.endedAt) || (Number(s.elapsedSec) || 0) > 0 || (Number(s.setCount) || 0) > 0,
        );
        if (cancelled) return;
        setWorkoutSessionCount(sessions.length);
        setWorkoutBurnKcal(estimateDayWorkoutBurnKcal(sessions));
      } catch {
        if (!cancelled) {
          setWorkoutSessionCount(0);
          setWorkoutBurnKcal(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  const waitingForData =
    !data &&
    (Boolean(day?.loading && day.date === selectedDate) ||
      Boolean(day && day.date === selectedDate && !day.data && !day.error) ||
      !day);

  const effectiveTarget =
    data?.calorieTarget != null && data.calorieTarget > 0
      ? data.calorieTarget + Math.max(0, workoutBurnKcal)
      : data?.calorieTarget ?? null;

  const caloriePct =
    effectiveTarget && effectiveTarget > 0 ? (data!.calories / effectiveTarget) * 100 : 0;

  const streak = day?.data?.streak?.streak ?? 0;
  const loggedToday = day?.data?.streak?.loggedToday ?? (data?.calories ?? 0) > 0;
  const holiday = isHolidayBufferOn(selectedDate);
  const isToday = selectedDate === today;

  const copy = useMemo(
    () =>
      buildDayHeroCopy({
        calories: data?.calories ?? 0,
        calorieTarget: effectiveTarget,
        caloriePct,
        streak,
        loggedToday,
        isToday,
        holiday,
      }),
    [data?.calories, effectiveTarget, caloriePct, streak, loggedToday, isToday, holiday],
  );

  if (waitingForData) {
    return <DayHeroSkeleton />;
  }

  const burnHint = formatWorkoutBurnHint(workoutBurnKcal, workoutSessionCount);
  const calLabel =
    data?.calorieTarget != null
      ? `${data.calories} / ${Math.round(effectiveTarget ?? data.calorieTarget)} ккал`
      : data
        ? `${data.calories} ккал`
        : "—";
  const proteinLabel =
    data?.proteinTarget != null && data.proteinTarget > 0
      ? `белок ${Math.round(data.protein)} / ${Math.round(data.proteinTarget)} г`
      : data && data.protein > 0
        ? `белок ${Math.round(data.protein)} г`
        : null;

  return (
    <section className={`day-hero day-hero--scene ${atmosphere}`} aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="day-hero-scene-inner relative flex items-center gap-4 px-4 py-5 md:gap-5 md:px-6 md:py-6">
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent-ink)]/75">
            {copy.eyebrow}
          </p>
          <p className="font-display mt-2 text-[1.4rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-[1.6rem]">
            {copy.headline}
          </p>
          <p className="mt-2.5 text-sm font-medium leading-relaxed text-[var(--muted-strong)]">
            {calLabel}
            {proteinLabel ? ` · ${proteinLabel}` : ""}
            {burnHint ? ` · ${burnHint}` : ""}
            {holiday ? " · праздн. запас" : ""}
          </p>
        </div>
        <HeroRing pct={effectiveTarget ? caloriePct : 0} />
      </div>
    </section>
  );
}
