"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DateNavBar } from "@/components/DateNavBar";
import { DailyLog } from "@/components/DailyLog";
import { FoodAddPanel } from "@/components/FoodAddPanel";
import { WaterTracker } from "@/components/WaterTracker";
import { StreakWidget } from "@/components/StreakWidget";
import { DiaryNoteWidget } from "@/components/DiaryNoteWidget";
import { FavoriteFoods } from "@/components/FavoriteFoods";
import { MealSuggestions } from "@/components/MealSuggestions";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

export default function RationPage() {
  const timezone = useTimezone();
  const { date, setDate, today } = useSelectedDate(timezone);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);

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
          {/* Secondary: streak, water, ai, favorites, note */}
          <StreakWidget selectedDate={date} refreshKey={refreshKey} />
          <WaterTracker selectedDate={date} />
          <MealSuggestions selectedDate={date} totalCalories={totalCalories} />
          <FavoriteFoods selectedDate={date} onSaved={() => setRefreshKey((v) => v + 1)} />
          <DiaryNoteWidget selectedDate={date} />
        </div>
      </AuthGate>
    </AppShell>
  );
}
