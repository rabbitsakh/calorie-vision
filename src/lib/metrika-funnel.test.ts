import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCOUNT_DELETE_CONFIRM } from "./account-delete-confirm.ts";
import {
  METRIKA_GOALS,
  getMetrikaClientId,
  setMetrikaClientId,
  trackMetrikaGoal,
} from "./yandex-metrika.ts";
import {
  resetMetrikaFunnelStorageForTests,
  trackBadgeUnlockedGoal,
  trackChallengeSnapshot,
  trackComboDayGoal,
  trackD7ReturnGoal,
  trackFirstMealSaveGoal,
  trackGamChestOpenGoal,
  trackGamReviewDismiss,
  trackGamReviewRate,
  trackGamReviewShow,
  trackLoginGoal,
  trackMealSavedGoal,
  trackPhotoRecognizeGoal,
  trackPushEnabledGoal,
  trackQuestDoneGoal,
  trackStreakFreezeGoal,
  trackWaterLoggedGoal,
  trackWeightLoggedGoal,
} from "./metrika-funnel.ts";

test("account delete confirm token is DELETE", () => {
  assert.equal(ACCOUNT_DELETE_CONFIRM, "DELETE");
});

test("setMetrikaClientId enables goal tracking", () => {
  const calls: unknown[][] = [];
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { ym: (...args: unknown[]) => void; localStorage: Storage; sessionStorage: Storage } }).window =
    {
      ym: (...args: unknown[]) => {
        calls.push(args);
      },
      localStorage: memoryStorage(),
      sessionStorage: memoryStorage(),
    };

  setMetrikaClientId("111847071");
  assert.equal(getMetrikaClientId(), "111847071");
  trackMetrikaGoal(METRIKA_GOALS.login);
  assert.deepEqual(calls[0], [111847071, "reachGoal", "login"]);

  (globalThis as { window?: unknown }).window = previous;
  setMetrikaClientId(null);
});

test("funnel goals fire once for first meal and d7", () => {
  const calls: string[] = [];
  const previous = (globalThis as { window?: unknown }).window;
  const local = memoryStorage();
  const session = memoryStorage();
  (globalThis as {
    window: {
      ym: (id: number, method: string, goal: string) => void;
      localStorage: Storage;
      sessionStorage: Storage;
    };
  }).window = {
    ym: (_id, method, goal) => {
      if (method === "reachGoal") calls.push(goal);
    },
    localStorage: local,
    sessionStorage: session,
  };
  setMetrikaClientId("111847071");
  resetMetrikaFunnelStorageForTests();

  trackLoginGoal();
  trackLoginGoal();
  trackFirstMealSaveGoal();
  trackFirstMealSaveGoal();
  trackMealSavedGoal(2_000);
  trackMealSavedGoal(2_000);
  trackPhotoRecognizeGoal(2_000);
  trackPhotoRecognizeGoal(2_000);
  trackWaterLoggedGoal(2_000);
  trackWeightLoggedGoal(2_000);
  trackPushEnabledGoal();
  trackPushEnabledGoal();
  trackD7ReturnGoal(1_000);
  trackD7ReturnGoal(1_000 + 8 * 24 * 60 * 60 * 1000);

  assert.deepEqual(calls, [
    "login",
    "first_meal_save",
    "meal_saved",
    "photo_recognize",
    "water_logged",
    "weight_logged",
    "push_enabled",
    "d7_return",
  ]);

  (globalThis as { window?: unknown }).window = previous;
  setMetrikaClientId(null);
});

test("gamification goals fire once and drop personal params", () => {
  const calls: Array<{ goal: string; params?: Record<string, string | number> }> = [];
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as {
    window: {
      ym: (...args: unknown[]) => void;
      localStorage: Storage;
      sessionStorage: Storage;
    };
  }).window = {
    ym: (...args: unknown[]) => {
      if (args[1] !== "reachGoal") return;
      calls.push({
        goal: String(args[2]),
        ...(args[3] ? { params: args[3] as Record<string, string | number> } : {}),
      });
    },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
  };
  setMetrikaClientId("111847071");

  trackGamChestOpenGoal("quest-chest:1", "sticker_sprout");
  trackGamChestOpenGoal("quest-chest:1", "sticker_sprout");
  trackBadgeUnlockedGoal("gym_first");
  trackBadgeUnlockedGoal("gym_first");
  trackComboDayGoal("2026-11-11");
  trackComboDayGoal("2026-11-11");
  trackQuestDoneGoal("2026-11-11", "log_meal");
  trackQuestDoneGoal("2026-11-11", "log_meal");
  trackQuestDoneGoal("2026-11-12", "log_meal");
  trackStreakFreezeGoal("2026-11-10");
  trackStreakFreezeGoal("2026-11-10");
  const challenge = {
    weekStart: "2026-11-09",
    challengeKey: "water_5",
    target: 5,
  };
  trackChallengeSnapshot({ ...challenge, progress: 1, completed: false });
  trackChallengeSnapshot({ ...challenge, progress: 1, completed: false });
  trackChallengeSnapshot({ ...challenge, progress: 2, completed: false });
  trackChallengeSnapshot({ ...challenge, progress: 2, completed: false });
  trackChallengeSnapshot({ ...challenge, progress: 5, completed: true });
  trackChallengeSnapshot({ ...challenge, progress: 5, completed: true });
  trackGamReviewShow(1);
  trackGamReviewShow(1);
  trackGamReviewRate(1);
  trackGamReviewRate(1);
  trackGamReviewDismiss(1, "later");
  trackGamReviewDismiss(1, "never");
  trackMetrikaGoal(METRIKA_GOALS.gamBadge, {
    badge: "combo_1",
    email: "user@example.com",
    food: "гречка с курицей",
    weight: 82,
  });

  assert.deepEqual(calls, [
    { goal: "gam_chest_open", params: { reward: "sticker_sprout" } },
    { goal: "gam_badge", params: { badge: "gym_first" } },
    { goal: "gam_combo_day" },
    { goal: "gam_quest_done", params: { quest: "log_meal" } },
    { goal: "gam_quest_done", params: { quest: "log_meal" } },
    { goal: "gam_streak_freeze" },
    { goal: "gam_challenge_progress", params: { challenge: "water_5", progress: 2, target: 5 } },
    { goal: "gam_challenge_progress", params: { challenge: "water_5", progress: 5, target: 5 } },
    { goal: "gam_challenge_done", params: { challenge: "water_5" } },
    { goal: "gam_review_show" },
    { goal: "gam_review_rate" },
    { goal: "gam_review_dismiss", params: { reason: "later" } },
    { goal: "gam_badge", params: { badge: "combo_1" } },
  ]);

  (globalThis as { window?: unknown }).window = previous;
  setMetrikaClientId(null);
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}
