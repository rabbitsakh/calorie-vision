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
import { FavoriteFoods } from "@/components/FavoriteFoods";
import { MealSuggestions } from "@/components/MealSuggestions";
import { DailySummaryCard } from "@/components/DailySummaryCard";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { QuickAddMeals } from "@/components/QuickAddMeals";
import { EveningCheckin } from "@/components/EveningCheckin";
import { MotivationTip } from "@/components/MotivationTip";
import { WeeklyChallenge } from "@/components/WeeklyChallenge";
import { TodayProgress } from "@/components/TodayProgress";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);

  const scrollToFoodAdd = useCallback(() => {
    document.getElementById("food-add-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <AppShell
      title="Рацион"
      description="Добавляйте еду и смотрите дневник за выбранный день."
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
        <div className="flex flex-col gap-4 md:gap-6">
          {date === today ? <DailySummaryCard today={today} /> : null}
          <StreakNudge
            selectedDate={date}
            today={today}
            refreshKey={refreshKey}
            onAddFood={scrollToFoodAdd}
          />
          <EveningCheckin today={today} selectedDate={date} />
          <MotivationTip today={today} selectedDate={date} />
          <TodayProgress selectedDate={date} refreshKey={refreshKey} />
          {/* Primary: add food + diary */}
          <FoodAddPanel
            selectedDate={date}
            onSaved={() => setRefreshKey((value) => value + 1)}
          />
          <DailyLog
            selectedDate={date}
            refreshKey={refreshKey}
            compact
            timezone={timezone}
            onChanged={() => setRefreshKey((value) => value + 1)}
            onTotalsChange={setTotalCalories}
          />
          <QuickAddMeals
            selectedDate={date}
            refreshKey={refreshKey}
            onSaved={() => setRefreshKey((value) => value + 1)}
          />
          <WeeklyChallenge selectedDate={date} refreshKey={refreshKey} />
          {/* Secondary: streak, water, ai, favorites, note */}
          <StreakWidget selectedDate={date} refreshKey={refreshKey} />
          <WaterTracker selectedDate={date} />
          <MealSuggestions selectedDate={date} totalCalories={totalCalories} />
          <FavoriteFoods selectedDate={date} onSaved={() => setRefreshKey((v) => v + 1)} />
          <PushNotificationPrompt />
          <DiaryNoteWidget selectedDate={date} />
        </div>
      </AuthGate>
    </AppShell>
  );
}
