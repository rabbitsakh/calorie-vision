import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAllPdf, buildAllZip } from "./export/bundle.ts";
import { CSV_BOM } from "./export/csv.ts";
import { buildDiaryCsv, buildDiaryPdf, buildDiaryPdfBlocks, type DiaryExportEntry } from "./export/diary.ts";
import { ALL_EXPORT_CSV_NAMES, exportDownloadName, exportQueryPath } from "./export/paths.ts";
import { buildWeightCsv, buildWeightPdf, type WeightExportEntry } from "./export/weight.ts";
import { readZip } from "./export/zip.ts";
import type { WorkoutExportSession } from "./workouts/export-csv.ts";

const eatenAt = "2026-08-18T18:30:00.000Z";

const meal: DiaryExportEntry = {
  date: "2026-08-18",
  createdAt: eatenAt,
  eatenAt,
  dishName: "Борщ, домашний",
  mealType: "DINNER",
  calories: 320,
  protein: 12,
  fat: 8,
  carbs: 40,
  fiber: 3,
  sugar: 1,
  portionGrams: 300,
  wasCorrected: true,
};

const session: WorkoutExportSession = {
  date: "2026-08-18",
  note: "Жим",
  startedAt: eatenAt,
  endedAt: "2026-08-18T19:15:00.000Z",
  muscles: ["chest"],
  exercises: [
    {
      name: "Жим лёжа",
      kind: "strength",
      note: null,
      sortOrder: 0,
      sets: [
        {
          weightKg: 80,
          reps: 8,
          distanceKm: null,
          durationSec: null,
          setType: "working",
          completed: true,
          rpe: 8,
          sortOrder: 0,
        },
      ],
    },
  ],
};

const weight: WeightExportEntry = {
  date: "2026-08-18",
  weightKg: 72.4,
  note: "утро",
  measuredAt: "2026-08-18T05:10:00.000Z",
};

test("рацион CSV: BOM, кавычки и время в поясе профиля", () => {
  const moscow = buildDiaryCsv([meal], "Europe/Moscow");
  assert.ok(moscow.startsWith(CSV_BOM));
  assert.match(moscow, /21:30/);
  assert.match(moscow, /"Борщ, домашний"/);
  assert.match(moscow, /Ужин/);
  assert.match(buildDiaryCsv([meal], "Asia/Yekaterinburg"), /23:30/);
  assert.doesNotMatch(moscow, /18:30/);
});

test("блоки PDF рациона содержат кириллицу и местное время", () => {
  const blocks = buildDiaryPdfBlocks([meal], "Europe/Moscow");
  assert.equal(blocks.length, 1);
  assert.match(blocks[0]?.heading ?? "", /2026-08-18/);
  assert.match(blocks[0]?.lines[0] ?? "", /21:30/);
  assert.match(blocks[0]?.lines[0] ?? "", /Борщ, домашний/);
  assert.match(blocks[0]?.lines[0] ?? "", /320 ккал/);
});

test("вес CSV пишет время замера в поясе профиля", () => {
  const csv = buildWeightCsv([weight], "Europe/Moscow");
  assert.ok(csv.startsWith(CSV_BOM));
  assert.match(csv, /08:10/);
  assert.match(csv, /72\.4/);
  assert.match(csv, /утро/);
  assert.match(buildWeightCsv([weight], "Asia/Yekaterinburg"), /10:10/);
});

test("ZIP «всё вместе» содержит три CSV с BOM", () => {
  const zip = buildAllZip({
    meals: [meal],
    sessions: [session],
    weights: [weight],
    timezone: "Europe/Moscow",
  });
  assert.equal(zip.subarray(0, 2).toString("utf8"), "PK");
  const files = readZip(zip);
  assert.deepEqual(
    files.map((file) => file.name),
    [ALL_EXPORT_CSV_NAMES.ration, ALL_EXPORT_CSV_NAMES.workouts, ALL_EXPORT_CSV_NAMES.weight],
  );
  for (const file of files) {
    assert.equal(file.data[0], 0xef);
    assert.equal(file.data[1], 0xbb);
    assert.equal(file.data[2], 0xbf);
  }
  const ration = files[0]?.data.toString("utf8") ?? "";
  const workouts = files[1]?.data.toString("utf8") ?? "";
  const weights = files[2]?.data.toString("utf8") ?? "";
  assert.match(ration, /Борщ, домашний/);
  assert.match(ration, /21:30/);
  assert.match(workouts, /Жим лёжа/);
  assert.match(workouts, /21:30/);
  assert.match(weights, /08:10/);
});

test("PDF рациона, веса и всего вместе — документы с кириллическим шрифтом", async () => {
  const diary = await buildDiaryPdf({
    entries: [meal],
    timezone: "Europe/Moscow",
    from: null,
    to: null,
  });
  const weightPdf = await buildWeightPdf({
    entries: [weight],
    timezone: "Europe/Moscow",
    from: "2026-08-01",
    to: "2026-08-18",
  });
  const all = await buildAllPdf({
    meals: [meal],
    sessions: [session],
    weights: [weight],
    timezone: "Europe/Moscow",
    from: null,
    to: null,
  });
  for (const buffer of [diary, weightPdf, all]) {
    assert.equal(buffer.subarray(0, 5).toString("utf8"), "%PDF-");
    assert.ok(buffer.includes(Buffer.from("DejaVuSans")), "PDF должен встроить DejaVu для кириллицы");
  }
  assert.ok(all.length > diary.length);
});

test("имена файлов: общий CSV — это ZIP", () => {
  assert.equal(exportDownloadName("ration", "csv"), "calorie-vision-ration.csv");
  assert.equal(exportDownloadName("all", "csv", "2026-08-01", "2026-08-18"), "calorie-vision-all-2026-08-01-2026-08-18.zip");
  assert.equal(exportDownloadName("all", "pdf"), "calorie-vision-all.pdf");
  assert.equal(exportQueryPath("weight", "pdf"), "/api/export/weight?format=pdf");
  assert.equal(exportQueryPath("ration", "csv", "2026-08-01", "2026-08-18"), "/api/export?format=csv&from=2026-08-01&to=2026-08-18");
});
