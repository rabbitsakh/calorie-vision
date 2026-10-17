"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StageScreen, type StageMetric } from "@/components/StageScreen";
import {
  buildSessionSummary,
  formatSummaryLoadLine,
  type SummaryExercise,
} from "@/lib/workouts/session-summary";
import {
  ruleNextSessionTip,
  type NextSessionTarget,
  type NextSessionTargetsCard,
} from "@/lib/workouts/next-session-targets";
import {
  clearLeverRecoveryFlag,
  getLeverMemory,
  setLeverMemory,
} from "@/lib/workouts/progression-lever-memory";
import type { ProgressionLever } from "@/lib/workouts/progression";
import {
  evaluateSessionLeverOutcome,
  leverGoalFromMemory,
  type SessionLeverOutcome,
} from "@/lib/workouts/lever-set-feedback";
import {
  formatLeverStreakHint,
  getLeverHitStreak,
  recordLeverOutcome,
} from "@/lib/workouts/lever-outcome-history";
import { formatRecoveryOutcomeLine } from "@/lib/workouts/lever-session-apply";
import { GymCollectionWear } from "@/components/workouts/GymCollectionWear";

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

function initialChosen(
  targets: NextSessionTargetsCard["targets"],
): Record<string, ProgressionLever> {
  const out: Record<string, ProgressionLever> = {};
  for (const t of targets) {
    if (t.options.length === 0) continue;
    const mem = getLeverMemory(t.name)?.lever;
    const pick =
      (mem && t.options.some((o) => o.lever === mem) ? mem : null) ??
      t.primaryLever ??
      t.options[0]?.lever ??
      null;
    if (pick) out[t.name] = pick;
  }
  return out;
}

/** I2 — hit/miss vs remembered lever from this session's top set / volume count. */
function outcomeForTarget(t: NextSessionTarget): SessionLeverOutcome | null {
  const mem = getLeverMemory(t.name);
  if (!mem) return null;
  const goal = leverGoalFromMemory(mem);
  if (!goal) return null;
  const synthetic = [
    {
      weightKg: t.basisKg,
      reps: t.sessionTopReps ?? mem.targetReps,
      setType: "working" as const,
      completed: true,
    },
  ];
  // Volume: synthesize N completed working sets so count-based hit works.
  if (goal.lever === "volume") {
    const n = Math.max(1, t.sessionWorkingCount ?? 1);
    const sets = Array.from({ length: n }, () => ({
      weightKg: t.basisKg,
      reps: t.sessionTopReps ?? mem.targetReps,
      setType: "working" as const,
      completed: true,
    }));
    return evaluateSessionLeverOutcome(sets, goal, t.lastWorkingCount);
  }
  return evaluateSessionLeverOutcome(synthetic, goal, t.lastWorkingCount);
}

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
  const [chosen, setChosen] = useState<Record<string, ProgressionLever>>(() =>
    initialChosen(targets),
  );
  const chosenKey = Object.entries(chosen)
    .map(([n, l]) => `${n}:${l}`)
    .sort()
    .join("|");
  const [tip, setTip] = useState<string | null>(null);
  const [tipLever, setTipLever] = useState<ProgressionLever | null>(null);
  const [tipExercise, setTipExercise] = useState<string | null>(null);
  /** Missed exercises that expanded the «сменить рычаг» list. */
  const [changeOpen, setChangeOpen] = useState<Record<string, boolean>>({});
  /** Bump after J1 history write so streak labels include this session. */
  const [historyTick, setHistoryTick] = useState(0);

  const leverOutcomes = useMemo(() => {
    const out: Record<string, SessionLeverOutcome> = {};
    for (const t of targets) {
      const o = outcomeForTarget(t);
      if (o) out[t.name] = o;
    }
    return out;
  }, [targetsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- targets snapshot

  const anyHit = Object.values(leverOutcomes).some((o) => o === "hit");
  const anyMiss = Object.values(leverOutcomes).some((o) => o === "miss");

  // O: snapshot recovery+hit names before N clears the flag (tip needs it).
  const recoveryHitNamesRef = useRef<string[] | null>(null);
  if (recoveryHitNamesRef.current === null && targets.length > 0) {
    recoveryHitNamesRef.current = targets
      .filter(
        (t) => leverOutcomes[t.name] === "hit" && Boolean(getLeverMemory(t.name)?.recovery),
      )
      .map((t) => t.name);
  }
  const recoveryHitNames = recoveryHitNamesRef.current ?? [];

  // N: recovery chrome from armed L flag at summary open.
  const recoveryLine = useMemo(() => {
    for (const t of targets) {
      const mem = getLeverMemory(t.name);
      if (!mem?.recovery) continue;
      const line = formatRecoveryOutcomeLine(mem.recovery, leverOutcomes[t.name]);
      if (line) return line;
    }
    // After clear, still show hit line from snapshot.
    for (const name of recoveryHitNames) {
      const line = formatRecoveryOutcomeLine("deload", "hit");
      if (line && leverOutcomes[name] === "hit") return line;
    }
    return null;
  }, [targets, leverOutcomes, historyTick, recoveryHitNames]); // eslint-disable-line react-hooks/exhaustive-deps -- historyTick after write

  useEffect(() => {
    setChosen(initialChosen(targets));
    setChangeOpen({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish summary is stable for a session
  }, [targetsKey]);

  // I2: reinforce memory for hit levers (same choice kept for next time).
  // J1: append hit/miss/close into local lever outcome history.
  // N: clear recovery flag on hit so next open doesn't stack deload.
  useEffect(() => {
    for (const t of targets) {
      const outcome = leverOutcomes[t.name];
      const lever = chosen[t.name] ?? t.primaryLever;
      if (!lever || !outcome) continue;
      if (outcome === "hit") {
        const opt = t.options.find((o) => o.lever === lever) ?? t.options[0];
        setLeverMemory({
          name: t.name,
          lever,
          basisKg: t.basisKg,
          targetKg: opt?.suggestedKg ?? null,
          targetReps: opt?.suggestedReps ?? null,
          at: date,
          recovery: null,
        });
        clearLeverRecoveryFlag(t.name);
      }
      recordLeverOutcome({
        name: t.name,
        lever,
        outcome,
        at: date,
      });
    }
    setHistoryTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per summary open
  }, [targetsKey]);

  useEffect(() => {
    if (!targetsKey) {
      setTip(null);
      setTipLever(null);
      setTipExercise(null);
      return;
    }
    const snapshot = (nextTargets?.targets ?? []).map((t) => {
      const pick = chosen[t.name] ?? t.primaryLever;
      const opt = pick ? t.options.find((o) => o.lever === pick) : null;
      return {
        ...t,
        primaryLever: pick,
        // Lock tip to the on-screen focus lever (G3).
        leverRemembered: Boolean(pick),
        line: opt ? `${t.name} → ${opt.label}: ${opt.line}` : t.line,
        suggestedKg: opt?.suggestedKg ?? t.suggestedKg,
      };
    });
    if (snapshot.length === 0) {
      setTip(null);
      return;
    }
    setTip(ruleNextSessionTip(snapshot, { recoveryHitNames }));
    setTipLever(snapshot.find((t) => t.leverRemembered)?.primaryLever ?? snapshot[0]?.primaryLever ?? null);
    setTipExercise(
      snapshot.find((t) => t.leverRemembered)?.name ?? snapshot[0]?.name ?? null,
    );
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workouts/next-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryHitNames,
            targets: snapshot.map((t) => ({
              name: t.name,
              adviceKind: t.adviceKind,
              line: t.line,
              suggestedKg: t.suggestedKg,
              basisKg: t.basisKg,
              primaryLever: t.primaryLever,
              leverRemembered: t.leverRemembered,
              options: t.options.map((o) => ({
                lever: o.lever,
                label: o.label,
                line: o.line,
                suggestedKg: o.suggestedKg,
                suggestedReps: o.suggestedReps,
              })),
            })),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          tip?: unknown;
          lever?: unknown;
          exerciseName?: unknown;
        };
        if (
          !cancelled &&
          typeof data.tip === "string" &&
          data.tip.trim().length >= 12
        ) {
          setTip(data.tip.trim());
        }
        if (
          !cancelled &&
          (data.lever === "weight" || data.lever === "volume" || data.lever === "reps")
        ) {
          setTipLever(data.lever);
        }
        if (!cancelled && typeof data.exerciseName === "string") {
          setTipExercise(data.exerciseName);
        }
      } catch {
        // keep rule tip
      }
    })();
    return () => {
      cancelled = true;
    };
    // G3: refresh tip when user picks a different lever.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot from targets + chosen
  }, [targetsKey, chosenKey]);

  const pickLever = (
    name: string,
    lever: ProgressionLever,
    basisKg: number | null,
    opt: { suggestedKg: number | null; suggestedReps: number | null },
  ) => {
    setLeverMemory({
      name,
      lever,
      basisKg,
      targetKg: opt.suggestedKg,
      targetReps: opt.suggestedReps,
      at: date,
    });
    setChosen((prev) => ({ ...prev, [name]: lever }));
  };

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
      {/* R6: equipped collection wear on finish summary */}
      <GymCollectionWear className="mb-3 [&_p]:text-white/70" />

      {recoveryLine ? (
        <p
          className="mb-3 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/15 px-3 py-2 text-sm font-semibold text-[var(--accent-soft)]"
          role="status"
        >
          {recoveryLine}
        </p>
      ) : null}

      <ul className="space-y-2">
        {card.exercises.map((ex) => (
          <li
            key={ex.name}
            className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{ex.name}</p>
              {ex.prLine ? (
                <p className="text-xs font-semibold text-[var(--accent-soft)]">{ex.prLine}</p>
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
          {anyHit ? (
            <p className="mt-1.5 text-sm font-semibold text-[var(--accent-soft)]">
              Цель по рычагу взята — оставляем на следующий раз
            </p>
          ) : anyMiss ? (
            <p className="mt-1.5 text-sm font-semibold text-amber-100">
              Цель не добрана — можно сменить рычаг
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-snug text-white/55">
              От макс. рабочего веса (без дроп-сетов). Нажмите рычаг — запомним до
              следующей.
            </p>
          )}
          <ul className="mt-2.5 space-y-3">
            {targets.map((t) => {
              const selected = chosen[t.name] ?? t.primaryLever;
              const outcome = leverOutcomes[t.name];
              const showChangeCta = outcome === "miss" && !changeOpen[t.name];
              const showLevers =
                t.options.length > 0 && (outcome !== "miss" || changeOpen[t.name] || outcome == null);
              return (
                <li key={`${t.name}-${t.line}`} className="text-sm leading-snug text-white/90">
                  <p className="font-semibold">
                    {t.name}
                    {t.basisKg != null && t.basisKg > 0 ? (
                      <span className="ml-1.5 font-medium text-white/50">
                        макс {Number.isInteger(t.basisKg) ? t.basisKg : t.basisKg} кг
                      </span>
                    ) : null}
                    {outcome === "hit" ? (
                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-soft)]">
                        цель
                      </span>
                    ) : null}
                    {historyTick > 0
                      ? (() => {
                          const streakHint = formatLeverStreakHint(getLeverHitStreak(t.name));
                          return streakHint ? (
                            <span className="ml-1.5 text-[10px] font-medium text-white/45">
                              {streakHint}
                            </span>
                          ) : null;
                        })()
                      : null}
                  </p>
                  {showChangeCta ? (
                    <button
                      type="button"
                      className="mt-1.5 w-full rounded-lg border border-amber-200/35 bg-amber-400/10 px-3 py-2 text-left text-[13px] font-semibold text-amber-50"
                      onClick={() =>
                        setChangeOpen((prev) => ({ ...prev, [t.name]: true }))
                      }
                    >
                      Сменить рычаг
                    </button>
                  ) : null}
                  {showLevers ? (
                    <ul className="mt-1.5 space-y-1" role="listbox" aria-label={`Рычаг для ${t.name}`}>
                      {t.options.map((opt) => {
                        const primary = opt.lever === selected;
                        return (
                          <li key={opt.lever}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={primary}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                                primary
                                  ? "bg-white/12 font-semibold text-white"
                                  : "text-white/70 hover:bg-white/6"
                              }`}
                              onClick={() =>
                                pickLever(t.name, opt.lever, t.basisKg, {
                                  suggestedKg: opt.suggestedKg,
                                  suggestedReps: opt.suggestedReps,
                                })
                              }
                            >
                              <span className="w-16 shrink-0 text-white/45">{opt.label}</span>
                              <span className="min-w-0 flex-1">{opt.line}</span>
                              {primary ? (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-soft)]">
                                  {outcome === "hit" || t.leverRemembered || chosen[t.name]
                                    ? "ваш"
                                    : "фокус"}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : t.options.length === 0 ? (
                    <p className="mt-1 text-[13px] text-white/75">{t.line}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {tip ? (
            <div className="mt-3 border-t border-white/10 pt-2.5">
              {tipLever || tipExercise ? (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Совет
                  {tipExercise ? ` · ${tipExercise}` : ""}
                  {tipLever === "weight"
                    ? " · вес"
                    : tipLever === "volume"
                      ? " · тоннаж"
                      : tipLever === "reps"
                        ? " · повторы"
                        : ""}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-white/65">{tip}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </StageScreen>
  );
}
