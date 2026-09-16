/**
 * First-run welcome flag for Capacitor Android shell.
 * Web/PWA never shows the app welcome slider.
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";

export const WELCOME_SEEN_KEY = "cv_welcome_seen_v1";

async function prefs() {
  const { Preferences } = await import("@capacitor/preferences");
  return Preferences;
}

export async function hasSeenAppWelcome(): Promise<boolean> {
  if (!isCapacitorNative()) return true;
  try {
    const Preferences = await prefs();
    const { value } = await Preferences.get({ key: WELCOME_SEEN_KEY });
    return value === "1";
  } catch {
    return false;
  }
}

export async function markAppWelcomeSeen(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const Preferences = await prefs();
    await Preferences.set({ key: WELCOME_SEEN_KEY, value: "1" });
  } catch {
    // ignore — worst case welcome shows again
  }
}

/**
 * Where Capacitor should send an unauthenticated user on cold start.
 */
export async function resolveNativeAuthEntry(): Promise<"/welcome" | "/login"> {
  if (!isCapacitorNative()) return "/login";
  return (await hasSeenAppWelcome()) ? "/login" : "/welcome";
}
