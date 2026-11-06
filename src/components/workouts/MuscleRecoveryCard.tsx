"use client";

import { formatDateShort } from "@/lib/dates";
import { formatDurationMinutes } from "@/lib/workouts/cardio";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import type { MuscleRecoveryMap, MuscleRecoveryRow, MuscleRecoveryStatus } from "@/lib/workouts/muscle-volume";

const STATUS_ORDER: MuscleRecoveryStatus[] = ["loaded", "recovering", "fresh"];

const STATUS_LABEL: Record<MuscleRecoveryStatus, string> = {
  loaded: "Хорошо нагружены",
  recovering: "Ещё восстанавливаются",
  fresh: "Свежие",
};

function agoLabel(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "только что";
  if (hours < 24) return `${Math.max(1, Math.round(hours))} ч назад`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "вчера";
  return `${days} дн. назад`;
}

function inShownWeek(date: string | null, map: MuscleRecoveryMap): boolean {
  return date != null && date >= map.weekStart && date <= map.weekEnd;
}

function WeekLines({ row }: { row: MuscleRecoveryRow }) {
  const lines: string[] = [];
  if (row.directTonnage > 0) {
    lines.push(`силовая ${formatWorkoutLoad(row.directTonnage)} кг·повт`);
  }
  if (row.indirectTonnage > 0) {
    lines.push(`косвенно ${formatWorkoutLoad(row.indirectTonnage)} кг·повт`);
  }
  if (row.directDurationSec > 0) {
    lines.push(
      row.key === "cardio"
        ? `кардио ${formatDurationMinutes(row.directDurationSec)}`
        : `время ${formatDurationMinutes(row.directDurationSec)}`,
    );
  }
  if (row.indirectDurationSec > 0) {
    lines.push(`косвенно кардио ${formatDurationMinutes(row.indirectDurationSec)}`);
  }
  if (lines.length === 0 && row.directSets > 0) {
    lines.push(row.key === "cardio" ? "без времени" : "без отягощения");
  }
  if (lines.length === 0) lines.push("на этой неделе тихо");
  return (
    <p className="gym-recovery__value">
      за неделю: {lines.join(" · ")}
    </p>
  );
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
          Мышцы · объём {formatDateShort(map.weekStart)}–{formatDateShort(map.weekEnd)}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
          Первая строка — только эта неделя. Вторая — день последней прямой нагрузки и её
          объём, даже если он был раньше. Рабочие, дроп и отказ входят, разминка нет.
          Ориентир, не совет врача.
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
                const when = row.lastDirectDate ? formatDateShort(row.lastDirectDate) : null;
                const directThisWeek = inShownWeek(row.lastDirectDate, map);
                const thenLoad =
                  row.lastDirectTonnage > 0
                    ? `${formatWorkoutLoad(row.lastDirectTonnage)} кг·повт`
                    : row.lastDirectDurationSec > 0
                      ? formatDurationMinutes(row.lastDirectDurationSec)
                      : null;
                return (
                  <li key={row.key} className="gym-recovery__row">
                    <span className="gym-recovery__name">{row.label}</span>
                    <WeekLines row={row} />
                    {ago && when ? (
                      <p className="gym-recovery__ago">
                        последняя прямая: {when}
                        {ago ? ` · ${ago}` : ""}
                        {thenLoad
                          ? directThisWeek
                            ? ""
                            : ` · в тот день ${thenLoad}, не за эту неделю`
                          : ""}
                      </p>
                    ) : (
                      <p className="gym-recovery__ago">прямой тренировки ещё не было</p>
                    )}
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
