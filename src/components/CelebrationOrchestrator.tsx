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

type CelebrationGateValue = {
  activeId: string | null;
  /** Queue this celebration; becomes active immediately if none is showing. */
  requestCelebration: (id: string) => void;
  /** Release when closed or unmounted; promotes the next queued id. */
  releaseCelebration: (id: string) => void;
};

const CelebrationGateContext = createContext<CelebrationGateValue | null>(null);

/**
 * Ensures only one fullscreen celebration is visible at a time.
 * SoftCelebration / FullscreenCelebration join via useCelebrationGate.
 */
export function CelebrationOrchestrator({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);

  const requestCelebration = useCallback((id: string) => {
    setActiveId((current) => {
      if (current === id) return current;
      if (current == null) return id;
      if (!queueRef.current.includes(id)) {
        queueRef.current.push(id);
      }
      return current;
    });
  }, []);

  const releaseCelebration = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((queued) => queued !== id);
    setActiveId((current) => {
      if (current !== id) return current;
      return queueRef.current.shift() ?? null;
    });
  }, []);

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
