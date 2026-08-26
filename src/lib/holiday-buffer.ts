/** Optional one-day holiday calorie buffer (+12%) — localStorage only. */

export const HOLIDAY_BUFFER_KEY_PREFIX = "cv-holiday-buffer";
/** Soft bump applied to daily calorie target when buffer is on. */
export const HOLIDAY_BUFFER_FACTOR = 1.12;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function getStorage(): StorageLike | null {
  try {
    const root = globalThis as {
      window?: { localStorage?: StorageLike };
      localStorage?: StorageLike;
    };
    return root.window?.localStorage ?? root.localStorage ?? null;
  } catch {
    return null;
  }
}

export function holidayBufferKey(date: string): string {
  return `${HOLIDAY_BUFFER_KEY_PREFIX}:${date}`;
}

export function isHolidayBufferOn(date: string, storage?: StorageLike | null): boolean {
  const store = storage === undefined ? getStorage() : storage;
  if (!store || !date) return false;
  try {
    return store.getItem(holidayBufferKey(date)) === "1";
  } catch {
    return false;
  }
}

export function setHolidayBuffer(date: string, on: boolean, storage?: StorageLike | null): void {
  const store = storage === undefined ? getStorage() : storage;
  if (!store || !date) return;
  try {
    const key = holidayBufferKey(date);
    if (on) store.setItem(key, "1");
    else if (store.removeItem) store.removeItem(key);
    else store.setItem(key, "0");
  } catch {
    // quota / private mode
  }
}

export function applyHolidayBuffer(calories: number, on: boolean): number {
  if (!on || !Number.isFinite(calories) || calories <= 0) return calories;
  return Math.round(calories * HOLIDAY_BUFFER_FACTOR);
}
