import { METRIKA_GOALS, trackMetrikaGoal } from "@/lib/yandex-metrika";

const LOGIN_SENT_KEY = "cv_metrika_login_sent";
const FIRST_MEAL_KEY = "cv_metrika_first_meal_sent";
const FIRST_OPEN_KEY = "cv_metrika_first_open_at";
const D7_SENT_KEY = "cv_metrika_d7_return_sent";
const PHOTO_DAY_KEY = "cv_metrika_photo_recognize_day";
const MEAL_DAY_KEY = "cv_metrika_meal_saved_day";
const WATER_DAY_KEY = "cv_metrika_water_logged_day";
const WEIGHT_DAY_KEY = "cv_metrika_weight_logged_day";
const PUSH_SENT_KEY = "cv_metrika_push_enabled_sent";

const DAY_MS = 24 * 60 * 60 * 1000;

function localStore(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function todayKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fire once per local calendar day (anti-spam for depth goals). */
function trackOncePerDay(storageKey: string, goal: string, now = Date.now()): void {
  const store = localStore();
  const day = todayKey(now);
  if (store?.getItem(storageKey) === day) {
    return;
  }
  trackMetrikaGoal(goal);
  store?.setItem(storageKey, day);
}

/** Once per browser tab/session after successful auth. */
export function trackLoginGoal(): void {
  const store = sessionStore();
  if (!store) {
    trackMetrikaGoal(METRIKA_GOALS.login);
    return;
  }
  if (store.getItem(LOGIN_SENT_KEY) === "1") {
    return;
  }
  trackMetrikaGoal(METRIKA_GOALS.login);
  store.setItem(LOGIN_SENT_KEY, "1");
}

/** Once when the user saves their first meal on this device. */
export function trackFirstMealSaveGoal(): void {
  const store = localStore();
  if (store?.getItem(FIRST_MEAL_KEY) === "1") {
    return;
  }
  trackMetrikaGoal(METRIKA_GOALS.firstMealSave);
  store?.setItem(FIRST_MEAL_KEY, "1");
}

/** Successful photo recognition — once per day. */
export function trackPhotoRecognizeGoal(now = Date.now()): void {
  trackOncePerDay(PHOTO_DAY_KEY, METRIKA_GOALS.photoRecognize, now);
}

/** Any meal saved — once per day (depth beyond first_meal_save). */
export function trackMealSavedGoal(now = Date.now()): void {
  trackOncePerDay(MEAL_DAY_KEY, METRIKA_GOALS.mealSaved, now);
}

/** Water logged — once per day. */
export function trackWaterLoggedGoal(now = Date.now()): void {
  trackOncePerDay(WATER_DAY_KEY, METRIKA_GOALS.waterLogged, now);
}

/** Weight logged — once per day. */
export function trackWeightLoggedGoal(now = Date.now()): void {
  trackOncePerDay(WEIGHT_DAY_KEY, METRIKA_GOALS.weightLogged, now);
}

/** Push subscription enabled — once per browser. */
export function trackPushEnabledGoal(): void {
  const store = localStore();
  if (store?.getItem(PUSH_SENT_KEY) === "1") {
    return;
  }
  trackMetrikaGoal(METRIKA_GOALS.pushEnabled);
  store?.setItem(PUSH_SENT_KEY, "1");
}

/**
 * d7_return: user opened the app again at least 7 days after first open.
 * Fires once per browser.
 */
export function trackD7ReturnGoal(now = Date.now()): void {
  const store = localStore();
  if (!store) {
    return;
  }
  if (store.getItem(D7_SENT_KEY) === "1") {
    return;
  }

  const raw = store.getItem(FIRST_OPEN_KEY);
  if (!raw) {
    store.setItem(FIRST_OPEN_KEY, String(now));
    return;
  }

  const firstOpen = Number(raw);
  if (!Number.isFinite(firstOpen) || firstOpen <= 0) {
    store.setItem(FIRST_OPEN_KEY, String(now));
    return;
  }

  if (now - firstOpen < 7 * DAY_MS) {
    return;
  }

  trackMetrikaGoal(METRIKA_GOALS.d7Return);
  store.setItem(D7_SENT_KEY, "1");
}

/** Test helpers */
export function resetMetrikaFunnelStorageForTests(): void {
  localStore()?.removeItem(FIRST_MEAL_KEY);
  localStore()?.removeItem(FIRST_OPEN_KEY);
  localStore()?.removeItem(D7_SENT_KEY);
  localStore()?.removeItem(PHOTO_DAY_KEY);
  localStore()?.removeItem(MEAL_DAY_KEY);
  localStore()?.removeItem(WATER_DAY_KEY);
  localStore()?.removeItem(WEIGHT_DAY_KEY);
  localStore()?.removeItem(PUSH_SENT_KEY);
  sessionStore()?.removeItem(LOGIN_SENT_KEY);
}
