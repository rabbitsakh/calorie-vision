"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { WeightHistory } from "@/components/WeightHistory";
import { WeightTargetCelebration } from "@/components/WeightTargetCelebration";
import { toDateKeyTz } from "@/lib/dates";
import { useTimezone } from "@/lib/use-timezone";

export default function WeightPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const timezone = useTimezone();
  const todayKey = toDateKeyTz(new Date(), timezone);

  return (
    <AppShell
      title="Вес"
      compact
    >
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-6">
          <WeightHistory
            refreshKey={refreshKey}
            timezone={timezone}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
          <WeightGoalCard
            selectedDate={todayKey}
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
          <WeightTargetCelebration refreshKey={refreshKey} />
        </div>
      </AuthGate>
    </AppShell>
  );
}
