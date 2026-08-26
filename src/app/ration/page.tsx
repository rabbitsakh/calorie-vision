"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { DailyLog } from "@/components/DailyLog";
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { WaterTracker } from "@/components/WaterTracker";
import { StreakWidget } from "@/components/StreakWidget";
import { StreakNudge } from "@/components/StreakNudge";
import { DiaryNoteWidget } from "@/components/DiaryNoteWidget";
import { DailySummaryCard } from "@/components/DailySummaryCard";
import { DayOpenedCelebration } from "@/components/DayOpenedCelebration";
import { DailyGoalCelebration } from "@/components/DailyGoalCelebration";
import { WaterGoalCelebration } from "@/components/WaterGoalCelebration";
import { WeekPerfectCelebration } from "@/components/WeekPerfectCelebration";
import { CheckinDoneCelebration } from "@/components/CheckinDoneCelebration";
import { ProteinGoalCelebration } from "@/components/ProteinGoalCelebration";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { EveningCheckin } from "@/components/EveningCheckin";
import { MotivationTip } from "@/components/MotivationTip";
import { WeeklyChallenge } from "@/components/WeeklyChallenge";
import { TodayProgress } from "@/components/TodayProgress";
import { MotivationQueue } from "@/components/MotivationQueue";
import { CelebrationOrchestrator } from "@/components/CelebrationOrchestrator";
import { MascotSaveReaction } from "@/components/MascotSaveReaction";
import { QuickAddAgain } from "@/components/QuickAddAgain";
import { ShoppingListPanel } from "@/components/ShoppingListPanel";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { FastingWindowBanner } from "@/components/FastingWindowBanner";
import { HolidayBufferToggle } from "@/components/HolidayBufferToggle";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import {
  PwaInstallOnboardingPrompt,
  PwaInstallWizard,
} from "@/components/PwaInstallWizard";
import { DIET_TARGETS_CHANGED_EVENT } from "@/lib/diet-refresh";
import { parseMealQueryParam } from "@/lib/push-deeplink";
import { withBasePath } from "@/lib/paths";
import type { MealType } from "@/types";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";
import { MedicalDisclaimerNote } from "@/components/MedicalDisclaimerNote";

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

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [showHabits, setShowHabits] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwaWizardOpen, setPwaWizardOpen] = useState(false);
  const [deepLinkMeal, setDeepLinkMeal] = useState<MealType | null>(null);

  const scrollToFoodAdd = useCallback(() => {
    document.getElementById("food-add-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    const onDietTargetsChanged = () => bump();
    window.addEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
    return () => window.removeEventListener(DIET_TARGETS_CHANGED_EVENT, onDietTargetsChanged);
  }, [bump]);

  // Push notification deep link: /ration?meal=BREAKFAST
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
    <AppShell
      title="Рацион"
      compact
      date={date}
      headerExtra={
        <DateNavBar
          date={date}
          today={today}
          refreshKey={refreshKey}
          onDateChange={(next) => setDate(next)}
        />
      }
    >
      <AuthGate>
        <div className="ration-page flex flex-col gap-3 md:gap-4">
          <OnboardingOverlay />
          <MascotSaveReaction />
          <ProfileCompletionBanner />
          <FastingWindowBanner isToday={date === today} />
          <TodayProgress selectedDate={date} refreshKey={refreshKey} />
          {date === today ? (
            <HolidayBufferToggle selectedDate={date} onChange={() => bump()} />
          ) : null}
          <WeeklyPlan
            selectedDate={date}
            refreshKey={refreshKey}
            onSelectDate={(next) => setDate(next)}
          />
          <MedicalDisclaimerNote className="px-1" />

          <FoodAddPanel selectedDate={date} initialMealType={deepLinkMeal ?? undefined} onSaved={bump} onPendingChange={setConfirmOpen} />

          <DailyLog
            selectedDate={date}
            refreshKey={refreshKey}
            compact
            timezone={timezone}
            onChanged={bump}
            onTotalsChange={setTotalCalories}
            onAddFood={scrollToFoodAdd}
          />

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
            {date === today ? <DailySummaryCard today={today} /> : null}
            <EveningCheckin today={today} selectedDate={date} timezone={timezone} />
            <MotivationTip today={today} selectedDate={date} quietHide />
            <PwaInstallOnboardingPrompt onOpenWizard={() => setPwaWizardOpen(true)} />
          </MotivationQueue>

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
                  Серия, недельный челлендж, заметка о дне, напоминания
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
                <PushNotificationPrompt />
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
      </AuthGate>
      <button
        type="button"
        className={`fab-add md:hidden ${confirmOpen ? "pointer-events-none opacity-0" : ""}`}
        aria-label="Добавить еду"
        aria-hidden={confirmOpen}
        tabIndex={confirmOpen ? -1 : 0}
        onClick={scrollToFoodAdd}
      >
        +
      </button>
    </AppShell>
  );
}
