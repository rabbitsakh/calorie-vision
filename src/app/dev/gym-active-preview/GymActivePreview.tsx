"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExerciseRow } from "@/components/workouts/ExerciseRow";
import { MobileTabBar } from "@/components/MobileTabBar";
import { RestTimer } from "@/components/workouts/RestTimer";
import { SetTable } from "@/components/workouts/SetTable";
import { WorkoutLiveHeader } from "@/components/workouts/WorkoutLiveHeader";
import { WorkoutRestTimerBanner } from "@/components/workouts/WorkoutRestTimer";
import { buildSetTableRows, type SetTableRowModel } from "@/lib/workouts/active-set-table";
import type { SetTableFields } from "@/components/workouts/SetTable";
import {
  buildLiveHeaderView,
  formatExerciseTonnage,
  type LiveHeaderExercise,
} from "@/lib/workouts/live-header";
import { exerciseLoad } from "@/lib/workouts/load";

function movePreviewRow(
  rows: SetTableRowModel[],
  setId: string,
  direction: "up" | "down",
): SetTableRowModel[] {
  const index = rows.findIndex((row) => row.setId === setId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length || !rows[target]?.setId) return rows;
  const next = [...rows];
  const current = next[index]!;
  next[index] = next[target]!;
  next[target] = current;
  return next.map((row, number) => ({ ...row, number: number + 1 }));
}

const LAST = [
  { weightKg: 60, reps: 8 },
  { weightKg: 80, reps: 8 },
  { weightKg: 80, reps: 6 },
];

const done = (weightKg: number, reps: number, setType = "working") => ({
  weightKg,
  reps,
  setType,
  completed: true as const,
});

const PREVIEW_EXERCISES: LiveHeaderExercise[] = [
  {
    kind: "strength",
    lastSetCount: 8,
    bestKg: 100,
    targetKg: 105,
    sets: [done(40, 10, "warmup"), ...Array.from({ length: 6 }, () => done(100, 8)), done(105, 8)],
  },
  {
    kind: "strength",
    lastSetCount: 8,
    bestKg: 140,
    targetKg: 147,
    sets: Array.from({ length: 4 }, () => done(140, 5)),
  },
];

const PREVIEW_HEADER = buildLiveHeaderView({
  exercises: PREVIEW_EXERCISES,
  previous: { tonnage: 7900, elapsedSec: 40 * 60 },
  elapsedSec: 34 * 60 + 15,
  prCount: 1,
});

const PREVIEW_LOADS = PREVIEW_EXERCISES.map((exercise) =>
  formatExerciseTonnage(
    exerciseLoad({ kind: exercise.kind, sets: exercise.sets.map((set) => ({ ...set })) }),
  ),
);

export function GymActivePreview() {
  const params = useSearchParams();
  const dark = params.get("theme") === "dark";
  const rest = params.get("rest") !== "0";
  const [restSeconds, setRestSeconds] = useState(90);
  const [rows, setRows] = useState(() =>
    buildSetTableRows({
      kind: "strength",
      sets: [
        {
          id: "s1",
          weightKg: 60,
          reps: 8,
          distanceKm: null,
          durationSec: null,
          setType: "warmup",
          completed: true,
        },
        {
          id: "s2",
          weightKg: 80,
          reps: 8,
          distanceKm: null,
          durationSec: null,
          setType: "working",
          completed: true,
        },
      ],
      lastSets: LAST,
      draft: { kg: "82.5", reps: "6", km: "", time: "", setType: "working", rpe: "" },
    }),
  );

  const patch = (row: SetTableRowModel, fields: SetTableFields) => {
    setRows((current) =>
      current.map((item) => (item.key === row.key ? { ...item, ...fields } : item)),
    );
  };

  return (
    <div className={`cv-app-frame${dark ? " gym-force-dark" : ""}`}>
      <main className="app-shell cv-app-main mx-auto flex w-full max-w-6xl flex-1 flex-col gap-1.5 px-2.5 py-1.5">
        <div className="gym-session-scene" data-layout-card>
          <WorkoutLiveHeader
            elapsedLabel="34:15"
            subtitle="идёт · 183 ккал · Ноги"
            clockAria="Время тренировки, расход 183 ккал"
            view={PREVIEW_HEADER}
            onBack={() => {}}
            finishLabel="Завершить"
            onFinish={() => {}}
            menu={[
              { key: "pause", label: "Пауза", onClick: () => {} },
              { key: "note", label: "Заметка", onClick: () => {} },
            ]}
            rest={
              <RestTimer
                compact
                restSeconds={restSeconds}
                setRestSeconds={setRestSeconds}
                restEndsAt={null}
                restLeft={0}
                restSound={false}
                setRestSound={() => {}}
                startRest={() => {}}
                clearRest={() => {}}
                options={[60, 90, 120, 180]}
              />
            }
          />

          <div className="gym-ss">
            <div className="gym-ss__rail" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="gym-ss__label">Суперсет · 1 из 2</p>
              <ExerciseRow
                name="Присед"
                muscle="Ноги · 100 → 105"
                doneLabel="8/8"
                loadLabel={PREVIEW_LOADS[0]}
                bestTarget={null}
                expanded
                superset={null}
                menu={[{ key: "note", label: "Ещё", onClick: () => {} }]}
                onToggle={() => {}}
              >
                <SetTable
                  kind="strength"
                  rows={rows}
                  addLabel="+ Подход"
                  onFieldChange={patch}
                  onCommit={patch}
                  onLog={() => {}}
                  onCycleType={() => {}}
                  onAddSet={() => {}}
                  onMoveSet={(setId, direction) => {
                    setRows((current) => movePreviewRow(current, setId, direction));
                  }}
                  onDeleteSet={() => {}}
                />
              </ExerciseRow>
              <p className="gym-ss__label">Суперсет · 2 из 2 · следом</p>
              <ExerciseRow
                name="Жим ногами"
                muscle="Ноги · 140 → 147"
                doneLabel="4/8"
                loadLabel={PREVIEW_LOADS[1]}
                bestTarget={null}
                expanded={false}
                superset={null}
                menu={[{ key: "note", label: "Ещё", onClick: () => {} }]}
                onToggle={() => {}}
              />
            </div>
          </div>
        </div>
      </main>
      {rest ? (
        <WorkoutRestTimerBanner
          restEndsAt={Date.now() + 42_000}
          restLeft={42}
          restSeconds={90}
          onSkip={() => {}}
          onAdd={() => {}}
        />
      ) : null}
      <MobileTabBar showAdd={false} />
    </div>
  );
}
