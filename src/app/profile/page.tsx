"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { BackButton } from "@/components/BackButton";
import { ProfileForm } from "@/components/ProfileForm";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { BadgesPanel } from "@/components/BadgesPanel";
import { useSelectedDate } from "@/lib/use-selected-date";

export default function ProfilePage() {
  const { date } = useSelectedDate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell
      title="Профиль"
      description="Личные данные и цель по весу."
      headerExtra={<BackButton />}
    >
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-6">
          <ProfileForm />
          <BadgesPanel />
          <WeightGoalCard
            selectedDate={date}
            refreshKey={refreshKey}
            showCurrentWeight
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      </AuthGate>
    </AppShell>
  );
}
