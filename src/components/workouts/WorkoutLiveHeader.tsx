"use client";

import type { ReactNode } from "react";
import { OverflowMenu, type OverflowMenuItem } from "@/components/workouts/OverflowMenu";
import { formatRecordBadge, type LiveHeaderView } from "@/lib/workouts/live-header";

type Props = {
  elapsedLabel: string;
  subtitle: string;
  clockAria: string;
  onClockClick?: () => void;
  view: LiveHeaderView;
  onBack: () => void;
  finishLabel: string;
  onFinish: () => void;
  menu: OverflowMenuItem[];
  rest?: ReactNode;
};

function compareAria(view: LiveHeaderView): string {
  const parts = [`Тоннаж ${view.tonnageLabel}`];
  if (view.previousTonnageLabel) parts.push(view.previousTonnageLabel);
  if (view.deltaLabel) parts.push(`разница ${view.deltaLabel}`);
  parts.push(`${view.setsLabel} подходов`);
  if (view.durationLabel) parts.push(`длительность ${view.durationLabel} к прошлой`);
  return parts.join(", ");
}

export function WorkoutLiveHeader({
  elapsedLabel,
  subtitle,
  clockAria,
  onClockClick,
  view,
  onBack,
  finishLabel,
  onFinish,
  menu,
  rest,
}: Props) {
  const records = formatRecordBadge(view.prCount);
  return (
    <header className="gym-live-head" data-gym-header aria-label="Шапка тренировки">
      <div className="gym-live-bar">
        <button type="button" className="gym-live-bar__back" aria-label="К списку" onClick={onBack}>
          ←
        </button>
        <button type="button" className="gym-live-bar__clock" aria-label={clockAria} onClick={onClockClick}>
          <strong>{elapsedLabel}</strong>
        </button>
        <button type="button" className="gym-finish" onClick={onFinish}>
          {finishLabel}
        </button>
        <OverflowMenu label="Действия тренировки" items={menu} />
      </div>
      <div className="gym-live-sub">
        <p className="gym-live-sub__text">{subtitle}</p>
        {rest}
      </div>
      <p className="gym-live-compare" aria-label={compareAria(view)}>
        <span className="gym-live-compare__now">{view.tonnageLabel}</span>
        {view.previousTonnageLabel ? (
          <span className="gym-live-compare__was">{view.previousTonnageLabel}</span>
        ) : null}
        {view.deltaLabel ? (
          <span className={`gym-live-compare__delta is-${view.deltaTone ?? "flat"}`}>{view.deltaLabel}</span>
        ) : null}
        <span className="gym-live-compare__sets">{view.setsLabel}</span>
        {view.durationLabel ? <span className="gym-live-compare__time">{view.durationLabel}</span> : null}
      </p>
      <p className="gym-live-goal">
        <span>{view.progressionLabel}</span>
        {records ? (
          <span className="gym-live-goal__pr" aria-label={records}>
            🏆 {view.prCount}
          </span>
        ) : null}
      </p>
    </header>
  );
}
