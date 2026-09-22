"use client";

import { useCallback, useEffect, useState } from "react";
import { playRestEndBeep } from "@/lib/workouts/session-clock";
import {
  REST_OPTIONS,
  formatRestClock,
  resolveRestDuration,
} from "@/lib/workouts/rest-timer";

const STORAGE_KEY = "cv-workout-rest-ends-at";
const SEC_KEY = "cv-workout-rest-seconds";
const SOUND_KEY = "cv-workout-rest-sound";

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
    (overrideSec?: unknown) => {
      const sec = resolveRestDuration(overrideSec, restSeconds);
      const ends = Date.now() + sec * 1000;
      setRestEndsAt(ends);
      setRestLeft(sec);
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
    setRestLeft(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!restEndsAt || !Number.isFinite(restEndsAt)) {
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
    formatRest: formatRestClock,
  };
}

/** Fixed overlay so rest is visible even when scrolled into sets. */
export function WorkoutRestTimerBanner({
  restEndsAt,
  restLeft,
  onSkip,
}: {
  restEndsAt: number | null;
  restLeft: number;
  onSkip: () => void;
}) {
  if (!restEndsAt || !Number.isFinite(restEndsAt)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-2xl border border-teal-400 bg-teal-50 px-4 py-3 shadow-lg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Отдых</p>
          <p className="text-3xl font-semibold tabular-nums text-slate-900">
            {formatRestClock(restLeft)}
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
  compact,
}: {
  restSeconds: number;
  setRestSeconds: (n: number) => void;
  restEndsAt: number | null;
  restLeft: number;
  restSound: boolean;
  setRestSound: (v: boolean) => void;
  startRest: (sec?: number) => void;
  clearRest: () => void;
  options?: readonly number[];
  /** Inline under session clock — less chrome. */
  compact?: boolean;
}) {
  const running = Boolean(restEndsAt && Number.isFinite(restEndsAt));
  return (
    <div className={compact ? "mt-3 border-t border-teal-200/80 pt-3" : "rounded-2xl border border-slate-200 bg-white p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            compact ? "text-teal-800" : "text-slate-500"
          }`}
        >
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
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">
          {running ? formatRestClock(restLeft) : formatRestClock(restSeconds)}
        </p>
        {running ? (
          <button type="button" className="text-sm text-slate-500" onClick={clearRest}>
            Сброс
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => startRest()}
          >
            Старт отдыха
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
    </div>
  );
}
