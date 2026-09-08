"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppSplash } from "@/components/AppSplash";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { DailyLog } from "@/components/DailyLog";
import { RationDayProvider, useRationDay } from "@/components/RationDayProvider";
import { WaterTracker } from "@/components/WaterTracker";
import { MotivationQueue } from "@/components/MotivationQueue";
import { CelebrationOrchestrator } from "@/components/CelebrationOrchestrator";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { TimezoneConflictBanner } from "@/components/TimezoneConflictBanner";
import { ShareMenu } from "@/components/ShareMenu";
import { ShoppingCountChip } from "@/components/ShoppingCountChip";
import { ReferralCapture } from "@/components/ReferralCapture";
import { FastingWindowBanner } from "@/components/FastingWindowBanner";
import { DayHero } from "@/components/DayHero";
import { NextStepBar } from "@/components/NextStepBar";
import { ChallengeStrip } from "@/components/ChallengeStrip";
import { ProgressHintsRow } from "@/components/ProgressHintsRow";
import { DailyQuestsStrip } from "@/components/DailyQuestsStrip";
import { OfflineMealQueueBanner } from "@/components/OfflineMealQueueBanner";
import { PendingConfirmBanner } from "@/components/PendingConfirmBanner";
import { FirstShareNudge } from "@/components/FirstShareNudge";
import { SevenDayAhaCard } from "@/components/SevenDayAhaCard";
import { QuickAddAgain } from "@/components/QuickAddAgain";
import { MascotSaveReaction } from "@/components/MascotSaveReaction";
import { BadgeUnlockHost } from "@/components/BadgeUnlockHost";
import { DIET_TARGETS_CHANGED_EVENT } from "@/lib/diet-refresh";
import { cacheLoggedDaysTotal, claimOpenCameraAfterOnboarding, shouldShowFirstShareNudge } from "@/lib/first-hour-trust";
import {
  FOOD_SAVED_EVENT,
  openFoodAdd,
  requestOpenFoodAddPicker,
  requestOpenFoodCamera,
} from "@/lib/open-food-camera";
import { parseMealQueryParam } from "@/lib/push-deeplink";
import { withBasePath } from "@/lib/paths";
import { SPLASH_MIN_VISIBLE_MS } from "@/lib/splash-tips";
import { useSelectedDate, withDateQuery } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

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
const ReferralNudge = dynamic(
  () => import("@/components/ReferralNudge").then((m) => m.ReferralNudge),
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
  setPwaWizardOpen,
  pwaWizardOpen,
  openFoodPicker,
}: {
  date: string;
  today: string;
  timezone: string | null | undefined;
  pwaWizardOpen: boolean;
  setPwaWizardOpen: (v: boolean) => void;
  openFoodPicker: () => void;
}) {
  const day = useRationDay();
  const [showHabits, setShowHabits] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const splashStartedAt = useRef<number | null>(null);
  const habitsRef = useRef<HTMLElement | null>(null);

  const openHabitsPanel = useCallback(() => {
    setShowHabits(true);
  }, []);

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
  const mealCount = useMemo(() => {
    if (Array.isArray(day.data?.meals.entries)) return day.data.meals.entries.length;
    return day.data?.meals.totalCalories ? 1 : 0;
  }, [day.data?.meals.entries, day.data?.meals.totalCalories]);
  const showShareNudge = date === today && shouldShowFirstShareNudge(mealCount);

  useEffect(() => {
    const onDietTargetsChanged = () => bump();
    window.addEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
    return () => window.removeEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
  }, [bump]);

  useEffect(() => {
    const onFoodSaved = () => bump();
    window.addEventListener(FOOD_SAVED_EVENT, onFoodSaved);
    return () => window.removeEventListener(FOOD_SAVED_EVENT, onFoodSaved);
  }, [bump]);

  useEffect(() => {
    const total = day.data?.streak?.daysLoggedTotal;
    if (typeof total === "number") cacheLoggedDaysTotal(total);
  }, [day.data?.streak?.daysLoggedTotal]);

  // Only splashDone dismisses — not the moment data arrives (that was the flash).
  const showSplash = !splashDone;
  const splashReady = Boolean(!day.loading && (day.data || day.error));

  useEffect(() => {
    if (showSplash) return;
    if (!claimOpenCameraAfterOnboarding()) return;
    const t = window.setTimeout(() => requestOpenFoodCamera(true), 500);
    return () => window.clearTimeout(t);
  }, [showSplash]);

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
        <TimezoneConflictBanner />
        <ReferralCapture signedIn />
        <OfflineMealQueueBanner onFlushed={bump} onRecognitionReady={() => bump()} />
        <PendingConfirmBanner selectedDate={date} />
        <FastingWindowBanner isToday={date === today} />
        <DayHero selectedDate={date} today={today} refreshKey={refreshKey} />
        <SevenDayAhaCard today={today} selectedDate={date} />
        <ChallengeStrip
          selectedDate={date}
          refreshKey={refreshKey}
          onOpenHabits={openHabitsPanel}
        />
        <NextStepBar selectedDate={date} today={today} />

        <WaterTracker selectedDate={date} onChanged={bump} compact />

        <DailyLog
          selectedDate={date}
          refreshKey={refreshKey}
          compact
          timezone={timezone}
          onChanged={bump}
          onTotalsChange={() => {}}
          onAddFood={openFoodPicker}
        />

        {!showShareNudge ? <ShareMenu date={date} className="px-0.5" /> : null}
        <FirstShareNudge date={date} today={today} mealCount={mealCount} />

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
        ) : day.fromCache ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <p className="min-w-0 flex-1 font-medium">
              Офлайн: показываем сохранённый день с устройства
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

        <Link
          href={withDateQuery("/plan", date)}
          className="px-1 text-sm font-medium text-slate-600 underline-offset-2 hover:text-teal-800 hover:underline"
        >
          Неделя и покупки — вкладка «План»
          <ShoppingCountChip />
        </Link>

        <MotivationQueue>
          <StreakNudge
            selectedDate={date}
            today={today}
            refreshKey={refreshKey}
            onAddFood={openFoodPicker}
            quietHide
          />
          <EveningCheckin today={today} selectedDate={date} timezone={timezone} />
          {date === today ? <DailySummaryCard today={today} /> : null}
          <MotivationTip today={today} selectedDate={date} quietHide />
          <ReferralNudge today={today} selectedDate={date} quietHide />
          <PwaInstallOnboardingPrompt onOpenWizard={() => setPwaWizardOpen(true)} />
          <PushNotificationPrompt />
        </MotivationQueue>

        <CelebrationOrchestrator>
          <section ref={habitsRef} id="habits-panel" className="card overflow-hidden scroll-mt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
              onClick={() => setShowHabits(true)}
              aria-expanded={showHabits}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">
                  Привычки и заметки
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Серия, челлендж, квесты, значки
                </p>
              </div>
              <ChevronIcon open={showHabits} />
            </button>
            <div className="flex gap-2 border-t border-slate-100 px-3 py-2 md:px-4">
              <StreakWidget selectedDate={date} refreshKey={refreshKey} mini />
              <WeeklyChallenge
                selectedDate={date}
                refreshKey={refreshKey}
                mini
                onMiniClick={openHabitsPanel}
              />
            </div>
          </section>

          {showHabits ? (
            <div
              className="habits-sheet fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="habits-sheet-title"
              onClick={() => setShowHabits(false)}
            >
              <div
                className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p id="habits-sheet-title" className="font-semibold text-slate-900">
                      Привычки и заметки
                    </p>
                    <p className="text-xs text-slate-500">Серия, челлендж, квесты</p>
                  </div>
                  <button
                    type="button"
                    className="btn-quiet text-sm text-slate-500"
                    onClick={() => setShowHabits(false)}
                  >
                    Закрыть
                  </button>
                </div>
                <div className="flex flex-col gap-3 overflow-y-auto p-3 md:gap-4 md:p-4">
                  <StreakWidget selectedDate={date} refreshKey={refreshKey} compact />
                  <ProgressHintsRow refreshKey={refreshKey} />
                  <DailyQuestsStrip selectedDate={date} today={today} refreshKey={refreshKey} />
                  <Link
                    href={withBasePath("/plan")}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-teal-200"
                  >
                    Неделя и покупки — вкладка «План»
                    <ShoppingCountChip />
                  </Link>
                  <DiaryNoteWidget selectedDate={date} />
                </div>
              </div>
            </div>
          ) : null}

          <DayOpenedCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <DailyGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <StreakMilestoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WaterGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <ProteinGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WeekPerfectCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <CheckinDoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <BadgeUnlockHost refreshKey={refreshKey} />
        </CelebrationOrchestrator>

        <PwaInstallWizard
          open={pwaWizardOpen}
          prefer="auto"
          onClose={() => setPwaWizardOpen(false)}
        />
      </div>
    </>
  );
}

function RationShell({
  date,
  today,
  timezone,
  setDate,
}: {
  date: string;
  today: string;
  timezone: string | null | undefined;
  setDate: (next: string) => void;
}) {
  const day = useRationDay();
  const [pwaWizardOpen, setPwaWizardOpen] = useState(false);
  const openFoodPicker = useCallback(() => requestOpenFoodAddPicker(), []);

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
        pwaWizardOpen={pwaWizardOpen}
        setPwaWizardOpen={setPwaWizardOpen}
        openFoodPicker={openFoodPicker}
      />
    </AppShell>
  );
}

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const meal = parseMealQueryParam(params.get("meal"));
    if (!meal) return;
    openFoodAdd({ mode: "photo", openCamera: true, mealType: meal });
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
          setDate={setDate}
        />
      </RationDayProvider>
    </AuthGate>
  );
}
