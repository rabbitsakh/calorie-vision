"use client";

import { useEffect, useState } from "react";
import { FullscreenCelebration } from "@/components/FullscreenCelebration";
import { pluralDays } from "@/lib/russian-text";

const CELEBRATION_MILESTONES = [7, 14, 30, 60, 100, 200, 365];

const MILESTONE_COPY: Record<number, string> = {
  7: "Неделя без пропусков — это уже привычка!",
  14: "Две недели подряд. Вы в форме!",
  30: "Месяц дневника — невероятно!",
  60: "Два месяца. Вы мастер регулярности!",
  100: "Сто дней! Легендарный результат!",
  200: "200 дней подряд. Вы вдохновляете!",
  365: "Год дневника! Это уровень чемпиона!",
};

function seenKey(milestone: number): string {
  return `milestone-seen-${milestone}`;
}

function isMilestoneSeen(milestone: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seenKey(milestone)) === "1";
  } catch {
    return true;
  }
}

function markMilestoneSeen(milestone: number): void {
  try {
    localStorage.setItem(seenKey(milestone), "1");
  } catch {
    // ignore
  }
}

/** Highest reached celebration milestone that hasn't been shown yet. */
export function findUnseenMilestone(streak: number): number | null {
  const reached = CELEBRATION_MILESTONES.filter((m) => streak >= m);
  for (let i = reached.length - 1; i >= 0; i--) {
    const m = reached[i]!;
    if (!isMilestoneSeen(m)) return m;
  }
  return null;
}

type MilestoneCelebrationProps = {
  streak: number;
};

/** Big streak milestones — fullscreen stage, manual dismiss. */
export function MilestoneCelebration({ streak }: MilestoneCelebrationProps) {
  const [milestone, setMilestone] = useState<number | null>(null);

  useEffect(() => {
    const next = findUnseenMilestone(streak);
    if (next != null) {
      setMilestone(next);
      markMilestoneSeen(next);
    }
  }, [streak]);

  if (milestone == null) return null;

  return (
    <FullscreenCelebration
      open
      variant="milestone"
      pose="streak"
      badge={String(milestone)}
      title={`${milestone} ${pluralDays(milestone)} подряд!`}
      subtitle={MILESTONE_COPY[milestone] ?? `Вы достигли ${milestone} дней подряд!`}
      durationMs={0}
      ctaLabel="Продолжить"
      onClose={() => setMilestone(null)}
    />
  );
}
