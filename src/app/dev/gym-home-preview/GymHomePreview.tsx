"use client";

import { useSearchParams } from "next/navigation";
import { MobileTabBar } from "@/components/MobileTabBar";
import { WorkoutSessionSummary } from "@/components/workouts/WorkoutSessionSummary";
import { WorkoutWeekPlan } from "@/components/workouts/WorkoutWeekPlan";
import type { SerializedRoutine } from "@/lib/workouts/routines";

const ROUTINE: SerializedRoutine = {
  id: "r1",
  name: "Жим",
  note: null,
  sortOrder: 0,
  weekdays: [3],
  planLabel: "Чт",
  muscleKeys: ["chest"],
  muscleLabels: ["Грудь"],
  exerciseCount: 4,
  exercises: [],
  updatedAt: "2026-11-12T00:00:00.000Z",
};

export function GymHomePreview() {
  const params = useSearchParams();
  const summary = params.get("screen") === "summary";
  const dark = params.get("theme") === "dark";
  const longNames = params.get("names") === "long";
  const routineName = longNames
    ? "Жим лёжа узким хватом и разводка гантелей на наклонной скамье"
    : ROUTINE.name;
  const repeatLabel = longNames
    ? "Повтор: грудь, трицепс и задняя дельта с длинным названием тренировки"
    : "Вт 10 ноя · грудь и трицепс";

  if (summary) {
    return (
      <WorkoutSessionSummary
        date="12 ноября"
        elapsedSec={48 * 60 + 12}
        totalLoad={4820}
        cardioDistanceKm={0}
        cardioDurationSec={0}
        cardioOnly={false}
        deltaPctVsPrevious={6}
        deltaPctVsTarget={null}
        previousLoad={4500}
        targetLoad={4700}
        exercises={[
          {
            name: "Жим лёжа",
            load: 1920,
            completedCount: 4,
            setCount: 4,
            prLine: "82.5 кг × 6",
            progressionKind: "up",
          },
          {
            name: "Разводка гантелей",
            load: 480,
            completedCount: 3,
            setCount: 3,
            prLine: null,
            progressionKind: "hold",
          },
        ]}
        recordLines={["Жим лёжа · 82.5 кг × 6"]}
        energyLabel="410 ккал"
        onClose={() => {}}
        onBackToList={() => {}}
        onGoToRation={() => {}}
      />
    );
  }

  return (
    <div className={`gym-preview${dark ? " gym-force-dark" : ""}`} data-layout-card>
      <div className="gym-preview__main">
        <div className="cv-segment-tabs cv-segment-tabs--3" role="tablist">
          <button type="button" className="chip chip-active min-h-9">
            Сегодня
          </button>
          <button type="button" className="chip min-h-9">
            Шаблоны
          </button>
          <button type="button" className="chip min-h-9">
            История
          </button>
        </div>
        <WorkoutWeekPlan
          todayKey="2026-11-12"
          sessions={[]}
          lastRepeat={{ id: "s1", label: repeatLabel, hint: "4 упражнения" }}
          routinesFallback={[{ ...ROUTINE, name: routineName }]}
          onOpenSession={() => {}}
          onStartBlank={() => {}}
          onRepeatLast={() => {}}
          onStartRoutine={() => {}}
          onEditRoutine={() => {}}
          onGoTemplates={() => {}}
        />
      </div>
      <MobileTabBar showAdd={false} />
    </div>
  );
}
