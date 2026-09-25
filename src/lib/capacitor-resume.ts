/**
 * Capacitor APK session resume.
 *
 * Capacitor JS is only injected on the local shell origin (https://localhost).
 * After login the WebView is on calorievision.ru without window.Capacitor — so
 * @capacitor/preferences alone never persists. MainActivity exposes
 * window.CvSession (JavascriptInterface) on every origin; we write there.
 *
 * Cold start: MainActivity or local app.js opens
 * /api/auth/capacitor-resume?token=… → re-sets NextAuth cookies → /ration.
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { CAP_LOGGED_IN_KEY } from "@/lib/capacitor-login-flag";
import { withBasePath } from "@/lib/paths";

export const CAP_RESUME_TOKEN_KEY = "cv_cap_resume_token_v1";

const PREFS_TIMEOUT_MS = 1200;

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

/** True inside the RuStore APK WebView (Capacitor local shell OR product origin with CvSession). */
export function isApkWebView(): boolean {
  if (typeof window === "undefined") return false;
  if (cvSession()) return true;
  return isCapacitorNative();
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

async function prefsGet(key: string): Promise<string | null> {
  const native = cvSession();
  if (native) {
    try {
      const value = native.get(key);
      return value == null || value === "" ? null : String(value);
    } catch {
      // fall through to Capacitor Preferences
    }
  }
  if (!isCapacitorNative()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

async function prefsSet(key: string, value: string): Promise<void> {
  const native = cvSession();
  if (native) {
    try {
      native.set(key, value);
    } catch {
      // continue — also try Preferences when available
    }
  }
  if (!isCapacitorNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

async function prefsRemove(key: string): Promise<void> {
  const native = cvSession();
  if (native) {
    try {
      native.remove(key);
    } catch {
      // continue
    }
  }
  if (!isCapacitorNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
}

export async function getCapacitorResumeToken(): Promise<string | null> {
  if (!isApkWebView()) return null;
  const value = await withTimeout(prefsGet(CAP_RESUME_TOKEN_KEY), PREFS_TIMEOUT_MS, null);
  return value && value.length > 10 ? value : null;
}

export async function storeCapacitorResumeToken(token: string): Promise<void> {
  if (!isApkWebView()) return;
  await withTimeout(
    (async () => {
      await prefsSet(CAP_RESUME_TOKEN_KEY, token);
      await prefsSet(CAP_LOGGED_IN_KEY, "1");
    })(),
    PREFS_TIMEOUT_MS,
    undefined,
  );
}

export async function clearCapacitorResumeToken(): Promise<void> {
  if (!isApkWebView()) return;
  await withTimeout(
    (async () => {
      await prefsRemove(CAP_RESUME_TOKEN_KEY);
      await prefsRemove(CAP_LOGGED_IN_KEY);
    })(),
    PREFS_TIMEOUT_MS,
    undefined,
  );
}

/** Ask the server for a fresh resume token and persist it on-device. */
export async function refreshCapacitorResumeToken(): Promise<boolean> {
  if (!isApkWebView()) return false;
  try {
    const resp = await fetch(withBasePath("/api/auth/capacitor-resume"), {
      method: "POST",
      credentials: "same-origin",
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { token?: string };
    if (!data.token) return false;
    await storeCapacitorResumeToken(data.token);
    return true;
  } catch {
    return false;
  }
}

export function capacitorResumeConsumeUrl(token: string, origin = "https://calorievision.ru"): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${withBasePath("/api/auth/capacitor-resume")}?token=${encodeURIComponent(token)}`;
}

/** Full-page navigation that re-mints cookies then opens /ration. */
export async function resumeCapacitorSessionInPlace(): Promise<boolean> {
  const token = await getCapacitorResumeToken();
  if (!token) return false;
  const origin =
    typeof window !== "undefined" && window.location.hostname.includes("calorievision")
      ? window.location.origin
      : "https://calorievision.ru";
  window.location.replace(capacitorResumeConsumeUrl(token, origin));
  return true;
}
