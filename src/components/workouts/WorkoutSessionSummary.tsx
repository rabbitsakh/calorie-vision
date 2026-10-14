"use client";

import { useEffect, useState } from "react";
import { StageScreen, type StageMetric } from "@/components/StageScreen";
import {
  buildSessionSummary,
  formatSummaryLoadLine,
  type SummaryExercise,
} from "@/lib/workouts/session-summary";
import {
  ruleNextSessionTip,
  type NextSessionTargetsCard,
} from "@/lib/workouts/next-session-targets";

type Props = {
  date: string;
  elapsedSec: number;
  totalLoad: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  cardioOnly: boolean;
  deltaPctVsPrevious: number | null;
  deltaPctVsTarget: number | null;
  previousLoad: number;
  targetLoad: number;
  exercises: SummaryExercise[];
  /** Rule-based next-session targets (Wave L). */
  nextTargets?: NextSessionTargetsCard | null;
  onClose: () => void;
  onBackToList: () => void;
  /** Primary CTA after finish — default list; ration is preferred post-gym flow. */
  onGoToRation?: () => void;
};

export function WorkoutSessionSummary({
  date,
  elapsedSec,
  totalLoad,
  cardioDistanceKm,
  cardioDurationSec,
  cardioOnly,
  deltaPctVsPrevious,
  deltaPctVsTarget,
  previousLoad,
  targetLoad,
  exercises,
  nextTargets = null,
  onClose,
  onBackToList,
  onGoToRation,
}: Props) {
  const card = buildSessionSummary({
    date,
    elapsedSec,
    totalLoad,
    cardioDistanceKm,
    cardioDurationSec,
    cardioOnly,
    deltaPctVsPrevious,
    deltaPctVsTarget,
    previousLoad,
    targetLoad,
    exercises,
  });

  const targets = nextTargets?.targets ?? [];
  const targetsKey = targets.map((t) => `${t.adviceKind}:${t.line}`).join("|");
  const [tip, setTip] = useState<string | null>(() =>
    targets.length > 0 ? ruleNextSessionTip(targets) : null,
  );

  useEffect(() => {
    if (!targetsKey) {
      setTip(null);
      return;
    }
    const snapshot = nextTargets?.targets ?? [];
    if (snapshot.length === 0) {
      setTip(null);
      return;
    }
    setTip(ruleNextSessionTip(snapshot));
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workouts/next-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targets: snapshot.map((t) => ({
              name: t.name,
              adviceKind: t.adviceKind,
              line: t.line,
              suggestedKg: t.suggestedKg,
              basisKg: t.basisKg,
              primaryLever: t.primaryLever,
              options: t.options.map((o) => ({
                lever: o.lever,
                label: o.label,
                line: o.line,
              })),
            })),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { tip?: unknown };
        if (
          !cancelled &&
          typeof data.tip === "string" &&
          data.tip.trim().length >= 12
        ) {
          setTip(data.tip.trim());
        }
      } catch {
        // keep rule tip
      }
    })();
    return () => {
      cancelled = true;
    };
    // targetsKey encodes advice + lines; nextTargets is rebuilt each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish summary is stable for a session
  }, [targetsKey]);

  const metrics: StageMetric[] = [
    {
      key: "load",
      label: "Нагрузка",
      value: formatSummaryLoadLine(card),
    },
    {
      key: "sets",
      label: "Подходы",
      value: `${card.completedSets}/${card.totalSets}`,
    },
  ];

  if (card.deltaPctVsPrevious != null) {
    metrics.push({
      key: "delta",
      label: "К прошлой",
      value: `${card.deltaPctVsPrevious > 0 ? "+" : ""}${card.deltaPctVsPrevious}%`,
    });
  }

  if (card.prCount > 0) {
    metrics.push({
      key: "prs",
      label: "Рекорды",
      value: card.prCount,
      accent: true,
    });
  }

  return (
    <StageScreen
      eyebrow="Итог тренировки"
      headline={card.headline}
      subline={`${card.elapsedLabel} · ${date}`}
      metrics={metrics}
      primaryAction={
        onGoToRation
          ? { label: "К рациону", onClick: onGoToRation }
          : { label: "К списку", onClick: onBackToList }
      }
      secondaryAction={
        onGoToRation
          ? { label: "К списку", onClick: onBackToList }
          : { label: "Остаться в тренировке", onClick: onClose }
      }
    >
      <ul className="space-y-2">
        {card.exercises.map((ex) => (
          <li
            key={ex.name}
            className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{ex.name}</p>
              {ex.prLine ? (
                <p className="text-xs font-semibold text-teal-300">{ex.prLine}</p>
              ) : ex.progressionKind === "stall" ? (
                <p className="text-xs text-amber-200">Плато — подумайте о deload</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm tabular-nums text-white/55">
              {ex.completedCount}/{ex.setCount}
              {ex.load > 0 ? ` · ${Math.round(ex.load)}` : ""}
            </p>
          </li>
        ))}
      </ul>

      {targets.length > 0 ? (
        <section
          className="mt-5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3.5 py-3"
          aria-label={nextTargets?.title ?? "Следующий раз"}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--on-ink)]/80">
            {nextTargets?.title ?? "Следующий раз"}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/55">
            От макс. рабочего веса (без дроп-сетов). Выберите один рычаг.
          </p>
          <ul className="mt-2.5 space-y-3">
            {targets.map((t) => (
              <li key={`${t.name}-${t.line}`} className="text-sm leading-snug text-white/90">
                <p className="font-semibold">
                  {t.name}
                  {t.basisKg != null && t.basisKg > 0 ? (
                    <span className="ml-1.5 font-medium text-white/50">
                      макс {Number.isInteger(t.basisKg) ? t.basisKg : t.basisKg} кг
                    </span>
                  ) : null}
                </p>
                {t.options.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {t.options.map((opt) => {
                      const primary = opt.lever === t.primaryLever;
                      return (
                        <li
                          key={opt.lever}
                          className={`flex gap-2 text-[13px] ${
                            primary ? "font-semibold text-white" : "text-white/70"
                          }`}
                        >
                          <span className="w-16 shrink-0 text-white/45">{opt.label}</span>
                          <span>{opt.line}</span>
                          {primary ? (
                            <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-soft)]">
                              фокус
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-white/75">{t.line}</p>
                )}
              </li>
            ))}
          </ul>
          {tip ? (
            <p className="mt-3 text-xs leading-relaxed text-white/65">{tip}</p>
          ) : null}
        </section>
      ) : null}
    </StageScreen>
  );
}
