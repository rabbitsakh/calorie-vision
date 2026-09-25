/**
 * Persist “user has logged in” for Capacitor APK cold start.
 *
 * Local shell (rustore/cap-www) and calorievision.ru do not share localStorage.
 * Preferences is native and survives process death — cold start reads it and
 * navigates to the product origin so NextAuth cookies can restore the session.
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";

export const CAP_LOGGED_IN_KEY = "cv_cap_logged_in_v1";

const PREFS_TIMEOUT_MS = 800;

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
