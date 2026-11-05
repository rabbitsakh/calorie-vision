"use client";

import { formatRestClock } from "@/lib/workouts/rest-timer";

type Props = {
  totalSec: number;
  leftSec: number;
  running: boolean;
  onAdd?: () => void;
  onSkip?: () => void;
};

/** Крупный круг отдыха: видно с расстояния в зале. */
export function RestRing({ totalSec, leftSec, running, onAdd, onSkip }: Props) {
  const total = Math.max(1, totalSec);
  const left = Math.max(0, Math.min(total, leftSec));
  const progress = running ? left / total : 1;
  const radius = 86;
  const circ = 2 * Math.PI * radius;
  const dash = circ * progress;
  return (
    <div className="gym-rest-ring">
      <div className="gym-rest-ring__dial" aria-hidden>
        <svg viewBox="0 0 200 200">
          <circle className="gym-rest-ring__track" cx="100" cy="100" r={radius} />
          <circle
            className="gym-rest-ring__value"
            cx="100"
            cy="100"
            r={radius}
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <div className="gym-rest-ring__time">
          <span>{running ? "Отдых" : "Между подходами"}</span>
          <strong>{formatRestClock(running ? left : totalSec)}</strong>
        </div>
      </div>
      {running ? (
        <div className="gym-rest-ring__actions">
          <button type="button" onClick={onAdd}>
            +30 с
          </button>
          <button type="button" onClick={onSkip}>
            Пропустить
          </button>
        </div>
      ) : null}
    </div>
  );
}
