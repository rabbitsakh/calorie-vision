import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_CLOSE_UNDO_MS,
  planAutoClock,
  planClockOnLoggedSet,
  planUndoAutoClose,
} from "./session-autoclose.ts";
import { decideDurationRepair } from "./duration-repair.ts";

const t0 = new Date("2026-11-01T10:00:00.000Z");
const t1 = new Date("2026-11-01T10:40:00.000Z");

test("первый подход ставит начало и не закрывает тренировку", () => {
  const open = planAutoClock({
    startedAt: null,
    endedAt: null,
    endedBy: null,
    setTimes: [t0],
    now: new Date(t0.getTime() + 10 * 60 * 1000),
  });
  assert.equal(open?.startedAt?.toISOString(), t0.toISOString());
  assert.equal(open?.endedAt, undefined);
  assert.equal(open?.endedBy, undefined);
});

test("простой любой длины не завершает тренировку", () => {
  const idle = planAutoClock({
    startedAt: t0,
    endedAt: null,
    endedBy: null,
    setTimes: [t0, t1],
    now: new Date(t1.getTime() + 24 * 60 * 60 * 1000),
  });
  assert.equal(idle, null);

  const noSets = planAutoClock({
    startedAt: t0,
    endedAt: null,
    endedBy: null,
    setTimes: [],
    now: new Date(t0.getTime() + 3 * 60 * 60 * 1000),
  });
  assert.equal(noSets, null);
});

test("ручное завершение не переоткрывается новым чтением и не снимается чужим подходом", () => {
  assert.equal(
    planAutoClock({
      startedAt: t0,
      endedAt: t1,
      endedBy: "manual",
      setTimes: [t0],
      now: new Date(t1.getTime() + 60 * 60 * 1000),
    }),
    null,
  );
  assert.equal(
    planClockOnLoggedSet(
      { startedAt: t0, endedAt: t1, endedBy: "manual" },
      new Date(t1.getTime() + 1000),
    ),
    null,
  );
  assert.equal(
    planUndoAutoClose({
      endedAt: t1,
      endedBy: "manual",
      now: new Date(t1.getTime() + 60 * 1000),
    }),
    null,
  );
});

test("свежее автозакрытие снимается, старое остаётся", () => {
  const now = new Date("2026-11-12T04:00:00.000Z");
  const fresh = planUndoAutoClose({
    endedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endedBy: "auto",
    now,
  });
  assert.equal(fresh?.endedAt, null);
  assert.equal(fresh?.endedBy, null);
  assert.equal(fresh?.pausedAt, null);

  const stale = planUndoAutoClose({
    endedAt: new Date(now.getTime() - AUTO_CLOSE_UNDO_MS - 1000),
    endedBy: "auto",
    now,
  });
  assert.equal(stale, null);
});

test("старое автозавершение снимается, если подход записали снова", () => {
  const at = new Date(t1.getTime() + 40 * 60 * 1000);
  const patch = planClockOnLoggedSet(
    { startedAt: t0, endedAt: t1, endedBy: "auto" },
    at,
  );
  assert.equal(patch?.endedAt, null);
  assert.equal(patch?.endedBy, null);
  assert.equal(patch?.startedAt, undefined);
});

test("починка: 4 часа при серии в 40 минут — исправить, растянутые подходы — не трогать", () => {
  const fix = decideDurationRepair({
    id: "a",
    startedAt: t0,
    endedAt: new Date(t0.getTime() + 4 * 60 * 60 * 1000),
    setTimes: [t0, t1],
  });
  assert.equal(fix.action, "fix");
  if (fix.action === "fix") {
    assert.equal(fix.startedAt.toISOString(), t0.toISOString());
    assert.equal(fix.endedAt.toISOString(), t1.toISOString());
  }

  const unsure = decideDurationRepair({
    id: "b",
    startedAt: t0,
    endedAt: new Date(t0.getTime() + 5 * 60 * 60 * 1000),
    setTimes: [t0, new Date(t0.getTime() + 4 * 60 * 60 * 1000)],
  });
  assert.equal(unsure.action, "uncertain");

  const manual = decideDurationRepair({
    id: "c",
    startedAt: t0,
    endedAt: new Date(t0.getTime() + 5 * 60 * 60 * 1000),
    endedBy: "manual",
    setTimes: [t0, t1],
  });
  assert.equal(manual.action, "skip");
});
