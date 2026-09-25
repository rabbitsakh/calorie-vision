/**
 * Persist “user has logged in” for Capacitor APK cold start.
 *
 * Prefer window.CvSession (MainActivity JavascriptInterface) — works on
 * calorievision.ru where Capacitor JS is not injected. Fall back to Preferences
 * on the local shell origin.
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";

export const CAP_LOGGED_IN_KEY = "cv_cap_logged_in_v1";

const PREFS_TIMEOUT_MS = 800;

type CvSessionBridge = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
};

function cvSession(): CvSessionBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const bridge = (window as Window & { CvSession?: CvSessionBridge }).CvSession;
    if (bridge && typeof bridge.get === "function" && typeof bridge.set === "function") {
      return bridge;
    }
  } catch {
    // ignore
  }
  return null;
}

function inApk(): boolean {
  return Boolean(cvSession()) || isCapacitorNative();
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
        resolve(fallback);
      });
  });
}

export async function hasCapacitorLoggedIn(): Promise<boolean> {
  if (!inApk()) return false;
  const native = cvSession();
  if (native) {
    try {
      return native.get(CAP_LOGGED_IN_KEY) === "1";
    } catch {
      // fall through
    }
  }
  if (!isCapacitorNative()) return false;
  return withTimeout(
    (async () => {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: CAP_LOGGED_IN_KEY });
      return value === "1";
    })(),
    PREFS_TIMEOUT_MS,
    false,
  );
}

export async function markCapacitorLoggedIn(): Promise<void> {
  if (!inApk()) return;
  const native = cvSession();
  if (native) {
    try {
      native.set(CAP_LOGGED_IN_KEY, "1");
    } catch {
      // fall through
    }
  }
  if (!isCapacitorNative()) return;
  await withTimeout(
    (async () => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: CAP_LOGGED_IN_KEY, value: "1" });
    })(),
    PREFS_TIMEOUT_MS,
    undefined,
  );
}

export async function clearCapacitorLoggedIn(): Promise<void> {
  if (!inApk()) return;
  const native = cvSession();
  if (native) {
    try {
      native.remove(CAP_LOGGED_IN_KEY);
    } catch {
      // fall through
    }
  }
  if (!isCapacitorNative()) return;
  await withTimeout(
    (async () => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: CAP_LOGGED_IN_KEY });
    })(),
    PREFS_TIMEOUT_MS,
    undefined,
  );
}
