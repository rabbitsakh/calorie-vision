/**
 * Capacitor APK session resume — Preferences holds an HMAC resume token.
 * Cold start opens /api/auth/capacitor-resume?token=… which re-sets NextAuth cookies
 * and redirects to /ration (WebView cookies alone are unreliable across process death).
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { CAP_LOGGED_IN_KEY } from "@/lib/capacitor-login-flag";
import { withBasePath } from "@/lib/paths";

export const CAP_RESUME_TOKEN_KEY = "cv_cap_resume_token_v1";

const PREFS_TIMEOUT_MS = 1200;

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
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

async function prefsSet(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

async function prefsRemove(key: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
}

export async function getCapacitorResumeToken(): Promise<string | null> {
  if (!isCapacitorNative()) return null;
  const value = await withTimeout(prefsGet(CAP_RESUME_TOKEN_KEY), PREFS_TIMEOUT_MS, null);
  return value && value.length > 10 ? value : null;
}

export async function storeCapacitorResumeToken(token: string): Promise<void> {
  if (!isCapacitorNative()) return;
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
  if (!isCapacitorNative()) return;
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
  if (!isCapacitorNative()) return false;
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
