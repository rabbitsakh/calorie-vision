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
import { isLikelyOfflineError } from "@/lib/connectivity";
import { buildEmptyOfflineRationDay } from "@/lib/offline-ration-day";
import { withBasePath } from "@/lib/paths";
import { readRationDayCache, writeRationDayCache } from "@/lib/ration-day-cache";
import { RATION_DAY_CACHE_UPDATED_EVENT } from "@/lib/ration-day-cache-optimistic";
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
    fiberTargetG: number | null;
    sugarTargetG: number | null;
  };
  week: {
    days: Array<{ date: string; calories: number }>;
    calorieTarget: number | null;
  };
  /** Weight logged for this date, if any. */
  weightKg?: number | null;
  tip: string | null;
  diaryMood: string | null;
  challenges: {
    active: {
      challengeKey: string;
      title: string;
      description: string;
      progress: number;
      target: number;
      completed: boolean;
      weekStart: string;
    } | null;
  } | null;
};

type RationDayContextValue = {
  date: string;
  today: string;
  data: RationDayPayload | null;
  loading: boolean;
  error: string | null;
  /** True when `data` came from localStorage (or empty offline shell). */
  fromCache: boolean;
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
  const [data, setData] = useState<RationDayPayload | null>(() =>
    typeof window !== "undefined" ? readRationDayCache(date) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(
    () => typeof window !== "undefined" && readRationDayCache(date) != null,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const readyOnce = useRef(false);
  const fetchGenRef = useRef(0);
  const dateRef = useRef(date);
  dateRef.current = date;

  const markReady = useCallback(() => {
    if (!readyOnce.current) {
      readyOnce.current = true;
      onReadyRef.current?.();
    }
  }, []);

  const refresh = useCallback(
    async (quiet = false) => {
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
        setFromCache(false);
        setError(null);
        writeRationDayCache(json);
        void import("@/lib/capacitor-local-reminders")
          .then((m) => m.refreshCapacitorReminderCopyFromDiary(json.today || json.date))
          .catch(() => {
            // APK-only; ignore on web
          });
        markReady();
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        if (dateRef.current !== requestDate) return;
        const cached = readRationDayCache(requestDate);
        if (cached) {
          setData(cached);
          setFromCache(true);
          setError(null);
          markReady();
        } else if (isLikelyOfflineError(err)) {
          // Soft empty shell so hero/feed still render offline.
          setData(buildEmptyOfflineRationDay(requestDate, today));
          setFromCache(true);
          setError(null);
          markReady();
        } else if (!quiet) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (gen === fetchGenRef.current && !quiet) {
          setLoading(false);
        } else if (gen === fetchGenRef.current && quiet) {
          setLoading(false);
        }
      }
    },
    [today, markReady],
  );

  useEffect(() => {
    readyOnce.current = false;
    const cached = readRationDayCache(date);
    if (cached) {
      setData(cached);
      setFromCache(true);
      setError(null);
      setLoading(false);
      markReady();
      // Background revalidate — keep cached UI until network answers.
      void refresh(true);
    } else {
      setData(null);
      setFromCache(false);
      void refresh(false);
    }
  }, [date, refresh, refreshKey, markReady]);

  // Wave S — offline enqueue patches localStorage; pull into live provider state.
  useEffect(() => {
    function onCacheUpdated(event: Event) {
      const detail = (event as CustomEvent<{ date?: string }>).detail;
      if (detail?.date && detail.date !== dateRef.current) return;
      const cached = readRationDayCache(dateRef.current);
      if (!cached) return;
      setData(cached);
      setFromCache(true);
      setError(null);
      setLoading(false);
      markReady();
    }
    window.addEventListener(RATION_DAY_CACHE_UPDATED_EVENT, onCacheUpdated);
    return () => window.removeEventListener(RATION_DAY_CACHE_UPDATED_EVENT, onCacheUpdated);
  }, [markReady]);

  const bump = useCallback(() => setRefreshKey((v) => v + 1), []);

  const value = useMemo(
    () => ({ date, today, data, loading, error, fromCache, refresh, bump, refreshKey }),
    [date, today, data, loading, error, fromCache, refresh, bump, refreshKey],
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
