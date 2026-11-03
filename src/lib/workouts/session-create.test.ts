import assert from "node:assert/strict";
import test from "node:test";
import {
  COPY_PREVIOUS_SESSION_DEFAULT,
  shouldRepeatPreviousSession,
} from "@/lib/workouts/session-create";

test("copy exercises from the previous session defaults to off", () => {
  assert.equal(COPY_PREVIOUS_SESSION_DEFAULT, false);
});

test("empty session does not call repeat", () => {
  assert.equal(shouldRepeatPreviousSession(false, "sess-1"), false);
  assert.equal(shouldRepeatPreviousSession(false, null), false);
  assert.equal(shouldRepeatPreviousSession(false, undefined), false);
  assert.equal(shouldRepeatPreviousSession(false, ""), false);
});

test("repeat only when the user opted in and a previous session exists", () => {
  assert.equal(shouldRepeatPreviousSession(true, "sess-1"), true);
  assert.equal(shouldRepeatPreviousSession(true, null), false);
  assert.equal(shouldRepeatPreviousSession(true, undefined), false);
  assert.equal(shouldRepeatPreviousSession(true, ""), false);
});
