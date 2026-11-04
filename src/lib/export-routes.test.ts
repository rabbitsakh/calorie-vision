import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import { CSV_BOM } from "./export/csv.ts";
import { ALL_EXPORT_CSV_NAMES } from "./export/paths.ts";
import { readZip } from "./export/zip.ts";

process.env.DATABASE_URL ||= "mysql://calorie:password@127.0.0.1:3306/calorie_vision";
process.env.NEXTAUTH_SECRET ||= "test-secret-test-secret-test-secret";
process.env.NEXTAUTH_URL ||= "http://localhost:3000";
process.env.FUNNEL_ANALYTICS = "off";

const require = createRequire(import.meta.url);
const nextAuthId = require.resolve("next-auth");
require.cache[nextAuthId] = {
  id: nextAuthId,
  filename: nextAuthId,
  loaded: true,
  exports: {
    async getServerSession() {
      return { user: { id: "user-1", email: "user@example.com" } };
    },
    default() {
      return async function ok() {
        return new Response("ok");
      };
    },
  },
};

type FindMany = (args: { where?: Record<string, unknown> }) => Promise<unknown[]>;

const eatenAt = new Date("2026-08-18T18:30:00.000Z");

const mealRow = {
  date: "2026-08-18",
  createdAt: eatenAt,
  eatenAt,
  dishName: "Борщ",
  mealType: "DINNER",
  calories: 320,
  protein: 12,
  fat: 8,
  carbs: 40,
  fiber: 3,
  sugar: 1,
  portionGrams: 300,
  wasCorrected: false,
};

const workoutRow = {
  date: "2026-08-18",
  note: "Жим",
  startedAt: eatenAt,
  endedAt: new Date("2026-08-18T19:15:00.000Z"),
  muscles: [{ groupKey: "chest" }],
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

const weightRow = {
  date: "2026-08-18",
  weightKg: 72.4,
  note: "утро",
  measuredAt: new Date("2026-08-18T05:10:00.000Z"),
};

let diaryGet: (request: NextRequest) => Promise<Response>;
let workoutsGet: (request: NextRequest) => Promise<Response>;
let weightGet: (request: NextRequest) => Promise<Response>;
let allGet: (request: NextRequest) => Promise<Response>;
let disconnect: () => Promise<void>;
let lastMealWhere: unknown;
let lastWorkoutWhere: unknown;
let lastWeightWhere: unknown;
let profileTimezone: string | null = "Europe/Moscow";

before(async () => {
  const { setFunnelProvidersForTests } = await import("./funnel-analytics.ts");
  setFunnelProvidersForTests([]);
  const { prisma } = await import("./prisma.ts");
  disconnect = () => prisma.$disconnect();
  prisma.user.findUnique = (async () => ({ timezone: profileTimezone })) as typeof prisma.user.findUnique;
  prisma.mealEntry.findMany = (async (args: { where?: unknown }) => {
    lastMealWhere = args?.where;
    return [mealRow];
  }) as unknown as FindMany as typeof prisma.mealEntry.findMany;
  prisma.workoutSession.findMany = (async (args: { where?: unknown }) => {
    lastWorkoutWhere = args?.where;
    return [workoutRow];
  }) as unknown as FindMany as typeof prisma.workoutSession.findMany;
  prisma.weightEntry.findMany = (async (args: { where?: unknown }) => {
    lastWeightWhere = args?.where;
    return [weightRow];
  }) as unknown as FindMany as typeof prisma.weightEntry.findMany;

  diaryGet = (await import("../app/api/export/route.ts")).GET;
  workoutsGet = (await import("../app/api/export/workouts/route.ts")).GET;
  weightGet = (await import("../app/api/export/weight/route.ts")).GET;
  allGet = (await import("../app/api/export/all/route.ts")).GET;
});

after(async () => {
  await disconnect?.();
});

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

async function textOf(response: Response): Promise<string> {
  return Buffer.from(await response.arrayBuffer()).toString("utf8");
}

test("GET /api/export CSV: BOM, Москва и фильтр дат", async () => {
  const response = await diaryGet(request("/api/export?format=csv&from=2026-08-01&to=2026-08-18"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(response.headers.get("content-disposition") ?? "", /calorie-vision-ration-2026-08-01-2026-08-18\.csv/);
  const body = await textOf(response);
  assert.ok(body.startsWith(CSV_BOM));
  assert.match(body, /21:30/);
  assert.match(body, /Борщ/);
  assert.doesNotMatch(body, /18:30/);
  assert.deepEqual(lastMealWhere, {
    userId: "user-1",
    date: { gte: "2026-08-01", lte: "2026-08-18" },
  });
});

test("GET /api/export без пояса в профиле пишет время по Москве", async () => {
  profileTimezone = null;
  try {
    const response = await diaryGet(request("/api/export?format=csv"));
    assert.equal(response.status, 200);
    const body = await textOf(response);
    assert.match(body, /21:30/);
    assert.doesNotMatch(body, /18:30/);
  } finally {
    profileTimezone = "Europe/Moscow";
  }
});

test("GET /api/export PDF встраивает кириллический шрифт", async () => {
  const response = await diaryGet(request("/api/export?format=pdf"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);
  assert.match(response.headers.get("content-disposition") ?? "", /calorie-vision-ration\.pdf/);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(body.includes(Buffer.from("DejaVuSans")));
});

test("GET /api/export/workouts CSV и PDF", async () => {
  const csv = await workoutsGet(request("/api/export/workouts?format=csv"));
  assert.equal(csv.status, 200);
  const csvBody = await textOf(csv);
  assert.ok(csvBody.startsWith(CSV_BOM));
  assert.match(csvBody, /Жим лёжа/);
  assert.match(csvBody, /21:30/);
  assert.deepEqual(lastWorkoutWhere, { userId: "user-1" });

  const pdf = await workoutsGet(request("/api/export/workouts?format=pdf&from=2026-08-01&to=2026-08-18"));
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-disposition") ?? "", /calorie-vision-workouts-2026-08-01-2026-08-18\.pdf/);
  const pdfBody = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBody.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.deepEqual(lastWorkoutWhere, {
    userId: "user-1",
    date: { gte: "2026-08-01", lte: "2026-08-18" },
  });
});

test("GET /api/export/weight CSV и PDF", async () => {
  const csv = await weightGet(request("/api/export/weight?format=csv"));
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-disposition") ?? "", /calorie-vision-weight\.csv/);
  const csvBody = await textOf(csv);
  assert.ok(csvBody.startsWith(CSV_BOM));
  assert.match(csvBody, /08:10/);
  assert.match(csvBody, /72\.4/);
  assert.deepEqual(lastWeightWhere, { userId: "user-1" });

  const pdf = await weightGet(request("/api/export/weight?format=pdf"));
  assert.equal(pdf.status, 200);
  const pdfBody = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBody.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(pdfBody.includes(Buffer.from("DejaVuSans")));
});

test("GET /api/export/all CSV — ZIP из трёх таблиц, PDF — один документ", async () => {
  const zipResponse = await allGet(request("/api/export/all?format=csv"));
  assert.equal(zipResponse.status, 200);
  assert.match(zipResponse.headers.get("content-type") ?? "", /application\/zip/);
  assert.match(zipResponse.headers.get("content-disposition") ?? "", /calorie-vision-all\.zip/);
  const zip = Buffer.from(await zipResponse.arrayBuffer());
  const names = readZip(zip).map((file) => file.name);
  assert.deepEqual(names, [
    ALL_EXPORT_CSV_NAMES.ration,
    ALL_EXPORT_CSV_NAMES.workouts,
    ALL_EXPORT_CSV_NAMES.weight,
  ]);

  const pdfResponse = await allGet(request("/api/export/all?format=pdf"));
  assert.equal(pdfResponse.status, 200);
  assert.match(pdfResponse.headers.get("content-disposition") ?? "", /calorie-vision-all\.pdf/);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(pdf.includes(Buffer.from("DejaVuSans")));
});

test("GET /api/export/all отклоняет неизвестный формат и ошибку загрузки", async () => {
  const bad = await allGet(request("/api/export/all?format=xlsx"));
  assert.equal(bad.status, 400);
  const payload = (await bad.json()) as { error?: string };
  assert.match(payload.error ?? "", /формат/);

  const { prisma } = await import("./prisma.ts");
  const original = prisma.mealEntry.findMany;
  prisma.mealEntry.findMany = (async () => {
    throw new Error("db down");
  }) as typeof prisma.mealEntry.findMany;
  try {
    const failed = await allGet(request("/api/export/all?format=csv"));
    assert.equal(failed.status, 500);
  } finally {
    prisma.mealEntry.findMany = original;
  }
});
