import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WORKOUT_CSV_HEADERS,
  buildWorkoutCsv,
  buildWorkoutPdfBlocks,
  flattenWorkoutExport,
  formatWorkoutExportClock,
  resolveWorkoutExportTimezone,
  workoutExportDateWhere,
  workoutExportTitle,
  type WorkoutExportSession,
} from "./export-csv.ts";
import { workoutExportFilename, workoutExportPath, workoutHistoryExportRange } from "./export-href.ts";

const moscowSession: WorkoutExportSession = {
  date: "2026-08-18",
  note: "Жим",
  startedAt: "2026-08-18T18:30:00.000Z",
  endedAt: "2026-08-18T19:15:00.000Z",
  muscles: ["triceps", "chest"],
  exercises: [
    {
      name: "Жим лёжа",
      kind: "strength",
      note: "узкий хват",
      sortOrder: 1,
      sets: [
        {
          weightKg: 80,
          reps: 8,
          distanceKm: null,
          durationSec: null,
          setType: "working",
          completed: true,
          rpe: 8,
          sortOrder: 1,
        },
        {
          weightKg: 60,
          reps: 12,
          distanceKm: null,
          durationSec: null,
          setType: "drop",
          completed: false,
          rpe: 9.5,
          sortOrder: 0,
        },
      ],
    },
    {
      name: "Бег",
      kind: "cardio",
      note: null,
      sortOrder: 0,
      sets: [
        {
          weightKg: null,
          reps: null,
          distanceKm: 5.25,
          durationSec: 1800,
          setType: "working",
          completed: true,
          rpe: null,
          sortOrder: 0,
        },
      ],
    },
  ],
};

test("resolveWorkoutExportTimezone prefers a valid profile zone", () => {
  assert.equal(resolveWorkoutExportTimezone("Asia/Yekaterinburg"), "Asia/Yekaterinburg");
  assert.equal(resolveWorkoutExportTimezone(null), "Europe/Moscow");
  assert.equal(resolveWorkoutExportTimezone("  "), "Europe/Moscow");
  assert.equal(resolveWorkoutExportTimezone("Not/AZone"), "Europe/Moscow");
});

test("formatWorkoutExportClock uses the profile timezone, not UTC", () => {
  assert.equal(formatWorkoutExportClock("2026-08-18T18:30:00.000Z", "Europe/Moscow"), "21:30");
  assert.equal(formatWorkoutExportClock("2026-08-18T18:30:00.000Z", "Asia/Yekaterinburg"), "23:30");
  assert.equal(formatWorkoutExportClock(null, "Europe/Moscow"), "");
});

test("workout title falls back to muscle groups", () => {
  assert.equal(workoutExportTitle(moscowSession), "Жим");
  assert.equal(
    workoutExportTitle({ note: "  ", muscles: ["back", "biceps"] }),
    "Спина · Бицепс",
  );
});

test("buildWorkoutCsv writes BOM, Russian headers, CRLF and set fields", () => {
  const csv = buildWorkoutCsv([moscowSession], "Europe/Moscow");
  assert.ok(csv.startsWith("\uFEFF"));
  const body = csv.slice(1);
  assert.equal(body.replace(/\r\n/g, "").includes("\n"), false);
  const lines = body.split("\r\n");
  assert.equal(lines[0], WORKOUT_CSV_HEADERS.join(","));
  assert.match(lines[0]!, /Дата,Начало,Окончание,Тренировка/);
  assert.match(lines[0]!, /№ подхода,Тип подхода,Вес кг,Повторы,Дистанция км,Время сек,Усилие \(RPE\)/);

  const rows = flattenWorkoutExport([moscowSession], "Europe/Moscow");
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.exercise, "Бег");
  assert.equal(rows[0]!.setNumber, "1");
  assert.equal(rows[0]!.distanceKm, "5.25");
  assert.equal(rows[0]!.durationSec, "1800");
  assert.equal(rows[0]!.start, "21:30");
  assert.equal(rows[0]!.end, "22:15");
  assert.equal(rows[0]!.muscles, "Грудь · Трицепс");
  assert.equal(rows[0]!.kind, "Кардио");

  const drop = rows.find((row) => row.setType === "Дроп");
  assert.ok(drop);
  assert.equal(drop!.setNumber, "1");
  assert.equal(drop!.weightKg, "60");
  assert.equal(drop!.reps, "12");
  assert.equal(drop!.rpe, "9.5");
  assert.equal(drop!.completed, "нет");
  assert.equal(drop!.exerciseNote, "узкий хват");

  const working = rows.find((row) => row.exercise === "Жим лёжа" && row.setType === "Рабочий");
  assert.equal(working?.setNumber, "2");
  assert.equal(working?.weightKg, "80");
  assert.equal(working?.reps, "8");

  assert.match(lines[1]!, /Бег/);
  assert.match(csv, /узкий хват/);
});

test("buildWorkoutCsv quotes commas and keeps a session without sets", () => {
  const csv = buildWorkoutCsv(
    [
      {
        date: "2026-09-01",
        note: "Ноги, легко",
        startedAt: null,
        endedAt: null,
        muscles: ["legs"],
        exercises: [
          {
            name: "Присед",
            kind: "strength",
            note: null,
            sortOrder: 0,
            sets: [],
          },
        ],
      },
    ],
    "Europe/Moscow",
  );
  assert.match(csv, /"Ноги, легко"/);
  const rows = flattenWorkoutExport(
    [
      {
        date: "2026-09-01",
        note: null,
        startedAt: null,
        endedAt: null,
        muscles: [],
        exercises: [],
      },
    ],
    "UTC",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.date, "2026-09-01");
  assert.equal(rows[0]!.setNumber, "");
  assert.equal(rows[0]!.start, "");
});

test("pdf blocks describe sets in the profile timezone", () => {
  const blocks = buildWorkoutPdfBlocks([moscowSession], "Europe/Moscow");
  assert.equal(blocks.length, 1);
  assert.match(blocks[0]!.heading, /2026-08-18  21:30–22:15  Жим/);
  assert.equal(blocks[0]!.muscles, "Грудь · Трицепс");
  assert.ok(blocks[0]!.lines.some((line) => line.includes("Бег") && line.includes("Кардио")));
  assert.ok(blocks[0]!.lines.some((line) => line.includes("5.25 км") && line.includes("30 мин")));
  assert.ok(blocks[0]!.lines.some((line) => line.includes("80 кг × 8") && line.includes("усилие 8")));
  assert.ok(blocks[0]!.lines.some((line) => line.includes("Дроп") && line.includes("не выполнен")));
});

test("date filter and filenames match the diary export shape", () => {
  assert.deepEqual(workoutExportDateWhere("2026-08-01", "2026-08-18"), {
    gte: "2026-08-01",
    lte: "2026-08-18",
  });
  assert.deepEqual(workoutExportDateWhere("2026-08-01", null), { gte: "2026-08-01" });
  assert.equal(workoutExportDateWhere(null, null), undefined);
  assert.equal(
    workoutExportPath("csv", "2026-08-01", "2026-08-18"),
    "/api/export/workouts?format=csv&from=2026-08-01&to=2026-08-18",
  );
  assert.equal(workoutExportPath("pdf"), "/api/export/workouts?format=pdf");
  assert.equal(
    workoutExportFilename("csv", "2026-08-01", "2026-08-18"),
    "calorie-vision-workouts-2026-08-01-2026-08-18.csv",
  );
  assert.equal(workoutExportFilename("pdf"), "calorie-vision-workouts.pdf");
});

test("gym history export range follows the list filters", () => {
  assert.deepEqual(
    workoutHistoryExportRange({
      filterPeriod: "all",
      filterDate: null,
      todayKey: "2026-08-18",
      calYear: 2026,
      calMonth: 7,
    }),
    { from: null, to: null },
  );
  assert.deepEqual(
    workoutHistoryExportRange({
      filterPeriod: "day",
      filterDate: "2026-08-18",
      todayKey: "2026-08-18",
      calYear: 2026,
      calMonth: 7,
    }),
    { from: "2026-08-18", to: "2026-08-18" },
  );
  const week = workoutHistoryExportRange({
    filterPeriod: "week",
    filterDate: null,
    todayKey: "2026-08-18",
    calYear: 2026,
    calMonth: 7,
  });
  assert.equal(week.from, "2026-08-17");
  assert.equal(week.to, "2026-08-23");
  const month = workoutHistoryExportRange({
    filterPeriod: "month",
    filterDate: null,
    todayKey: "2026-08-18",
    calYear: 2026,
    calMonth: 1,
  });
  assert.equal(month.from, "2026-02-01");
  assert.equal(month.to, "2026-02-28");
});
