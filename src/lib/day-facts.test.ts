import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveDayNorm } from "./day-norm.ts";
import {
  OPEN_SESSION_IDLE_GRACE_SEC,
  sessionBillableElapsedSec,
  shownWaterMl,
  sumWaterMl,
  wallClockSessionInstants,
} from "./day-facts.ts";
import { buildEveningStats } from "./evening-day-summary.ts";
import { buildMomentHero } from "./moment-hero.ts";
import { trainingCalorieBonus } from "./training-day.ts";
import { formatWaterOf } from "./water-display.ts";
import { estimateDbSessionEnergy, estimateSessionEnergy } from "./workouts/energy.ts";
import {
  invalidateRationDayCache,
  RATION_DAY_CACHE_KEY,
  readRationDayCache,
  writeRationDayCache,
} from "./ration-day-cache.ts";

const BENCH = [
  {
    name: "Жим штанги лёжа",
    kind: "strength",
    catalogId: "bench-press",
    sets: [{ completed: true, setType: "working" as const }],
  },
];

const PROFILE = {
  weightKg: 128,
  goal: "LOSE" as const,
  pace: "HEALTHY" as const,
  sex: "MALE" as const,
  heightCm: 180,
  birthYear: 1991,
  activity: "LIGHT" as const,
};

function mockStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  map.clear();
  return map;
}

test("правка времени: 1:50 остаётся 1:50, а не сутки", () => {
  const sameDay = wallClockSessionInstants("2026-11-25", "10:00", "11:50", "UTC");
  assert.ok(sameDay);
  const spanSec = (new Date(sameDay.endedAt).getTime() - new Date(sameDay.startedAt).getTime()) / 1000;
  assert.equal(spanSec, 110 * 60);

  const overnight = wallClockSessionInstants("2026-11-25", "22:00", "00:20", "UTC");
  assert.ok(overnight);
  const nightSec = (new Date(overnight.endedAt).getTime() - new Date(overnight.startedAt).getTime()) / 1000;
  assert.equal(nightSec, (2 * 60 + 20) * 60);
  assert.ok(nightSec < 4 * 60 * 60);
});

test("создали тренировку, сменили время — норма и расход совпадают, длительность разумна", () => {
  const created = wallClockSessionInstants("2026-11-25", "10:00", "11:50", "UTC");
  assert.ok(created);
  const started = new Date(created.startedAt);
  const ended = new Date(created.endedAt);
  const sets = [
    { completed: true, createdAt: new Date(started.getTime() + 10 * 60 * 1000) },
    { completed: true, createdAt: new Date(started.getTime() + 100 * 60 * 1000) },
  ];
  const createdEnergy = estimateDbSessionEnergy(
    {
      startedAt: started,
      endedAt: ended,
      pausedAt: null,
      pausedMs: 0,
      exercises: [{ ...BENCH[0]!, sets }],
    },
    128,
  );
  assert.equal(createdEnergy.durationSec, 110 * 60);
  assert.ok(createdEnergy.kcal > 400 && createdEnergy.kcal < 1500, `расход ${createdEnergy.kcal}`);

  const createdDay = resolveDayNorm({
    ...PROFILE,
    burnKcal: createdEnergy.kcal,
    trainingDay: true,
    burnApproximate: createdEnergy.approximate,
    sessionCount: 1,
  });
  assert.equal(createdDay.training?.calorieBonusKcal, trainingCalorieBonus(createdEnergy.kcal, "LOSE"));
  assert.equal(
    createdDay.target.calories,
    createdDay.training!.baseCalories + createdDay.training!.calorieBonusKcal,
  );

  const edited = wallClockSessionInstants("2026-11-25", "10:00", "11:20", "UTC");
  assert.ok(edited);
  const editedEnergy = estimateDbSessionEnergy(
    {
      startedAt: new Date(edited.startedAt),
      endedAt: new Date(edited.endedAt),
      pausedAt: null,
      pausedMs: 0,
      exercises: [{ ...BENCH[0]!, sets }],
    },
    128,
  );
  assert.equal(editedEnergy.durationSec, 80 * 60);
  assert.ok(editedEnergy.kcal < createdEnergy.kcal);
  const direct = estimateSessionEnergy({ weightKg: 128, elapsedSec: 80 * 60, exercises: BENCH });
  assert.equal(editedEnergy.kcal, direct.kcal);

  const editedDay = resolveDayNorm({
    ...PROFILE,
    burnKcal: editedEnergy.kcal,
    trainingDay: true,
    sessionCount: 1,
  });
  assert.equal(editedDay.training?.calorieBonusKcal, trainingCalorieBonus(editedEnergy.kcal, "LOSE"));
  assert.equal(editedDay.target.calories, editedDay.training!.baseCalories + editedDay.training!.calorieBonusKcal);
  assert.notEqual(editedDay.target.calories, createdDay.target.calories);
  assert.equal(editedDay.training?.baseCalories, createdDay.training?.baseCalories);

  const hero = buildMomentHero({
    selectedIsToday: true,
    hour: 20,
    gymLive: false,
    gymLiveLabel: null,
    gymDoneToday: true,
    morning: null,
    softStep: null,
    logged: true,
    mealCount: 2,
    calories: 1630,
    calorieTarget: editedDay.target.calories,
    protein: 140,
    proteinTarget: editedDay.target.protein,
    fat: 65,
    fatTarget: editedDay.target.fat,
    carbs: 113,
    carbsTarget: editedDay.target.carbs,
    waterMl: 4500,
    waterTarget: editedDay.target.waterMl,
    streak: 3,
    calorieBase: editedDay.training?.baseCalories,
    calorieBonus: editedDay.training?.calorieBonusKcal,
  });
  const evening = buildEveningStats(
    { calories: 1630, protein: 140, fat: 65, carbs: 113, waterMl: 4500 },
    {
      calories: editedDay.target.calories,
      protein: editedDay.target.protein,
      fat: editedDay.target.fat,
      carbs: editedDay.target.carbs,
      waterMl: editedDay.target.waterMl,
    },
  );
  const kcalLine = evening.find((stat) => stat.key === "calories")?.text ?? "";
  const waterLine = evening.find((stat) => stat.key === "water")?.text ?? "";
  assert.match(hero?.title ?? "", new RegExp(editedDay.target.calories.toLocaleString("ru-RU").replace(/\s/g, "\\s")));
  assert.match(kcalLine, new RegExp(editedDay.target.calories.toLocaleString("ru-RU").replace(/\s/g, "\\s")));
  assert.equal(waterLine, formatWaterOf(4500, editedDay.target.waterMl));
  assert.equal(hero?.chips?.find((chip) => chip.kind === "water")?.detail, waterLine);

  const removed = resolveDayNorm(PROFILE);
  assert.equal(removed.training, null);
  assert.equal(removed.target.calories, editedDay.training?.baseCalories);
});

test("открытая тренировка не прибавляет простой до текущего времени", () => {
  const start = Date.parse("2026-11-25T07:00:00.000Z");
  const lastSet = start + 110 * 60 * 1000;
  const now = start + 14 * 60 * 60 * 1000;
  const session = {
    startedAt: new Date(start),
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    exercises: [
      {
        sets: [
          { completed: true, createdAt: new Date(start + 5 * 60 * 1000) },
          { completed: true, createdAt: new Date(lastSet) },
        ],
      },
    ],
  };
  const elapsed = sessionBillableElapsedSec(session, now);
  assert.equal(elapsed, 110 * 60 + OPEN_SESSION_IDLE_GRACE_SEC);
  assert.ok(elapsed < 3 * 60 * 60);

  const billed = estimateDbSessionEnergy(session, 128, now);
  const rawOpen = estimateSessionEnergy({ weightKg: 128, elapsedSec: 14 * 60 * 60, exercises: BENCH });
  assert.equal(billed.durationSec, elapsed);
  assert.ok(billed.kcal < 2000);
  assert.ok(rawOpen.kcal > 4000);
  const day = resolveDayNorm({ ...PROFILE, burnKcal: billed.kcal, trainingDay: true });
  const inflated = resolveDayNorm({ ...PROFILE, burnKcal: rawOpen.kcal, trainingDay: true });
  assert.ok(day.target.calories < inflated.target.calories);
  assert.equal(day.training?.calorieBonusKcal, trainingCalorieBonus(billed.kcal, "LOSE"));
});

test("вода героя, итога и ленты — одна сумма записей", () => {
  const total = sumWaterMl([{ ml: 500 }, { ml: 2000 }, { ml: 2000 }]);
  assert.equal(total, 4500);
  assert.equal(shownWaterMl(total), 4500);
  assert.equal(formatWaterOf(shownWaterMl(total), 4200), "4,5 из 4,2 л");
  assert.notEqual(formatWaterOf(shownWaterMl(500), 4200), formatWaterOf(shownWaterMl(total), 4200));

  const files = [
    "src/components/MomentHeroCard.tsx",
    "src/components/EveningDaySummaryCard.tsx",
    "src/components/useDayFeedEvents.ts",
    "src/components/WaterTracker.tsx",
    "src/app/api/ration-day/route.ts",
    "src/app/api/water/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(source, /shownWaterMl|sumWaterMl/, file);
  }
});

test("старый кэш дня не подставляется, сброс даты стирает снимок", () => {
  const map = mockStorage();
  map.set(
    "cv-ration-day-cache-v1",
    JSON.stringify({
      "2026-11-25": { date: "2026-11-25", water: { totalMl: 500, target: 4200 } },
    }),
  );
  assert.equal(readRationDayCache("2026-11-25"), null);

  writeRationDayCache({ date: "2026-11-25", today: "2026-11-25" } as never);
  assert.equal(readRationDayCache("2026-11-25")?.date, "2026-11-25");
  assert.equal(map.has("cv-ration-day-cache-v1"), false);
  assert.ok(localStorage.getItem(RATION_DAY_CACHE_KEY));

  invalidateRationDayCache("2026-11-25");
  assert.equal(readRationDayCache("2026-11-25"), null);
});
