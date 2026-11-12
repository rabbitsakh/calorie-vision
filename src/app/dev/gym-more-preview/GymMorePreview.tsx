"use client";

import { useSearchParams } from "next/navigation";
import { ExerciseHistorySheet } from "@/components/workouts/ExerciseHistorySheet";
import { WorkoutHistoryHub } from "@/components/workouts/WorkoutHistoryHub";
import { WorkoutTemplatesPanel } from "@/components/workouts/WorkoutTemplatesPanel";
import type { HistoryChartPoint } from "@/components/workouts/ExerciseHistorySheet";

const CHART: HistoryChartPoint[] = [
  { date: "2026-09-18", weight: 70, volume: 1600, pace: null, distance: 0, duration: 0, reps: 8, estimated1Rm: 88, bestSetKg: 70, bestSetReps: 8 },
  { date: "2026-10-02", weight: 72.5, volume: 1740, pace: null, distance: 0, duration: 0, reps: 8, estimated1Rm: 91, bestSetKg: 72.5, bestSetReps: 8 },
  { date: "2026-10-16", weight: 75, volume: 1800, pace: null, distance: 0, duration: 0, reps: 8, estimated1Rm: 95, bestSetKg: 75, bestSetReps: 8 },
  { date: "2026-10-30", weight: 77.5, volume: 1860, pace: null, distance: 0, duration: 0, reps: 8, estimated1Rm: 98, bestSetKg: 77.5, bestSetReps: 8 },
  { date: "2026-11-06", weight: 80, volume: 1920, pace: null, distance: 0, duration: 0, reps: 8, estimated1Rm: 101, bestSetKg: 80, bestSetReps: 8 },
  { date: "2026-11-12", weight: 82.5, volume: 1980, pace: null, distance: 0, duration: 0, reps: 6, estimated1Rm: 99, bestSetKg: 82.5, bestSetReps: 6 },
];

export function GymMorePreview() {
  const params = useSearchParams();
  const screen = params.get("screen") ?? "chart";
  const dark = params.get("theme") === "dark";
  return (
    <div className={`gym-preview${dark ? " gym-force-dark" : ""}`}>
      <div className="gym-preview__main">
        {screen === "templates" ? (
          <WorkoutTemplatesPanel
            routines={[
              { id: "1", name: "Жим", planLabel: "Чт", muscleLabels: ["Грудь", "Трицепс"], exerciseCount: 4 },
              { id: "2", name: "Тяга", planLabel: "Пн", muscleLabels: ["Спина"], exerciseCount: 4 },
            ]}
            busy={false}
            onCreateNew={() => {}}
            onStart={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ) : null}
        {screen === "history" ? (
          <WorkoutHistoryHub
            todayKey="2026-11-12"
            sessions={[
              {
                id: "a",
                date: "2026-11-10",
                muscleLabels: ["Грудь", "Трицепс"],
                exerciseCount: 4,
                setCount: 16,
                totalLoad: 3240,
                cardioOnly: false,
                cardioDistanceKm: 0,
                cardioDurationSec: 0,
                clockStatus: "finished",
                elapsedLabel: "48 мин",
                prCount: 1,
              },
            ]}
            loading={false}
            error={null}
            creating={false}
            busy={false}
            queuedSets={0}
            insights={null}
            filterPeriod="month"
            filterDate={null}
            filterCardio={false}
            filterGroups={[]}
            calYear={2026}
            calMonth={10}
            calMarked={{ "2026-11-10": 1, "2026-11-06": 1 }}
            monthSummary={{ sessionCount: 4, tonnage: 12400, cardioDistanceKm: 0 }}
            onNewSession={() => {}}
            onCalPrev={() => {}}
            onCalNext={() => {}}
            onPickDay={() => {}}
            onSetFilterPeriod={() => {}}
            onToggleCardio={() => {}}
            onToggleGroup={() => {}}
            onFlushQueue={() => {}}
            onOpenSession={() => {}}
            onRepeat={() => {}}
            onSaveAsRoutine={() => {}}
          />
        ) : null}
      </div>
      {screen === "chart" ? (
        <ExerciseHistorySheet
          name="Жим лёжа"
          kind="strength"
          bundle={{
            points: CHART.map((point) => ({
              date: point.date,
              topWeightKg: point.bestSetKg ?? point.weight,
              topReps: point.bestSetReps ?? point.reps,
              totalLoad: point.volume,
              setCount: 4,
            })),
            chart: CHART,
            prSummary: "Рекорд 82.5 × 6 · 6 ноября",
            kind: "strength",
            topWeightDeltaKg: 2.5,
            bestPaceDeltaSec: null,
            metric: "weight",
          }}
          onMetric={() => {}}
          onClose={() => {}}
        />
      ) : null}
    </div>
  );
}
