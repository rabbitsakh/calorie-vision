"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
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

/** Big streak milestones — same visual language as SoftCelebration, manual dismiss. */
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

  function dismiss() {
    setMilestone(null);
  }

  return (
    <div
      className="soft-celeb-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-title"
      onClick={dismiss}
    >
      <div
        className="soft-celeb-card relative w-full max-w-sm overflow-hidden rounded-3xl bg-white px-5 py-6 text-center shadow-xl ring-1 ring-teal-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="milestone-confetti absolute h-1.5 w-1.5 rounded-sm"
              style={{
                left: `${10 + ((i * 19) % 80)}%`,
                top: `${-8 - (i % 4) * 3}%`,
                backgroundColor: ["#0f766e", "#14b8a6", "#f59e0b", "#5eead4"][i % 4],
                animationDelay: `${(i % 6) * 0.07}s`,
                transform: `rotate(${i * 18}deg)`,
              }}
            />
          ))}
        </div>

        <div className="soft-celeb-ring pointer-events-none absolute left-1/2 top-3 h-24 w-24 -translate-x-1/2 rounded-full bg-teal-100/80" aria-hidden />
        <div className="relative mx-auto mb-2 flex flex-col items-center">
          <Mascot pose="streak" size="lg" className="mascot-bob" />
          <span className="mt-1 rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-bold text-white">
            {milestone}
          </span>
        </div>
        <h2 id="milestone-title" className="text-xl font-bold text-slate-900">
          {milestone} {pluralDays(milestone)} подряд!
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {MILESTONE_COPY[milestone] ?? `Вы достигли ${milestone} дней подряд!`}
        </p>
        <button
          type="button"
          className="btn btn-on-tint mt-5 w-full text-teal-800"
          onClick={dismiss}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
