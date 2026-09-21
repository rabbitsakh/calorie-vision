"use client";

import { useCallback, useEffect, useState } from "react";
import { playRestEndBeep } from "@/lib/workouts/session-clock";

const STORAGE_KEY = "cv-workout-rest-ends-at";
const SEC_KEY = "cv-workout-rest-seconds";
const SOUND_KEY = "cv-workout-rest-sound";

const REST_OPTIONS = [60, 90, 120, 180] as const;

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Rest timer that survives WebView backgrounding via localStorage.
 */
export function useWorkoutRestTimer() {
  const [restSeconds, setRestSecondsState] = useState(90);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [restSound, setRestSoundState] = useState(true);

  useEffect(() => {
    try {
      const sec = Number(localStorage.getItem(SEC_KEY));
      if (REST_OPTIONS.includes(sec as (typeof REST_OPTIONS)[number])) {
        setRestSecondsState(sec);
      }
      const sound = localStorage.getItem(SOUND_KEY);
      if (sound === "0") setRestSoundState(false);
      const ends = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(ends) && ends > Date.now()) {
        setRestEndsAt(ends);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const setRestSeconds = useCallback((sec: number) => {
    setRestSecondsState(sec);
    try {
      localStorage.setItem(SEC_KEY, String(sec));
    } catch {
      // ignore
    }
  }, []);

  const setRestSound = useCallback((on: boolean) => {
    setRestSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const startRest = useCallback(
    (overrideSec?: number) => {
      const sec = overrideSec ?? restSeconds;
      const ends = Date.now() + sec * 1000;
      setRestEndsAt(ends);
      try {
        localStorage.setItem(STORAGE_KEY, String(ends));
      } catch {
        // ignore
      }
    },
    [restSeconds],
  );

  const clearRest = useCallback(() => {
    setRestEndsAt(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!restEndsAt) {
      setRestLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) {
        setRestEndsAt(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        if (restSound) playRestEndBeep();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {
            // ignore
          }
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [restEndsAt, restSound]);

  return {
    restSeconds,
    setRestSeconds,
    restEndsAt,
    restLeft,
    restSound,
    setRestSound,
    startRest,
    clearRest,
    REST_OPTIONS,
    formatRest,
  };
}

export function WorkoutRestTimerBanner({
  restEndsAt,
  restLeft,
  onSkip,
}: {
  restEndsAt: number | null;
  restLeft: number;
  onSkip: () => void;
}) {
  if (!restEndsAt) return null;
  return (
    <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Отдых</p>
          <p className="text-3xl font-semibold tabular-nums text-slate-900">
            {formatRest(restLeft)}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          onClick={onSkip}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}

export function WorkoutRestTimerControls({
  restSeconds,
  setRestSeconds,
  restEndsAt,
  restLeft,
  restSound,
  setRestSound,
  startRest,
  clearRest,
  options = REST_OPTIONS,
}: {
  restSeconds: number;
  setRestSeconds: (n: number) => void;
  restEndsAt: number | null;
  restLeft: number;
  restSound: boolean;
  setRestSound: (v: boolean) => void;
  startRest: () => void;
  clearRest: () => void;
  options?: readonly number[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Отдых между подходами
        </p>
        <div className="flex gap-1">
          {options.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setRestSeconds(sec)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                restSeconds === sec ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {sec}с
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {restEndsAt ? formatRest(restLeft) : formatRest(restSeconds)}
        </p>
        {restEndsAt ? (
          <button type="button" className="text-sm text-slate-500" onClick={clearRest}>
            Сброс
          </button>
        ) : (
          <button type="button" className="text-sm font-medium text-teal-800" onClick={startRest}>
            Старт
          </button>
        )}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={restSound}
          onChange={(e) => setRestSound(e.target.checked)}
        />
        Звук и вибрация в конце
      </label>
    </section>
  );
}
