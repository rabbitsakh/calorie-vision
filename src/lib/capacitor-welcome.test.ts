import assert from "node:assert/strict";
import test from "node:test";
import {
  WELCOME_SEEN_KEY,
  hasSeenAppWelcomeSync,
  markAppWelcomeSeen,
  rememberWelcomeSeen,
} from "./capacitor-welcome.ts";

test("welcome prefs key is stable", () => {
  assert.equal(WELCOME_SEEN_KEY, "cv_welcome_seen_v1");
});

test("hasSeenAppWelcomeSync is true on web (no Capacitor)", () => {
  assert.equal(hasSeenAppWelcomeSync(), true);
});

test("флаг обучения пишется до проверки моста Capacitor", () => {
  const bag = new Map<string, string>();
  rememberWelcomeSeen({
    setItem: (key, value) => {
      bag.set(key, value);
    },
  });
  assert.equal(bag.get(WELCOME_SEEN_KEY), "1");
});

test("markAppWelcomeSeen is a no-op on web", async () => {
  await markAppWelcomeSeen();
  assert.equal(hasSeenAppWelcomeSync(), true);
});
