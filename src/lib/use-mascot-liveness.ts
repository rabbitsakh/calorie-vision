"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  gestureDurationMs,
  mascotGestureClass,
  nextIdleGestureDelayMs,
  pickIdleGesture,
  prefersReducedMascotMotion,
  type MascotGesture,
} from "@/lib/mascot-liveness";
import type { MascotPose } from "@/components/Mascot";

type UseMascotLivenessOptions = {
  pose?: MascotPose;
  /** Enable random idle gestures (look / yawn / stretch / wave). */
  idleReel?: boolean;
  /** Enable tap-to-pet. */
  interactive?: boolean;
};

/**
 * Idle reel + tap-to-pet state for the mascot.
 * Returns gesture class and pointer handler to spread onto <Mascot />.
 */
export function useMascotLiveness(options: UseMascotLivenessOptions = {}) {
  const { pose = "idle", idleReel = true, interactive = false } = options;
  const [gesture, setGesture] = useState<MascotGesture>("none");
  const timerRef = useRef<number | null>(null);
  const clearRef = useRef<number | null>(null);
  const lastGesture = useRef<MascotGesture>("none");
  const busyRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (clearRef.current != null) window.clearTimeout(clearRef.current);
    timerRef.current = null;
    clearRef.current = null;
  }, []);

  const playGesture = useCallback((next: MascotGesture) => {
    if (prefersReducedMascotMotion() || next === "none") return;
    busyRef.current = true;
    lastGesture.current = next;
    setGesture(next);
    if (clearRef.current != null) window.clearTimeout(clearRef.current);
    clearRef.current = window.setTimeout(() => {
      setGesture("none");
      busyRef.current = false;
    }, gestureDurationMs(next));
  }, []);

  useEffect(() => {
    clearTimers();
    if (!idleReel || pose !== "idle" || prefersReducedMascotMotion()) {
      setGesture("none");
      return;
    }

    const schedule = () => {
      timerRef.current = window.setTimeout(() => {
        if (!busyRef.current) {
          playGesture(pickIdleGesture(lastGesture.current));
        }
        schedule();
      }, nextIdleGestureDelayMs());
    };
    schedule();
    return clearTimers;
  }, [idleReel, pose, playGesture, clearTimers]);

  const onPet = useCallback(() => {
    if (!interactive || prefersReducedMascotMotion()) return;
    playGesture("pet");
    try {
      navigator.vibrate?.(12);
    } catch {
      // ignore
    }
  }, [interactive, playGesture]);

  const triggerReact = useCallback(() => {
    playGesture("react");
  }, [playGesture]);

  return {
    gesture,
    gestureClassName: mascotGestureClass(gesture),
    interactive,
    onPet,
    triggerReact,
    petProps: interactive
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-label": "Погладить талисмана",
          onClick: onPet,
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onPet();
            }
          },
          style: { cursor: "pointer" } as CSSProperties,
        }
      : {},
  };
}
