"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { DailyLog } from "@/components/DailyLog";
import { useSelectedDate } from "@/lib/use-selected-date";

export default function DiaryPage() {
  const { date } = useSelectedDate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell title="Дневник" description="Приёмы пищи и сравнение с рекомендуемым рационом." date={date}>
      <AuthGate>
        <DailyLog
          selectedDate={date}
          refreshKey={refreshKey}
          onChanged={() => setRefreshKey((value) => value + 1)}
        />
      </AuthGate>
    </AppShell>
  );
}
