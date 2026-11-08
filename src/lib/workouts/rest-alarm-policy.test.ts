import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { chooseRestAlarmMode } from "./rest-alarm-policy.ts";
import { resolveRestForSet } from "./rest-timer.ts";
import { startRestNotification } from "./rest-notify.ts";

const SERVICE = join(
  process.cwd(),
  "android/app/src/main/java/ru/calorievision/app/CvRestTimerService.java",
);

test("Android 16 без права точных будильников не выбирает exact", () => {
  assert.equal(
    chooseRestAlarmMode({ sdkInt: 36, canScheduleExactAlarms: false }),
    "while-idle",
  );
  assert.equal(
    chooseRestAlarmMode({ sdkInt: 31, canScheduleExactAlarms: false }),
    "while-idle",
  );
});

test("точное право и старые SDK оставляют exact", () => {
  assert.equal(
    chooseRestAlarmMode({ sdkInt: 36, canScheduleExactAlarms: true }),
    "exact",
  );
  assert.equal(
    chooseRestAlarmMode({ sdkInt: 30, canScheduleExactAlarms: false }),
    "exact",
  );
});

test("повторный выбор режима стабилен", () => {
  const input = { sdkInt: 36, canScheduleExactAlarms: false };
  assert.equal(chooseRestAlarmMode(input), chooseRestAlarmMode(input));
});

test("смена рабочего подхода запускает отдых, разминка нет", () => {
  assert.ok(resolveRestForSet({ setType: "working", defaultSec: 90 }) > 0);
  assert.equal(resolveRestForSet({ setType: "warmup", defaultSec: 90 }), 0);
  assert.equal(
    resolveRestForSet({ setType: "working", exerciseName: "Жим", defaultSec: 90 }),
    90,
  );
});

test("сервис отдыха не бросает SecurityException из onStartCommand", () => {
  const java = readFileSync(SERVICE, "utf8");
  const start = java.indexOf("private void scheduleDone");
  const end = java.indexOf("private void cancelAlarm");
  assert.ok(start >= 0 && end > start);
  const method = java.slice(start, end);
  const guard = method.indexOf("canScheduleExactAlarms");
  const exact = method.indexOf("setExactAndAllowWhileIdle");
  const denied = method.indexOf("SecurityException");
  const fallback = method.indexOf("setAndAllowWhileIdle");
  assert.ok(method.includes("try"));
  assert.ok(guard >= 0 && exact > guard, "exact только после проверки права");
  assert.ok(denied > exact && fallback > denied, "отказ права ведёт на неточный будильник");
  assert.match(method, /catch \(Exception/);
});

afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test("повторный старт отдыха снова вызывает мост и не роняет вызов", async () => {
  const calls: number[] = [];
  globalThis.window = {
    CvRest: {
      start(endsAt: number) {
        calls.push(endsAt);
        return true;
      },
    },
  } as unknown as Window & typeof globalThis;

  assert.equal(await startRestNotification(1_700_000_000_000, "Отдых"), true);
  assert.equal(await startRestNotification(1_700_000_090_000, "Отдых"), true);
  assert.deepEqual(calls, [1_700_000_000_000, 1_700_000_090_000]);
});

test("исключение моста при смене подхода не пробрасывается в интерфейс", async () => {
  globalThis.window = {
    CvRest: {
      start() {
        throw new Error("native start failed");
      },
    },
  } as unknown as Window & typeof globalThis;

  assert.equal(await startRestNotification(1_700_000_000_000, "Отдых"), false);
});
