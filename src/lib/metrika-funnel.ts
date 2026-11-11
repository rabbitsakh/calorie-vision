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
const ONBOARDING_COMPLETE_KEY = "cv_metrika_onboarding_complete_sent";
const ONBOARDING_PHOTO_CTA_KEY = "cv_metrika_onboarding_photo_cta_sent";
const FIRST_CONFIRM_SAVE_KEY = "cv_metrika_first_confirm_save_sent";

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

/** Chest opened with loot — once per day (wave 10). */
export function trackChestOpenedGoal(now = Date.now()): void {
  trackOncePerDay("cv_metrika_chest_opened_day", METRIKA_GOALS.chestOpened, now);
}

/** Avatar frame equipped — once per day (wave 10). */
export function trackFrameEquippedGoal(now = Date.now()): void {
  trackOncePerDay("cv_metrika_frame_equipped_day", METRIKA_GOALS.frameEquipped, now);
}

/** Meta collection chest — once per day (wave 10). */
export function trackMetaChestGoal(now = Date.now()): void {
  trackOncePerDay("cv_metrika_meta_chest_day", METRIKA_GOALS.metaChest, now);
}

function trackOnceFlag(
  storageKey: string,
  goal: string,
  params?: Record<string, unknown>,
): void {
  const store = localStore();
  if (store?.getItem(storageKey) === "1") return;
  trackMetrikaGoal(goal, params);
  store?.setItem(storageKey, "1");
}

/**
 * Distinct chest grant. `dedupeId` is the chest source key (kept on device only).
 * `rewardKey` is the catalog id sent to Metrika — not food, weight, or email.
 */
export function trackGamChestOpenGoal(dedupeId: string, rewardKey: string): void {
  const id = dedupeId.trim();
  const reward = rewardKey.trim();
  if (!/^[a-z0-9_:-]{1,80}$/i.test(id)) return;
  if (!/^[a-z0-9_]{1,64}$/i.test(reward)) return;
  trackOnceFlag(`cv_metrika_gam_chest:${id}`, METRIKA_GOALS.gamChestOpen, { reward });
}

/** Badge unlock once per badge type. */
export function trackBadgeUnlockedGoal(badgeKey: string): void {
  const badge = badgeKey.trim();
  if (!/^[a-z0-9_]{1,40}$/i.test(badge)) return;
  trackOnceFlag(`cv_metrika_gam_badge:${badge}`, METRIKA_GOALS.gamBadge, { badge });
}

/** Combo day once per calendar date. */
export function trackComboDayGoal(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  trackOnceFlag(`cv_metrika_gam_combo:${date}`, METRIKA_GOALS.gamComboDay);
}

/** Daily quest completion once per date and quest id. */
export function trackQuestDoneGoal(date: string, questId: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (!/^[a-z0-9_]{1,32}$/i.test(questId)) return;
  trackOnceFlag(`cv_metrika_gam_quest:${date}:${questId}`, METRIKA_GOALS.gamQuestDone, {
    quest: questId,
  });
}

type ChallengeMark = { progress: number; completed: boolean };

function readChallengeMark(raw: string | null): ChallengeMark | null {
  if (!raw) return null;
  const [progressRaw, completedRaw] = raw.split(":");
  const progress = Number(progressRaw);
  if (!Number.isFinite(progress) || progress < 0) return null;
  return { progress: Math.floor(progress), completed: completedRaw === "1" };
}

/**
 * Weekly challenge. The first snapshot on this device is a baseline and is not
 * sent (so a reload of the current number is not a new event). Later increases
 * and the incomplete → complete transition each fire once.
 */
export function trackChallengeSnapshot(input: {
  weekStart: string;
  challengeKey: string;
  progress: number;
  target: number;
  completed: boolean;
}): void {
  const store = localStore();
  if (!store) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) return;
  if (!/^[a-z0-9_]{1,40}$/i.test(input.challengeKey)) return;
  const progress = Math.max(0, Math.floor(input.progress));
  const target = Math.max(1, Math.floor(input.target) || 1);
  const storageKey = `cv_metrika_gam_challenge:${input.weekStart}:${input.challengeKey}`;
  const prev = readChallengeMark(store.getItem(storageKey));
  const next = `${progress}:${input.completed ? "1" : "0"}`;
  if (!prev) {
    store.setItem(storageKey, next);
    return;
  }
  if (progress > prev.progress) {
    trackMetrikaGoal(METRIKA_GOALS.gamChallengeProgress, {
      challenge: input.challengeKey,
      progress,
      target,
    });
  }
  if (input.completed && !prev.completed) {
    trackMetrikaGoal(METRIKA_GOALS.gamChallengeDone, { challenge: input.challengeKey });
  }
  if (progress !== prev.progress || input.completed !== prev.completed) {
    store.setItem(storageKey, next);
  }
}

/** Streak freeze once per frozen date. */
export function trackStreakFreezeGoal(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  trackOnceFlag(`cv_metrika_gam_freeze:${date}`, METRIKA_GOALS.gamStreakFreeze);
}

export function trackGamReviewShow(showIndex: number): void {
  if (!Number.isInteger(showIndex) || showIndex < 1) return;
  trackOnceFlag(`cv_metrika_gam_review_show:${showIndex}`, METRIKA_GOALS.gamReviewShow);
}

export function trackGamReviewRate(showIndex: number): void {
  if (!Number.isInteger(showIndex) || showIndex < 1) return;
  trackOnceFlag(`cv_metrika_gam_review_rate:${showIndex}`, METRIKA_GOALS.gamReviewRate);
}

export function trackGamReviewDismiss(
  showIndex: number,
  reason: "later" | "rated" | "never",
): void {
  if (!Number.isInteger(showIndex) || showIndex < 1) return;
  trackOnceFlag(`cv_metrika_gam_review_dismiss:${showIndex}`, METRIKA_GOALS.gamReviewDismiss, {
    reason,
  });
}

/** Onboarding finished (or skipped) — once per browser. */
export function trackOnboardingCompleteGoal(): void {
  const store = localStore();
  if (store?.getItem(ONBOARDING_COMPLETE_KEY) === "1") return;
  trackMetrikaGoal(METRIKA_GOALS.onboardingComplete);
  store?.setItem(ONBOARDING_COMPLETE_KEY, "1");
}

/** User tapped «Сфотографировать» in onboarding — once per browser. */
export function trackOnboardingPhotoCtaGoal(): void {
  const store = localStore();
  if (store?.getItem(ONBOARDING_PHOTO_CTA_KEY) === "1") return;
  trackMetrikaGoal(METRIKA_GOALS.onboardingPhotoCta);
  store?.setItem(ONBOARDING_PHOTO_CTA_KEY, "1");
}

/** First save from photo confirmation card — once per browser. */
export function trackFirstConfirmSaveGoal(): void {
  const store = localStore();
  if (store?.getItem(FIRST_CONFIRM_SAVE_KEY) === "1") return;
  trackMetrikaGoal(METRIKA_GOALS.firstConfirmSave);
  store?.setItem(FIRST_CONFIRM_SAVE_KEY, "1");
}

/** Soft-save («как есть») — once per day for funnel share. */
export function trackConfirmSaveAsIsGoal(now = Date.now()): void {
  trackOncePerDay("cv_metrika_confirm_save_as_is_day", METRIKA_GOALS.confirmSaveAsIs, now);
}

/** Confirm «Уточнить» tap — once per day. */
export function trackConfirmLookupGoal(now = Date.now()): void {
  trackOncePerDay("cv_metrika_confirm_lookup_day", METRIKA_GOALS.confirmLookup, now);
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
  localStore()?.removeItem("cv_metrika_chest_opened_day");
  localStore()?.removeItem("cv_metrika_frame_equipped_day");
  localStore()?.removeItem("cv_metrika_meta_chest_day");
  localStore()?.removeItem(ONBOARDING_COMPLETE_KEY);
  localStore()?.removeItem(ONBOARDING_PHOTO_CTA_KEY);
  localStore()?.removeItem(FIRST_CONFIRM_SAVE_KEY);
  localStore()?.removeItem("cv_metrika_confirm_save_as_is_day");
  localStore()?.removeItem("cv_metrika_confirm_lookup_day");
  sessionStore()?.removeItem(LOGIN_SENT_KEY);
}
