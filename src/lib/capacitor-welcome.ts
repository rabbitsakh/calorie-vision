/**
 * First-run welcome flag for Capacitor Android shell.
 * Web/PWA never shows the app welcome slider.
 *
 * Source of truth: localStorage (sync, same-origin WebView).
 * Preferences is best-effort only — native get/set can hang or fail under
 * remote server.url, which used to loop login → welcome after «Войти».
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";

export const WELCOME_SEEN_KEY = "cv_welcome_seen_v1";

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

function readLocalSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    // private mode / quota — LoginForm must not bounce forever
  }
}

/** Sync check for gates that must not race router.replace. */
export function hasSeenAppWelcomeSync(): boolean {
  if (typeof window === "undefined") return true;
  if (!isCapacitorNative()) return true;
  return readLocalSeen();
}

export async function hasSeenAppWelcome(): Promise<boolean> {
  if (!isCapacitorNative()) return true;
  if (readLocalSeen()) return true;

  // Migrate from Preferences if an older build wrote there only.
  const fromPrefs = await withTimeout(
    (async () => {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: WELCOME_SEEN_KEY });
      return value === "1";
    })(),
    PREFS_TIMEOUT_MS,
    false,
  );
  if (fromPrefs) {
    writeLocalSeen();
    return true;
  }
  return false;
}

export async function markAppWelcomeSeen(): Promise<void> {
  if (!isCapacitorNative()) return;
  // Sync first so /login never redirects back before Preferences resolves.
  writeLocalSeen();
  await withTimeout(
    (async () => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: WELCOME_SEEN_KEY, value: "1" });
    })(),
    PREFS_TIMEOUT_MS,
    undefined,
  );
}

/**
 * Where Capacitor should send an unauthenticated user on cold start.
 */
export async function resolveNativeAuthEntry(): Promise<"/welcome" | "/login"> {
  if (!isCapacitorNative()) return "/login";
  return (await hasSeenAppWelcome()) ? "/login" : "/welcome";
}
