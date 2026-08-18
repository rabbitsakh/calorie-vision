"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { WeightHistory } from "@/components/WeightHistory";

export default function WeightPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <AppShell
      title="Вес"
      description="Фиксируйте вес и следите за динамикой."
    >
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-6">
          <WeightHistory
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
          <WeightGoalCard
            selectedDate={todayKey}
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      </AuthGate>
    </AppShell>
  );
}
