import assert from "node:assert/strict";
import test from "node:test";
import { WELCOME_SEEN_KEY } from "./capacitor-welcome.ts";

test("welcome prefs key is stable", () => {
  assert.equal(WELCOME_SEEN_KEY, "cv_welcome_seen_v1");
});
