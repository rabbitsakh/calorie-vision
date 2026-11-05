"use client";

import { formatDurationMinutes } from "@/lib/workouts/cardio";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import type { MuscleRecoveryMap, MuscleRecoveryRow, MuscleRecoveryStatus } from "@/lib/workouts/muscle-volume";

const STATUS_ORDER: MuscleRecoveryStatus[] = ["loaded", "recovering", "fresh"];

const STATUS_LABEL: Record<MuscleRecoveryStatus, string> = {
  loaded: "Хорошо нагружены",
  recovering: "Ещё восстанавливаются",
  fresh: "Свежие",
};

function weekValue(row: MuscleRecoveryRow): string {
  const parts: string[] = [];
  if (row.tonnage > 0) parts.push(`${formatWorkoutLoad(row.tonnage)} кг·повт`);
  if (row.durationSec > 0) parts.push(formatDurationMinutes(row.durationSec));
  if (parts.length > 0) {
    const value = parts.join(" · ");
    return row.directSets > 0 ? value : `${value} · косвенно`;
  }
  if (row.directSets > 0) return row.key === "cardio" ? "без времени" : "без отягощения";
  return "на этой неделе тихо";
}

function agoLabel(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "только что";
  if (hours < 24) return `${Math.max(1, Math.round(hours))} ч назад`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "вчера";
  return `${days} дн. назад`;
}

export function MuscleRecoveryCard({
  map,
  plain = false,
}: {
  map: MuscleRecoveryMap;
  /** Внутри уже готовой карточки недели — без второй рамки. */
  plain?: boolean;
}) {
  if (map.rows.length === 0) return null;
  const body = (
    <div className="gym-recovery">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Мышцы на этой неделе
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
          По справочнику: прямая нагрузка и доля вспомогательных. Ориентир по давности, не совет врача.
        </p>
      </div>
      {STATUS_ORDER.map((status) => {
        const rows = map.rows.filter((row) => row.status === status);
        if (rows.length === 0) return null;
        return (
          <div key={status} className="gym-recovery__band">
            <p className={`gym-recovery__status gym-recovery__status--${status}`}>{STATUS_LABEL[status]}</p>
            <ul className="gym-recovery__list">
              {rows.map((row) => {
                const ago = agoLabel(row.hoursSinceStrong);
                return (
                  <li key={row.key} className="gym-recovery__row">
                    <span className="gym-recovery__name">{row.label}</span>
                    <span className="gym-recovery__value">{weekValue(row)}</span>
                    {ago ? <span className="gym-recovery__ago">{ago}</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
  if (plain) return body;
  return <section className="gym-plane">{body}</section>;
}
