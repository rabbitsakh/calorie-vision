"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { withBasePath } from "@/lib/paths";
import type { DayMealsResponse } from "@/types";

export type RationDayStreak = {
  streak: number;
  longestStreak: number;
  nextMilestone: number | null;
  daysUntilNext: number | null;
  last14: Array<{ date: string; logged: boolean; frozen: boolean }>;
  daysLoggedTotal: number;
  loggedToday: boolean;
  streakAtRisk: boolean;
  streakBeforeToday: number;
  freezeAvailable: boolean;
  canFreezeYesterday: boolean;
  frozenDates: string[];
  weekStart: string;
  daysLoggedThisWeek: number;
  daysInWeekSoFar: number;
  weekNudge: string | null;
};

export type RationDayPayload = {
  date: string;
  today: string;
  meals: DayMealsResponse;
  streak: RationDayStreak;
  water: { totalMl: number; target: number };
  account: {
    sex: string | null;
    heightCm: number | null;
    birthYear: number | null;
    fastingStartHour: number | null;
    fastingEndHour: number | null;
    timezone: string | null;
    waterTargetMl: number | null;
  };
  week: {
    days: Array<{ date: string; calories: number }>;
    calorieTarget: number | null;
  };
  tip: string | null;
  diaryMood: string | null;
  challenges: unknown | null;
};

type RationDayContextValue = {
  date: string;
  today: string;
  data: RationDayPayload | null;
  loading: boolean;
  error: string | null;
  refresh: (quiet?: boolean) => Promise<void>;
  bump: () => void;
  refreshKey: number;
};

const RationDayContext = createContext<RationDayContextValue | null>(null);

type RationDayProviderProps = {
  date: string;
  today: string;
  children: ReactNode;
  /** Called when bootstrap finishes first successful load. */
  onReady?: () => void;
};

export function RationDayProvider({ date, today, children, onReady }: RationDayProviderProps) {
  const [data, setData] = useState<RationDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyOnce = useRef(false);
  const fetchGenRef = useRef(0);
  const dateRef = useRef(date);
  dateRef.current = date;

  const refresh = useCallback(async (quiet = false) => {
    const gen = ++fetchGenRef.current;
    const requestDate = dateRef.current;
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const resp = await fetch(
        withBasePath(`/api/ration-day?date=${requestDate}&today=${today}`),
        { cache: "no-store" },
      );
      const json = (await resp.json()) as RationDayPayload & { error?: string };
      if (!resp.ok) throw new Error(json.error ?? "Не удалось загрузить день");
      if (gen !== fetchGenRef.current) return;
      if (dateRef.current !== requestDate) return;
      setData(json);
      if (!readyOnce.current) {
        readyOnce.current = true;
        onReadyRef.current?.();
      }
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    readyOnce.current = false;
    void refresh(false);
  }, [date, refresh, refreshKey]);

  const bump = useCallback(() => setRefreshKey((v) => v + 1), []);

  const value = useMemo(
    () => ({ date, today, data, loading, error, refresh, bump, refreshKey }),
    [date, today, data, loading, error, refresh, bump, refreshKey],
  );

  return <RationDayContext.Provider value={value}>{children}</RationDayContext.Provider>;
}

export function useRationDay(): RationDayContextValue {
  const ctx = useContext(RationDayContext);
  if (!ctx) {
    throw new Error("useRationDay must be used within RationDayProvider");
  }
  return ctx;
}

export function useOptionalRationDay(): RationDayContextValue | null {
  return useContext(RationDayContext);
}
