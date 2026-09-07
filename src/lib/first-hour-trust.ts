/**
 * Wave 14 — first-hour trust helpers (local gates, no server).
 */

const OPEN_CAMERA_AFTER_ONBOARDING_KEY = "cv-open-camera-after-onboarding";
const FIRST_SHARE_NUDGE_KEY = "cv-first-share-nudge-seen";
const SEVEN_DAY_AHA_KEY = "cv-seven-day-aha-seen";
const LOGGED_DAYS_CACHE_KEY = "cv-logged-days-count-v1";

function store(): Storage | null {
  try {
    const root = globalThis as typeof globalThis & {
      window?: { localStorage?: Storage };
      localStorage?: Storage;
    };
    return root.window?.localStorage ?? root.localStorage ?? null;
  } catch {
    return null;
  }
}

/** After onboarding photo CTA — ration should open camera once. */
export function markOpenCameraAfterOnboarding(): void {
  store()?.setItem(OPEN_CAMERA_AFTER_ONBOARDING_KEY, "1");
}

export function claimOpenCameraAfterOnboarding(): boolean {
  const s = store();
  if (!s || s.getItem(OPEN_CAMERA_AFTER_ONBOARDING_KEY) !== "1") return false;
  s.removeItem(OPEN_CAMERA_AFTER_ONBOARDING_KEY);
  return true;
}

/** Soft share-day nudge after first complete day — once per device. */
export function shouldShowFirstShareNudge(mealCountToday: number): boolean {
  if (mealCountToday < 1) return false;
  const s = store();
  if (!s || s.getItem(FIRST_SHARE_NUDGE_KEY) === "1") return false;
  return true;
}

export function markFirstShareNudgeSeen(): void {
  store()?.setItem(FIRST_SHARE_NUDGE_KEY, "1");
}

/** Cache days-logged total from streak payload for quiet gates. */
export function cacheLoggedDaysTotal(count: number): void {
  if (!Number.isFinite(count) || count < 0) return;
  store()?.setItem(LOGGED_DAYS_CACHE_KEY, String(Math.floor(count)));
}

export function getCachedLoggedDaysTotal(): number {
  const raw = store()?.getItem(LOGGED_DAYS_CACHE_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Hide referral / chest noise until user has a few real days. */
export function isFirstWeekQuiet(minDays = 3): boolean {
  return getCachedLoggedDaysTotal() < minDays;
}

/** One soft «aha» after a week of use. */
export function shouldShowSevenDayAha(daysLoggedTotal: number): boolean {
  if (daysLoggedTotal < 7) return false;
  const s = store();
  if (!s || s.getItem(SEVEN_DAY_AHA_KEY) === "1") return false;
  return true;
}

export function markSevenDayAhaSeen(): void {
  store()?.setItem(SEVEN_DAY_AHA_KEY, "1");
}
