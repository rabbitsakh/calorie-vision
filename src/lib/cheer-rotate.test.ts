import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLastRotatedCheerKey,
  pickRotatedCheerKey,
  resetCheerRotateForTests,
} from "./cheer-rotate.ts";

describe("pickRotatedCheerKey", () => {
  it("falls back to preferred when nothing owned", () => {
    resetCheerRotateForTests();
    assert.equal(pickRotatedCheerKey([], "cheer_steady"), "cheer_steady");
    assert.equal(pickRotatedCheerKey([]), null);
  });

  it("cycles through owned keys", () => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (k: string) => mem.get(k) ?? null,
          setItem: (k: string, v: string) => {
            mem.set(k, v);
          },
          removeItem: (k: string) => {
            mem.delete(k);
          },
        },
      },
      configurable: true,
    });
    resetCheerRotateForTests();

    const owned = ["cheer_steady", "cheer_week", "cheer_sip"];
    assert.equal(pickRotatedCheerKey(owned, "cheer_week"), "cheer_week");
    assert.equal(getLastRotatedCheerKey(), "cheer_week");
    assert.equal(pickRotatedCheerKey(owned, "cheer_week"), "cheer_steady");
    assert.equal(pickRotatedCheerKey(owned, "cheer_week"), "cheer_sip");
    assert.equal(pickRotatedCheerKey(owned, "cheer_week"), "cheer_week");

    resetCheerRotateForTests();
  });
});
