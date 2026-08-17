"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { useSelectedDate } from "@/lib/use-selected-date";

export default function WeightPage() {
  const { date } = useSelectedDate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell title="Вес и цель" description="Вес сохраняется на выбранный день. По нему считается рацион." date={date}>
      <AuthGate>
        <WeightGoalCard
          selectedDate={date}
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      </AuthGate>
    </AppShell>
  );
}
