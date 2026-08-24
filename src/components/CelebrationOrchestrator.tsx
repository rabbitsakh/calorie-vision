"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  consumeFullscreenCelebrationSlot,
  FS_CELEB_DAILY_CAP,
  getFullscreenCelebrationCount,
  isFullscreenCelebrationCapReached,
} from "@/lib/celebration-daily-cap";

type CelebrationGateValue = {
  activeId: string | null;
  /** Queue this celebration; becomes active immediately if none is showing. False = daily cap. */
  requestCelebration: (id: string) => boolean;
  /** Release when closed or unmounted; promotes the next queued id. */
  releaseCelebration: (id: string) => void;
};

const CelebrationGateContext = createContext<CelebrationGateValue | null>(null);

/**
 * Ensures only one fullscreen celebration is visible at a time,
 * and at most 2 fullscreen celebrations per local day.
 * SoftCelebration / FullscreenCelebration join via useCelebrationGate.
 */
export function CelebrationOrchestrator({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const countedRef = useRef<Set<string>>(new Set());

  const admit = useCallback((id: string): boolean => {
    if (countedRef.current.has(id)) return true;
    if (isFullscreenCelebrationCapReached()) return false;
    if (!consumeFullscreenCelebrationSlot()) return false;
    countedRef.current.add(id);
    return true;
  }, []);

  const requestCelebration = useCallback(
    (id: string): boolean => {
      if (activeIdRef.current === id) return true;

      if (activeIdRef.current == null) {
        if (!admit(id)) return false;
        activeIdRef.current = id;
        setActiveId(id);
        return true;
      }

      if (!queueRef.current.includes(id)) {
        const remaining = FS_CELEB_DAILY_CAP - getFullscreenCelebrationCount();
        if (remaining <= queueRef.current.length) return false;
        queueRef.current.push(id);
      }
      return true;
    },
    [admit],
  );

  const releaseCelebration = useCallback(
    (id: string) => {
      queueRef.current = queueRef.current.filter((queued) => queued !== id);
      if (activeIdRef.current !== id) return;

      let next: string | null = null;
      while (queueRef.current.length > 0) {
        const candidate = queueRef.current.shift()!;
        if (admit(candidate)) {
          next = candidate;
          break;
        }
      }
      if (!next) queueRef.current = [];
      activeIdRef.current = next;
      setActiveId(next);
    },
    [admit],
  );

  const value = useMemo(
    () => ({ activeId, requestCelebration, releaseCelebration }),
    [activeId, requestCelebration, releaseCelebration],
  );

  return (
    <CelebrationGateContext.Provider value={value}>{children}</CelebrationGateContext.Provider>
  );
}

export function useCelebrationGate(): CelebrationGateValue | null {
  return useContext(CelebrationGateContext);
}
