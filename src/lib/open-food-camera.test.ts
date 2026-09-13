import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  FOOD_SAVED_EVENT,
  OPEN_FOOD_ADD_EVENT,
  openFoodAdd,
  requestOpenFoodAddPicker,
  requestOpenFoodBarcode,
  requestOpenFoodCamera,
  requestOpenFoodText,
  requestOpenPendingConfirm,
} from "./open-food-camera.ts";

test("open food add / saved event names are stable", () => {
  assert.equal(OPEN_FOOD_ADD_EVENT, "cv-open-food-add");
  assert.equal(FOOD_SAVED_EVENT, "cv-food-saved");
});

afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

test("openFoodAdd dispatches detail; picker has no mode", () => {
  const captured: unknown[] = [];
  const listeners = new Map<string, Set<EventListener>>();

  globalThis.window = {
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      const set = listeners.get(event.type);
      if (set) {
        for (const listener of set) listener(event);
      }
      if (event.type === OPEN_FOOD_ADD_EVENT) {
        captured.push((event as CustomEvent).detail);
      }
      return true;
    },
  } as unknown as Window & typeof globalThis;

  openFoodAdd({});
  openFoodAdd({ mode: "photo", openCamera: true });
  requestOpenFoodAddPicker();
  requestOpenFoodCamera();
  requestOpenFoodText();
  requestOpenFoodBarcode();
  requestOpenPendingConfirm();

  assert.deepEqual(captured[0], {});
  assert.deepEqual(captured[1], { mode: "photo", openCamera: true });
  assert.deepEqual(captured[2], {});
  assert.deepEqual(captured[3], { mode: "photo", openCamera: true });
  assert.deepEqual(captured[4], { mode: "text" });
  assert.deepEqual(captured[5], { mode: "barcode" });
  assert.deepEqual(captured[6], { resumePending: true });
});
