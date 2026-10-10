/**
 * Pick the most recent finished (or best-effort) session to one-tap repeat.
 * Expects sessions already sorted newest-first (API default).
 */

export type LastFinishedCandidate = {
  id: string;
  date: string;
  muscleLabels: string[];
  cardioOnly: boolean;
  exerciseCount: number;
  clockStatus?: string | null;
  endedAt?: string | null;
};

export function isFinishedSession(s: LastFinishedCandidate): boolean {
  return s.clockStatus === "finished" || Boolean(s.endedAt);
}

/** Prefer finished; else newest with exercises. Skip local offline ids. */
export function pickLastFinishedSession<T extends LastFinishedCandidate>(
  sessions: T[],
  opts?: { skipLocal?: boolean },
): T | null {
  const skipLocal = opts?.skipLocal !== false;
  const usable = sessions.filter((s) => {
    if (!s.id) return false;
    if (skipLocal && s.id.startsWith("local-sess-")) return false;
    return true;
  });
  const finished = usable.find(isFinishedSession);
  if (finished) return finished;
  return usable.find((s) => s.exerciseCount > 0) ?? null;
}

export function lastSessionRepeatLabel(s: LastFinishedCandidate): string {
  return s.cardioOnly ? "Повторить кардио" : "Повторить последнюю";
}

export function lastSessionRepeatHint(s: LastFinishedCandidate): string {
  const muscles = s.muscleLabels.filter(Boolean).join(" · ");
  const base = muscles || (s.cardioOnly ? "Кардио" : "Тренировка");
  if (s.exerciseCount > 0) {
    return `${base} · ${s.exerciseCount} упр.`;
  }
  return base;
}
