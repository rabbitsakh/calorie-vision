import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBadgeStats, qualifyingBadgeKeys } from "./badges.ts";
import {
  countBeatenGymRecords,
  decideGymChestGrant,
  gymChestSourceKey,
  isComboDay,
  isProteinWithinDailyGoal,
  sessionQualifiesForGymReward,
  setQualifiesForGymReward,
  summarizeGymRewards,
  type GymRewardSession,
} from "./gym-rewards.ts";

function set(partial: {
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  distanceKm?: number;
  setType?: string;
  completed?: boolean;
}) {
  return {
    weightKg: partial.weightKg ?? null,
    reps: partial.reps ?? null,
    durationSec: partial.durationSec ?? null,
    distanceKm: partial.distanceKm ?? null,
    setType: partial.setType ?? "working",
    completed: partial.completed ?? true,
  };
}

function session(
  id: string,
  date: string,
  sets: ReturnType<typeof set>[],
  extra?: { ended?: boolean; name?: string },
): GymRewardSession {
  return {
    id,
    date,
    createdAt: `${date}T08:00:00.000Z`,
    ended: extra?.ended,
    exercises: [
      {
        name: extra?.name ?? "Жим лёжа",
        kind: "strength",
        sets,
      },
    ],
  };
}

test("пустая тренировка и разминка не считаются", () => {
  assert.equal(setQualifiesForGymReward(set({})), false);
  assert.equal(setQualifiesForGymReward(set({ reps: 8, setType: "warmup" })), false);
  assert.equal(setQualifiesForGymReward(set({ reps: 8, completed: false })), false);
  assert.equal(setQualifiesForGymReward(set({ weightKg: 40 })), false);
  assert.equal(sessionQualifiesForGymReward(false, [set({ reps: 5 })]), false);
  assert.equal(sessionQualifiesForGymReward(true, []), false);
  assert.equal(sessionQualifiesForGymReward(true, [set({ reps: 5 })]), true);
  assert.equal(sessionQualifiesForGymReward(true, [set({ durationSec: 60 })]), true);
});

test("белок в цели — от 92% нормы, без верхней границы и без калорий", () => {
  assert.equal(isProteinWithinDailyGoal(91.9, 100), false);
  assert.equal(isProteinWithinDailyGoal(92, 100), true);
  assert.equal(isProteinWithinDailyGoal(140, 100), true);
  assert.equal(isProteinWithinDailyGoal(100, 0), false);
  assert.equal(isProteinWithinDailyGoal(0, 100), false);
  assert.equal(
    isComboDay({ qualifyingWorkout: false, protein: 120, proteinTarget: 100 }),
    false,
  );
  assert.equal(
    isComboDay({ qualifyingWorkout: true, protein: 120, proteinTarget: 100 }),
    true,
  );
});

test("тренировка даёт один зачёт сундука, повтор и пустой день — нет", () => {
  const done = session("s1", "2026-11-11", [set({ reps: 8, weightKg: 40 })]);
  const first = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [done],
    protein: 40,
    proteinTarget: 120,
    existingSourceKeys: [],
  });
  assert.equal(first.action, "grant");
  if (first.action !== "grant") return;
  assert.equal(first.kind, "workout");
  assert.equal(first.sourceKey, "gym-chest:2026-11-11:session:s1");
  assert.ok(first.sourceKey.length <= 96);

  const again = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [done, session("s2", "2026-11-11", [set({ reps: 5 })])],
    protein: 40,
    proteinTarget: 120,
    existingSourceKeys: [first.sourceKey],
  });
  assert.deepEqual(again, { action: "skip", reason: "day-already-credited" });

  const empty = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [session("s3", "2026-11-11", [set({ setType: "warmup", reps: 10 })])],
    protein: 0,
    proteinTarget: 0,
    existingSourceKeys: [],
  });
  assert.deepEqual(empty, { action: "skip", reason: "no-qualifying-session" });

  const draft = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [session("s4", "2026-11-11", [set({ reps: 8 })], { ended: false })],
    protein: 0,
    proteinTarget: 0,
    existingSourceKeys: [],
  });
  assert.deepEqual(draft, { action: "skip", reason: "no-qualifying-session" });
});

test("удаление и перенос сессии не дают второй зачёт", () => {
  const key = gymChestSourceKey("2026-11-10", "s1");
  const recreated = decideGymChestGrant({
    date: "2026-11-10",
    today: "2026-11-11",
    sessions: [session("s9", "2026-11-10", [set({ reps: 6 })])],
    protein: 0,
    proteinTarget: 0,
    existingSourceKeys: [key],
  });
  assert.equal(recreated.action, "skip");

  const moved = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [session("s1", "2026-11-11", [set({ reps: 6 })])],
    protein: 0,
    proteinTarget: 0,
    existingSourceKeys: [key],
  });
  assert.deepEqual(moved, { action: "skip", reason: "session-already-credited" });

  const future = decideGymChestGrant({
    date: "2026-11-12",
    today: "2026-11-11",
    sessions: [session("s5", "2026-11-12", [set({ reps: 6 })])],
    protein: 0,
    proteinTarget: 0,
    existingSourceKeys: [],
  });
  assert.deepEqual(future, { action: "skip", reason: "future-day" });
});

test("комбо занимает тот же один зачёт, а не второй", () => {
  const combo = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [session("s1", "2026-11-11", [set({ reps: 5, weightKg: 20 })])],
    protein: 110,
    proteinTarget: 100,
    existingSourceKeys: [],
  });
  assert.equal(combo.action, "grant");
  if (combo.action !== "grant") return;
  assert.equal(combo.kind, "combo");
  assert.equal(combo.sourceKey, "gym-chest:2026-11-11:session:s1");

  const stacked = decideGymChestGrant({
    date: "2026-11-11",
    today: "2026-11-11",
    sessions: [session("s1", "2026-11-11", [set({ reps: 5 })])],
    protein: 130,
    proteinTarget: 100,
    existingSourceKeys: ["gym-chest:2026-11-11:session:s1"],
  });
  assert.deepEqual(stacked, { action: "skip", reason: "day-already-credited" });
});

test("значки зала и комбо: пороги, рекорд и защита от пустой истории", () => {
  const none = summarizeGymRewards({
    sessions: [session("e", "2026-11-02", [])],
    proteinByDate: {},
    proteinTargetByDate: {},
  });
  assert.equal(none.gymSessionCount, 0);
  assert.deepEqual(
    qualifyingBadgeKeys({ ...emptyBadgeStats(), ...none, gymPrBeats: none.gymPrBeats }),
    [],
  );

  const first = session("a", "2026-11-02", [set({ reps: 5, weightKg: 40 })]);
  const heavier = session("b", "2026-11-04", [set({ reps: 5, weightKg: 50 })]);
  const summary = summarizeGymRewards({
    sessions: [first, heavier],
    proteinByDate: { "2026-11-02": 100, "2026-11-04": 96 },
    proteinTargetByDate: { "2026-11-02": 100, "2026-11-04": 100 },
  });
  assert.equal(summary.gymSessionCount, 2);
  assert.equal(summary.gymPrBeats, 1);
  assert.deepEqual(summary.comboDates, ["2026-11-02", "2026-11-04"]);
  assert.equal(summary.comboStreakBest, 1);

  const keys = qualifyingBadgeKeys({
    ...emptyBadgeStats(),
    gymSessionCount: summary.gymSessionCount,
    gymPrBeats: summary.gymPrBeats,
    gymBestWeekSessions: summary.gymBestWeekSessions,
    comboDayCount: summary.comboDayCount,
    comboStreakBest: summary.comboStreakBest,
  });
  assert.ok(keys.includes("gym_first"));
  assert.ok(keys.includes("gym_pr"));
  assert.ok(keys.includes("combo_first"));
  assert.equal(keys.includes("gym_10"), false);
  assert.equal(keys.includes("combo_3"), false);
  assert.equal(countBeatenGymRecords([first]), 0);
});

test("серия комбо и неделя из трёх тренировок", () => {
  const dates = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09"];
  const sessions = dates.map((date, index) =>
    session(`w${index}`, date, [set({ reps: 8, weightKg: 30 + index })]),
  );
  const proteinByDate = Object.fromEntries(dates.map((date) => [date, 100]));
  const proteinTargetByDate = Object.fromEntries(dates.map((date) => [date, 100]));
  const summary = summarizeGymRewards({
    sessions,
    proteinByDate,
    proteinTargetByDate,
  });
  assert.equal(summary.gymBestWeekSessions, 3);
  assert.equal(summary.comboStreakBest, 3);
  assert.equal(summary.comboDayCount, 4);

  const keys = qualifyingBadgeKeys({
    ...emptyBadgeStats(),
    gymSessionCount: 30,
    gymPrBeats: 1,
    gymBestWeekSessions: 3,
    comboDayCount: 4,
    comboStreakBest: 7,
  });
  assert.ok(keys.includes("gym_30"));
  assert.ok(keys.includes("gym_week_3"));
  assert.ok(keys.includes("combo_3"));
  assert.ok(keys.includes("combo_7"));
});
