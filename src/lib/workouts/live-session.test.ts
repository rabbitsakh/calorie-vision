import assert from "node:assert/strict";
import test from "node:test";
import {
  pickSessionToResume,
  readWorkoutResumeId,
  shouldAdoptRemoteFinish,
  writeWorkoutResumeId,
} from "./live-session.ts";

const running = {
  id: "run",
  clockStatus: "running",
  startedAt: "2026-11-12T06:00:00.000Z",
  endedAt: null,
  endedBy: null,
};

const paused = {
  id: "pause",
  clockStatus: "paused",
  startedAt: "2026-11-12T07:00:00.000Z",
  endedAt: null,
  endedBy: null,
};

const finished = {
  id: "done",
  clockStatus: "finished",
  startedAt: "2026-11-12T05:00:00.000Z",
  endedAt: "2026-11-12T06:00:00.000Z",
  endedBy: "manual",
};

const idle = {
  id: "draft",
  clockStatus: "idle",
  startedAt: null,
  endedAt: null,
  endedBy: null,
};

test("после перезагрузки берётся одна живая тренировка, без дубля", () => {
  const picked = pickSessionToResume([finished, paused, running, idle]);
  assert.equal(picked?.id, "run");
  const again = pickSessionToResume([picked!]);
  assert.equal(again?.id, "run");
});

test("запомненный экран важнее другой идущей, завершённый не поднимается", () => {
  assert.equal(pickSessionToResume([running, idle], "draft")?.id, "draft");
  assert.equal(pickSessionToResume([running, finished], "done")?.id, "run");
  assert.equal(pickSessionToResume([finished, idle]), null);
});

test("удалённое завершение принимается только как явное", () => {
  assert.equal(shouldAdoptRemoteFinish({ clockStatus: "finished", endedBy: "auto" }), false);
  assert.equal(shouldAdoptRemoteFinish({ clockStatus: "finished", endedBy: null }), false);
  assert.equal(shouldAdoptRemoteFinish({ clockStatus: "finished", endedBy: "manual" }), true);
  assert.equal(shouldAdoptRemoteFinish({ clockStatus: "running", endedBy: null }), false);
});

test("id активной тренировки переживает перезагрузку хранилища", () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
    removeItem: (key: string) => {
      mem.delete(key);
    },
  };
  assert.equal(readWorkoutResumeId(storage), null);
  writeWorkoutResumeId(storage, "sess-1");
  assert.equal(readWorkoutResumeId(storage), "sess-1");
  writeWorkoutResumeId(storage, null);
  assert.equal(readWorkoutResumeId(storage), null);
});
