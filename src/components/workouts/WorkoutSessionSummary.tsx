"use client";

import Link from "next/link";
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
  isEarlyGymUser,
  recordLeverOutcome,
} from "@/lib/workouts/lever-outcome-history";
import {
  armMissRecoveryAfterFinish,
  formatRecoveryOutcomeLine,
} from "@/lib/workouts/lever-session-apply";
import { GymCollectionWear } from "@/components/workouts/GymCollectionWear";
import { assistantGymLink } from "@/lib/push-deeplink";

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
  /** Рекорды этой тренировки, уже с названием движения. */
  recordLines?: string[];
  energyLabel?: string | null;
  energyNote?: string | null;
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
  recordLines = [],
  energyLabel = null,
  energyNote = null,
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
  /** Missed exercises that expanded the «сменить рычаг» list. */
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

  const nextSentence = (() => {
    const target = targets[0];
    if (!target) return null;
    const lever = chosen[target.name] ?? target.primaryLever;
    const option = lever ? target.options.find((item) => item.lever === lever) : null;
    return `${target.name}: ${option?.line ?? target.line}`;
  })();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish summary is stable for a session
  }, [targetsKey]);

  // I2: reinforce memory for hit levers (same choice kept for next time).
  // J1: append hit/miss/close into local lever outcome history.
  // N: clear recovery flag on hit so next open doesn't stack deload.
  // Gym loop: after 2× miss arm soft-deload / switch at finish (Today strip next day).
  useEffect(() => {
    const recoveryChosen: Record<string, ProgressionLever> = {};
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
      if (outcome === "miss") {
        const goal = armMissRecoveryAfterFinish({
          name: t.name,
          lever,
          basisKg: t.basisKg,
          basisReps: t.sessionTopReps ?? null,
          at: date,
        });
        if (goal?.lever) {
          recoveryChosen[t.name] = goal.lever;
        }
      }
    }
    if (Object.keys(recoveryChosen).length > 0) {
      setChosen((prev) => ({ ...prev, ...recoveryChosen }));
    }
    setHistoryTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per summary open
  }, [targetsKey]);

  useEffect(() => {
    if (!targetsKey) {
      setTip(null);
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
    const earlyUser = isEarlyGymUser();
    setTip(ruleNextSessionTip(snapshot, { recoveryHitNames, earlyUser }));
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workouts/next-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryHitNames,
            earlyUser,
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

  const metrics: StageMetric[] = [
    {
      key: "time",
      label: "Длительность",
      value: card.elapsedLabel,
    },
    {
      key: "load",
      label: "Тоннаж",
      value: formatSummaryLoadLine(card),
    },
    {
      key: "sets",
      label: "Подходы",
      value: `${card.completedSets}/${card.totalSets}`,
    },
  ];

  if (energyLabel) {
    metrics.push({
      key: "energy",
      label: "Расход",
      value: energyLabel,
      accent: true,
    });
  }

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
      lead={<GymCollectionWear tone="stage" />}
      metrics={metrics}
      primaryAction={
        onGoToRation
          ? { label: "К рациону", onClick: onGoToRation }
          : { label: "К списку", onClick: onBackToList }
      }
      secondaryAction={{ label: "Изменить тренировку", onClick: onClose }}
      onDismiss={onBackToList}
      dismissLabel="К списку"
    >
      {energyNote ? <p className="gym-energy-line mb-3">{energyNote}</p> : null}
      {recordLines.length > 0 ? (
        <section
          className="mb-3 rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/15 px-3 py-2.5"
          aria-label="Рекорды тренировки"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--on-ink)]/80">
            Рекорды
          </p>
          <ul className="mt-1.5 space-y-1">
            {recordLines.map((line, index) => (
              <li key={`${index}-${line}`} className="text-sm font-semibold text-[var(--accent-soft)]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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

      <section className="mt-4 rounded-2xl bg-white/10 px-3.5 py-3" aria-label="Зачёт сундука">
        <p className="font-semibold">Зачёт сундука</p>
        <p className="mt-1 text-sm leading-snug text-white/75">
          Тренировка даёт один зачёт на день. Если белок тоже закрыт, это комбо — тот же один зачёт, не второй.
        </p>
      </section>
      {nextSentence ? (
        <p className="mt-4 text-sm leading-snug text-white/88">
          В следующий раз {nextSentence}. Поменять цель можно в тренировке.
        </p>
      ) : null}
      {tip ? <p className="mt-2 text-sm leading-snug text-white/70">{tip}</p> : null}
      <Link
        href={assistantGymLink({
          prefill: tip
            ? `После тренировки ${date}. ${tip} Подскажи план на следующий раз.`
            : `После тренировки ${date}. Помоги с планом на следующий раз.`,
        })}
        className="mt-3 inline-flex text-sm font-semibold text-[var(--accent-soft)]"
      >
        Разобрать с AI
      </Link>
    </StageScreen>
  );
}
