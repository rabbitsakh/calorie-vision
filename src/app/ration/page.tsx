"use client";

import { useCallback, useState } from "react";
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
import { QuickAddAgain } from "@/components/QuickAddAgain";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [showExtras, setShowExtras] = useState(false);

  const scrollToFoodAdd = useCallback(() => {
    document.getElementById("food-add-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);

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
        <div className="flex flex-col gap-4 md:gap-5">
          <TodayProgress selectedDate={date} refreshKey={refreshKey} />

          <FoodAddPanel selectedDate={date} onSaved={bump} />
          <DailyLog
            selectedDate={date}
            refreshKey={refreshKey}
            compact
            timezone={timezone}
            onChanged={bump}
            onTotalsChange={setTotalCalories}
            onAddFood={scrollToFoodAdd}
          />

          <MotivationQueue>
            <StreakNudge
              selectedDate={date}
              today={today}
              refreshKey={refreshKey}
              onAddFood={scrollToFoodAdd}
              quietHide
            />
            {date === today ? <DailySummaryCard today={today} /> : null}
            <EveningCheckin today={today} selectedDate={date} />
            <MotivationTip today={today} selectedDate={date} quietHide />
          </MotivationQueue>

          <QuickAddAgain
            selectedDate={date}
            refreshKey={refreshKey}
            totalCalories={totalCalories}
            onSaved={bump}
          />

          <button
            type="button"
            className="self-start text-sm font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => setShowExtras((value) => !value)}
          >
            {showExtras ? "Скрыть детали дня" : "Ещё за день"}
          </button>
          {showExtras ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <WaterTracker selectedDate={date} />
                <StreakWidget selectedDate={date} refreshKey={refreshKey} compact />
              </div>
              <WeeklyChallenge selectedDate={date} refreshKey={refreshKey} />
              <PushNotificationPrompt />
              <DiaryNoteWidget selectedDate={date} />
            </div>
          ) : null}

          <DayOpenedCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <DailyGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WaterGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <ProteinGoalCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <WeekPerfectCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <CheckinDoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
          <StreakMilestoneCelebration today={today} selectedDate={date} refreshKey={refreshKey} />
        </div>
      </AuthGate>
      <button type="button" className="fab-add md:hidden" aria-label="Добавить еду" onClick={scrollToFoodAdd}>
        +
      </button>
    </AppShell>
  );
}
