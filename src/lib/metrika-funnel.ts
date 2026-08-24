import { METRIKA_GOALS, trackMetrikaGoal } from "@/lib/yandex-metrika";

const LOGIN_SENT_KEY = "cv_metrika_login_sent";
const FIRST_MEAL_KEY = "cv_metrika_first_meal_sent";
const FIRST_OPEN_KEY = "cv_metrika_first_open_at";
const D7_SENT_KEY = "cv_metrika_d7_return_sent";

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
  sessionStore()?.removeItem(LOGIN_SENT_KEY);
}
