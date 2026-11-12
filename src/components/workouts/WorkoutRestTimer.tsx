"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playRestEndBeep } from "@/lib/workouts/session-clock";
import {
  clearRestNotification,
  readNativeRestEndsAt,
  shiftRestNotification,
  startRestNotification,
  subscribeRestNotificationActions,
} from "@/lib/workouts/rest-notify";
import {
  REST_OPTIONS,
  formatRestClock,
  hydrateExerciseRestMap,
  readExerciseRestMap,
  resolveRestDuration,
} from "@/lib/workouts/rest-timer";
import type { WorkoutPrefs } from "@/lib/workouts/workout-prefs";
import { withBasePath } from "@/lib/paths";

const STORAGE_KEY = "cv-workout-rest-ends-at";
const SEC_KEY = "cv-workout-rest-seconds";
const SOUND_KEY = "cv-workout-rest-sound";

function pushWorkoutPrefs(patch: WorkoutPrefs): void {
  void fetch(withBasePath("/api/account"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workoutPrefs: {
        defaultRestSec: patch.defaultRestSec,
        byExercise: { ...readExerciseRestMap(), ...patch.byExercise },
        sound: patch.sound,
      },
    }),
  }).catch(() => {
    // offline — localStorage already updated
  });
}

/**
 * Rest timer that survives WebView backgrounding via localStorage.
 * Hydrates/pushes default rest + per-exercise map via account.workoutPrefs.
 */
export function useWorkoutRestTimer() {
  const [restSeconds, setRestSecondsState] = useState(90);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [restSound, setRestSoundState] = useState(true);
  const nativeAlarm = useRef(false);

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

    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { workoutPrefs?: WorkoutPrefs | null };
        const prefs = data.workoutPrefs;
        if (!prefs) return;
        if (prefs.byExercise) hydrateExerciseRestMap(prefs.byExercise);
        if (
          typeof prefs.defaultRestSec === "number" &&
          REST_OPTIONS.includes(prefs.defaultRestSec as (typeof REST_OPTIONS)[number])
        ) {
          setRestSecondsState(prefs.defaultRestSec);
          try {
            localStorage.setItem(SEC_KEY, String(prefs.defaultRestSec));
          } catch {
            // ignore
          }
        }
        if (typeof prefs.sound === "boolean") {
          setRestSoundState(prefs.sound);
          try {
            localStorage.setItem(SOUND_KEY, prefs.sound ? "1" : "0");
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const setRestSeconds = useCallback((sec: number) => {
    setRestSecondsState(sec);
    try {
      localStorage.setItem(SEC_KEY, String(sec));
    } catch {
      // ignore
    }
    pushWorkoutPrefs({ defaultRestSec: sec });
  }, []);

  const setRestSound = useCallback((on: boolean) => {
    setRestSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
    pushWorkoutPrefs({ sound: on, defaultRestSec: restSeconds });
  }, [restSeconds]);

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
      void startRestNotification(ends, "Отдых").then((native) => {
        nativeAlarm.current = native;
      });
    },
    [restSeconds],
  );

  const extendRest = useCallback((extraSec = 30) => {
    setRestEndsAt((current) => {
      const base = current && current > Date.now() ? current : Date.now();
      const ends = base + extraSec * 1000;
      try {
        localStorage.setItem(STORAGE_KEY, String(ends));
      } catch {
        // ignore
      }
      void shiftRestNotification(ends, extraSec * 1000);
      return ends;
    });
  }, []);

  const clearRest = useCallback(() => {
    setRestEndsAt(null);
    setRestLeft(0);
    nativeAlarm.current = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    void clearRestNotification();
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
        if (restSound && !nativeAlarm.current) playRestEndBeep();
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
    let id = 0;
    const arm = () => {
      window.clearInterval(id);
      if (document.visibilityState === "hidden") return;
      id = window.setInterval(() => {
        const nativeEnds = readNativeRestEndsAt();
        if (nativeEnds && restEndsAt && Math.abs(nativeEnds - restEndsAt) > 1500) {
          setRestEndsAt(nativeEnds);
          try {
            localStorage.setItem(STORAGE_KEY, String(nativeEnds));
          } catch {
            // ignore
          }
          return;
        }
        tick();
      }, 250);
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        window.clearInterval(id);
        return;
      }
      tick();
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [restEndsAt, restSound]);

  useEffect(() => {
    return subscribeRestNotificationActions((action) => {
      if (action === "skip") clearRest();
      else extendRest(30);
    });
  }, [clearRest, extendRest]);

  return {
    restSeconds,
    setRestSeconds,
    restEndsAt,
    restLeft,
    restSound,
    setRestSound,
    startRest,
    extendRest,
    clearRest,
    REST_OPTIONS,
    formatRest: formatRestClock,
  };
}

/** Полоска отдыха над таб-баром: не закрывает подходы и вкладки. */
export function WorkoutRestTimerBanner({
  restEndsAt,
  restLeft,
  restSeconds = 90,
  onSkip,
  onAdd,
}: {
  restEndsAt: number | null;
  restLeft: number;
  restSeconds?: number;
  onSkip: () => void;
  onAdd?: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | "inline" | null>(null);
  useEffect(() => {
    const frame = document.querySelector(".cv-app-frame");
    const tab = frame?.querySelector(":scope > .mobile-tab-bar");
    if (!frame || !tab) {
      setSlot("inline");
      return;
    }
    const host = document.createElement("div");
    host.className = "gym-rest-slot";
    frame.insertBefore(host, tab);
    setSlot(host);
    return () => host.remove();
  }, []);
  if (!restEndsAt || !Number.isFinite(restEndsAt) || slot === null) return null;
  const total = Math.max(1, restSeconds);
  const left = Math.max(0, restLeft);
  const progress = Math.max(0, Math.min(1, left / total));
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  const dash = circ * progress;
  const bar = (
    <div className="gym-rest-bar" role="status" aria-label={`Отдых ${formatRestClock(left)}`}>
      <svg className="gym-rest-bar__ring" viewBox="0 0 44 44" aria-hidden>
        <circle className="gym-rest-bar__track" cx="22" cy="22" r={radius} />
        <circle
          className="gym-rest-bar__value"
          cx="22"
          cy="22"
          r={radius}
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="gym-rest-bar__time">
        <strong>{formatRestClock(left)}</strong>
        <span>Отдых</span>
      </div>
      <button type="button" className="gym-rest-bar__add" onClick={() => onAdd?.()}>
        +30
      </button>
      <button type="button" className="gym-rest-bar__skip" onClick={() => onSkip()}>
        Дальше
      </button>
    </div>
  );
  return slot === "inline" ? bar : createPortal(bar, slot);
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
    <div className={compact ? "mt-3 border-t border-[var(--border-quiet)] pt-3" : "gym-plane"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            compact ? "text-[var(--accent-ink)]" : "text-[var(--muted)]"
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
                restSeconds === sec ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
            >
              {sec}с
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
          {running ? formatRestClock(restLeft) : formatRestClock(restSeconds)}
        </p>
        {running ? (
          <button type="button" className="text-sm text-[var(--muted)]" onClick={clearRest}>
            Сброс
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => startRest()}
          >
            Старт отдыха
          </button>
        )}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-strong)]">
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
