import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lastSessionRepeatHint,
  lastSessionRepeatLabel,
  pickLastFinishedSession,
} from "./last-finished-session.ts";

test("pickLastFinishedSession prefers finished over newer draft", () => {
  const picked = pickLastFinishedSession([
    {
      id: "draft",
      date: "2026-10-10",
      muscleLabels: ["Грудь"],
      cardioOnly: false,
      exerciseCount: 0,
      clockStatus: "idle",
    },
    {
      id: "done",
      date: "2026-10-08",
      muscleLabels: ["Спина"],
      cardioOnly: false,
      exerciseCount: 4,
      clockStatus: "finished",
    },
  ]);
  assert.equal(picked?.id, "done");
});

test("skips local offline sessions", () => {
  const picked = pickLastFinishedSession([
    {
      id: "local-sess-1",
      date: "2026-10-10",
      muscleLabels: ["Грудь"],
      cardioOnly: false,
      exerciseCount: 2,
      clockStatus: "finished",
    },
    {
      id: "srv",
      date: "2026-10-07",
      muscleLabels: ["Ноги"],
      cardioOnly: false,
      exerciseCount: 3,
      clockStatus: "finished",
    },
  ]);
  assert.equal(picked?.id, "srv");
});

test("fallback to newest with exercises", () => {
  const picked = pickLastFinishedSession([
    {
      id: "a",
      date: "2026-10-09",
      muscleLabels: [],
      cardioOnly: true,
      exerciseCount: 1,
      clockStatus: "idle",
    },
  ]);
  assert.equal(picked?.id, "a");
  assert.equal(lastSessionRepeatLabel(picked!), "Повторить кардио");
  assert.match(lastSessionRepeatHint(picked!), /Кардио/);
});

test("empty list", () => {
  assert.equal(pickLastFinishedSession([]), null);
});
