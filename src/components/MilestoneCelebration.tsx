"use client";

import { useEffect, useState } from "react";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-title"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 text-center shadow-xl ring-1 ring-amber-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="milestone-confetti absolute h-2 w-2 rounded-sm"
              style={{
                left: `${8 + ((i * 17) % 84)}%`,
                top: `${-10 - (i % 5) * 4}%`,
                backgroundColor: ["#f59e0b", "#ea580c", "#14b8a6", "#fbbf24", "#0d9488"][i % 5],
                animationDelay: `${(i % 8) * 0.08}s`,
                transform: `rotate(${i * 20}deg)`,
              }}
            />
          ))}
        </div>

        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h2 id="milestone-title" className="mt-3 text-2xl font-bold text-amber-900">
          {milestone} {pluralDays(milestone)}!
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {MILESTONE_COPY[milestone] ?? `Вы достигли ${milestone} дней подряд!`}
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={dismiss}>
          Продолжить
        </button>
      </div>

      <style jsx>{`
        @keyframes milestone-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) rotate(360deg);
            opacity: 0;
          }
        }
        .milestone-confetti {
          animation: milestone-fall 2.2s ease-in forwards;
        }
      `}</style>
    </div>
  );
}
