import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RUSTORE_URL, RUSTORE_PACKAGE_ID } from "./android-install.ts";
import {
  REVIEW_COOLDOWN_DAYS,
  REVIEW_MAX_SHOWS,
  REVIEW_MIN_SUCCESS_DAYS,
  RUSTORE_REVIEW_COPY,
  claimReviewPromptShow,
  disableReviewPrompt,
  emptyReviewPromptRecord,
  isAndroidAppShell,
  loadReviewPromptRecord,
  parseReviewPromptRecord,
  recordReviewShown,
  releaseReviewPromptClaim,
  resetReviewPromptForTests,
  rustoreReviewLinks,
  saveReviewPromptRecord,
  shouldShowReviewPrompt,
  type ReviewMoment,
} from "./rustore-review-prompt.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 11);

function ready(overrides: Partial<Parameters<typeof shouldShowReviewPrompt>[0]> = {}) {
  return shouldShowReviewPrompt({
    androidApp: true,
    authenticated: true,
    successDays: REVIEW_MIN_SUCCESS_DAYS,
    moment: "day-closed",
    foodEntryOpen: false,
    record: emptyReviewPromptRecord(),
    now: NOW,
    ...overrides,
  });
}

test("просьба об оценке только в Android, после 3-го дня и в хороший момент", () => {
  assert.equal(ready(), true);
  for (const moment of ["chest-opened", "badge-unlocked", "day-closed"] as ReviewMoment[]) {
    assert.equal(ready({ moment }), true, moment);
  }
  assert.equal(ready({ androidApp: false }), false);
  assert.equal(ready({ authenticated: false }), false);
  assert.equal(ready({ successDays: REVIEW_MIN_SUCCESS_DAYS - 1 }), false);
  assert.equal(ready({ moment: null }), false);
  assert.equal(ready({ foodEntryOpen: true }), false);
});

test("просьба не чаще раза в 30 дней и не больше трёх раз", () => {
  const once = recordReviewShown(emptyReviewPromptRecord(), NOW);
  assert.equal(ready({ record: once, now: NOW + 29 * DAY }), false);
  assert.equal(ready({ record: once, now: NOW + REVIEW_COOLDOWN_DAYS * DAY }), true);

  let record = emptyReviewPromptRecord();
  for (let i = 0; i < REVIEW_MAX_SHOWS; i += 1) {
    record = recordReviewShown(record, NOW + i * REVIEW_COOLDOWN_DAYS * DAY);
  }
  assert.equal(record.shownCount, 3);
  assert.equal(
    ready({ record, now: NOW + REVIEW_MAX_SHOWS * REVIEW_COOLDOWN_DAYS * DAY }),
    false,
  );
});

test("«Уже оценил» и «Не предлагать» отключают навсегда", () => {
  const disabled = disableReviewPrompt(recordReviewShown(emptyReviewPromptRecord(), NOW));
  assert.equal(
    ready({ record: disabled, now: NOW + 365 * DAY }),
    false,
  );
  assert.equal(ready({ record: { ...disabled, shownCount: 0, lastShownAt: null } }), false);
});

test("учёт показов пишется один раз и помнит отказ", () => {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { localStorage: Storage } }).window = {
    localStorage: memoryStorage(),
  };
  resetReviewPromptForTests();

  const first = claimReviewPromptShow(NOW, 3, "day-closed");
  const repeat = claimReviewPromptShow(NOW, 4, "chest-opened");
  assert.equal(first, 1);
  assert.equal(repeat, 1);
  assert.equal(loadReviewPromptRecord().shownCount, 1);

  releaseReviewPromptClaim();
  assert.equal(claimReviewPromptShow(NOW + 10 * DAY, 4, "badge-unlocked"), null);

  const second = claimReviewPromptShow(NOW + 31 * DAY, 5, "chest-opened");
  assert.equal(second, 2);
  releaseReviewPromptClaim();
  saveReviewPromptRecord(disableReviewPrompt(loadReviewPromptRecord()));
  releaseReviewPromptClaim();
  assert.equal(claimReviewPromptShow(NOW + 90 * DAY, 9, "day-closed"), null);
  assert.equal(loadReviewPromptRecord().disabled, true);

  resetReviewPromptForTests();
  (globalThis as { window?: unknown }).window = previous;
});

test("битая запись в хранилище не включает отказ и не раздувает счётчик", () => {
  assert.deepEqual(parseReviewPromptRecord("не json"), emptyReviewPromptRecord());
  assert.deepEqual(parseReviewPromptRecord(null), emptyReviewPromptRecord());
  assert.deepEqual(parseReviewPromptRecord(JSON.stringify({ disabled: true, shownCount: -3 })), {
    shownCount: 0,
    lastShownAt: null,
    disabled: true,
  });
  assert.equal(loadReviewPromptRecord().disabled, false);
});

test("текст не просит пять звёзд и не обещает награду", () => {
  const blob = Object.values(RUSTORE_REVIEW_COPY).join("\n");
  assert.match(blob, /Оценить в RuStore/);
  assert.match(blob, /Уже оценил/);
  assert.match(blob, /Не предлагать/);
  assert.match(blob, /Позже/);
  assert.doesNotMatch(blob, /звезд|звёзд|★★|5\s*зв/i);
  assert.doesNotMatch(blob, /наград/i);
});

test("ссылка на карточку RuStore — deep link и https из документации", () => {
  const links = rustoreReviewLinks();
  assert.equal(links.deepLink, `rustore://apps.rustore.ru/app/${RUSTORE_PACKAGE_ID}`);
  assert.equal(links.webUrl, DEFAULT_RUSTORE_URL);
  assert.equal(links.webUrl, "https://www.rustore.ru/catalog/app/ru.calorievision.app");
});

test("браузер без оболочки Android не считается приложением", () => {
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window: { localStorage: Storage; sessionStorage: Storage } }).window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
  };
  assert.equal(isAndroidAppShell(), false);
  (globalThis as {
    window: {
      localStorage: Storage;
      sessionStorage: Storage;
      CvSession: { get: () => null; set: () => void; remove: () => void };
    };
  }).window = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    CvSession: {
      get: () => null,
      set: () => undefined,
      remove: () => undefined,
    },
  };
  assert.equal(isAndroidAppShell(), true);
  (globalThis as { window?: unknown }).window = previous;
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}
