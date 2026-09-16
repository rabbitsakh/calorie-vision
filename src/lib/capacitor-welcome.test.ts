import assert from "node:assert/strict";
import test from "node:test";
import {
  WELCOME_SEEN_KEY,
  hasSeenAppWelcomeSync,
  markAppWelcomeSeen,
} from "./capacitor-welcome.ts";

test("welcome prefs key is stable", () => {
  assert.equal(WELCOME_SEEN_KEY, "cv_welcome_seen_v1");
});

test("hasSeenAppWelcomeSync is true on web (no Capacitor)", () => {
  assert.equal(hasSeenAppWelcomeSync(), true);
});

test("markAppWelcomeSeen is a no-op on web", async () => {
  await markAppWelcomeSeen();
  assert.equal(hasSeenAppWelcomeSync(), true);
});
