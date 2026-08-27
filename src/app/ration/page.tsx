"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppSplash } from "@/components/AppSplash";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { DailyLog } from "@/components/DailyLog";
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { RationDayProvider, useRationDay } from "@/components/RationDayProvider";
import { WaterTracker } from "@/components/WaterTracker";
import { MotivationQueue } from "@/components/MotivationQueue";
import { CelebrationOrchestrator } from "@/components/CelebrationOrchestrator";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { FastingWindowBanner } from "@/components/FastingWindowBanner";
import { DayHero } from "@/components/DayHero";
import { NextStepBar } from "@/components/NextStepBar";
import { HolidayBufferToggle } from "@/components/HolidayBufferToggle";
import { MedicalDisclaimerNote } from "@/components/MedicalDisclaimerNote";
import { QuickAddAgain } from "@/components/QuickAddAgain";
import { DIET_TARGETS_CHANGED_EVENT } from "@/lib/diet-refresh";
import { requestOpenFoodCamera } from "@/lib/open-food-camera";
import { parseMealQueryParam } from "@/lib/push-deeplink";
import { withBasePath } from "@/lib/paths";
import { SPLASH_MIN_VISIBLE_MS } from "@/lib/splash-tips";
import type { MealType } from "@/types";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

const WeeklyPlan = dynamic(
  () => import("@/components/WeeklyPlan").then((m) => m.WeeklyPlan),
  { ssr: false, loading: () => null },
);
const ShoppingListPanel = dynamic(
  () => import("@/components/ShoppingListPanel").then((m) => m.ShoppingListPanel),
  { ssr: false, loading: () => null },
);
const StreakWidget = dynamic(
  () => import("@/components/StreakWidget").then((m) => m.StreakWidget),
  { ssr: false, loading: () => null },
);
const WeeklyChallenge = dynamic(
  () => import("@/components/WeeklyChallenge").then((m) => m.WeeklyChallenge),
  { ssr: false, loading: () => null },
);
const DiaryNoteWidget = dynamic(
  () => import("@/components/DiaryNoteWidget").then((m) => m.DiaryNoteWidget),
  { ssr: false, loading: () => null },
);
const PushNotificationPrompt = dynamic(
  () => import("@/components/PushNotificationPrompt").then((m) => m.PushNotificationPrompt),
  { ssr: false, loading: () => null },
);
const StreakNudge = dynamic(
  () => import("@/components/StreakNudge").then((m) => m.StreakNudge),
  { ssr: false, loading: () => null },
);
const DailySummaryCard = dynamic(
  () => import("@/components/DailySummaryCard").then((m) => m.DailySummaryCard),
  { ssr: false, loading: () => null },
);
const EveningCheckin = dynamic(
  () => import("@/components/EveningCheckin").then((m) => m.EveningCheckin),
  { ssr: false, loading: () => null },
);
const MotivationTip = dynamic(
  () => import("@/components/MotivationTip").then((m) => m.MotivationTip),
  { ssr: false, loading: () => null },
);
const MascotSaveReaction = dynamic(
  () => import("@/components/MascotSaveReaction").then((m) => m.MascotSaveReaction),
  { ssr: false, loading: () => null },
);
const PwaInstallOnboardingPrompt = dynamic(
  () =>
    import("@/components/PwaInstallWizard").then((m) => m.PwaInstallOnboardingPrompt),
  { ssr: false, loading: () => null },
);
const PwaInstallWizard = dynamic(
  () => import("@/components/PwaInstallWizard").then((m) => m.PwaInstallWizard),
  { ssr: false, loading: () => null },
);

const DayOpenedCelebration = dynamic(
  () => import("@/components/DayOpenedCelebration").then((m) => m.DayOpenedCelebration),
  { ssr: false },
);
const DailyGoalCelebration = dynamic(
  () => import("@/components/DailyGoalCelebration").then((m) => m.DailyGoalCelebration),
  { ssr: false },
);
const WaterGoalCelebration = dynamic(
  () => import("@/components/WaterGoalCelebration").then((m) => m.WaterGoalCelebration),
  { ssr: false },
);
const WeekPerfectCelebration = dynamic(
  () => import("@/components/WeekPerfectCelebration").then((m) => m.WeekPerfectCelebration),
  { ssr: false },
);
const CheckinDoneCelebration = dynamic(
  () => import("@/components/CheckinDoneCelebration").then((m) => m.CheckinDoneCelebration),
  { ssr: false },
);
const ProteinGoalCelebration = dynamic(
  () => import("@/components/ProteinGoalCelebration").then((m) => m.ProteinGoalCelebration),
  { ssr: false },
);
const StreakMilestoneCelebration = dynamic(
  () =>
    import("@/components/StreakMilestoneCelebration").then((m) => m.StreakMilestoneCelebration),
  { ssr: false },
);

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RationBody({
  date,
  today,
  timezone,
  deepLinkMeal,
  confirmOpen,
  setConfirmOpen,
  setPwaWizardOpen,
  pwaWizardOpen,
  scrollToFoodAdd,
  onSelectDate,
}: {
  date: string;
  today: string;
  timezone: string | null | undefined;
  deepLinkMeal: MealType | null;
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
  pwaWizardOpen: boolean;
  setPwaWizardOpen: (v: boolean) => void;
  scrollToFoodAdd: () => void;
  onSelectDate: (next: string) => void;
}) {
  const day = useRationDay();
  const [showHabits, setShowHabits] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const splashStartedAt = useRef<number | null>(null);

  useEffect(() => {
    // Date change / first paint: arm splash until bootstrap finishes.
    if (day.loading && !day.data) {
      if (splashStartedAt.current == null) {
        splashStartedAt.current = Date.now();
      }
      setSplashDone(false);
      return;
    }
    if (!day.loading && (day.data || day.error)) {
      const started = splashStartedAt.current ?? Date.now();
      const remaining = Math.max(0, SPLASH_MIN_VISIBLE_MS - (Date.now() - started));
      const t = window.setTimeout(() => {
        setSplashDone(true);
        splashStartedAt.current = null;
      }, remaining);
      return () => window.clearTimeout(t);
    }
  }, [day.loading, day.data, day.error]);

  const bump = day.bump;
  const refreshKey = day.refreshKey;
  const totalCalories = day.data?.meals.totalCalories ?? 0;

  useEffect(() => {
    const onDietTargetsChanged = () => bump();
    window.addEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
    return () => window.removeEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
  }, [bump]);

  // Only splashDone dismisses — not the moment data arrives (that was the flash).
  const showSplash = !splashDone;
  const splashReady = Boolean(!day.loading && (day.data || day.error));

  return (
    <>
      {showSplash ? (
        <AppSplash
          tipContext={{
            streak: day.data?.streak?.streak ?? null,
            loggedToday: day.data?.streak?.loggedToday ?? null,
            serverTip: day.data?.tip ?? null,
          }}
          ready={splashReady}
        />
      ) : null}

      <div className={`ration-page flex flex-col gap-2.5 md:gap-3 ${showSplash ? "invisible h-0 overflow-hidden" : ""}`}>
        <OnboardingOverlay />
        <MascotSaveReaction />
        <ProfileCompletionBanner />
        <FastingWindowBanner isToday={date === today} />
        <DayHero selectedDate={date} today={today} refreshKey={refreshKey} />
        <NextStepBar
          selectedDate={date}
          today={today}
          onAddFood={scrollToFoodAdd}
          onAddWater={() => {
            document.getElementById("water-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        {date === today ? <HolidayBufferToggle selectedDate={date} onChange={() => bump()} /> : null}
        <WeeklyPlan selectedDate={date} refreshKey={refreshKey} onSelectDate={onSelectDate} compact />
        <MedicalDisclaimerNote className="px-1" />

        <FoodAddPanel
          selectedDate={date}
          initialMealType={deepLinkMeal ?? undefined}
          onSaved={bump}
          onPendingChange={setConfirmOpen}
        />

        <DailyLog
          selectedDate={date}
          refreshKey={refreshKey}
          compact
          timezone={timezone}
          onChanged={bump}
          onTotalsChange={() => {}}
          onAddFood={scrollToFoodAdd}
        />

        {day.error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <p className="min-w-0 flex-1 font-medium">
              Не удалось загрузить день. {day.error}
            </p>
            <button
              type="button"
              className="shrink-0 font-semibold text-teal-800 underline-offset-2 hover:underline"
              disabled={day.loading}
              onClick={() => void day.refresh()}
            >
              Обновить
            </button>
          </div>
        ) : null}

        <QuickAddAgain
          selectedDate={date}
          refreshKey={refreshKey}
          totalCalories={totalCalories}
          onSaved={bump}
        />

        <ShoppingListPanel selectedDate={date} />
        <WaterTracker selectedDate={date} onChanged={bump} />

        <MotivationQueue>
          <StreakNudge
            selectedDate={date}
            today={today}
            refreshKey={refreshKey}
            onAddFood={scrollToFoodAdd}
            quietHide
          />
          <EveningCheckin today={today} selectedDate={date} timezone={timezone} />
          {date === today ? <DailySummaryCard today={today} /> : null}
          <MotivationTip today={today} selectedDate={date} quietHide />
          <PwaInstallOnboardingPrompt onOpenWizard={() => setPwaWizardOpen(true)} />
        </MotivationQueue>

        <PushNotificationPrompt />

        <section className="card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
            onClick={() => setShowHabits((value) => !value)}
            aria-expanded={showHabits}
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">Привычки и заметки</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Серия, недельный челлендж, заметка о дне
              </p>
            </div>
            <ChevronIcon open={showHabits} />
          </button>
          {!showHabits ? (
            <div className="flex gap-2 border-t border-slate-100 px-3 py-2 md:px-4">
              <StreakWidget selectedDate={date} refreshKey={refreshKey} mini />
              <WeeklyChallenge selectedDate={date} refreshKey={refreshKey} mini />
            </div>
          ) : (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-3 md:gap-4 md:p-4">
              <StreakWidget selectedDate={date} refreshKey={refreshKey} compact />
              <WeeklyChallenge selectedDate={date} refreshKey={refreshKey} />
              <DiaryNoteWidget selectedDate={date} />
            </div>
          )}
        </section>

        <CelebrationOrchestrator>
          <DayOpenedCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <DailyGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <StreakMilestoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WaterGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <ProteinGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WeekPerfectCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <CheckinDoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
        </CelebrationOrchestrator>

        <PwaInstallWizard
          open={pwaWizardOpen}
          prefer="auto"
          onClose={() => setPwaWizardOpen(false)}
        />
      </div>

      <button
        type="button"
        className={`fab-add md:hidden ${confirmOpen || showSplash ? "pointer-events-none opacity-0" : ""}`}
        aria-label="Сфотографировать еду"
        aria-hidden={confirmOpen || showSplash}
        tabIndex={confirmOpen || showSplash ? -1 : 0}
        onClick={() => requestOpenFoodCamera(true)}
      >
        <span className="fab-add-icon" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.25" />
          </svg>
        </span>
      </button>
    </>
  );
}

function RationShell({
  date,
  today,
  timezone,
  deepLinkMeal,
  setDate,
}: {
  date: string;
  today: string;
  timezone: string | null | undefined;
  deepLinkMeal: MealType | null;
  setDate: (next: string) => void;
}) {
  const day = useRationDay();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwaWizardOpen, setPwaWizardOpen] = useState(false);
  const scrollToFoodAdd = useCallback(() => {
    document.getElementById("food-add-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const openFoodCamera = useCallback(() => requestOpenFoodCamera(true), []);

  return (
    <AppShell
      title="Рацион"
      compact
      date={date}
      headerExtra={
        <DateNavBar
          date={date}
          today={today}
          refreshKey={day.refreshKey}
          onDateChange={setDate}
        />
      }
    >
      <RationBody
        date={date}
        today={today}
        timezone={timezone}
        deepLinkMeal={deepLinkMeal}
        confirmOpen={confirmOpen}
        setConfirmOpen={setConfirmOpen}
        pwaWizardOpen={pwaWizardOpen}
        setPwaWizardOpen={setPwaWizardOpen}
        scrollToFoodAdd={openFoodCamera}
        onSelectDate={setDate}
      />
    </AppShell>
  );
}

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [deepLinkMeal, setDeepLinkMeal] = useState<MealType | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const meal = parseMealQueryParam(params.get("meal"));
    if (!meal) return;
    setDeepLinkMeal(meal);
    window.requestAnimationFrame(() => {
      document.getElementById("food-add-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const clean = withBasePath("/ration");
    window.history.replaceState({}, "", clean.endsWith("/") ? clean : `${clean}/`);
  }, []);

  return (
    <AuthGate>
      <RationDayProvider date={date} today={today}>
        <RationShell
          date={date}
          today={today}
          timezone={timezone}
          deepLinkMeal={deepLinkMeal}
          setDate={setDate}
        />
      </RationDayProvider>
    </AuthGate>
  );
}
