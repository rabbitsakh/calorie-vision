"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExerciseRow } from "@/components/workouts/ExerciseRow";
import { MobileTabBar } from "@/components/MobileTabBar";
import { OverflowMenu } from "@/components/workouts/OverflowMenu";
import { SetTable } from "@/components/workouts/SetTable";
import { WorkoutRestTimerBanner } from "@/components/workouts/WorkoutRestTimer";
import { buildSetTableRows, type SetTableRowModel } from "@/lib/workouts/active-set-table";
import type { SetTableFields } from "@/components/workouts/SetTable";

const LAST = [
  { weightKg: 60, reps: 8 },
  { weightKg: 80, reps: 8 },
  { weightKg: 80, reps: 6 },
];

export function GymActivePreview() {
  const params = useSearchParams();
  const dark = params.get("theme") === "dark";
  const rest = params.get("rest") !== "0";
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
    <div className="gym-preview">
      <div className={`gym-preview__body${dark ? " gym-force-dark" : ""}`}>
      <div className="gym-session-scene gym-preview__main">
        <div className="gym-live-bar">
          <button type="button" className="gym-live-bar__back" aria-label="К списку">
            ←
          </button>
          <div className="gym-live-bar__clock">
            <strong>24:18</strong>
            <span>идёт · ~320 ккал · грудь</span>
          </div>
          <button type="button" className="gym-finish">
            Завершить
          </button>
          <OverflowMenu
            label="Действия тренировки"
            items={[
              { key: "pause", label: "Пауза", onClick: () => {} },
              { key: "note", label: "Заметка", onClick: () => {} },
            ]}
          />
        </div>

        <div className="gym-ss">
          <div className="gym-ss__rail" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="gym-ss__label">Суперсет · 1 из 2</p>
            <ExerciseRow
              name="Жим лёжа"
              muscle="Грудь · было 80, цель 82.5"
              doneLabel="2/4"
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
                onMoveSet={() => {}}
                onDeleteSet={() => {}}
              />
            </ExerciseRow>
            <p className="gym-ss__label">Суперсет · 2 из 2 · следом</p>
            <ExerciseRow
              name="Разводка гантелей"
              muscle="0/3 · после жима"
              doneLabel="0/3"
              bestTarget={null}
              expanded={false}
              superset={null}
              menu={[{ key: "note", label: "Ещё", onClick: () => {} }]}
              onToggle={() => {}}
            />
          </div>
        </div>
      </div>
        {rest ? (
          <div className="gym-rest-slot">
            <WorkoutRestTimerBanner
              restEndsAt={Date.now() + 42_000}
              restLeft={42}
              restSeconds={90}
              onSkip={() => {}}
              onAdd={() => {}}
            />
          </div>
        ) : null}
      </div>
      <div className="gym-preview__tabs">
        <MobileTabBar showAdd={false} />
      </div>
    </div>
  );
}

