import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCapacitorNative, takeNativeFoodPhoto } from "./capacitor-bridge.ts";

describe("capacitor-bridge", () => {
  it("isCapacitorNative is false without window Capacitor", () => {
    assert.equal(isCapacitorNative(), false);
  });

  it("takeNativeFoodPhoto returns null on web", async () => {
    assert.equal(await takeNativeFoodPhoto(), null);
  });
});
